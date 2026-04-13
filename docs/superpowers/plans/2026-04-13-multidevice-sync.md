# Multi-Device Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-blob Firebase sync with per-trip nodes, a clean `SyncService` abstraction, and a `useCloudSync` hook so multiple devices can edit independently without data loss.

**Architecture:** `SyncService` interface + `FirebaseSyncService` implementation live in `src/services/sync/`. All sync behavior (load on login, debounced save, real-time listener, merge dialog, remote-update toast) moves into `useCloudSync` hook. App.tsx imports only the hook and the factory — zero Firebase imports in the UI layer.

**Tech Stack:** Firebase Realtime Database (`firebase/database` — already installed), React hooks, Vitest + Testing Library

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/services/sync/types.ts` | `SyncService` interface, `SyncCallbacks`, `LoadResult`, `PendingMerge`, `SyncStatus` |
| Create | `src/services/sync/firebase.ts` | `FirebaseSyncService` — all Firebase DB operations |
| Create | `src/services/sync/index.ts` | `createSyncService()` factory |
| Create | `src/hooks/useCloudSync.ts` | All sync behavior as a React hook |
| Modify | `src/App.tsx` | Remove inline sync logic; consume `useCloudSync`; add remote-update toast |
| Modify | `src/firebase.ts` | Remove `saveUserTripStore` / `loadUserTripStore` (replaced by service) |

---

## Task 1: Define SyncService types

**Files:**
- Create: `src/services/sync/types.ts`

- [ ] **Step 1: Create the types file**

```ts
// src/services/sync/types.ts
import type { HybridTrip } from '@/domain/types';

export type SyncStatus = 'local' | 'saving' | 'saved' | 'error';

export interface LoadResult {
  trips: HybridTrip[];
  activeTripId: string;
  /** 'cloud' = data came from Firebase. 'empty' = no cloud data existed (first login). */
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

export interface PendingMerge {
  /** Cloud-only trips (not in local) — used to build the merge result. */
  cloudTrips: HybridTrip[];
  /** Full cloud store — used when user picks "use cloud only". */
  allCloudTrips: HybridTrip[];
  cloudActiveTripId: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/sync/types.ts
git commit -m "feat(sync): add SyncService interface and types"
```

---

## Task 2: Implement FirebaseSyncService — loadTrips + legacy migration

**Files:**
- Create: `src/services/sync/firebase.ts`

> **Context:** Firebase DB structure being introduced:
> - `users/{uid}/trips/{tripId}` — full HybridTrip per trip
> - `users/{uid}/activeTripId` — string
> - `users/{uid}/tripStore` — legacy blob (read once then deleted during migration)
>
> Helpers already in `src/firebase.ts` that this file reuses: `getDb`, `sanitizeForFirebase`, `restoreArrays`.
> Migration helpers already in `src/domain/migration.ts`: `normalizeTrip`, `needsMigrationToV2`, `migrateV1toV2`.

- [ ] **Step 1: Create firebase.ts with loadTrips and private migration helper**

```ts
// src/services/sync/firebase.ts
import { trackError } from '@/services/telemetry';
import { normalizeTrip, needsMigrationToV2, migrateV1toV2 } from '@/domain/migration';
import type { HybridTrip, TripStore, V1HybridTrip } from '@/domain/types';
import { getDb, sanitizeForFirebase, restoreArrays } from '@/firebase';
import type { LoadResult, SyncCallbacks, SyncService, Unsubscribe } from './types';

function normalizeAndMigrate(raw: unknown): HybridTrip {
  const normalized = normalizeTrip(raw as HybridTrip);
  return needsMigrationToV2(normalized)
    ? migrateV1toV2(normalized as unknown as V1HybridTrip)
    : normalized;
}

export class FirebaseSyncService implements SyncService {
  async loadTrips(uid: string): Promise<LoadResult> {
    try {
      const { ref, get, child } = await import('firebase/database');
      const db = await getDb();
      const dbRef = ref(db);

      // Check for per-trip nodes (already migrated)
      const tripsSnapshot = await get(child(dbRef, `users/${uid}/trips`));
      if (tripsSnapshot.exists()) {
        const raw = restoreArrays(tripsSnapshot.val()) as Record<string, unknown>;
        const trips = Object.values(raw).map(normalizeAndMigrate);
        const activeSnap = await get(child(dbRef, `users/${uid}/activeTripId`));
        const activeTripId = activeSnap.exists()
          ? String(activeSnap.val())
          : (trips[0]?.id ?? '');
        return { trips, activeTripId, source: 'cloud' };
      }

      // Check for legacy blob and migrate
      const legacySnap = await get(child(dbRef, `users/${uid}/tripStore`));
      if (legacySnap.exists()) {
        return this._migrateLegacyBlob(uid, legacySnap.val());
      }

      return { trips: [], activeTripId: '', source: 'empty' };
    } catch (error) {
      trackError('sync_load_failed', error, { uid });
      throw error;
    }
  }

