# Accommodation resize behavior — design

## Problem

Per-night accommodations on a stay are keyed by `dayOffset` within the stay (`Stay.nightAccommodations: Record<number, NightAccommodation>`, `src/domain/types.ts:45-46`). The keys are never remapped when a stay's boundaries change, so accommodations silently attach to the wrong dates after any of these operations:

- `applyTimelineDrag` resize-start / resize-end (`src/domain/tripMutations.ts:49-73`) — shifts `startSlot`/`endSlot` but not `nightAccommodations`.
- `adjustStaysForDateChange` (`src/domain/tripMutations.ts:83-137`) — clamps stays at trip-date shrink boundaries but doesn't touch accommodations.

User-visible symptom reported in Notion: "if I had Tokyo 3 days and Kyoto 3, and I increase Kyoto / shorten Tokyo, I see the Tokyo accommodation in the Kyoto destination detail."

Mechanism: Kyoto's `nightAccommodations[0]` was "Kyoto night 0, Hotel Kyoto." After Kyoto's start slot moves one day earlier (left-resize grows the stay), Kyoto now has four nights but `[0]` is still the old value — which now paints the new first night, a night that originally belonged to Tokyo. Same class of bug applies to any left-grow / right-shrink combination.

## Behavior spec

The rule is framed in terms of **accommodation groups** (runs of consecutive nights sharing the same hotel, already modelled by `deriveAccommodationGroups` in `src/domain/stayLogic.ts:47-80`).

### Stay grows at an edge

The adjacent accommodation group extends to cover the newly added nights.

- **Grow at end** (`endSlot` increases): the last group extends forward. The last night's accommodation value is copied onto each new night's key.
- **Grow at start** (`startSlot` decreases): the first group extends backward. After the resize, `dayOffset=0` shifts to refer to the new first night; existing keys shift by `+deltaDays`; new keys `0..deltaDays-1` receive the old first group's accommodation value.
- If the edge night was empty (no accommodation), the new nights stay empty — nothing is synthesised.

Silent. No toast. Rationale: common case is "extend my Tokyo stay by a night, still the same hotel." User-visible affordance for changing the new nights lives in the Sleeping section of `StayOverviewPanel`, which already supports editing per-group.

### Stay shrinks at an edge

Each dropped night is handled independently:

- Dropped night is part of a multi-night group (group has ≥ 2 nights before the drop) → group shrinks silently.
- Dropped night is the only remaining night of its group (singleton) → that accommodation is **removed**, and a sonner toast surfaces with an Undo action.

Toast copy (singular): `"<Accommodation name> removed from <Stay label> — Undo"`.
Toast copy (multiple singletons removed in one op): `"<N> accommodations removed — Undo"`.

Undo restores the pre-resize trip via the existing `useHistory` snapshot — the resize and the accommodation removal live in the same history entry, so one undo reverses both.

### Cross-stay boundary drag (the Tokyo/Kyoto case)

No special handling — the behaviour above applied to each side independently produces the right result:

- Tokyo's tail shrinks: last group shrinks silently (if multi-night), or singleton removal toast.
- Kyoto's head grows: first group extends backward (if any), or new first night stays empty.

No accommodation "moves" from Tokyo to Kyoto. No cross-city leak.

### Trip date shift (start moves without length change)

Already correct. Keys are `dayOffset` relative to the stay. Shifting `trip.startDate` doesn't change the stay's internal offsets. No work needed.

### Trip date shrink

`adjustStaysForDateChange` clamps stays that fall partially outside the new window. The same shrink rule applies to the clipped portion: multi-night groups shrink silently, singletons emit a toast entry.

If a stay is removed entirely (falls fully outside the window), its accommodations go with it. No toast — the stay removal itself is the user-visible event.

## Architecture

### New pure helper

`src/domain/accommodationAdjust.ts`:

