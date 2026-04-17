# Destination Inbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a trip-level "candidate destinations" inbox so users can save stays without committing them to the timeline, and freely promote/demote stays between the timeline and that inbox.

**Architecture:** Introduce a second array `candidateStays: Stay[]` on `HybridTrip`. Pure domain mutations (`promoteCandidateStay`, `demoteStay`) handle state transitions. UI surfaces: overview-sidebar shows candidates (instead of per-stay visits when no stay is selected), `StayEditorModal` gains a "Move to inbox" action, `AddStayModal` grows a "Pick from inbox" chip row, and the overview map renders candidate pins with a ghost style.

**Tech Stack:** TypeScript, React 18, Vite, Tailwind v4, Vitest + Testing Library, Firebase Realtime Database.

**Spec:** `docs/superpowers/specs/2026-04-17-destination-inbox-design.md`

---

## File Structure

**Create:**
- `src/components/modals/__tests__/AddStayModal.test.tsx` — UI tests for chip picker + candidate mode

**Modify:**
- `src/domain/types.ts` — add `candidateStays` to `HybridTrip`
- `src/domain/migration.ts` — add `migrateV2toV3`, update `normalizeTrip`, export `needsMigrationToV3`
- `src/domain/__tests__/migration.test.ts` — tests for v3 migration + normalize
- `src/domain/tripMutations.ts` — add `promoteCandidateStay`, `demoteStay`
- `src/domain/__tests__/tripMutations.test.ts` — tests
- `src/lib/persistence.ts` — chain v3 migration in loader
- `src/services/sync/firebase.ts` — chain v3 migration in `normalizeAndMigrate`
- `src/domain/sampleData.ts` — bump to v3, add `candidateStays: []`
- `src/components/modals/StayEditorModal.tsx` — add `onDemote` prop + "Move to inbox" button
- `src/components/modals/AddStayModal.tsx` — add `candidates`, `mode`, `initialCandidate` props + chip row + conditional date stepper + dual save paths
- `src/components/TripMap/StayOverviewLayer.tsx` — render `candidateStays` as ghost markers
- `src/components/TripMap/index.tsx` — accept + pass `candidateStays` prop
- `src/App.tsx` — wire overview inbox sidebar, `+` button dispatch, demote handler, promote handler, candidate selection state
- `docs/PRD.md` — document feature + status
- `docs/IMPROVEMENTS.md` — mark related items done

---

## Task 1: Add `candidateStays` to `HybridTrip` type

**Files:**
- Modify: `src/domain/types.ts:60-74`

- [ ] **Step 1: Update the type**

```ts
export type HybridTrip = {
  id: string;
  name: string;
  startDate: string;
  totalDays: number;
  version?: number;
  createdAt?: number;
  updatedAt?: number;
  stays: Stay[];
  candidateStays: Stay[];
  visits: VisitItem[];
  routes: Route[];
  shareCode?: string;
  sourceShareCode?: string;
  importedAt?: number;
};
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: many errors about `candidateStays` missing in call sites — ignore for now; later tasks fix them via migration/normalization defaults. Do NOT fix each site manually.

- [ ] **Step 3: Commit**

```bash
git add src/domain/types.ts
git commit -m "feat(types): add candidateStays array to HybridTrip"
```

---

## Task 2: v2→v3 migration + failing test

**Files:**
- Modify: `src/domain/__tests__/migration.test.ts`
- Modify: `src/domain/migration.ts`

- [ ] **Step 1: Add failing test for `migrateV2toV3`**

Append inside `describe('normalizeTrip', ...)` or add a new `describe('migrateV2toV3', ...)`:

```ts
describe('migrateV2toV3', () => {
  it('adds empty candidateStays array and bumps version to 3', () => {
    const v2Trip = {
      id: 'trip-1',
      name: 'Japan',
      startDate: '2026-05-01',
      totalDays: 10,
      version: 2,
      stays: [],
      visits: [],
      routes: [],
    } as unknown as HybridTrip;

    const result = migrateV2toV3(v2Trip);

    expect(result.version).toBe(3);
    expect(result.candidateStays).toEqual([]);
  });

  it('preserves existing trip data', () => {
    const v2Trip = {
      id: 'trip-1',
      name: 'Japan',
      startDate: '2026-05-01',
      totalDays: 10,
      version: 2,
      stays: [{ id: 'stay-1', name: 'Tokyo' }],
      visits: [{ id: 'v1', stayId: 'stay-1' }],
      routes: [],
    } as unknown as HybridTrip;

    const result = migrateV2toV3(v2Trip);

    expect(result.stays).toHaveLength(1);
    expect(result.visits).toHaveLength(1);
  });
});
```

Update the top import:

```ts
import { migrateV1toV2, migrateV2toV3, normalizeTrip } from '../migration';
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/__tests__/migration.test.ts`
Expected: FAIL — `migrateV2toV3 is not a function` / `is not defined`

- [ ] **Step 3: Implement `migrateV2toV3` + `needsMigrationToV3`**

Add below `migrateV1toV2` in `src/domain/migration.ts`:

```ts
export function migrateV2toV3(old: HybridTrip): HybridTrip {
  return {
    ...old,
    version: 3,
    candidateStays: (old as unknown as { candidateStays?: Stay[] }).candidateStays ?? [],
  };
}

