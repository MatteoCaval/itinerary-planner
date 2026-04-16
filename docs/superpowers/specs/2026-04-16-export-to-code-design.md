# Export to Code — Share Trips via Firebase Share Codes

**Date:** 2026-04-16
**Status:** Approved
**Approach:** Firebase Realtime DB (reuse existing `saveItinerary`/`loadItinerary` infrastructure)

## Summary

Re-introduce the ability to share a trip via a short code stored in Firebase Realtime DB. The creator generates a code, shares it out-of-band (text, email, etc.), and anyone with the code can import the trip. Importers can also pull latest updates when the creator (or anyone, in writable mode) pushes changes.

## Data Model

### Firebase Node (`itineraries/{code}`)

```typescript
{
  trip: HybridTrip,              // full trip snapshot
  createdAt: number,             // timestamp of first share
  updatedAt: number,             // timestamp of last push
  ownerUid: string,              // Firebase Auth UID of creator
  mode: 'readonly' | 'writable', // creator sets this
  lastUpdatedBy?: string,        // UID if logged in, null if anonymous push
}
```

### HybridTrip Additions

```typescript
// Added to HybridTrip (all optional, no migration needed):
shareCode?: string;           // active share code (owner side)
sourceShareCode?: string;     // origin code (importer side)
importedAt?: number;          // when imported
```

These fields sync to user's cloud storage (`users/{uid}/trips/{tripId}`) — intentional, so share state is available across devices for logged-in users.

## Permissions

| Action | Auth required? |
|--------|---------------|
| Create share code | Yes |
| Update (readonly mode) | Yes (owner only) |
| Update (writable mode) | No |
| Revoke/delete | Yes (owner only) |
| Import | No |

**Future TODO:** Require auth for writable pushes to prevent abuse. For now, open write is an accepted risk.

## Share Code Format

- **Charset:** `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (29 chars, no ambiguous O/0/I/1/L)
- **Format:** `TRIP-XXXXXX` (6 random chars, ~580M combinations)
- **Collision handling:** Check existence before saving. Max 3 retries, then extend to 7 chars.
- **One active code per trip.** To get a new code, revoke the old one first.

## UI Flows

### Flow 1: Share a Trip (Export)

1. User clicks "Share trip" in ProfileMenu dropdown
2. Not logged in? -> Auth modal -> after login, resume share flow
3. Trip already has active `shareCode`? -> Show management view (existing code, copy, update, revoke, toggle mode)
4. No active code -> Dialog with:
   - Mode picker: "Read only" (default) / "Anyone can update"
   - Brief explanation of each mode
   - "Generate share code" button
5. Code generated -> display `TRIP-XXXXXX` prominently with copy-to-clipboard
6. Success toast

### Flow 2: Update a Shared Trip (Owner)

1. Owner makes local changes, opens share dialog
2. Dialog shows existing code + "Last shared: [relative time]"
3. "Push update" button -> overwrites Firebase node with current trip state
4. For writable mode non-owners: push triggered from top bar indicator

### Flow 3: Pull Latest (Importer Side)

1. Trip has `sourceShareCode` -> top bar shows subtle indicator (link icon)
2. App checks remote `updatedAt` vs local `importedAt` on trip load (not polling)
3. Update available -> top bar indicator becomes more prominent (dot badge or color change)
4. User clicks -> prompt:
   - "Save copy & update" -> duplicates trip as "[Name] (before update)", then overwrites with remote
   - "Update without saving" -> overwrites directly
   - "Cancel"
5. After update: `importedAt` refreshed

### Flow 4: Revoke

1. Owner opens share dialog for trip with active code
2. "Revoke" button with confirmation: "This will permanently disable the share code. Anyone who has it won't be able to import or pull updates."
3. Confirmed -> delete Firebase node, clear `shareCode` from local trip

### Flow 5: Writable Push (Non-Owner)

1. User imported a writable trip
2. Top bar shows indicator: linked + writable
3. Push changes via button in top bar
4. Last-write-wins via `updatedAt`

### Top Bar Indicators

| Trip state | Top bar indicator |
|-----------|-------------------|
| Has active share code (owner) | Share icon + code displayed |
| Imported, no updates available | Subtle link icon |
| Imported, update available | Link icon with badge/highlight |
| Imported + writable | Link icon + "push" affordance |

## Firebase Changes

### Modified Functions

- **`saveItinerary(code, data)`** — update to wrap trip data with metadata (`ownerUid`, `mode`, `createdAt`, `updatedAt`, `lastUpdatedBy`) instead of saving raw trip

### New Functions

- **`checkShareCodeExists(code)`** — lightweight existence check for collision detection
- **`deleteShareCode(code)`** — remove node (revoke)
- **`getShareCodeMeta(code)`** — fetch `updatedAt`, `mode` (lightweight check for "update available?" and permission)

### Existing (minor changes)

- **`loadItinerary(code)`** — update to detect and handle both formats: new wrapped structure (`{trip, ownerUid, mode, ...}`) and legacy raw trip data (for backward compatibility with codes created before this feature). Detection: check for presence of `ownerUid` field.

### Security Rules

Current state: open read/write on `itineraries/*`. No changes needed for initial implementation.

**Future TODO:** Tighten rules to:
- Enforce `ownerUid` match for writes on readonly codes
- Require auth for writable code pushes
- Rate limit code generation

## Firebase Console Changes Required

The following changes need to be made manually in the Firebase Console:

1. **Security rules** — verify `itineraries` path has read/write open (likely already the case)
2. No new indexes or configuration needed for Realtime DB
3. No Cloud Functions required

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Share code revoked, importer tries to pull | "This share code is no longer available" — clear `sourceShareCode`, remove indicator |
| Firebase unreachable | Toast error, no state change, retry possible |
| Trip imported then deleted locally | No effect on Firebase node |
| Owner pushes update, importer has local changes | Importer sees "update available" on next load. Local changes preserved until explicit pull |
| Simultaneous writable pushes | Last-write-wins via `updatedAt` |
| User shares same trip twice | Return existing code, don't generate new |
| User wants new code for same trip | Revoke old first, then generate new |
| Import own trip (round-trip) | Treated as new independent copy |
| Node deleted outside app (Firebase console) | Same as revoke — "no longer available" for importer, owner can generate new code |
| Code input with lowercase/spaces | Normalize: trim, uppercase (already handled in ImportFromCodeDialog) |

## Future Improvements

- Require auth for writable pushes (currently open — accepted risk)
- Firebase security rules enforcement for `ownerUid` on readonly codes
- Rate limiting on code generation
- Share code analytics (import count)
- Expiration/TTL support