```ts
export type AdjustResult = {
  nightAccommodations: Record<number, NightAccommodation> | undefined;
  removed: Array<{ name: string; stayLabel: string }>;
};

/**
 * Recomputes nightAccommodations after a stay's day range changes.
 * - oldDayCount / newDayCount: number of nights before/after the change.
 * - startShift: how many days were added (negative) or removed (positive) at the start.
 *   Positive startShift drops keys 0..startShift-1 before reindexing.
 *   Negative startShift prepends |startShift| keys, filled from the old first group.
 * - endShift: same for the end. Positive drops trailing keys; negative appends from last group.
 *
 * Returns the new nightAccommodations and any removed singleton accommodations
 * for toast surfacing.
 */
export function adjustAccommodationsForResize(
  oldAccoms: Record<number, NightAccommodation> | undefined,
  oldDayCount: number,
  newDayCount: number,
  startShift: number,
  endShift: number,
  stayLabel: string,
): AdjustResult;
```

Zero React dependency. Unit-testable in isolation. Lives next to `stayLogic.ts` / `tripMutations.ts`.

### Wiring

1. `applyTimelineDrag` (resize branches) — compute `startShift` / `endShift` from the drag delta, call `adjustAccommodationsForResize`, write the new `nightAccommodations` onto the stay, and return `removed` alongside the updated stays. The function's return type gains a `removed: Array<{ name; stayLabel }>` field.

2. `adjustStaysForDateChange` — same pattern applied after clamping. Returns `removed` alongside the current `{ stays, visits }`.

3. App layer (`src/App.tsx`) — both call sites already gate commits through `useHistory`. After committing the new trip state, if `removed.length > 0`, fire a sonner toast with Undo that calls `history.undo()`. Existing undo/redo plumbing covers the rollback; no new state needed.

### Group-awareness

The helper identifies "singleton" groups by scanning consecutive keys with equal `name` (same notion as `deriveAccommodationGroups`, but inline since we only need the singleton check, not full group objects). Two adjacent nights share a group iff `name` matches; other fields follow the name.

## Data model

No changes. `nightAccommodations: Record<number, NightAccommodation>` keying is preserved. Considered and rejected: rekeying by absolute date. Reasons:
- The behavioural rule is framed in stay-edge terms, not calendar-date terms.
- Date-keyed accommodations would allow "orphan" bookings not attached to any stay, which doesn't match the mental model.
- Migration cost for zero user-facing benefit.

## Testing

Unit tests for `adjustAccommodationsForResize` in `src/domain/__tests__/accommodationAdjust.test.ts`:

1. Grow-end preserves existing keys, extends last group forward.
2. Grow-end on empty last night leaves new nights empty.
3. Grow-start reindexes existing keys by `+startShift` and fills new prefix from original first group.
4. Grow-start on empty first night leaves new prefix empty.
5. Shrink-end drops trailing keys from a multi-night group silently (empty `removed`).
6. Shrink-end removes a singleton group and populates `removed`.
7. Shrink-start drops leading keys and reindexes.
8. Mixed shift (shrink-end + grow-start) produces correct union.
9. Shrink that strips every key returns `undefined` for `nightAccommodations`.
10. Multiple singleton removals in one op all appear in `removed`.

Integration coverage via existing `tripMutations` tests extended with:
- Tokyo/Kyoto boundary drag scenario produces no cross-stay leak.
- Trip date shrink past a singleton accommodation populates `removed`.

## Non-goals

- Rekeying by absolute date (rejected above).
- Warn-before-resize modals (rejected in brainstorming — too noisy for a sliding-boundary interaction).
- Richer undo affordance (e.g. persistent "recently removed" bin) — out of scope; the history snapshot is enough.
- Changes to the accommodation editor UI. The Sleeping section in `StayOverviewPanel` already covers adding/removing after a grow.

## Risks

- `applyTimelineDrag` is hot path — called during drag. The helper runs O(days in stay) per call. Fine for any realistic trip length.
- Firebase sync: `nightAccommodations` is a sparse object. The helper returns a reindexed dense object. Firebase sync already normalises sparse keys (`normalizeTrip`), so no new behaviour.
- Toast spam on rapid boundary drags: the toast fires once at commit time (end of drag), not per pointer-move. Using existing drag-commit pattern.