export function needsMigrationToV3(trip: unknown): boolean {
  const t = trip as Record<string, unknown>;
  return (t.version ?? 0) < 3;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run src/domain/__tests__/migration.test.ts`
Expected: PASS (all 14 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/migration.ts src/domain/__tests__/migration.test.ts
git commit -m "feat(migration): add v2 to v3 migration for candidateStays"
```

---

## Task 3: `normalizeTrip` coerces `candidateStays`

**Files:**
- Modify: `src/domain/__tests__/migration.test.ts`
- Modify: `src/domain/migration.ts:373-393`

- [ ] **Step 1: Add failing test**

Inside `describe('normalizeTrip', ...)`:

```ts
it('coerces missing candidateStays to empty array (Firebase empty-array strip)', () => {
  const tripMissingCandidates = {
    id: 'trip-1',
    name: 'Japan',
    startDate: '2026-05-01',
    totalDays: 10,
    version: 3,
    stays: [],
    visits: [],
    routes: [],
    // candidateStays key absent — Firebase strips empty arrays
  } as unknown as HybridTrip;

  const result = normalizeTrip(tripMissingCandidates);
  expect(result.candidateStays).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/__tests__/migration.test.ts`
Expected: FAIL — `expected undefined to equal []`

- [ ] **Step 3: Update `normalizeTrip`**

In `src/domain/migration.ts`, inside the `normalizeTrip` return object, add the coercion next to the existing `stays` coercion:

```ts
export function normalizeTrip(raw: HybridTrip): HybridTrip {
  return {
    ...raw,
    stays: (raw.stays ?? []).map((s) => ({
      ...s,
      nightAccommodations: s.nightAccommodations ?? undefined,
      checklist: s.checklist ?? undefined,
      notes: s.notes ?? undefined,
      links: s.links ?? undefined,
    })),
    candidateStays: (raw.candidateStays ?? []).map((s) => ({
      ...s,
      nightAccommodations: s.nightAccommodations ?? undefined,
      checklist: s.checklist ?? undefined,
      notes: s.notes ?? undefined,
      links: s.links ?? undefined,
    })),
    visits: (raw.visits ?? []).map((v) => ({
      ...v,
      dayOffset: v.dayOffset ?? null,
      dayPart: v.dayPart ?? null,
      checklist: v.checklist ?? undefined,
      links: v.links ?? undefined,
    })),
    routes: raw.routes ?? [],
    version: raw.version ?? undefined,
    createdAt: raw.createdAt ?? undefined,
    updatedAt: raw.updatedAt ?? undefined,
  };
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run src/domain/__tests__/migration.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/migration.ts src/domain/__tests__/migration.test.ts
git commit -m "feat(migration): normalizeTrip coerces missing candidateStays to []"
```

---

## Task 4: Chain v3 migration into persistence + Firebase loaders

**Files:**
- Modify: `src/lib/persistence.ts`
- Modify: `src/services/sync/firebase.ts:7-12`

- [ ] **Step 1: Update `src/lib/persistence.ts` load path**

Find the import block at the top and update:

```ts
import {
  migrateV1toV2,
  migrateV2toV3,
  needsMigrationToV2,
  needsMigrationToV3,
  normalizeTrip,
  legacyTripToHybrid,
  hybridTripToLegacy,
} from '@/domain/migration';
```

Find the v2-native load block (starts `// 1. Try v2 native format`) and replace the `trips` mapping so it runs both migrations and normalization, in order:

```ts
trips: parsed.trips.map((t) => {
  let migrated = normalizeTrip(t);
  if (needsMigrationToV2(migrated)) {
    migrated = migrateV1toV2(migrated as unknown as V1HybridTrip);
  }
  if (needsMigrationToV3(migrated)) {
    migrated = migrateV2toV3(migrated);
  }
  return migrated;
}),
```

- [ ] **Step 2: Update `src/services/sync/firebase.ts`**

Replace the helper at the top:

```ts
import { trackError } from '@/services/telemetry';
import {
  normalizeTrip,
  needsMigrationToV2,
  migrateV1toV2,
  needsMigrationToV3,
  migrateV2toV3,
} from '@/domain/migration';
import type { HybridTrip, TripStore, V1HybridTrip } from '@/domain/types';
import { getDb, sanitizeForFirebase, restoreArrays } from '@/firebase';
import type { LoadResult, SyncCallbacks, SyncService, Unsubscribe } from './types';

function normalizeAndMigrate(raw: unknown): HybridTrip {
  let trip = normalizeTrip(raw as HybridTrip);
  if (needsMigrationToV2(trip)) {
    trip = migrateV1toV2(trip as unknown as V1HybridTrip);
  }
  if (needsMigrationToV3(trip)) {
    trip = migrateV2toV3(trip);
  }
  return trip;
}
```

- [ ] **Step 3: Run full test suite**

Run: `npm run test`
Expected: all tests pass. (If the existing `firebaseSyncService.test.ts` tests pass a v1 or v2 sample, they now come out as v3 — that's correct.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/persistence.ts src/services/sync/firebase.ts
git commit -m "feat(sync): chain v2 to v3 migration in persistence and firebase loaders"
```

---

## Task 5: Update sample data to v3

**Files:**
- Modify: `src/domain/sampleData.ts:10`

- [ ] **Step 1: Update sample trip**

Change `version: 2,` to `version: 3,` and add `candidateStays: [],` next to `stays:` in the returned trip object.

- [ ] **Step 2: Run full suite**

Run: `npm run test`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add src/domain/sampleData.ts
git commit -m "feat(sample): bump sample trip to v3 with empty candidateStays"
```

---

## Task 6: Domain mutations — `promoteCandidateStay` + `demoteStay`

**Files:**
- Modify: `src/domain/__tests__/tripMutations.test.ts`
- Modify: `src/domain/tripMutations.ts`

- [ ] **Step 1: Write failing tests**

Append to `src/domain/__tests__/tripMutations.test.ts`:

```ts
import { promoteCandidateStay, demoteStay } from '../tripMutations';

describe('demoteStay', () => {
  const baseTrip: HybridTrip = {
    id: 'trip',
    name: 'Trip',
    startDate: '2026-05-01',
    totalDays: 10,
    version: 3,
    stays: [
      { id: 's1', name: 'Tokyo', color: '#111', startSlot: 0, endSlot: 9, centerLat: 35.68, centerLng: 139.77 },
      { id: 's2', name: 'Kyoto', color: '#222', startSlot: 9, endSlot: 18, centerLat: 35.01, centerLng: 135.77 },
    ],
    candidateStays: [],
    visits: [
      { id: 'v1', stayId: 's1', name: 'Sensoji', type: 'landmark', lat: 35.71, lng: 139.79, dayOffset: 0, dayPart: 'morning', order: 0 },
      { id: 'v2', stayId: 's1', name: 'Wishlist', type: 'food', lat: 35.69, lng: 139.7, dayOffset: null, dayPart: null, order: 0 },
      { id: 'v3', stayId: 's2', name: 'Fushimi Inari', type: 'landmark', lat: 34.97, lng: 135.77, dayOffset: 0, dayPart: 'morning', order: 0 },
    ],
    routes: [
      { fromStayId: 's1', toStayId: 's2', mode: 'train' },
    ],
  };

  it('moves the stay from stays to candidateStays', () => {
    const result = demoteStay(baseTrip, 's1');
    expect(result.stays.map((s) => s.id)).toEqual(['s2']);
    expect(result.candidateStays.map((s) => s.id)).toEqual(['s1']);
  });

  it('unschedules all visits belonging to the demoted stay', () => {
    const result = demoteStay(baseTrip, 's1');
    const s1Visits = result.visits.filter((v) => v.stayId === 's1');
    expect(s1Visits).toHaveLength(2);
    s1Visits.forEach((v) => {
      expect(v.dayOffset).toBeNull();
      expect(v.dayPart).toBeNull();
    });
    // Other stay's visits unchanged
    const s2Visit = result.visits.find((v) => v.id === 'v3')!;
    expect(s2Visit.dayOffset).toBe(0);
    expect(s2Visit.dayPart).toBe('morning');
  });

  it('drops routes referencing the demoted stay', () => {
    const result = demoteStay(baseTrip, 's1');
    expect(result.routes).toEqual([]);
  });

  it('returns trip unchanged when stayId not found', () => {
    const result = demoteStay(baseTrip, 'nope');
    expect(result).toEqual(baseTrip);
  });
});

describe('promoteCandidateStay', () => {
  const tripWithCandidate: HybridTrip = {
    id: 'trip',
    name: 'Trip',
    startDate: '2026-05-01',
    totalDays: 10,
    version: 3,
    stays: [
      { id: 's1', name: 'Tokyo', color: '#111', startSlot: 0, endSlot: 9, centerLat: 35.68, centerLng: 139.77 },
    ],
    candidateStays: [
      { id: 'c1', name: 'Kyoto', color: '#222', startSlot: 0, endSlot: 0, centerLat: 35.01, centerLng: 135.77 },
    ],
    visits: [
      { id: 'v-attached', stayId: 'c1', name: 'Fushimi Inari', type: 'landmark', lat: 34.97, lng: 135.77, dayOffset: null, dayPart: null, order: 0 },
    ],
    routes: [],
  };

  it('moves the candidate from candidateStays to stays with new startSlot/endSlot', () => {
    const result = promoteCandidateStay(tripWithCandidate, 'c1', 9, 18);
    expect(result.candidateStays).toEqual([]);
    expect(result.stays.map((s) => s.id)).toEqual(['s1', 'c1']);
    const promoted = result.stays.find((s) => s.id === 'c1')!;
    expect(promoted.startSlot).toBe(9);
    expect(promoted.endSlot).toBe(18);
  });

  it('preserves attached visits (stayId unchanged)', () => {
    const result = promoteCandidateStay(tripWithCandidate, 'c1', 9, 18);
    const attached = result.visits.find((v) => v.id === 'v-attached')!;
    expect(attached.stayId).toBe('c1');
  });

  it('returns trip unchanged when candidateId not found', () => {
    const result = promoteCandidateStay(tripWithCandidate, 'nope', 0, 3);
    expect(result).toEqual(tripWithCandidate);
  });
});
```

Update the existing import at top of file to include `HybridTrip` if not already there.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/domain/__tests__/tripMutations.test.ts`
Expected: FAIL — `promoteCandidateStay is not a function`, `demoteStay is not a function`.

- [ ] **Step 3: Implement `demoteStay`**

Append to `src/domain/tripMutations.ts`:

```ts
export function demoteStay(trip: HybridTrip, stayId: string): HybridTrip {
  const stay = trip.stays.find((s) => s.id === stayId);
  if (!stay) return trip;

  return {
    ...trip,
    stays: trip.stays.filter((s) => s.id !== stayId),
    candidateStays: [...trip.candidateStays, stay],
    visits: trip.visits.map((v) =>
      v.stayId === stayId ? { ...v, dayOffset: null, dayPart: null } : v,
    ),
    routes: trip.routes.filter(
      (r) => r.fromStayId !== stayId && r.toStayId !== stayId,
    ),
  };
}

export function promoteCandidateStay(
  trip: HybridTrip,
  candidateId: string,
  startSlot: number,
  endSlot: number,
): HybridTrip {
  const candidate = trip.candidateStays.find((s) => s.id === candidateId);
  if (!candidate) return trip;

  return {
    ...trip,
    candidateStays: trip.candidateStays.filter((s) => s.id !== candidateId),
    stays: [...trip.stays, { ...candidate, startSlot, endSlot }],
  };
}
```

Ensure `HybridTrip` is imported at the top of `src/domain/tripMutations.ts` (it almost certainly is — check).

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run src/domain/__tests__/tripMutations.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/tripMutations.ts src/domain/__tests__/tripMutations.test.ts
git commit -m "feat(domain): add promoteCandidateStay and demoteStay mutations"
```

---

## Task 7: `StayEditorModal` — Move-to-inbox button

**Files:**
- Modify: `src/components/modals/StayEditorModal.tsx`

- [ ] **Step 1: Extend props + add button**

Replace the component signature + action bar:

```tsx
import { useState } from 'react';
import { Trash2, Inbox } from 'lucide-react';
// ...existing imports

function StayEditorModal({
  stay,
  onClose,
  onSave,
  onDelete,
  onDemote,
  visitCount = 0,
}: {
  stay: Stay;
  onClose: () => void;
  onSave: (updates: Partial<Stay>) => void;
  onDelete: () => void;
  onDemote?: () => void;
  visitCount?: number;
}) {
  const [name, setName] = useState(stay.name);
  const [color, setColor] = useState(stay.color);
  const [confirmingDemote, setConfirmingDemote] = useState(false);
  // ...rest unchanged
```

In the action bar JSX (below the Delete AlertDialog, before the Cancel button), insert:

```tsx
{onDemote && (
  <AlertDialog open={confirmingDemote} onOpenChange={setConfirmingDemote}>
    <AlertDialogTrigger asChild>
      <Button variant="outline" size="sm">
        <Inbox data-icon="inline-start" className="w-3.5 h-3.5" /> Move to Inbox
      </Button>
    </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Move &ldquo;{stay.name}&rdquo; to inbox?</AlertDialogTitle>
        <AlertDialogDescription>
          The destination moves out of the timeline. Its {visitCount}{' '}
          scheduled {visitCount === 1 ? 'place' : 'places'} will be unscheduled
          but kept in the stay's own inbox.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction
          onClick={() => {
            onDemote();
            onClose();
          }}
        >
          Move to Inbox
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
)}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: only unrelated pre-existing errors. The modal file should not emit new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/modals/StayEditorModal.tsx
git commit -m "feat(stay-editor): add Move to Inbox action"
```

---

## Task 8: `AddStayModal` — pick-from-inbox chip row + candidate mode

**Files:**
- Modify: `src/components/modals/AddStayModal.tsx`
- Create: `src/components/modals/__tests__/AddStayModal.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/modals/__tests__/AddStayModal.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AddStayModal from '../AddStayModal';
import type { Stay } from '@/domain/types';

const kyoto: Stay = {
  id: 'c1',
  name: 'Kyoto',
  color: '#615cf6',
  startSlot: 0,
  endSlot: 0,
  centerLat: 35.01,
  centerLng: 135.77,
};

describe('AddStayModal — pick from inbox', () => {
  it('hides the chip row when candidates is empty', () => {
    render(
      <AddStayModal
        onClose={() => {}}
        onSave={() => {}}
        stayColor="#111"
        candidates={[]}
      />,
    );
    expect(screen.queryByText(/From inbox/i)).toBeNull();
  });

  it('shows candidate chips and pre-fills name on click', () => {
    render(
      <AddStayModal
        onClose={() => {}}
        onSave={() => {}}
        stayColor="#111"
        candidates={[kyoto]}
      />,
    );
    expect(screen.getByText(/From inbox/i)).toBeInTheDocument();
    const chip = screen.getByRole('button', { name: /Kyoto/i });
    fireEvent.click(chip);
    const nameInput = screen.getByPlaceholderText(/Tokyo, Kyoto, Paris/i) as HTMLInputElement;
    expect(nameInput.value).toBe('Kyoto');
  });

  it('calls onSavePromote with candidateId when a chip is selected and saved', () => {
    const onSavePromote = vi.fn();
    render(
      <AddStayModal
        onClose={() => {}}
        onSave={() => {}}
        onSavePromote={onSavePromote}
        stayColor="#111"
        candidates={[kyoto]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Kyoto/i }));
    fireEvent.click(screen.getByRole('button', { name: /Add to Timeline/i }));
    expect(onSavePromote).toHaveBeenCalledTimes(1);
    expect(onSavePromote.mock.calls[0][0]).toMatchObject({ candidateId: 'c1' });
  });
});

describe('AddStayModal — candidate mode', () => {
  it('hides the date stepper when mode is candidate', () => {
    render(
      <AddStayModal
        onClose={() => {}}
        onSave={() => {}}
        stayColor="#111"
        mode="candidate"
      />,
    );
    expect(screen.queryByText(/Duration/i)).toBeNull();
  });

  it('save button reads "Save to Inbox" in candidate mode', () => {
    render(
      <AddStayModal
        onClose={() => {}}
        onSave={() => {}}
        stayColor="#111"
        mode="candidate"
      />,
    );
    expect(screen.getByRole('button', { name: /Save to Inbox/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/modals/__tests__/AddStayModal.test.tsx`
Expected: FAIL — props unknown, text not found.

- [ ] **Step 3: Update `AddStayModal`**

Replace the component signature, body header, and action bar. Keep the search/LocationPicker block unchanged. Full replacement for the file:

```tsx
import { useState, useEffect } from 'react';
import { Search, MapPin, Check, X } from 'lucide-react';
import ModalBase from '@/components/ui/ModalBase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { searchPlace, PlaceSearchResult } from '@/utils/geocoding';
import { LocationPicker } from '@/components/ui/LocationPicker';
import type { Stay } from '@/domain/types';

type AddStayMode = 'schedule' | 'candidate';

type SavePayload = {
  name: string;
  days: number;
  lat?: number;
  lng?: number;
};

type PromotePayload = SavePayload & { candidateId: string };

type CandidatePayload = { name: string; lat?: number; lng?: number };

function AddStayModal({
  onClose,
  onSave,
  onSavePromote,
  onSaveCandidate,
  stayColor,
  initialDays,
  existingStayCoords,
  candidates,
  initialCandidateId,
  mode = 'schedule',
}: {
  onClose: () => void;
  stayColor: string;
  initialDays?: number;
  onSave: (data: SavePayload) => void;
  onSavePromote?: (data: PromotePayload) => void;
  onSaveCandidate?: (data: CandidatePayload) => void;
  existingStayCoords?: { lat: number; lng: number }[];
  candidates?: Stay[];
  initialCandidateId?: string;
  mode?: AddStayMode;
}) {
  const initialCandidate = candidates?.find((c) => c.id === initialCandidateId) ?? null;

  const [name, setName] = useState(initialCandidate?.name ?? '');
  const [days, setDays] = useState(initialDays ?? 3);
  const [searchResults, setSearchResults] = useState<PlaceSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [pickedCoords, setPickedCoords] = useState<{ lat: number; lng: number } | null>(
    initialCandidate ? { lat: initialCandidate.centerLat, lng: initialCandidate.centerLng } : null,
  );
  const [showResults, setShowResults] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [searchStale, setSearchStale] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(
    initialCandidate?.id ?? null,
  );

  const fitBounds: [number, number][] | undefined =
    existingStayCoords && existingStayCoords.length > 0
      ? existingStayCoords.map((c) => [c.lat, c.lng])
      : undefined;

  useEffect(() => {
    if (selectedCandidateId) {
      setSearchResults([]);
      setSearchError(false);
      return;
    }
    if (!name.trim() || name.trim().length < 3 || pickedCoords) {
      setSearchResults([]);
      setSearchError(false);
      return;
    }
    const controller = new AbortController();
    const tid = window.setTimeout(async () => {
      setIsSearching(true);
      setSearchError(false);
      setSearchStale(false);
      const staleTimer = window.setTimeout(() => setSearchStale(true), 8000);
      try {
        const results = await searchPlace(name.trim(), { signal: controller.signal });
        setSearchResults(results.slice(0, 6));
        setShowResults(true);
      } catch {
        if (!controller.signal.aborted) setSearchError(true);
      } finally {
        clearTimeout(staleTimer);
        if (!controller.signal.aborted) {
          setIsSearching(false);
          setSearchStale(false);
        }
      }
    }, 500);
    return () => {
      clearTimeout(tid);
      controller.abort();
      setSearchStale(false);
    };
  }, [name, pickedCoords, selectedCandidateId]);

  const pickResult = (r: PlaceSearchResult) => {
    setName(r.display_name.split(',')[0].trim());
    setPickedCoords({ lat: parseFloat(r.lat), lng: parseFloat(r.lon) });
    setSearchResults([]);
    setShowResults(false);
  };

  const pickCandidate = (c: Stay) => {
    setName(c.name);
    setPickedCoords({ lat: c.centerLat, lng: c.centerLng });
    setSelectedCandidateId(c.id);
    setSearchResults([]);
    setShowResults(false);
  };

  const clearCandidate = () => {
    setName('');
    setPickedCoords(null);
    setSelectedCandidateId(null);
  };

  const canSave = name.trim().length > 0;
  const isCandidateMode = mode === 'candidate';
  const showChipRow =
    !isCandidateMode && candidates !== undefined && candidates.length > 0;

  const handleSave = () => {
    if (!canSave) return;
    if (isCandidateMode) {
      onSaveCandidate?.({ name: name.trim(), lat: pickedCoords?.lat, lng: pickedCoords?.lng });
      return;
    }
    if (selectedCandidateId && onSavePromote) {
      onSavePromote({
        candidateId: selectedCandidateId,
        name: name.trim(),
        days,
        lat: pickedCoords?.lat,
        lng: pickedCoords?.lng,
      });
      return;
    }
    onSave({ name: name.trim(), days, lat: pickedCoords?.lat, lng: pickedCoords?.lng });
  };

  const saveLabel = isCandidateMode ? 'Save to Inbox' : 'Add to Timeline';
  const modalTitle = isCandidateMode ? 'Save Destination' : 'Add Destination';

  return (
    <ModalBase title={modalTitle} onClose={onClose}>
      <div className="space-y-5">
        {showChipRow && (
          <div>
            <label className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground mb-2 block">
              From inbox
            </label>
            <div className="flex gap-2 overflow-x-auto pb-1 scroll-hide">
              {candidates!.map((c) => {
                const active = c.id === selectedCandidateId;
                return (
                  <button
                    key={c.id}
                    onClick={() => (active ? clearCandidate() : pickCandidate(c))}
                    aria-pressed={active}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[11px] font-semibold whitespace-nowrap transition-colors ${
                      active
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-white text-foreground border-border hover:bg-muted'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: c.color }}
                      aria-hidden
                    />
                    {c.name}
                  </button>
                );
              })}
              {selectedCandidateId && (
                <button
                  onClick={clearCandidate}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-full text-muted-foreground hover:text-foreground text-[11px] font-medium"
                >
                  <X className="w-3 h-3" /> Clear
                </button>
              )}
            </div>
          </div>
        )}

        {/* Destination search */}
        <div className="relative">
          <label className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground mb-2 block">
            City or destination <span className="text-destructive">*</span>
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-9 pr-9 text-xs font-semibold placeholder:font-normal"
              placeholder="e.g. Tokyo, Kyoto, Paris…"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setPickedCoords(null);
                setSelectedCandidateId(null);
              }}
              onFocus={() => searchResults.length > 0 && setShowResults(true)}
              autoFocus
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            )}
            {pickedCoords && !isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-success">
                <Check className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
          {showResults && searchResults.length > 0 && (
            <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-border rounded-lg shadow-xl overflow-hidden">
              {searchResults.map((r) => {
                const parts = r.display_name.split(',');
                return (
                  <button
                    key={r.place_id}
                    onClick={() => pickResult(r)}
                    className="w-full text-left px-3 py-2.5 hover:bg-primary/5 border-b last:border-b-0 border-border flex items-start gap-2 transition-colors"
                  >
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {parts[0].trim()}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {parts.slice(1, 4).join(',').trim()}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {searchError && (
            <p className="text-[11px] text-destructive font-medium mt-1">
              Search failed — try a different name, or just type your destination and save.
            </p>
          )}
          {isSearching && searchStale && (
            <p className="text-[11px] text-muted-foreground font-medium mt-1">
              Search is taking longer than expected…
            </p>
          )}
          <LocationPicker
            value={pickedCoords}
            onChange={(coords) => setPickedCoords(coords)}
            fitBounds={fitBounds}
          />
        </div>

        {!isCandidateMode && (
          <div>
            <label className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground mb-2 block">
              Duration
            </label>
            <div className="flex items-center gap-3">
              <div className="flex items-center border border-border rounded-lg overflow-hidden bg-white">
                <button
                  onClick={() => setDays((d) => Math.max(1, d - 1))}
                  className="w-11 h-11 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted text-xl font-light transition-colors"
                >
                  −
                </button>
                <span className="w-10 text-center font-extrabold text-sm text-foreground tabular-nums">
                  {days}
                </span>
                <button
                  onClick={() => setDays((d) => Math.min(90, d + 1))}
                  className="w-11 h-11 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted text-xl font-light transition-colors"
                >
                  +
                </button>
              </div>
              <span className="text-sm text-muted-foreground">{days === 1 ? 'day' : 'days'}</span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-muted/60">
          <div className="w-2 h-8 rounded-full flex-shrink-0" style={{ background: stayColor }} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-extrabold text-foreground truncate">
              {name || 'New destination'}
            </p>
            <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
              {isCandidateMode
                ? 'Saved to inbox — no dates yet'
                : `${days} ${days === 1 ? 'day' : 'days'} on the timeline`}
            </p>
          </div>
          {pickedCoords && (
            <Badge
              variant="outline"
              className="text-[9px] font-bold text-success bg-success/10 border-emerald-100 flex-shrink-0"
            >
              Located
            </Badge>
          )}
        </div>

        <div className="flex gap-2.5 pt-1">
          <Button variant="outline" size="sm" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" className="flex-1" onClick={handleSave} disabled={!canSave}>
            {saveLabel}
          </Button>
        </div>
      </div>
    </ModalBase>
  );
}

export default AddStayModal;
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/components/modals/__tests__/AddStayModal.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/modals/AddStayModal.tsx src/components/modals/__tests__/AddStayModal.test.tsx
git commit -m "feat(add-stay): candidate mode and pick-from-inbox chip row"
```

---

## Task 9: Map — render candidate pins in overview

**Files:**
- Modify: `src/components/TripMap/StayOverviewLayer.tsx`
- Modify: `src/components/TripMap/index.tsx`

- [ ] **Step 1: Extend `StayOverviewLayer`**

Add a new `candidateStays` prop and render them with a ghost style. Update the file (additions marked):

In the type definition, add after `OverviewStay`:

```ts
export type OverviewCandidate = {
  id: string;
  name: string;
  color: string;
  centerLat: number;
  centerLng: number;
};
```

Update the props type:

```ts
type StayOverviewLayerProps = {
  stays: OverviewStay[];
  candidateStays?: OverviewCandidate[];
  onSelectStay: (stayId: string) => void;
  onSelectCandidate?: (candidateId: string) => void;
  expanded?: boolean;
  highlightedStayId?: string | null;
  highlightedCandidateId?: string | null;
  showRouteIcons?: boolean;
};
```

Destructure new props in the component signature. At the bottom of the returned JSX (after the existing stays `.map(...)`), add:

```tsx
{(candidateStays ?? []).map((c) => (
  <Marker
    key={`candidate-${c.id}`}
    position={[c.centerLat, c.centerLng]}
    icon={L.divIcon({
      className: 'candidate-marker',
      html: `<div style="width:28px;height:28px;border-radius:50%;border:2px dashed ${c.color};background:white;opacity:0.75;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,0.15);"><span style="font-size:10px;font-weight:700;color:${c.color};">${c.name.slice(0, 2).toUpperCase()}</span></div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    })}
    eventHandlers={{
      click: () => {
        map.flyTo([c.centerLat, c.centerLng], 11, { duration: 0.5 });
        onSelectCandidate?.(c.id);
      },
    }}
  >
    <Tooltip direction="top" offset={[0, -12]}>
      <strong>{c.name}</strong> · in inbox
    </Tooltip>
  </Marker>
))}
```

- [ ] **Step 2: Pass through in `TripMap/index.tsx`**

Add to `TripMapProps` around line 46:

```ts
interface TripMapProps {
  visits: VisitItem[];
  selectedVisitId: string | null;
  highlightedVisitId?: string | null;
  onSelectVisit: (id: string | null) => void;
  expanded: boolean;
  stay: Stay | null;
  mode: 'overview' | 'stay' | 'detail';
  overviewStays?: OverviewStay[];
  overviewCandidates?: { id: string; name: string; color: string; centerLat: number; centerLng: number }[];
  onSelectStay?: (stayId: string) => void;
  onSelectCandidate?: (candidateId: string) => void;
  selectedDayOffset?: number | null;
  highlightedStayId?: string | null;
  highlightedCandidateId?: string | null;
  onBackToOverview?: () => void;
}
```

Destructure new props in the component and pass them through to `<StayOverviewLayer>`:

```tsx
<StayOverviewLayer
  stays={overviewStays ?? []}
  candidateStays={overviewCandidates}
  onSelectStay={onSelectStay ?? (() => {})}
  onSelectCandidate={onSelectCandidate}
  expanded={expanded}
  highlightedStayId={highlightedStayId}
  highlightedCandidateId={highlightedCandidateId}
  showRouteIcons={showRouteIcons}