  private async _migrateLegacyBlob(uid: string, raw: unknown): Promise<LoadResult> {
    const { ref, set, remove } = await import('firebase/database');
    const db = await getDb();

    const blob = raw as Partial<TripStore>;
    const trips = (blob.trips ?? []).map(normalizeAndMigrate);
    const activeTripId = blob.activeTripId ?? trips[0]?.id ?? '';

    // Write each trip to its own node (idempotent — safe to retry)
    await Promise.all(
      trips.map((trip) =>
        set(ref(db, `users/${uid}/trips/${trip.id}`), sanitizeForFirebase(trip)),
      ),
    );
    await set(ref(db, `users/${uid}/activeTripId`), activeTripId);

    // Only delete legacy blob after all writes succeed
    await remove(ref(db, `users/${uid}/tripStore`));

    return { trips, activeTripId, source: 'cloud' };
  }

  async saveTrip(_uid: string, _trip: HybridTrip): Promise<void> {
    throw new Error('Not implemented');
  }

  async deleteTrip(_uid: string, _tripId: string): Promise<void> {
    throw new Error('Not implemented');
  }

  async saveActiveTripId(_uid: string, _id: string): Promise<void> {
    throw new Error('Not implemented');
  }

  subscribe(_uid: string, _callbacks: SyncCallbacks): Unsubscribe {
    throw new Error('Not implemented');
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/sync/firebase.ts
git commit -m "feat(sync): add FirebaseSyncService with loadTrips and legacy migration"
```

---

## Task 3: Implement FirebaseSyncService — saveTrip (with updatedAt gate), deleteTrip, saveActiveTripId

**Files:**
- Modify: `src/services/sync/firebase.ts`

> **Context:** `saveTrip` must not overwrite a trip in Firebase if the cloud version has a newer `updatedAt`. This protects against Device B overwriting Device A's recent edit when Device B syncs its stale copy.

- [ ] **Step 1: Write the failing test**

Create `src/services/sync/__tests__/firebaseSyncService.test.ts`:

```ts
// src/services/sync/__tests__/firebaseSyncService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// We test the updatedAt-gate logic in isolation by mocking firebase/database
vi.mock('firebase/database', () => ({
  ref: vi.fn((db, path) => ({ path })),
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('@/firebase', () => ({
  getDb: vi.fn().mockResolvedValue({}),
  sanitizeForFirebase: (x: unknown) => x,
  restoreArrays: (x: unknown) => x,
}));

import * as firebaseDb from 'firebase/database';
import { FirebaseSyncService } from '../firebase';
import type { HybridTrip } from '@/domain/types';

function makeTrip(id: string, updatedAt: number): HybridTrip {
  return {
    id,
    name: 'Test',
    startDate: '2025-01-01',
    totalDays: 3,
    version: 2,
    updatedAt,
    createdAt: updatedAt,
    stays: [],
    visits: [],
    routes: [],
  };
}

describe('FirebaseSyncService.saveTrip', () => {
  const service = new FirebaseSyncService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('saves trip when cloud has no updatedAt (first save)', async () => {
    vi.mocked(firebaseDb.get).mockResolvedValue({
      exists: () => true,
      val: () => ({ id: 'trip-1', name: 'Test', updatedAt: undefined }),
    } as any);

    const trip = makeTrip('trip-1', 1000);
    await service.saveTrip('uid-1', trip);

    expect(firebaseDb.set).toHaveBeenCalledOnce();
  });

  it('saves trip when local updatedAt is newer than cloud', async () => {
    vi.mocked(firebaseDb.get).mockResolvedValue({
      exists: () => true,
      val: () => ({ id: 'trip-1', updatedAt: 500 }),
    } as any);

    const trip = makeTrip('trip-1', 1000);
    await service.saveTrip('uid-1', trip);

    expect(firebaseDb.set).toHaveBeenCalledOnce();
  });

  it('skips save when cloud updatedAt is newer than local', async () => {
    vi.mocked(firebaseDb.get).mockResolvedValue({
      exists: () => true,
      val: () => ({ id: 'trip-1', updatedAt: 9999 }),
    } as any);

    const trip = makeTrip('trip-1', 1000);
    await service.saveTrip('uid-1', trip);

    expect(firebaseDb.set).not.toHaveBeenCalled();
  });

  it('saves trip when cloud node does not exist yet', async () => {
    vi.mocked(firebaseDb.get).mockResolvedValue({
      exists: () => false,
      val: () => null,
    } as any);

    const trip = makeTrip('trip-1', 1000);
    await service.saveTrip('uid-1', trip);

    expect(firebaseDb.set).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/services/sync/__tests__/firebaseSyncService.test.ts
```

Expected: FAIL — `saveTrip` throws `'Not implemented'`

- [ ] **Step 3: Implement saveTrip, deleteTrip, saveActiveTripId**

Replace the three stub methods in `src/services/sync/firebase.ts`:

```ts
async saveTrip(uid: string, trip: HybridTrip): Promise<void> {
  try {
    const { ref, get, set } = await import('firebase/database');
    const db = await getDb();
    const tripRef = ref(db, `users/${uid}/trips/${trip.id}`);

    const snapshot = await get(tripRef);
    if (snapshot.exists()) {
      const cloud = snapshot.val() as { updatedAt?: number };
      const cloudUpdatedAt = cloud.updatedAt ?? 0;
      const localUpdatedAt = trip.updatedAt ?? 0;
      if (localUpdatedAt < cloudUpdatedAt) return; // cloud is newer — don't overwrite
    }

    await set(tripRef, sanitizeForFirebase(trip));
  } catch (error) {
    trackError('sync_save_trip_failed', error, { uid, tripId: trip.id });
    throw error;
  }
}

async deleteTrip(uid: string, tripId: string): Promise<void> {
  try {
    const { ref, remove } = await import('firebase/database');
    const db = await getDb();
    await remove(ref(db, `users/${uid}/trips/${tripId}`));
  } catch (error) {
    trackError('sync_delete_trip_failed', error, { uid, tripId });
    throw error;
  }
}

async saveActiveTripId(uid: string, id: string): Promise<void> {
  try {
    const { ref, set } = await import('firebase/database');
    const db = await getDb();
    await set(ref(db, `users/${uid}/activeTripId`), id);
  } catch (error) {
    trackError('sync_save_active_trip_id_failed', error, { uid });
    // Non-critical — don't rethrow
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/services/sync/__tests__/firebaseSyncService.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/services/sync/firebase.ts src/services/sync/__tests__/firebaseSyncService.test.ts
git commit -m "feat(sync): implement saveTrip with updatedAt gate, deleteTrip, saveActiveTripId"
```

---

## Task 4: Implement FirebaseSyncService — subscribe (real-time listener)

**Files:**
- Modify: `src/services/sync/firebase.ts`

> **Context:** Firebase `onValue` fires immediately with current data AND on every subsequent change. The hook guards against own-echoes (changes we pushed ourselves) using a `lastPushedAtRef`. This method just calls the callbacks — it does not need to know about echoes.

- [ ] **Step 1: Replace the subscribe stub in `src/services/sync/firebase.ts`**

```ts
subscribe(uid: string, callbacks: SyncCallbacks): Unsubscribe {
  let unsubFns: Array<() => void> = [];
  let cancelled = false;

  (async () => {
    try {
      const [{ ref, onValue }, db] = await Promise.all([
        import('firebase/database'),
        getDb(),
      ]);

      if (cancelled) return;

      // Listen to per-trip nodes
      const tripsRef = ref(db, `users/${uid}/trips`);
      const unsubTrips = onValue(
        tripsRef,
        (snapshot) => {
          if (!snapshot.exists()) return;
          const raw = restoreArrays(snapshot.val()) as Record<string, unknown>;
          Object.values(raw).forEach((t) => {
            callbacks.onTripUpdated(normalizeAndMigrate(t));
          });
        },
        (error) => callbacks.onError(error.message),
      );

      // Listen to activeTripId
      const activeRef = ref(db, `users/${uid}/activeTripId`);
      const unsubActive = onValue(activeRef, (snapshot) => {
        if (snapshot.exists()) {
          callbacks.onActiveTripIdChanged(String(snapshot.val()));
        }
      });

      unsubFns = [unsubTrips, unsubActive];
    } catch (error) {
      callbacks.onError(error instanceof Error ? error.message : 'Sync listener failed');
    }
  })();

  return () => {
    cancelled = true;
    unsubFns.forEach((fn) => fn());
  };
}
```

- [ ] **Step 2: Run full test suite to confirm nothing broken**

```bash
npx vitest run
```

Expected: all existing tests pass

- [ ] **Step 3: Commit**

```bash
git add src/services/sync/firebase.ts
git commit -m "feat(sync): implement real-time subscribe listener in FirebaseSyncService"
```

---

## Task 5: Create sync service factory

**Files:**
- Create: `src/services/sync/index.ts`

- [ ] **Step 1: Create the factory**

```ts
// src/services/sync/index.ts
import { FirebaseSyncService } from './firebase';
import type { SyncService } from './types';

export { type SyncService, type SyncCallbacks, type LoadResult, type PendingMerge, type SyncStatus } from './types';

let instance: SyncService | null = null;

/** Returns a shared SyncService instance (singleton per app session). */
export function createSyncService(): SyncService {
  if (!instance) {
    instance = new FirebaseSyncService();
  }
  return instance;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/sync/index.ts
git commit -m "feat(sync): add createSyncService factory"
```

---

## Task 6: Implement useCloudSync hook

**Files:**
- Create: `src/hooks/useCloudSync.ts`

> **Context:** This hook replaces the two inline `useEffect` sync blocks in App.tsx (~lines 344–426) plus `handleMergeDecision` (~lines 711–733), `syncedUidRef`, `pendingMerge`, `syncError`, and `syncStatus` state.
>
> Key design decisions:
> - `lastPushedRef`: `Record<tripId, HybridTrip>` — tracks the store trip reference that was last pushed. When `store.trips` changes, trips whose reference differs from `lastPushedRef[id]` are the changed ones. After pushing, updates `lastPushedRef[id]` to the current store reference (not the stamped copy) so future mutations are detected correctly.
> - `lastPushedAtRef`: `Record<tripId, number>` — tracks `updatedAt` values we assigned at push time. Used in `onTripUpdated` to ignore our own Firebase echoes.
> - `hasPendingSaveRef`: boolean — true while debounce timer is running. Used to skip `onActiveTripIdChanged` from the listener when local changes are in flight.
> - The hook stamps `updatedAt = Date.now()` on changed trips at save time (it does NOT update the store with these timestamps — the store's in-memory trips keep their pre-save state until next mutation).

- [ ] **Step 1: Write the failing test**

Create `src/hooks/__tests__/useCloudSync.test.ts`:

```ts
// src/hooks/__tests__/useCloudSync.test.ts
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCloudSync } from '../useCloudSync';
import type { SyncService, SyncCallbacks } from '@/services/sync/types';
import type { TripStore, HybridTrip } from '@/domain/types';

function makeTrip(id: string, updatedAt = 1000): HybridTrip {
  return {
    id, name: `Trip ${id}`, startDate: '2025-01-01', totalDays: 3,
    version: 2, updatedAt, createdAt: updatedAt, stays: [], visits: [], routes: [],
  };
}

function makeMockService(overrides: Partial<SyncService> = {}): SyncService {
  return {
    loadTrips: vi.fn().mockResolvedValue({ trips: [], activeTripId: '', source: 'empty' }),
    saveTrip: vi.fn().mockResolvedValue(undefined),
    deleteTrip: vi.fn().mockResolvedValue(undefined),
    saveActiveTripId: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockReturnValue(() => {}),
    ...overrides,
  };
}

const EMPTY_STORE: TripStore = { trips: [], activeTripId: '' };

describe('useCloudSync', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('does not load trips when user is null', () => {
    const service = makeMockService();
    const setStore = vi.fn();
    renderHook(() => useCloudSync(service, EMPTY_STORE, setStore, null));
    expect(service.loadTrips).not.toHaveBeenCalled();
  });

  it('loads trips on login and pulls cloud when local is empty', async () => {
    const cloudTrip = makeTrip('cloud-1');
    const service = makeMockService({
      loadTrips: vi.fn().mockResolvedValue({
        trips: [cloudTrip], activeTripId: 'cloud-1', source: 'cloud',
      }),
    });
    const setStore = vi.fn();
    const user = { uid: 'user-1' } as any;

    renderHook(() => useCloudSync(service, EMPTY_STORE, setStore, user));

    await waitFor(() => expect(setStore).toHaveBeenCalled());
    const updater = setStore.mock.calls[0][0];
    const next = updater(EMPTY_STORE);
    expect(next.trips).toEqual([cloudTrip]);
    expect(next.activeTripId).toBe('cloud-1');
  });

  it('sets pendingMerge when both sides have unique trips', async () => {
    const localTrip = makeTrip('local-1');
    const cloudTrip = makeTrip('cloud-1');
    const store: TripStore = { trips: [localTrip], activeTripId: 'local-1' };
    const service = makeMockService({
      loadTrips: vi.fn().mockResolvedValue({
        trips: [cloudTrip], activeTripId: 'cloud-1', source: 'cloud',
      }),
    });
    const setStore = vi.fn();
    const user = { uid: 'user-1' } as any;

    const { result } = renderHook(() => useCloudSync(service, store, setStore, user));

    await waitFor(() => expect(result.current.pendingMerge).not.toBeNull());
    expect(result.current.pendingMerge?.allCloudTrips).toEqual([cloudTrip]);
    expect(result.current.pendingMerge?.cloudTrips).toEqual([cloudTrip]);
  });

  it('does not auto-save when store.trips is empty', async () => {
    const service = makeMockService();
    const setStore = vi.fn();
    const user = { uid: 'user-1' } as any;

    renderHook(() => useCloudSync(service, EMPTY_STORE, setStore, user));

    await act(() => { vi.advanceTimersByTime(3000); });
    expect(service.saveTrip).not.toHaveBeenCalled();
  });

  it('auto-saves changed trips after 2s debounce', async () => {
    const trip = makeTrip('trip-1');
    const store: TripStore = { trips: [trip], activeTripId: 'trip-1' };
    const service = makeMockService({
      loadTrips: vi.fn().mockResolvedValue({ trips: [], activeTripId: '', source: 'empty' }),
    });
    const setStore = vi.fn();
    const user = { uid: 'user-1' } as any;

    renderHook(() => useCloudSync(service, store, setStore, user));

    await act(() => { vi.advanceTimersByTime(3000); });
    expect(service.saveTrip).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/hooks/__tests__/useCloudSync.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement useCloudSync**

Create `src/hooks/useCloudSync.ts`:

```ts
// src/hooks/useCloudSync.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { User } from 'firebase/auth';
import { saveStore } from '@/lib/persistence';
import type { HybridTrip, TripStore } from '@/domain/types';
import type { PendingMerge, SyncService, SyncStatus } from '@/services/sync/types';

export interface UseCloudSyncResult {
  syncStatus: SyncStatus;
  syncError: string | null;
  setSyncError: (e: string | null) => void;
  pendingMerge: PendingMerge | null;
  handleMergeDecision: (decision: 'merge' | 'keep-local' | 'use-cloud') => void;
  dismissMerge: () => void;
  remoteUpdateToast: { tripName: string } | null;
  dismissRemoteToast: () => void;
}

export function useCloudSync(
  service: SyncService,
  store: TripStore,
  setStore: Dispatch<SetStateAction<TripStore>>,
  user: User | null,
): UseCloudSyncResult {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [pendingMerge, setPendingMerge] = useState<PendingMerge | null>(null);
  const [remoteUpdateToast, setRemoteUpdateToast] = useState<{ tripName: string } | null>(null);

  // Track which session we've loaded for (prevent double-load per uid)
  const syncedUidRef = useRef<string | null>(null);

  // Snapshot of store for use inside async closures
  const storeRef = useRef(store);
  useEffect(() => { storeRef.current = store; });

  // Trip references from last successful push — used to detect changed trips
  const lastPushedRef = useRef<Record<string, HybridTrip>>({});

  // updatedAt values we assigned at push time — used to ignore own Firebase echoes
  const lastPushedAtRef = useRef<Record<string, number>>({});

  // True while debounce timer is active — guards activeTripId listener
  const hasPendingSaveRef = useRef(false);

  // Track current active trip id for remote update toast decision
  const activeTripIdRef = useRef(store.activeTripId);
  useEffect(() => { activeTripIdRef.current = store.activeTripId; });

  // ── Load on login ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) {
      setSyncStatus('local');
      setSyncError(null);
      setPendingMerge(null);
      setRemoteUpdateToast(null);
      syncedUidRef.current = null;
      lastPushedRef.current = {};
      lastPushedAtRef.current = {};
      return;
    }

    if (syncedUidRef.current === user.uid) return;
    syncedUidRef.current = user.uid;

    (async () => {
      try {
        const result = await service.loadTrips(user.uid);
        const currentStore = storeRef.current;

        if (result.source === 'empty') {
          // First login — upload local trips to cloud
          await Promise.all(
            currentStore.trips.map((t) => service.saveTrip(user.uid, t)),
          );
          if (currentStore.activeTripId) {
            await service.saveActiveTripId(user.uid, currentStore.activeTripId);
          }
          return;
        }

        const cloudTrips = result.trips;
        const localIds = new Set(currentStore.trips.map((t) => t.id));
        const cloudOnlyTrips = cloudTrips.filter((t) => !localIds.has(t.id));

        if (cloudOnlyTrips.length === 0) {
          // All cloud trips already in local — push local state up
          if (currentStore.trips.length > 0) {
            await Promise.all(currentStore.trips.map((t) => service.saveTrip(user.uid, t)));
          }
          return;
        }

        if (currentStore.trips.length === 0) {
          // No local trips — pull cloud silently
          const next: TripStore = {
            trips: cloudTrips,
            activeTripId: result.activeTripId || cloudTrips[0]?.id ?? '',
          };
          setStore(() => next);
          saveStore(next);
          return;
        }

        // Both sides have unique trips — ask the user
        setPendingMerge({
          cloudTrips: cloudOnlyTrips,
          allCloudTrips: cloudTrips,
          cloudActiveTripId: result.activeTripId,
        });
      } catch {
        setSyncError('Could not load your trips from the cloud. Your local trips are safe.');
      }
    })();
  }, [user, service, setStore]);

  // ── Real-time listener ────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const unsubscribe = service.subscribe(user.uid, {
      onTripUpdated: (trip) => {
        // Ignore our own echoes
        const lastAt = lastPushedAtRef.current[trip.id];
        if (lastAt !== undefined && trip.updatedAt !== undefined && trip.updatedAt <= lastAt) {
          return;
        }

        if (trip.id === activeTripIdRef.current) {
          // Currently viewing this trip — notify user instead of silently overwriting
          setRemoteUpdateToast({ tripName: trip.name });
          return;
        }

        setStore((prev) => {
          const idx = prev.trips.findIndex((t) => t.id === trip.id);
          if (idx === -1) {
            return { ...prev, trips: [...prev.trips, trip] };
          }
          // Only apply if remote is strictly newer
          if ((trip.updatedAt ?? 0) <= (prev.trips[idx].updatedAt ?? 0)) return prev;
          const trips = [...prev.trips];
          trips[idx] = trip;
          return { ...prev, trips };
        });
      },

      onTripDeleted: (tripId) => {
        setStore((prev) => ({
          ...prev,
          trips: prev.trips.filter((t) => t.id !== tripId),
          activeTripId:
            prev.activeTripId === tripId ? (prev.trips[0]?.id ?? '') : prev.activeTripId,
        }));
      },

      onActiveTripIdChanged: (id) => {
        // Don't switch while local changes are pending
        if (hasPendingSaveRef.current) return;
        setStore((prev) => {
          if (prev.activeTripId === id) return prev;
          return { ...prev, activeTripId: id };
        });
      },

      onError: (message) => {
        setSyncError(message);
      },
    });

    return unsubscribe;
  }, [user, service, setStore]);

  // ── Auto-save on trips change ─────────────────────────────────────────────
  useEffect(() => {
    if (!user || store.trips.length === 0 || pendingMerge) {
      if (!user) setSyncStatus('local');
      return;
    }

    // Find trips whose reference changed since last push
    const changedTrips = store.trips.filter((t) => lastPushedRef.current[t.id] !== t);
    if (changedTrips.length === 0) return;

    setSyncStatus('saving');
    hasPendingSaveRef.current = true;

    const timer = setTimeout(async () => {
      try {
        const now = Date.now();
        // Stamp updatedAt at save time (only on the copy we send to Firebase)
        const stamped = changedTrips.map((t) => ({ ...t, updatedAt: now }));

        await Promise.all(stamped.map((t) => service.saveTrip(user.uid, t)));

        // Track the updatedAt values we sent (for echo guard)
        stamped.forEach((t) => {
          lastPushedAtRef.current[t.id] = now;
        });
        // Track store references (for next change detection)
        store.trips.forEach((t) => {
          lastPushedRef.current[t.id] = t;
        });

        setSyncStatus('saved');
      } catch {
        setSyncStatus('error');
      } finally {
        hasPendingSaveRef.current = false;
      }
    }, 2000);

    return () => {
      clearTimeout(timer);
      hasPendingSaveRef.current = false;
    };
  }, [store.trips, user, pendingMerge, service]);

  // ── Save activeTripId on change ───────────────────────────────────────────
  useEffect(() => {
    if (!user || !store.activeTripId) return;
    service.saveActiveTripId(user.uid, store.activeTripId);
    // Non-critical — errors swallowed inside saveActiveTripId
  }, [store.activeTripId, user, service]);

  // ── Merge decision ────────────────────────────────────────────────────────
  const handleMergeDecision = useCallback(
    (decision: 'merge' | 'keep-local' | 'use-cloud') => {
      if (!pendingMerge || !user) {
        setPendingMerge(null);
        return;
      }

      const { cloudTrips, allCloudTrips, cloudActiveTripId } = pendingMerge;
      const currentStore = storeRef.current;
      let next: TripStore;

      if (decision === 'merge') {
        const merged = [...currentStore.trips, ...cloudTrips];
        next = { trips: merged, activeTripId: currentStore.activeTripId || (merged[0]?.id ?? '') };
      } else if (decision === 'keep-local') {
        next = currentStore;
      } else {
        next = {
          trips: allCloudTrips,
          activeTripId: cloudActiveTripId || (allCloudTrips[0]?.id ?? ''),
        };
      }

      setPendingMerge(null);
      setStore(() => next);
      saveStore(next);

      Promise.all(next.trips.map((t) => service.saveTrip(user.uid, t))).catch(() => {
        setSyncError('Could not sync your decision to the cloud. Changes saved locally.');
      });
    },
    [pendingMerge, user, service, setStore],
  );

  return {
    syncStatus,
    syncError,
    setSyncError,
    pendingMerge,
    handleMergeDecision,
    dismissMerge: useCallback(() => setPendingMerge(null), []),
    remoteUpdateToast,
    dismissRemoteToast: useCallback(() => setRemoteUpdateToast(null), []),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/hooks/__tests__/useCloudSync.test.ts
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useCloudSync.ts src/hooks/__tests__/useCloudSync.test.ts
git commit -m "feat(sync): implement useCloudSync hook"
```

---

## Task 7: Wire useCloudSync into App.tsx

**Files:**
- Modify: `src/App.tsx`

> **Context:** This task removes all inline sync logic from App.tsx and wires the hook. Lines to remove:
> - `pendingMerge` useState (~line 133–136)
> - `syncError` useState (~line 139)
> - `syncedUidRef` useRef (~line 140)
> - The cloud-load useEffect (~lines 344–397)
> - `syncStatus` useState and auto-save useEffect (~lines 408–426)
> - `handleMergeDecision` function (~lines 711–733)
> - In `handleSignOut`: `setPendingMerge(null)`, `setSyncError(null)`, `syncedUidRef.current = null` (hook resets on user→null)
>
> `PendingMerge` type currently inline in App.tsx moves to `@/services/sync/types` (already defined in Task 1).
>
> Also add the remote update toast render near the MergeDialog block (~line 3084).

- [ ] **Step 1: Update imports in App.tsx**

Remove from imports:
```ts
import { saveUserTripStore, loadUserTripStore } from './firebase';
import { normalizeTrip, migrateV1toV2, needsMigrationToV2 } from './domain/migration';
// Remove V1HybridTrip from domain/types import
```

Add:
```ts
import { useMemo } from 'react'; // add to existing React import if not present
import { useCloudSync } from './hooks/useCloudSync';
import { createSyncService } from './services/sync';
```

- [ ] **Step 2: Replace inline sync state and effects with hook**

Remove these lines from `ChronosApp()`:
```ts
// DELETE these lines:
const [pendingMerge, setPendingMerge] = useState<{ ... } | null>(null);
const [syncError, setSyncError] = useState<string | null>(null);
const syncedUidRef = useRef<string | null>(null);
const [syncStatus, setSyncStatus] = useState<...>('local');

// DELETE the cloud-load useEffect (the one with user?.uid dep)
// DELETE the auto-save useEffect (the one with store.trips dep)
// DELETE the activeTripId save useEffect (the one with store.activeTripId dep)
// DELETE handleMergeDecision function
```

Add after `const { user } = useAuth();`:
```ts
const syncService = useMemo(() => createSyncService(), []);
const {
  syncStatus,
  syncError,
  setSyncError,
  pendingMerge,
  handleMergeDecision,
  dismissMerge,
  remoteUpdateToast,
  dismissRemoteToast,
} = useCloudSync(syncService, store, setStore, user);
```

- [ ] **Step 3: Update handleSignOut**

Remove these three lines from `handleSignOut`:
```ts
// DELETE:
setPendingMerge(null);
setSyncError(null);
syncedUidRef.current = null;
```
The hook resets itself when `user` becomes null.

- [ ] **Step 4: Update MergeDialog render and add remote-update toast**

Replace the existing MergeDialog block (~line 3097) with:
```tsx
{pendingMerge && (
  <MergeDialog
    localCount={store.trips.length}
    cloudCount={pendingMerge.allCloudTrips.length}
    mergeCount={store.trips.length + pendingMerge.cloudTrips.length}
    localTripNames={store.trips.map((t) => t.name)}
    cloudTripNames={pendingMerge.allCloudTrips.map((t) => t.name)}
    onMerge={() => handleMergeDecision('merge')}
    onKeepLocal={() => handleMergeDecision('keep-local')}
    onUseCloud={() => handleMergeDecision('use-cloud')}
    onDismiss={dismissMerge}
  />
)}

{remoteUpdateToast && (
  <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-popover border border-border rounded-xl shadow-lg px-4 py-3 text-sm">
    <span className="text-foreground">
      <strong>"{remoteUpdateToast.tripName}"</strong> was updated on another device.
    </span>
    <button
      onClick={dismissRemoteToast}
      className="text-muted-foreground hover:text-foreground text-xs font-medium"
    >
      Dismiss
    </button>
  </div>
)}
```

- [ ] **Step 5: Run build**

```bash
npm run build
```

Expected: no TypeScript errors, build succeeds

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat(sync): wire useCloudSync into App.tsx, add remote-update toast"
```

---

## Task 8: Remove deprecated firebase.ts functions

**Files:**
- Modify: `src/firebase.ts`

> **Context:** `saveUserTripStore` and `loadUserTripStore` are now replaced by `FirebaseSyncService`. Remove them to avoid confusion. Check nothing else imports them first.

- [ ] **Step 1: Verify no remaining imports**

```bash
grep -r "saveUserTripStore\|loadUserTripStore" src/
```

Expected: no matches (only definition in `firebase.ts`)

- [ ] **Step 2: Remove the two functions from src/firebase.ts**

Delete `saveUserTripStore` (lines ~137–150) and `loadUserTripStore` (lines ~152–170) from `src/firebase.ts`.

Also export `getDb`, `sanitizeForFirebase`, `restoreArrays` if not already exported (they're needed by `FirebaseSyncService`):

```ts
// Ensure these are exported (not just local):
export { getDb, sanitizeForFirebase, restoreArrays };
```

- [ ] **Step 3: Run full test suite and build**

```bash
npx vitest run && npm run build
```

Expected: all tests pass, build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/firebase.ts
git commit -m "refactor(sync): remove deprecated saveUserTripStore/loadUserTripStore"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Per-trip Firebase nodes: Task 2 (loadTrips), Task 3 (saveTrip/delete), Task 4 (subscribe)
- ✅ Migration from legacy blob: Task 2 (`_migrateLegacyBlob`)
- ✅ `updatedAt` gate: Task 3 (saveTrip implementation + tests)
- ✅ Real-time listener: Task 4 (subscribe)
- ✅ Echo guard: Task 6 (`lastPushedAtRef` in onTripUpdated)
- ✅ Remote-update toast for active trip: Task 6 (onTripUpdated) + Task 7 (render)
- ✅ SyncService abstraction: Tasks 1, 5
- ✅ No Firebase in App.tsx: Task 7 removes all Firebase imports
- ✅ `activeTripId` as separate node: Task 3, Task 6 (saveActiveTripId effect)
- ✅ Backward compat: Task 2 (migration check in loadTrips)
- ✅ Sign-out cleanup: Task 7 (handleSignOut simplified, hook self-resets on user→null)
- ✅ Error handling: all methods use try/catch + telemetry, hook surfaces syncError

**Placeholder scan:** None found.

**Type consistency check:**
- `PendingMerge` defined in `types.ts` Task 1, used in `useCloudSync` Task 6 and `App.tsx` Task 7 ✅
- `SyncStatus` defined in `types.ts` Task 1, returned by hook Task 6, consumed in App.tsx Task 7 ✅
- `LoadResult.source: 'cloud' | 'empty'` — used correctly in Task 6 load logic ✅
- `normalizeAndMigrate` defined as module-private in `firebase.ts` Task 2, used in Tasks 3 and 4 ✅
- `getDb`, `sanitizeForFirebase`, `restoreArrays` imported from `@/firebase` in `firebase.ts` — Task 8 ensures they're exported ✅
