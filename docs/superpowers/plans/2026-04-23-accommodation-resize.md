# Accommodation Resize Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a stay's boundary changes (timeline drag or trip-date edit), its per-night accommodations should follow the stay: multi-night groups shrink/grow silently, singletons surface as a toast with undo, and no accommodation ever leaks across stays.

**Architecture:** Introduce one pure helper (`adjustAccommodationsForResize`) that rekeys a stay's `nightAccommodations` given an old/new day count and start/end shift, returning a list of removed singletons. Wire it into `applyTimelineDrag` (return `{ stays, removed }`) and `adjustStaysForDateChange` (add `removed`). At the two consumer call sites (`App.tsx` drag loop and `TripEditorModal` save), fire a sonner toast with an Undo action that calls `hist.undo()`.

**Tech Stack:** TypeScript, React, Vitest + Testing Library, sonner (toasts), existing `useHistory` hook.

---

## File Structure

**Create:**
- `src/domain/accommodationAdjust.ts` — pure helper `adjustAccommodationsForResize`
- `src/domain/__tests__/accommodationAdjust.test.ts` — unit tests

**Modify:**
- `src/domain/types.ts` — extend `DragState` with `originalNightAccommodations`
- `src/domain/tripMutations.ts` — change `applyTimelineDrag` return type to `{ stays, removed }`; change `adjustStaysForDateChange` return type to `{ stays, visits, removed }`; both call the new helper
- `src/domain/__tests__/tripMutations.test.ts` — update existing tests for new return shapes, add Tokyo/Kyoto integration test
- `src/App.tsx` — capture original accoms at drag start, consume new return shape, fire toast on mouseup
- `src/components/modals/TripEditorModal.tsx` — consume new `removed` from `adjustStaysForDateChange`, fire toast on save

---

## Task 1: Create `adjustAccommodationsForResize` helper with tests