/>
```

Also extend the `allPoints` memo so candidate coords participate in fit:

```tsx
const allPoints = useMemo(() => {
  if (mode === 'overview') {
    const stayPts = (overviewStays ?? []).map((s): [number, number] => [s.centerLat, s.centerLng]);
    const candPts = (overviewCandidates ?? []).map((c): [number, number] => [c.centerLat, c.centerLng]);
    return [...stayPts, ...candPts];
  }
  const pts: [number, number][] = visits.map((v) => [v.lat, v.lng]);
  accommodations.forEach((a) => pts.push([a.lat, a.lng]));
  if (pts.length === 0 && stay) {
    pts.push([stay.centerLat, stay.centerLng]);
  }
  return pts;
}, [visits, accommodations, mode, overviewStays, overviewCandidates, stay]);
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors in TripMap files. Many pre-existing errors in App.tsx about `candidateStays` — those are fixed in Task 10.

- [ ] **Step 4: Commit**

```bash
git add src/components/TripMap/StayOverviewLayer.tsx src/components/TripMap/index.tsx
git commit -m "feat(map): render candidate stays as ghost markers in overview"
```

---

## Task 10: Wire `App.tsx` — state, sidebar, modal dispatch, handlers

**Files:**
- Modify: `src/App.tsx`

