# Destination Inbox — Design

**Date:** 2026-04-17
**Status:** Draft

## Summary

Extend the existing context-scoped inbox to work at trip level. Currently the inbox holds **visits** tied to a stay. Add a second inbox, visible in overview mode, that holds **candidate destinations** — stays not yet placed on the timeline. Support moving stays bidirectionally between timeline and inbox.

This also fixes the existing bug where the `+` button in global overview does nothing because no `selectedStay` is set.

## Motivation

Users research destinations before committing them to dates. Today the only way to "save" a destination is to add it to the timeline immediately with a date range. The overview inbox becomes a staging area for candidates, and the workflow around `AddStayModal` becomes: either fill a fresh stay or promote one you've already saved.

## Data model

```ts
// src/domain/types.ts
interface HybridTrip {
  // ...existing
  stays: Stay[];            // scheduled (on timeline)
  candidateStays: Stay[];   // NEW — inbox for destinations not yet scheduled
  visits: VisitItem[];      // trip-level — stayId can reference either array
  // ...
}
```

- `Stay` shape unchanged — candidates reuse the same type. `startSlot`/`endSlot` values on candidates are never read by timeline code (which iterates `trip.stays` only). On demote we leave whatever values were there; on promote the user picks new dates which set them.
- `trip.visits` references `stayId` that may live in either array. Visits travel with the stay on promote/demote. Scheduled visits (`dayOffset !== null`) get unscheduled on demote.
- Trip `version` bumps to `3`. `migrateV2toV3` adds `candidateStays: []` to existing trips.
- `normalizeTrip` coerces `candidateStays ?? []` (Firebase may strip empty arrays; same defense as the `dayOffset` fix).

## UI

### Overview sidebar inbox

In overview mode (`!selectedStay`), the existing `unplanned` tab switches content from per-stay visits to `trip.candidateStays`.

- Each row: candidate card (name, color swatch, coords/region hint, thumbnail if image).
- Actions on card: `Edit` (opens `AddStayModal` pre-filled, save writes back to candidate), `Delete`, `Promote` (explicit button → opens `AddStayModal` with dates flow).
- Card body click → selects candidate, pans overview map to coords, highlights its pin. Selecting a candidate does **not** switch `mapMode` to `stay` or `detail` — the view stays in overview.
- Empty state: "No destinations in inbox yet. Add places you're considering, then move them to the timeline when ready."

### `+` button (bug fix + extension)

- Overview mode → opens `AddStayModal` in **candidate mode** (date picker hidden; save writes to `candidateStays`).
- Stay mode (existing) → unchanged, opens `VisitFormModal` for per-stay inbox.

### `AddStayModal` — Pick from inbox

When opened via the timeline `+` (fresh add):

- Top of modal: **"From inbox"** row — horizontally scrolling chips of `trip.candidateStays` (name + color swatch).
- Click chip → modal's name/coords/image/notes fields auto-fill from that candidate; chip highlighted.
- "Clear" link deselects, reverts to empty fields.
- Empty `candidateStays` → section hidden entirely.

Save behavior:

- Candidate selected → **promote**: remove from `candidateStays`, insert into `stays` with chosen dates. Visits keep their `stayId`.
- No candidate selected → normal fresh stay add.

Opening via a candidate's `Promote` button pre-selects that chip and pre-fills fields. Same save flow.

### Demote — from `StayEditorModal`

Add "Move to inbox" action next to Delete.

1. Confirm dialog: "Move [stay name] to inbox? Scheduled visits will be unscheduled."
2. On confirm:
   - Move stay object from `trip.stays` to `trip.candidateStays`.
   - All visits with matching `stayId` get `dayOffset: null, dayPart: null`.
   - Drop any `Route` with `fromStayId === stay.id || toStayId === stay.id`.
   - If demoted stay was `selectedStayId`, clear selection (returns to overview).
3. Close modal, toast: "Moved [name] to inbox".

Undo via existing history (Cmd+Z) — push snapshot before mutation. Same for promote (both mutations are `hist.push`-wrapped).

### Map — candidate pins in overview

- In `mapMode === 'overview'`, `TripMap` receives a new `candidateStays` prop.
- `StayOverviewLayer` renders candidates in a separate marker group with a visually distinct style (dashed/ghost: outlined circle, ~60% opacity, candidate's color).
- Candidate pin click → selects candidate (same as inbox card click).
- Candidate pins excluded from trip route lines (routes only connect scheduled stays).

## Architecture

Pure logic lives in `src/domain/tripMutations.ts`:

```ts
promoteCandidateStay(trip: HybridTrip, candidateId: string, startSlot: number, endSlot: number): HybridTrip
demoteStay(trip: HybridTrip, stayId: string): HybridTrip
```

Both pure. `App.tsx` calls them via `updateTrip`. Visit-attachment, route-cleanup, and selection-reset logic all inside `demoteStay` so React component layer stays thin.

`AddStayModal` grows a new prop/state:
- `candidates: Stay[]` (injected from parent)
- internal `selectedCandidateId: string | null` — when set, fields pre-fill and save path triggers promote
- `mode: 'schedule' | 'candidate'` — when `candidate`, date picker hidden, save writes to `candidateStays` instead of `stays`

`StayEditorModal` gains `onDemote?: () => void` prop.

## Testing

Domain-first (Vitest):

- `migration.test.ts` — `migrateV2toV3` adds empty `candidateStays`; idempotent on already-v3 trips.
- `migration.test.ts` — `normalizeTrip` coerces missing `candidateStays` to `[]` (Firebase strip defense).
- `tripMutations.test.ts`:
  - `promoteCandidateStay` moves stay between arrays, sets `startSlot`/`endSlot`, preserves visits by `stayId`.
  - `demoteStay` moves stay to `candidateStays`, unschedules attached visits, drops routes referencing the stay.
  - `demoteStay` with no-op stayId returns trip unchanged.

UI tests (Testing Library, following `LocationPicker.test.tsx` pattern):

- `AddStayModal` — chip selection fills fields; "Clear" resets; chip row hidden when `candidates` empty.
- `StayEditorModal` — "Move to inbox" triggers `onDemote`.

## Known limitations (MVP)

- Route cleanup on demote is simple drop — no auto-reconnect of surrounding stays. User re-configures.
- Candidate stays don't participate in cloud sync share-codes beyond standard trip sync (no separate share surface).
- No drag-and-drop between timeline and inbox — promote/demote are explicit actions only.

## Migration

- Trip `version: 2` → `3`: add `candidateStays: []`.
- `normalizeTrip` coerces absent `candidateStays` to `[]` for Firebase-loaded trips where the array was stripped.
- Legacy v1 trips migrate v1→v2→v3 chain unchanged.