**Files:**
- Create: `src/domain/accommodationAdjust.ts`
- Test: `src/domain/__tests__/accommodationAdjust.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/domain/__tests__/accommodationAdjust.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { adjustAccommodationsForResize } from '../accommodationAdjust';
import type { NightAccommodation } from '../types';

const hotel = (name: string): NightAccommodation => ({ name });

describe('adjustAccommodationsForResize', () => {
  it('returns undefined and no removals when oldAccoms is undefined', () => {
    const result = adjustAccommodationsForResize(undefined, 3, 4, 0, -1, 'Tokyo');
    expect(result.nightAccommodations).toBeUndefined();
    expect(result.removed).toEqual([]);
  });

  it('grow-end extends the last group forward', () => {
    // 3 nights of Hotel A -> 4 nights of Hotel A
    const accoms = { 0: hotel('A'), 1: hotel('A'), 2: hotel('A') };
    const result = adjustAccommodationsForResize(accoms, 3, 4, 0, -1, 'Tokyo');
    expect(result.nightAccommodations).toEqual({
      0: hotel('A'),
      1: hotel('A'),
      2: hotel('A'),
      3: hotel('A'),
    });
    expect(result.removed).toEqual([]);
  });

  it('grow-end leaves new nights empty when last night was empty', () => {
    // 3 nights, only first is booked -> grow by 1, last two stay empty
    const accoms = { 0: hotel('A') };
    const result = adjustAccommodationsForResize(accoms, 3, 4, 0, -1, 'Tokyo');
    expect(result.nightAccommodations).toEqual({ 0: hotel('A') });
    expect(result.removed).toEqual([]);
  });

  it('grow-start reindexes existing keys and fills prefix from first group', () => {
    // 2 nights of Hotel A -> gain 1 night at start
    const accoms = { 0: hotel('A'), 1: hotel('A') };
    const result = adjustAccommodationsForResize(accoms, 2, 3, -1, 0, 'Tokyo');
    expect(result.nightAccommodations).toEqual({
      0: hotel('A'),
      1: hotel('A'),
      2: hotel('A'),
    });
    expect(result.removed).toEqual([]);
  });

  it('grow-start leaves prefix empty when old first night was empty', () => {
    // Only night 1 booked, grow by 1 at start -> prefix empty
    const accoms = { 1: hotel('A') };
    const result = adjustAccommodationsForResize(accoms, 2, 3, -1, 0, 'Tokyo');
    expect(result.nightAccommodations).toEqual({ 2: hotel('A') });
    expect(result.removed).toEqual([]);
  });

  it('shrink-end drops trailing keys from a multi-night group silently', () => {
    // 4 nights of Hotel A -> 3 nights (last dropped)
    const accoms = { 0: hotel('A'), 1: hotel('A'), 2: hotel('A'), 3: hotel('A') };
    const result = adjustAccommodationsForResize(accoms, 4, 3, 0, 1, 'Tokyo');
    expect(result.nightAccommodations).toEqual({
      0: hotel('A'),
      1: hotel('A'),
      2: hotel('A'),
    });
    expect(result.removed).toEqual([]);
  });

  it('shrink-end removes a singleton and reports it', () => {
    // 3 nights: A, A, B (B singleton at end) -> 2 nights, B removed
    const accoms = { 0: hotel('A'), 1: hotel('A'), 2: hotel('B') };
    const result = adjustAccommodationsForResize(accoms, 3, 2, 0, 1, 'Tokyo');
    expect(result.nightAccommodations).toEqual({ 0: hotel('A'), 1: hotel('A') });
    expect(result.removed).toEqual([{ name: 'B', stayLabel: 'Tokyo' }]);
  });

  it('shrink-start drops leading keys and reindexes', () => {
    // 3 nights: A, A, A -> lose first night (still multi-night group)
    const accoms = { 0: hotel('A'), 1: hotel('A'), 2: hotel('A') };
    const result = adjustAccommodationsForResize(accoms, 3, 2, 1, 0, 'Tokyo');
    expect(result.nightAccommodations).toEqual({ 0: hotel('A'), 1: hotel('A') });
    expect(result.removed).toEqual([]);
  });

  it('shrink-start removes a singleton at the start', () => {
    // 3 nights: X, A, A (X singleton at start) -> 2 nights, X removed
    const accoms = { 0: hotel('X'), 1: hotel('A'), 2: hotel('A') };
    const result = adjustAccommodationsForResize(accoms, 3, 2, 1, 0, 'Tokyo');
    expect(result.nightAccommodations).toEqual({ 0: hotel('A'), 1: hotel('A') });
    expect(result.removed).toEqual([{ name: 'X', stayLabel: 'Tokyo' }]);
  });

  it('mixed shrink-end + grow-start combines correctly', () => {
    // 3 nights of A -> shrink end by 1, grow start by 1 -> still 3 nights of A, all reindexed
    const accoms = { 0: hotel('A'), 1: hotel('A'), 2: hotel('A') };
    const result = adjustAccommodationsForResize(accoms, 3, 3, -1, 1, 'Tokyo');
    expect(result.nightAccommodations).toEqual({
      0: hotel('A'),
      1: hotel('A'),
      2: hotel('A'),
    });
    expect(result.removed).toEqual([]);
  });

  it('returns undefined when every key is dropped', () => {
    const accoms = { 0: hotel('Z') };
    const result = adjustAccommodationsForResize(accoms, 1, 0, 0, 1, 'Tokyo');
    expect(result.nightAccommodations).toBeUndefined();
    expect(result.removed).toEqual([{ name: 'Z', stayLabel: 'Tokyo' }]);
  });

  it('reports multiple singletons removed in one operation', () => {
    // 3 nights: X, Y, Z (all singletons) -> drop 2 from end
    const accoms = { 0: hotel('X'), 1: hotel('Y'), 2: hotel('Z') };
    const result = adjustAccommodationsForResize(accoms, 3, 1, 0, 2, 'Tokyo');
    expect(result.nightAccommodations).toEqual({ 0: hotel('X') });
    expect(result.removed).toEqual([
      { name: 'Y', stayLabel: 'Tokyo' },
      { name: 'Z', stayLabel: 'Tokyo' },
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/domain/__tests__/accommodationAdjust.test.ts`
Expected: all tests fail, module `../accommodationAdjust` does not exist.

- [ ] **Step 3: Implement the helper**

Create `src/domain/accommodationAdjust.ts`:

```ts
import type { NightAccommodation } from './types';

export type AccommodationRemoval = { name: string; stayLabel: string };

export type AdjustAccommodationsResult = {
  nightAccommodations: Record<number, NightAccommodation> | undefined;
  removed: AccommodationRemoval[];
};

/**
 * Recomputes `nightAccommodations` after a stay's day range changes.
 *
 * `startShift` > 0 means the stay lost that many days at the start (shrink-start).
 * `startShift` < 0 means the stay gained that many days at the start (grow-start).
 * `endShift`   > 0 means the stay lost that many days at the end (shrink-end).
 * `endShift`   < 0 means the stay gained that many days at the end (grow-end).
 *
 * Rules (see docs/superpowers/specs/2026-04-23-accommodation-resize-design.md):
 * - On grow, the adjacent accommodation group extends into the new nights (if any).
 * - On shrink, dropped nights either shrink their group silently (multi-night) or
 *   emit a removal entry (singleton) for toast surfacing.
 */
export function adjustAccommodationsForResize(
  oldAccoms: Record<number, NightAccommodation> | undefined,
  oldDayCount: number,
  newDayCount: number,
  startShift: number,
  endShift: number,
  stayLabel: string,
): AdjustAccommodationsResult {
  if (!oldAccoms || Object.keys(oldAccoms).length === 0) {
    return { nightAccommodations: undefined, removed: [] };
  }

  const removed: AccommodationRemoval[] = [];

  const isSingleton = (day: number): boolean => {
    const target = oldAccoms[day];
    if (!target) return false;
    const prev = oldAccoms[day - 1];
    const next = oldAccoms[day + 1];
    const prevMatches = prev && prev.name === target.name;
    const nextMatches = next && next.name === target.name;
    return !prevMatches && !nextMatches;
  };

  // 1. Collect removals from shrink-start (dropped keys 0..startShift-1)
  if (startShift > 0) {
    for (let d = 0; d < startShift; d++) {
      const accom = oldAccoms[d];
      if (accom && isSingleton(d)) {
        removed.push({ name: accom.name, stayLabel });
      }
    }
  }

  // 2. Collect removals from shrink-end (dropped keys oldDayCount-endShift..oldDayCount-1)
  if (endShift > 0) {
    for (let d = oldDayCount - endShift; d < oldDayCount; d++) {
      const accom = oldAccoms[d];
      if (accom && isSingleton(d)) {
        removed.push({ name: accom.name, stayLabel });
      }
    }
  }

  // 3. Build new accommodations: shift surviving keys by -startShift
  const next: Record<number, NightAccommodation> = {};
  const firstKeptDay = Math.max(0, startShift);
  const lastKeptDay = oldDayCount - Math.max(0, endShift) - 1;
  for (let d = firstKeptDay; d <= lastKeptDay; d++) {
    const accom = oldAccoms[d];
    if (accom) {
      next[d - startShift] = accom;
    }
  }

  // 4. Extend first group backward if grow-start
  if (startShift < 0) {
    const firstSurvivingDay = Math.max(0, startShift) - startShift; // always -startShift
    const seedAccom = oldAccoms[Math.max(0, startShift)]; // old key 0
    if (seedAccom) {
      for (let d = 0; d < firstSurvivingDay; d++) {
        next[d] = seedAccom;
      }
    }
  }

  // 5. Extend last group forward if grow-end
  if (endShift < 0) {
    const lastOldDay = oldDayCount - 1;
    const seedAccom = oldAccoms[lastOldDay];
    if (seedAccom) {
      const firstNewDay = lastOldDay - startShift + 1;
      const lastNewDay = newDayCount - 1;
      for (let d = firstNewDay; d <= lastNewDay; d++) {
        next[d] = seedAccom;
      }
    }
  }

  if (Object.keys(next).length === 0) {
    return { nightAccommodations: undefined, removed };
  }
  return { nightAccommodations: next, removed };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/domain/__tests__/accommodationAdjust.test.ts`
Expected: all 12 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/accommodationAdjust.ts src/domain/__tests__/accommodationAdjust.test.ts
git commit -m "feat(domain): add adjustAccommodationsForResize helper"
```

---

## Task 2: Extend `DragState` with original accommodations

**Files:**
- Modify: `src/domain/types.ts:90-96`

- [ ] **Step 1: Update DragState type**

Edit `src/domain/types.ts`, replace lines 90-96:

```ts
export type DragState = {
  stayId: string;
  mode: 'move' | 'resize-start' | 'resize-end';
  originX: number;
  originalStart: number;
  originalEnd: number;
  originalNightAccommodations?: Record<number, NightAccommodation>;
} | null;
```

- [ ] **Step 2: Verify type compiles**

Run: `npm run build`
Expected: no errors. (Consumers of `DragState` don't have to read the new field yet; it's optional.)

- [ ] **Step 3: Commit**

```bash
git add src/domain/types.ts
git commit -m "feat(types): thread original accommodations through DragState"
```

---

## Task 3: Rewire `applyTimelineDrag` to return `{ stays, removed }`

**Files:**
- Modify: `src/domain/tripMutations.ts:49-73`
- Modify: `src/domain/__tests__/tripMutations.test.ts:113-151`

- [ ] **Step 1: Update existing tests to expect new return shape**

Open `src/domain/__tests__/tripMutations.test.ts`. Each `applyTimelineDrag` test currently reads `result[0].startSlot` etc. Update to read from `result.stays[0].startSlot`. Example before:

```ts
const result = applyTimelineDrag(stays, drag, 3, 15);
expect(result[0].startSlot).toBe(3);
```

After:

```ts
const result = applyTimelineDrag(stays, drag, 3, 15);
expect(result.stays[0].startSlot).toBe(3);
expect(result.removed).toEqual([]);
```

Apply that pattern to all four existing `applyTimelineDrag` tests (lines ~124, ~131, ~139, ~147).

Then add a new test below them, still inside `describe('applyTimelineDrag', ...)`:

```ts
it('reports singleton accommodations removed on resize-end shrink', () => {
  const stays: Stay[] = [
    {
      id: 's1',
      name: 'Tokyo',
      color: '#000',
      startSlot: 0,
      endSlot: 9, // 3 days
      centerLat: 0,
      centerLng: 0,
      nightAccommodations: {
        0: { name: 'Hotel A' },
        1: { name: 'Hotel A' },
        2: { name: 'Hotel B' }, // singleton at end
      },
    },
  ];
  const drag: DragState = {
    stayId: 's1',
    mode: 'resize-end',
    originX: 0,
    originalStart: 0,
    originalEnd: 9,
    originalNightAccommodations: {
      0: { name: 'Hotel A' },
      1: { name: 'Hotel A' },
      2: { name: 'Hotel B' },
    },
  };
  // Shrink by 3 slots (1 day)
  const result = applyTimelineDrag(stays, drag, -3, 15);
  expect(result.stays[0].endSlot).toBe(6);
  expect(result.stays[0].nightAccommodations).toEqual({
    0: { name: 'Hotel A' },
    1: { name: 'Hotel A' },
  });
  expect(result.removed).toEqual([{ name: 'Hotel B', stayLabel: 'Tokyo' }]);
});