This is the largest integration step. Split into small sub-steps; commit at end.

- [ ] **Step 1: Add selected-candidate state**

Near existing `const [locatedVisitId, setLocatedVisitId] = useState<string | null>(null);` (around line 209), add:

```ts
const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
const [promotingCandidateId, setPromotingCandidateId] = useState<string | null>(null);
```

- [ ] **Step 2: Ensure `trip.candidateStays` is always an array at read sites**

Pass `candidateStays ?? []` defensively wherever you read it; the data layer guarantees it, but the type allows it to be optional if you kept it optional. (Not needed if you made it required in Task 1 — skip this step if so.)

- [ ] **Step 3: Overview-sidebar inbox tab renders candidates**

Find the `unplanned` tab block (line ~1845). Change its content to switch on `selectedStay`:

```tsx
{sidebarTab === 'unplanned' && (
  <div className="flex-1 overflow-y-auto p-4 space-y-3 scroll-hide">
    {selectedStay ? (
      <>
        {inboxVisits.map((v) => (
          <DraggableInventoryCard
            key={v.id}
            visit={v}
            onEdit={() => setEditingVisit(v)}
            onLocate={() => {
              setLocatedVisitId(v.id);
              setSelectedVisitId(v.id);
            }}
          />
        ))}
        {inboxVisits.length === 0 && (
          /* existing empty state — unchanged */
        )}
      </>
    ) : (
      <>
        {trip.candidateStays.map((c) => (
          <div
            key={c.id}
            className="group rounded-xl border border-border bg-white p-3 cursor-pointer hover:shadow-sm transition-shadow"
            onClick={() => setSelectedCandidateId(c.id)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.color }} />
                <p className="text-xs font-bold text-foreground truncate">{c.name}</p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Promote ${c.name} to timeline`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPromotingCandidateId(c.id);
                    setAddingStay(true);
                  }}
                >
                  <CalendarPlus className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${c.name} from inbox`}
                  onClick={(e) => {
                    e.stopPropagation();
                    updateTrip((t) => ({
                      ...t,
                      candidateStays: t.candidateStays.filter((s) => s.id !== c.id),
                      visits: t.visits.filter((v) => v.stayId !== c.id),
                    }));
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        {trip.candidateStays.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <div className="size-9 rounded-xl bg-muted flex items-center justify-center">
              <Compass className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-[11px] font-bold text-muted-foreground">
              No destinations in inbox yet
            </p>
            <p className="text-[11px] text-muted-foreground text-center max-w-[220px]">
              Add places you're considering, then move them to the timeline when ready.
            </p>
          </div>
        )}
      </>
    )}
  </div>
)}
```

