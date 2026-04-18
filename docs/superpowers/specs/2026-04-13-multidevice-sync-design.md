# Multi-Device Sync — Design Spec

**Date:** 2026-04-13  
**Status:** Approved

## Problem

The app uses Firebase Realtime Database for cloud sync but saves all trips as a single blob (`users/{uid}/tripStore`). This means:

- Any change (including switching the active trip) uploads the entire store
- Multiple devices editing different trips simultaneously cause last-write-wins data loss at the store level — one device's save silently overwrites another's
- All sync logic is inline in `App.tsx` with direct Firebase imports — untestable and hard to swap

## Goals

- Per-trip independent saves so devices don't stomp on each other
- Real-time: changes on Device A appear on Device B while both are open
- Clean service abstraction: UI never imports Firebase directly
- Backward compat: existing `users/{uid}/tripStore` data migrated transparently

## Non-Goals

- Field-level / CRDT merging within a single trip
- Offline-first with local queue (Firebase SDK handles reconnection)
- Multi-user collaboration (single owner per account)

---

## Firebase Data Structure

```
users/{uid}/trips/{tripId}     ← full HybridTrip (sanitized, arrays restored)
users/{uid}/activeTripId       ← string
users/{uid}/tripStore          ← legacy blob (read-once on migration, then deleted)
```

Each trip is an independent node. `activeTripId` is a separate lightweight node — switching trips writes only this field, not any trip data.

**Conflict tiebreak:** `updatedAt` on each `HybridTrip`. A write to `users/{uid}/trips/{tripId}` only proceeds if `localTrip.updatedAt >= cloudTrip.updatedAt`. Checked client-side before writing (transactions not needed — simultaneous same-trip edits are rare).

---

## Architecture

### File layout

```
src/services/sync/
  types.ts          ← SyncService interface + SyncCallbacks + result types
  firebase.ts       ← FirebaseSyncService implements SyncService
  index.ts          ← createSyncService() factory (the only export App needs)

src/hooks/
  useCloudSync.ts   ← all sync behavior as a React hook
```

App.tsx imports only `useCloudSync` and `createSyncService`. No Firebase in the UI layer.

### `SyncService` interface (`src/services/sync/types.ts`)

```ts
export interface LoadResult {
  trips: HybridTrip[];
  activeTripId: string;
  source: 'cloud' | 'empty';
}

export type Unsubscribe = () => void;

export interface SyncCallbacks {
  onTripUpdated: (trip: HybridTrip) => void;
  onTripDeleted: (tripId: string) => void;
  onActiveTripIdChanged: (id: string) => void;
  onError: (message: string) => void;
}

export interface SyncService {
  loadTrips(uid: string): Promise<LoadResult>;
  saveTrip(uid: string, trip: HybridTrip): Promise<void>;
  deleteTrip(uid: string, tripId: string): Promise<void>;
  saveActiveTripId(uid: string, id: string): Promise<void>;
  subscribe(uid: string, callbacks: SyncCallbacks): Unsubscribe;
}
```

### `FirebaseSyncService` (`src/services/sync/firebase.ts`)

Implements `SyncService` using Firebase Realtime Database.

- `loadTrips`: reads `users/{uid}/trips/*`, normalizes + migrates each trip (V1→V2 if needed). Also checks for legacy `users/{uid}/tripStore` blob and triggers migration if `trips/` doesn't exist yet.
- `saveTrip`: reads current `users/{uid}/trips/{tripId}`, compares `updatedAt`, writes only if local is newer or equal.
- `saveActiveTripId`: simple `set` on `users/{uid}/activeTripId`.
- `subscribe`: attaches `onValue` listener to `users/{uid}/trips` and `users/{uid}/activeTripId`. Returns unsubscribe function.

### `useCloudSync` hook (`src/hooks/useCloudSync.ts`)