it('extends last accommodation group on resize-end grow', () => {
  const stays: Stay[] = [
    {
      id: 's1',
      name: 'Tokyo',
      color: '#000',
      startSlot: 0,
      endSlot: 6, // 2 days
      centerLat: 0,
      centerLng: 0,
      nightAccommodations: {
        0: { name: 'Hotel A' },
        1: { name: 'Hotel A' },
      },
    },
  ];
  const drag: DragState = {
    stayId: 's1',
    mode: 'resize-end',
    originX: 0,
    originalStart: 0,
    originalEnd: 6,
    originalNightAccommodations: {
      0: { name: 'Hotel A' },
      1: { name: 'Hotel A' },
    },
  };
  const result = applyTimelineDrag(stays, drag, 3, 15);
  expect(result.stays[0].endSlot).toBe(9);
  expect(result.stays[0].nightAccommodations).toEqual({
    0: { name: 'Hotel A' },
    1: { name: 'Hotel A' },
    2: { name: 'Hotel A' },
  });
  expect(result.removed).toEqual([]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/domain/__tests__/tripMutations.test.ts`
Expected: the four modified tests fail (type mismatch / undefined). The two new tests fail (same).

- [ ] **Step 3: Rewrite `applyTimelineDrag`**

Edit `src/domain/tripMutations.ts`. Add import at top:

```ts
import {
  adjustAccommodationsForResize,
  type AccommodationRemoval,
} from './accommodationAdjust';
```

Replace the function (lines 48-73):

```ts
/** Apply a slot delta to a stay during timeline drag (move/resize). Returns updated stays and any removed singleton accommodations. */
export function applyTimelineDrag(
  stays: Stay[],
  dragState: NonNullable<DragState>,
  delta: number,
  totalSlots: number,
): { stays: Stay[]; removed: AccommodationRemoval[] } {
  const removed: AccommodationRemoval[] = [];
  const nextStays = stays.map((s) => {
    if (s.id !== dragState.stayId) return s;

    const len = dragState.originalEnd - dragState.originalStart;

    if (dragState.mode === 'move') {
      const next = clamp(dragState.originalStart + delta, 0, totalSlots - len);
      return { ...s, startSlot: next, endSlot: next + len };
    }

    let newStart = s.startSlot;
    let newEnd = s.endSlot;
    if (dragState.mode === 'resize-start') {
      newStart = clamp(dragState.originalStart + delta, 0, dragState.originalEnd - 1);
      newEnd = dragState.originalEnd;
    } else {
      newStart = dragState.originalStart;
      newEnd = clamp(dragState.originalEnd + delta, dragState.originalStart + 1, totalSlots);
    }

    const oldDayCount = Math.ceil((dragState.originalEnd - dragState.originalStart) / 3);
    const newDayCount = Math.ceil((newEnd - newStart) / 3);
    const startShift = Math.floor((newStart - dragState.originalStart) / 3);
    const endShift = Math.floor((dragState.originalEnd - newEnd) / 3);

    const accomResult = adjustAccommodationsForResize(
      dragState.originalNightAccommodations,
      oldDayCount,
      newDayCount,
      startShift,
      endShift,
      s.name,
    );
    removed.push(...accomResult.removed);

    const { nightAccommodations: _dropped, ...rest } = s;
    return {
      ...rest,
      startSlot: newStart,
      endSlot: newEnd,
      ...(accomResult.nightAccommodations !== undefined
        ? { nightAccommodations: accomResult.nightAccommodations }
        : {}),
    };
  });

  return { stays: nextStays, removed };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/domain/__tests__/tripMutations.test.ts`
Expected: all `applyTimelineDrag` tests PASS. `adjustStaysForDateChange` tests still pass (not yet modified).

- [ ] **Step 5: Commit**

```bash
git add src/domain/tripMutations.ts src/domain/__tests__/tripMutations.test.ts
git commit -m "feat(domain): applyTimelineDrag rewires accommodations and reports removals"
```

---

## Task 4: Update `adjustStaysForDateChange` to return `{ stays, visits, removed }`

**Files:**
- Modify: `src/domain/tripMutations.ts:83-137`
- Modify: `src/domain/__tests__/tripMutations.test.ts:153-260`

- [ ] **Step 1: Update existing tests for new return shape**

In `src/domain/__tests__/tripMutations.test.ts`, each `adjustStaysForDateChange` test reads `result.stays` and `result.visits`. Those keep working. Add `expect(result.removed).toEqual([]);` after each existing assertion block (five tests — lines ~161, ~173, ~205, ~242, ~256).

Then add a new test inside the same `describe('adjustStaysForDateChange', ...)`:

```ts
it('reports removed singleton accommodations when a stay is clamped', () => {
  const stays: Stay[] = [
    {
      id: 's1',
      name: 'Tokyo',
      color: '#000',
      startSlot: 0,
      endSlot: 9, // 3 days
      centerLat: 0,
      centerLng: 0,
      nightAccommodations: {
        0: { name: 'Hotel A' },
        1: { name: 'Hotel A' },
        2: { name: 'Hotel B' }, // singleton that will be clipped
      },
    },
  ];
  const visits: VisitItem[] = [];
  // slotShift=0, newMaxSlot=6 -> stay end clamps from 9 to 6 (drops last day)
  const result = adjustStaysForDateChange(stays, visits, 0, 6);
  expect(result.stays[0].endSlot).toBe(6);
  expect(result.stays[0].nightAccommodations).toEqual({
    0: { name: 'Hotel A' },
    1: { name: 'Hotel A' },
  });
  expect(result.removed).toEqual([{ name: 'Hotel B', stayLabel: 'Tokyo' }]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/domain/__tests__/tripMutations.test.ts`
Expected: new test fails (`result.removed` undefined), five modified tests fail for the same reason.

- [ ] **Step 3: Update the function**

Edit `src/domain/tripMutations.ts`, replace `adjustStaysForDateChange` (lines 83-137):

```ts
/**
 * Adjust stays and visits after a date range change (start date shift and/or totalDays decrease).
 * - Shifts all stays by `-slotShift` to account for start date moving.
 * - Removes stays fully outside the new range.
 * - Clamps partially outside stays, rekeys their accommodations, and unschedules overflowing visits.
 */
export function adjustStaysForDateChange(
  stays: Stay[],
  visits: VisitItem[],
  slotShift: number,
  newMaxSlot: number,
): { stays: Stay[]; visits: VisitItem[]; removed: AccommodationRemoval[] } {
  const removed: AccommodationRemoval[] = [];

  const shifted = stays.map((s) => ({
    ...s,
    startSlot: s.startSlot - slotShift,
    endSlot: s.endSlot - slotShift,
  }));

  const removedStayIds = new Set(
    shifted.filter((s) => s.endSlot <= 0 || s.startSlot >= newMaxSlot).map((s) => s.id),
  );

  const clampedStays = shifted
    .filter((s) => !removedStayIds.has(s.id))
    .map((s) => {
      const clampedStart = Math.max(0, s.startSlot);
      const clampedEnd = Math.min(newMaxSlot, s.endSlot);

      if (clampedStart === s.startSlot && clampedEnd === s.endSlot) {
        return { ...s, startSlot: clampedStart, endSlot: clampedEnd };
      }

      const oldDayCount = Math.ceil((s.endSlot - s.startSlot) / 3);
      const newDayCount = Math.ceil((clampedEnd - clampedStart) / 3);
      const startShift = Math.floor((clampedStart - s.startSlot) / 3);
      const endShift = Math.floor((s.endSlot - clampedEnd) / 3);

      const accomResult = adjustAccommodationsForResize(
        s.nightAccommodations,
        oldDayCount,
        newDayCount,
        startShift,
        endShift,
        s.name,
      );
      removed.push(...accomResult.removed);

      const { nightAccommodations: _dropped, ...rest } = s;
      return {
        ...rest,
        startSlot: clampedStart,
        endSlot: clampedEnd,
        ...(accomResult.nightAccommodations !== undefined
          ? { nightAccommodations: accomResult.nightAccommodations }
          : {}),
      };
    });

  const shiftedMap = new Map(shifted.map((s) => [s.id, s]));

  const adjustedVisits = visits.map((v) => {
    if (removedStayIds.has(v.stayId)) {
      return { ...v, dayOffset: null, dayPart: null };
    }
    if (v.dayOffset === null) return v;

    const clamped = clampedStays.find((s) => s.id === v.stayId);
    const original = shiftedMap.get(v.stayId);
    if (!clamped || !original) return v;

    if (clamped.startSlot === original.startSlot && clamped.endSlot === original.endSlot) return v;

    const newDayCount = Math.ceil((clamped.endSlot - clamped.startSlot) / 3);
    const dayShiftWithinStay = Math.max(
      0,
      Math.floor((clamped.startSlot - original.startSlot) / 3),
    );
    const adjusted = v.dayOffset - dayShiftWithinStay;
    return adjusted >= 0 && adjusted < newDayCount
      ? { ...v, dayOffset: adjusted }
      : { ...v, dayOffset: null, dayPart: null };
  });

  return { stays: clampedStays, visits: adjustedVisits, removed };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/domain/__tests__/tripMutations.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/tripMutations.ts src/domain/__tests__/tripMutations.test.ts
git commit -m "feat(domain): adjustStaysForDateChange rekeys accommodations and reports removals"
```

---

## Task 5: Add Tokyo/Kyoto integration test

**Files:**
- Modify: `src/domain/__tests__/tripMutations.test.ts`

- [ ] **Step 1: Write failing test (it should already pass, but confirms the scenario)**

Add at the end of the `applyTimelineDrag` describe block:

```ts
it('boundary drag Tokyo->Kyoto does not leak accommodation across stays', () => {
  const stays: Stay[] = [
    {
      id: 'tokyo',
      name: 'Tokyo',
      color: '#000',
      startSlot: 0,
      endSlot: 9, // 3 days
      centerLat: 0,
      centerLng: 0,
      nightAccommodations: {
        0: { name: 'Hotel Tokyo' },
        1: { name: 'Hotel Tokyo' },
        2: { name: 'Hotel Tokyo' },
      },
    },
    {
      id: 'kyoto',
      name: 'Kyoto',
      color: '#111',
      startSlot: 9,
      endSlot: 18, // 3 days
      centerLat: 0,
      centerLng: 0,
      nightAccommodations: {
        0: { name: 'Hotel Kyoto' },
        1: { name: 'Hotel Kyoto' },
        2: { name: 'Hotel Kyoto' },
      },
    },
  ];

  // Step 1: Shrink Tokyo by 1 day (resize-end, delta -3)
  const tokyoDrag: DragState = {
    stayId: 'tokyo',
    mode: 'resize-end',
    originX: 0,
    originalStart: 0,
    originalEnd: 9,
    originalNightAccommodations: stays[0].nightAccommodations,
  };
  const afterTokyoShrink = applyTimelineDrag(stays, tokyoDrag, -3, 18);
  expect(afterTokyoShrink.stays[0].endSlot).toBe(6);
  expect(afterTokyoShrink.stays[0].nightAccommodations).toEqual({
    0: { name: 'Hotel Tokyo' },
    1: { name: 'Hotel Tokyo' },
  });
  expect(afterTokyoShrink.removed).toEqual([]); // multi-night group shrunk silently

  // Step 2: Grow Kyoto by 1 day at start (resize-start, delta -3)
  const kyotoDrag: DragState = {
    stayId: 'kyoto',
    mode: 'resize-start',
    originX: 0,
    originalStart: 9,
    originalEnd: 18,
    originalNightAccommodations: stays[1].nightAccommodations,
  };
  const afterKyotoGrow = applyTimelineDrag(afterTokyoShrink.stays, kyotoDrag, -3, 18);
  expect(afterKyotoGrow.stays[1].startSlot).toBe(6);
  expect(afterKyotoGrow.stays[1].nightAccommodations).toEqual({
    0: { name: 'Hotel Kyoto' },
    1: { name: 'Hotel Kyoto' },
    2: { name: 'Hotel Kyoto' },
    3: { name: 'Hotel Kyoto' },
  });
  expect(afterKyotoGrow.removed).toEqual([]);

  // No Hotel Tokyo should appear anywhere in Kyoto's accommodations
  const kyotoAccoms = Object.values(afterKyotoGrow.stays[1].nightAccommodations ?? {});
  expect(kyotoAccoms.every((a) => a.name === 'Hotel Kyoto')).toBe(true);
});
```

- [ ] **Step 2: Run test**

Run: `npx vitest run src/domain/__tests__/tripMutations.test.ts -t 'Tokyo->Kyoto'`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/domain/__tests__/tripMutations.test.ts
git commit -m "test(domain): add Tokyo/Kyoto boundary-drag regression"
```

---

## Task 6: Wire drag consumer in `App.tsx`

**Files:**
- Modify: `src/App.tsx:247-247` (dragState setters), `src/App.tsx:516-546` (drag effect)

- [ ] **Step 1: Capture original accommodations when a drag starts**

There are three `setDragState({...})` call sites (lines ~2058, ~2090, ~2179). For each, look at the surrounding code to find the stay being dragged (there will be a local variable like `stay` or a lookup `trip.stays.find(s => s.id === ...)`). Add `originalNightAccommodations: stay.nightAccommodations` to the dragState object.

Example — if the current call is:

```tsx
setDragState({
  stayId: stay.id,
  mode: 'resize-end',
  originX: e.clientX,
  originalStart: stay.startSlot,
  originalEnd: stay.endSlot,
});
```

Change to:

```tsx
setDragState({
  stayId: stay.id,
  mode: 'resize-end',
  originX: e.clientX,
  originalStart: stay.startSlot,
  originalEnd: stay.endSlot,
  originalNightAccommodations: stay.nightAccommodations,
});
```

Do this at all three setDragState call sites.

- [ ] **Step 2: Update the drag effect to consume new return shape and toast on mouseup**

Edit `src/App.tsx:519-547` (the `useEffect` that handles the drag). Current code:

```tsx
useEffect(() => {
  if (!dragState) return;
  const zone = timelineZoneRef.current;
  const visibleDays = zoomDays > 0 ? zoomDays : trip.totalDays;
  const slotWidth = (zone?.clientWidth ?? visibleDays * 42) / (visibleDays * 3);

  const applyDelta = (clientX: number) => {
    const delta = Math.round((clientX - dragState.originX) / slotWidth);
    updateTrip((curr) => ({
      ...curr,
      stays: applyTimelineDrag(curr.stays, dragState, delta, curr.totalDays * 3),
    }));
  };
  const onMove = (e: MouseEvent) => applyDelta(e.clientX);
  const onTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    applyDelta(e.touches[0].clientX);
  };
  const onUp = () => {
    hist.push(trip);
    setDragState(null);
  };
  // ...event listener setup
}, [/* deps */]);
```

Change to:

```tsx
useEffect(() => {
  if (!dragState) return;
  const zone = timelineZoneRef.current;
  const visibleDays = zoomDays > 0 ? zoomDays : trip.totalDays;
  const slotWidth = (zone?.clientWidth ?? visibleDays * 42) / (visibleDays * 3);

  let lastRemoved: AccommodationRemoval[] = [];

  const applyDelta = (clientX: number) => {
    const delta = Math.round((clientX - dragState.originX) / slotWidth);
    updateTrip((curr) => {
      const result = applyTimelineDrag(curr.stays, dragState, delta, curr.totalDays * 3);
      lastRemoved = result.removed;
      return { ...curr, stays: result.stays };
    });
  };
  const onMove = (e: MouseEvent) => applyDelta(e.clientX);
  const onTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    applyDelta(e.touches[0].clientX);
  };
  const onUp = () => {
    hist.push(trip);
    if (lastRemoved.length > 0) {
      const label =
        lastRemoved.length === 1
          ? `${lastRemoved[0].name} removed from ${lastRemoved[0].stayLabel}`
          : `${lastRemoved.length} accommodations removed`;
      notifyReversible(label, () => {
        const prev = hist.undo();
        if (prev) updateTrip(() => prev);
      });
    }
    setDragState(null);
  };
  // ...existing event listener setup unchanged
}, [/* existing deps */]);
```

Also add the import at the top of App.tsx (near the other domain imports):

```ts
import type { AccommodationRemoval } from './domain/accommodationAdjust';
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: no TypeScript errors.

- [ ] **Step 4: Verify existing tests still pass**

Run: `npm run test`
Expected: all tests PASS.

- [ ] **Step 5: Manual smoke test**

Start dev server: `npm run dev`

In the Japan demo trip:
1. Add a hotel to the last night of the first stay (should create a singleton group).
2. Drag the stay's right edge left by one day.
3. Expect: toast `"<Hotel name> removed from <Stay name>"` with Undo action. Clicking Undo restores the hotel.
4. Drag the edge further to reduce from 3 nights to 1 — hotel on middle nights, a multi-night group, should shrink silently (no toast if the remaining nights still share the same hotel).
5. Drag the boundary between two stays (shrink first, grow second) — no Hotel X appearing in stay Y.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat(app): surface accommodation removal toasts on timeline resize"
```

---

## Task 7: Wire `TripEditorModal` consumer

**Files:**
- Modify: `src/components/modals/TripEditorModal.tsx:92-98`

- [ ] **Step 1: Inspect the modal's save path**

Read `src/components/modals/TripEditorModal.tsx:87-103`. The `doSave(withClamp)` function calls `adjustStaysForDateChange` and then `onSave`. We need to propagate the `removed` list from the helper out to the App so it can toast.

- [ ] **Step 2: Extend the modal's props to forward `removed`**

`TripEditorModal` has an `onSave` prop. Check its type (likely `(patch: Partial<HybridTrip>) => void`). We'll piggyback by passing `removed` as a side-channel: add a new prop `onAccommodationsRemoved?: (removed: AccommodationRemoval[]) => void`. Consumer (App.tsx) wires it to fire the toast.

In `TripEditorModal.tsx`, at the top:

```ts
import type { AccommodationRemoval } from '@/domain/accommodationAdjust';
```

In the component props type (find the props interface), add:

```ts
onAccommodationsRemoved?: (removed: AccommodationRemoval[]) => void;
```

Destructure the prop in the function signature.

In `doSave` (around line 87):

```ts
const doSave = (withClamp: boolean) => {
  if (isPureDateMove) {
    onSave({ name, startDate, totalDays });
  } else if (withClamp || slotShift !== 0) {
    const adjusted = adjustStaysForDateChange(
      trip.stays,
      trip.visits ?? [],
      slotShift,
      newMaxSlot,
    );
    onSave({ name, startDate, totalDays, stays: adjusted.stays, visits: adjusted.visits });
    if (adjusted.removed.length > 0) {
      onAccommodationsRemoved?.(adjusted.removed);
    }
  } else {
    onSave({ name, startDate, totalDays });
  }
  onClose();
};
```

- [ ] **Step 3: Wire consumer in App.tsx**

Find where `<TripEditorModal ... />` is rendered in App.tsx (search for `TripEditorModal`). Add the new prop:

```tsx
<TripEditorModal
  // ...existing props
  onAccommodationsRemoved={(removed) => {
    const label =
      removed.length === 1
        ? `${removed[0].name} removed from ${removed[0].stayLabel}`
        : `${removed.length} accommodations removed`;
    notifyReversible(label, () => {
      const prev = hist.undo();
      if (prev) updateTrip(() => prev);
    });
  }}
/>
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: no TypeScript errors.

- [ ] **Step 5: Verify tests pass**

Run: `npm run test`
Expected: all PASS.

- [ ] **Step 6: Manual smoke test**

In `npm run dev`:
1. Create/open a trip with a stay that has a singleton accommodation on its last day.
2. Open the trip editor, reduce `totalDays` so that day is cut off.
3. Confirm the shrink dialog. Expect toast with Undo. Click Undo — accommodation restored.

- [ ] **Step 7: Commit**

```bash
git add src/components/modals/TripEditorModal.tsx src/App.tsx
git commit -m "feat(trip-editor): surface accommodation removal toasts on date shrink"
```

---

## Task 8: Update docs

**Files:**
- Modify: `docs/PRD.md` (Known Limitations / Data Model section)
- Modify: `docs/IMPROVEMENTS.md` (move this bug from open to closed)

- [ ] **Step 1: Update PRD**

Open `docs/PRD.md`. Find the Data Model or Known Limitations section. Add a short note:

```md
- When a stay is resized (via timeline drag or trip date shrink), per-night accommodations follow the stay: multi-night groups shrink/extend silently, singleton nights that are removed surface a toast with an undo action.
```

If a "Known Limitations" bullet previously described the accommodation-follows-day bug, delete it.

- [ ] **Step 2: Update IMPROVEMENTS**

Open `docs/IMPROVEMENTS.md`. Locate the Notion bug "accommodation attached to day only and not to destination...". Check it off `[x]` and append a note: `(fixed 2026-04-23, see docs/superpowers/specs/2026-04-23-accommodation-resize-design.md)`.

- [ ] **Step 3: Commit**

```bash
git add docs/PRD.md docs/IMPROVEMENTS.md
git commit -m "docs: document accommodation resize behavior"
```

---

## Self-Review

**Spec coverage:**
- Grow rules (end and start) — Task 1 tests ✓, Task 3 resize-end grow test ✓
- Shrink singleton removal — Task 1 tests ✓, Task 3 resize-end shrink test ✓, Task 4 adjustStaysForDateChange test ✓
- Cross-stay boundary drag — Task 5 ✓
- Trip date shift (no-op) — existing test coverage in Task 4's pre-existing tests ✓
- Trip date shrink past accommodation — Task 4 new test ✓
- Undo plumbing — Task 6 and Task 7 use `hist.undo()` ✓
- No data model migration — preserved throughout ✓

**Placeholder scan:** No "TBD", "TODO", or "handle edge cases" in steps. Every code step shows actual code.

**Type consistency:**
- `AccommodationRemoval` type defined in Task 1, imported in Tasks 3, 4, 6, 7 ✓
- `AdjustAccommodationsResult` — only used internally in the helper ✓
- `applyTimelineDrag` return type `{ stays, removed }` — tests updated in Task 3, consumer in Task 6 ✓
- `adjustStaysForDateChange` return type `{ stays, visits, removed }` — tests updated in Task 4, consumer in Task 7 ✓
- `DragState.originalNightAccommodations` — defined Task 2, produced in Task 6 Step 1, consumed in Task 3 ✓