Add `CalendarPlus, Trash2` to the lucide-react import if not already imported.

- [ ] **Step 4: `+` button dispatches by mode**

Find the `+` button (line ~1759). Replace `onClick={() => setAddingToInbox(true)}` with:

```tsx
onClick={() => {
  if (selectedStay) {
    setAddingToInbox(true);
  } else {
    setAddingStay(true);
  }
}}
```

Remove the `sidebarTab === 'unplanned' ? '' : 'invisible pointer-events-none'` gate if it prevents the button from showing in overview — the button should always be visible when the unplanned tab is active.

- [ ] **Step 5: `AddStayModal` invocation gains candidate props**

Find the `{addingStay && (` block (line ~2853). Extend it:

The existing `onSave` block at `App.tsx:2864-2883` (builds a new `Stay` with jitter fallback, pushes into `trip.stays`, calls `setSelectedStayId`, clears modal) stays **as-is**. Only add the new props alongside it.

```tsx
{addingStay && (
  <AddStayModal
    mode={!selectedStay && !promotingCandidateId ? 'candidate' : 'schedule'}
    candidates={trip.candidateStays}
    initialCandidateId={promotingCandidateId ?? undefined}
    onClose={() => {
      setAddingStay(false);
      setPendingTimelineSlot(null);
      setPromotingCandidateId(null);
    }}
    stayColor={STAY_COLORS[trip.stays.length % STAY_COLORS.length]}
    initialDays={pendingTimelineSlot?.days}
    existingStayCoords={trip.stays
      .filter((s) => s.centerLat != null && s.centerLng != null)
      .map((s) => ({ lat: s.centerLat, lng: s.centerLng }))}
    onSave={/* keep the existing fresh-stay handler from App.tsx:2864 unchanged */}
    onSavePromote={({ candidateId, days }) => {
      const startSlot =
        pendingTimelineSlot?.startSlot ??
        (sortedStays.length > 0 ? sortedStays[sortedStays.length - 1].endSlot : 0);
      const endSlot = Math.min(startSlot + days * 3, trip.totalDays * 3);
      updateTrip((t) => promoteCandidateStay(t, candidateId, startSlot, endSlot));
      setSelectedStayId(candidateId);
      setAddingStay(false);
      setPendingTimelineSlot(null);
      setPromotingCandidateId(null);
    }}
    onSaveCandidate={({ name, lat, lng }) => {
      const newCandidate: Stay = {
        id: `stay-${Date.now()}`,
        name,
        color: STAY_COLORS[(trip.stays.length + trip.candidateStays.length) % STAY_COLORS.length],
        startSlot: 0,
        endSlot: 0,
        centerLat: lat ?? jitter(35.6762, 5),
        centerLng: lng ?? jitter(139.6503, 5),
      };
      updateTrip((t) => ({ ...t, candidateStays: [...t.candidateStays, newCandidate] }));
      setAddingStay(false);
    }}
  />
)}
```