```ts
function useCloudSync(
  service: SyncService,
  store: TripStore,
  setStore: (updater: (s: TripStore) => TripStore) => void,
  user: User | null,
): {
  syncStatus: 'local' | 'saving' | 'saved' | 'error';
  pendingMerge: PendingMerge | null;
  remoteUpdateToast: { tripName: string } | null;
  dismissRemoteToast: () => void;
  setPendingMerge: (m: PendingMerge | null) => void;
};
```

**Responsibilities:**

1. **On login** (`user` changes): call `service.loadTrips`, run merge logic (same as current: no local trips → pull cloud silently; both sides have unique trips → set `pendingMerge`).

2. **Auto-save** (`store.trips` changes, debounced 2s): for each trip, compare `updatedAt` against `lastPushedAt` ref. Only call `service.saveTrip` for trips that changed. Skip if `store.trips.length === 0`.

3. **Active trip sync** (`store.activeTripId` changes): call `service.saveActiveTripId` immediately (no debounce).

4. **Real-time listener**: after login, call `service.subscribe`. Callbacks:
   - `onTripUpdated`: if trip is currently active → set `remoteUpdateToast`; else silently merge into store. Guard against own-echo by comparing `updatedAt` against `lastPushedAt` ref.
   - `onTripDeleted`: remove trip from store.
   - `onActiveTripIdChanged`: update `store.activeTripId` if no local unsaved changes on current trip.
   - `onError`: set `syncStatus: 'error'`.

5. **On logout** (`user` → null): call unsubscribe, clear all state.

### App.tsx integration

Replace the existing inline sync `useEffect` blocks and `pendingMerge` state with:

```tsx
const syncService = useMemo(() => createSyncService(), []);

const { syncStatus, pendingMerge, remoteUpdateToast, dismissRemoteToast, setPendingMerge } =
  useCloudSync(syncService, store, setStore, user);
```

App.tsx renders the remote update toast:

```tsx
{
  remoteUpdateToast && (
    <Toast>
      "{remoteUpdateToast.tripName}" was updated on another device.
      <Button onClick={dismissRemoteToast}>Dismiss</Button>
    </Toast>
  );
}
```

No Firebase imports remain in App.tsx.

---

## Migration (legacy blob → per-trip nodes)

Runs inside `FirebaseSyncService.loadTrips` on first call per session:

1. Check if `users/{uid}/trips` exists → already migrated, skip.
2. Check if `users/{uid}/tripStore` exists → old format:
   a. Read blob.
   b. Write each trip to `users/{uid}/trips/{tripId}` (idempotent).
   c. Write `users/{uid}/activeTripId`.
   d. Only after all writes succeed: delete `users/{uid}/tripStore`.
3. Neither exists → first login, upload local trips.

If migration fails mid-way, next login retries safely (write idempotency). The blob deletion is the last step.

---

## Error Handling

| Scenario                    | Behaviour                                                                        |
| --------------------------- | -------------------------------------------------------------------------------- |
| Save fails                  | Retry once after 3s, then `syncStatus: 'error'`. Local state safe.               |
| Load fails on login         | Fall back to local store, show `syncError` banner.                               |
| Migration fails mid-way     | Safe retry on next login. Blob only deleted after all writes succeed.            |
| No `updatedAt` on trip      | Treat as `0` — cloud wins. Trip gets timestamp after first save.                 |
| Own-echo from listener      | Guard via `lastPushedAt` ref. If incoming `updatedAt` matches last push, ignore. |
| Listener active at sign-out | `useCloudSync` cleanup calls `unsubscribe()`.                                    |
| Offline / tab hidden        | Firebase SDK handles reconnection. Debounce fires on reconnect.                  |

---

## Design Principles (apply going forward)

- **UI never imports storage/network layers directly.** All data access goes through service interfaces.
- **Hooks own behavior, components own rendering.** Complex async logic lives in hooks, not components.
- **Interfaces before implementations.** Define the contract (`types.ts`) before writing Firebase code. Swap by changing the factory in `index.ts`.