Import `promoteCandidateStay` and `demoteStay` at the top:

```ts
import {
  createVisit,
  normalizeVisitOrders,
  sortVisits,
} from './domain/visitLogic';
import {
  applyTimelineDrag,
  extendTripBefore,
  extendTripAfter,
  adjustStaysForDateChange,
  promoteCandidateStay,
  demoteStay,
} from './domain/tripMutations';
```

(Adjust based on existing imports — do NOT duplicate.)

- [ ] **Step 6: `StayEditorModal` invocation gains `onDemote`**

At the existing `StayEditorModal` usage (line ~2827), add the prop:

```tsx
<StayEditorModal
  stay={stay}
  visitCount={trip.visits.filter((v) => v.stayId === editingStayId).length}
  onClose={() => setEditingStayId(null)}
  onSave={/* existing */}
  onDelete={/* existing */}
  onDemote={() => {
    updateTrip((t) => demoteStay(t, editingStayId));
    if (selectedStayId === editingStayId) {
      setSelectedStayId('');
    }
  }}
/>
```

- [ ] **Step 7: Pass `candidateStays` to `TripMap`**

Find the `TripMap` usage in `App.tsx`. Add:

```tsx
<TripMap
  /* existing props */
  overviewCandidates={trip.candidateStays.map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color,
    centerLat: c.centerLat,
    centerLng: c.centerLng,
  }))}
  highlightedCandidateId={selectedCandidateId}
  onSelectCandidate={(id) => setSelectedCandidateId(id)}
/>
```

- [ ] **Step 8: Type-check + test**

Run: `npx tsc --noEmit`
Expected: zero errors (or only pre-existing unrelated ones).

Run: `npm run test`
Expected: all tests pass.

- [ ] **Step 9: Manual smoke test**

Start dev server: `npm run dev`
1. In overview mode, click `+` — AddStayModal opens in "Save Destination" / no-dates mode. Save a candidate (e.g. "Osaka") with coords. Candidate appears in overview sidebar + ghost pin on map.
2. Click `+` on timeline area — AddStayModal opens in schedule mode with "From inbox" chip row showing Osaka. Pick Osaka → name/coords pre-fill. Save → Osaka moves to timeline; sidebar candidate gone; normal pin on map.
3. Open an existing stay's editor → click "Move to Inbox" → confirm. Stay vanishes from timeline, appears in overview sidebar, ghost pin on map. Its scheduled visits go to its per-stay inbox (check by selecting it if accessible) — actually selecting a candidate doesn't deep-select, so check via state only if needed. Scheduled visits present with `dayOffset === null`. Undo (Cmd+Z) restores.
4. Delete (trash button) a candidate → gone.

- [ ] **Step 10: Commit**

```bash
git add src/App.tsx
git commit -m "feat(app): wire destination inbox in sidebar, modals, and map"
```

---

## Task 11: Update docs

**Files:**
- Modify: `docs/PRD.md`
- Modify: `docs/IMPROVEMENTS.md` (only if the feature maps to an item already there)

- [ ] **Step 1: PRD — describe feature**

Add a bullet under "Features" (or the relevant section) about the destination inbox:

> **Destination Inbox.** In trip overview mode, the sidebar inbox holds candidate destinations (stays not yet placed on the timeline). Users can save candidates from overview mode, promote them onto the timeline with dates (via "Pick from inbox" chip in `AddStayModal`), and demote scheduled stays back to the inbox from the stay editor. Visits travel with their stay; demotion unschedules scheduled visits. Candidate stays render as ghost markers on the overview map.

Update the Data Model section to mention `candidateStays: Stay[]` on `HybridTrip` and the trip version bump to `3`.

Update the Feature Status table: add a row for "Destination Inbox" → status "Shipped".

- [ ] **Step 2: IMPROVEMENTS.md**

If there is an existing entry like "clicking + in overview does nothing" or "todo list for destinations", move it to the "Done" section (or remove if the file doesn't track that way). Do NOT add new backlog items.

- [ ] **Step 3: Commit**

```bash
git add docs/PRD.md docs/IMPROVEMENTS.md
git commit -m "docs: describe destination inbox feature in PRD"
```

---

## Final verification

- [ ] Run full suite:

```bash
npm run test
```

Expected: all tests pass.

- [ ] Lint changed files:

```bash
npx eslint src/domain/migration.ts src/domain/__tests__/migration.test.ts src/domain/tripMutations.ts src/domain/__tests__/tripMutations.test.ts src/domain/types.ts src/domain/sampleData.ts src/lib/persistence.ts src/services/sync/firebase.ts src/components/modals/AddStayModal.tsx src/components/modals/StayEditorModal.tsx src/components/modals/__tests__/AddStayModal.test.tsx src/components/TripMap/StayOverviewLayer.tsx src/components/TripMap/index.tsx src/App.tsx
```

Expected: clean (no new errors).

- [ ] Dev-server smoke test covers the four flows from Task 10 Step 9.

- [ ] Branch: `feat/destination-inbox` (already checked out). Do NOT push or open PR without user instruction.
