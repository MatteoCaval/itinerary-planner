# Component audit — 2026-04-19

Full scan of every app component (50 files; 19 shadcn primitives noted separately, 31 app components audited in depth) against visual polish, UX friction, accessibility, mobile, motion, code quality, and performance.

---

## Top themes

### P0 — correctness or data-loss risk

1. **Destructive actions lack guards across panels.** History snapshot navigation (`HistoryPanel:36`), trip switch (`TripSwitcherPanel`), profile sign-out (`ProfileMenu`), visit delete (`VisitDetailDrawer:256`) all apply or remove data without a confirmation step.
2. **`renderToStaticMarkup()` runs on every render** in `TripMap/markerFactories.tsx:36,52,66` — icons are recreated each frame. Also affects `RouteSegments` (line 76) and `StayOverviewLayer` (lines 138, 182). Memoize / LRU-cache icons.
3. **`ClusteredMarkers` re-clusters on every `moveend`** (pan). Debounce needed — otherwise clustering recomputes constantly during drag.
4. **`useRouteGeometry` calls are not batched.** Rapid visit reordering triggers multiple concurrent OSRM requests.
5. **`ChronosErrorBoundary` directly renders `error.message`** without sanitization and has no `role="alert"`. Missing telemetry.
6. **`SortableVisitCard` uses `<p onClick={onSelect}>`** for selection — not keyboard-accessible, no focus ring, wrong role.
7. **`VisitFormModal` is 533 lines** — split into `ChecklistSection` + `LinksSection` subcomponents.

### P1 — state-of-the-art gaps

**Consistency across modals**

- Button ordering inconsistent — Cancel is left in 5 modals, right in 3, absent in 3. Pick one rule, apply everywhere.
- Header typography scales differ: `xs` (11px) in `ModalBase`, `sm` in `ImportFromCodeDialog`/`ShareTripDialog`, `22px` in `AuthModalSimple`.
- `AuthModalSimple` has no `DialogDescription` — a11y violation.
- No shared `ErrorMessage` primitive; each modal styles errors slightly differently.
- Loading UX varies — most use spinners, `AIPlannerModal` uses skeleton placeholders. Pick a standard.

**Accessibility**

- Input fields missing `htmlFor`/`id` associations in `AuthModalSimple`, `AccommodationEditorModal`, `RouteEditorModal`, `VisitFormModal`.
- No `aria-live` for search/loading state in any of the three geocoded-search modals.
- Icon-only buttons missing `aria-label` in several places (copy button in `ShareTripDialog`, duration steppers in `AddStayModal`).
- Map container has no `aria-label`; route polylines, cluster markers, stay markers have no `aria-description`.
- `WelcomeScreen` heading is not in an `<h1>`; timeline visualization lacks `aria-hidden` / `role="presentation"`.

**Mobile**

- Touch targets below 44px: `DraggableInventoryCard` side-by-side buttons (~24px), `SortableVisitCard` edit button, `MapControlsPanel` settings button (32px), `TripSwitcherPanel` row buttons (30px).
- Geocoded search dropdowns use `z-50 absolute` positioning that overflows on small screens (`AccommodationEditorModal`, `AddStayModal`, `VisitFormModal`).
- `VisitFormModal` category grid is `grid-cols-5` — too tight on phone; needs responsive breakpoint.
- `WelcomeScreen` decorative timeline uses percentage positions that break on small viewports.
- `MapControlsPanel` width is a fixed `w-56`.

**Code quality**

- No memoization on cards (`DraggableInventoryCard`, `SortableVisitCard`). Re-measure on every parent render.
- `App.tsx` passes ~15 props into `TripMap` — group into subsystem props objects.
- Duplicated form state patterns across 10 modals — candidates for a shared form hook.
- `WelcomeScreen` has hardcoded hex literals for demo timeline (magic values).
- `HistoryPanel` reverses history array on every render (line 26) — memoize.
- `MergeDialog`, `RouteEditorModal` have inline styles for gradients/colors — move to CSS classes.

**Motion / a11y**

- `prefers-reduced-motion` is respected in `index.css` globally but not component-side. Hover-scale and pulse animations still run for motion-averse users.
- Modal enter/exit has no transition beyond shadcn default. Revoke-confirm in `ShareTripDialog` pops in abruptly.
- Map `flyTo` durations inconsistent: 0.4s / 0.5s / 0.55s across `ClusteredMarkers`, `StayOverviewLayer`, `SelectedVisitHandler`. Standardize.

### P2 — polish

- `WelcomeScreen` CTAs have equal visual weight; primary action should dominate.
- `ChronosErrorBoundary` could migrate to a functional component with a hook (or shadcn's error pattern).
- `StayEditorModal` allows saving with empty name.
- `RouteEditorModal` has no validation.
- `ShareTripDialog` should show a fade-in on revoke confirmation.
- No keyboard shortcuts on any modal (no Cmd+Enter submit on most).
- `AIPlannerModal` tab underline uses `-mb-px` hack — switch to `data-state`.
- `StayOverviewPanel` accommodation rows don't use `font-num` on night counts.

---

## By-component quick index

**Cards**

- `DraggableInventoryCard` (117L): no memo, touch targets small, no reduced-motion, semantic role missing
- `SortableVisitCard` (143L): select handler on `<p>` (critical), complex 4-state ring logic, no memo

**Timeline / overview**

- `DroppablePeriodSlot` (84L): period icons too small (12px), no memoized `items` for `SortableContext`, empty-state affordance weak

**Landing / errors**

- `WelcomeScreen` (144L): semantic HTML gaps, hardcoded positions, CTAs not hierarchical, no mobile adapt of timeline
- `ChronosErrorBoundary` (51L): `role="alert"` missing, no telemetry, directly renders error message

**Date picker**

- `InlineDateRangePicker` (65L): parse called every render (memoize), no aria-label on summary

**Modals — content**

- `AccommodationEditorModal` (288L): autocomplete + geocoding dropdowns overflow on mobile, no inline validation
- `AddStayModal` (329L): candidate logic and location picker bolted together, no aria-live
- `AIPlannerModal` (411L): biggest modal; AI mapping should extract, tabs not semantic
- `AuthModalSimple` (233L): no `DialogDescription`, no email validation, inline gradient styles
- `ImportFromCodeDialog` (193L): Cancel disabled during loading (should stay enabled)
- `MergeDialog` (128L): clean
- `RouteEditorModal` (134L): inline styles for mode colors, no name validation
- `ShareTripDialog` (279L): copy button missing aria-label, revoke confirmation pops
- `StayEditorModal` (159L): save allowed with empty name
- `TripEditorModal` (243L): Delete confirm doesn't show impact (Shrink does — inconsistent)
- `VisitFormModal` (533L): needs split into sub-components
- `ModalBase`: used by 8/11 modals; 3 modals bypass it → inconsistencies

**Panels**

- `HistoryPanel` (108L): reverse on every render, no confirmation on past-snapshot click
- `ProfileMenu`: uses `alert()` for errors; no confirmation on sign-out
- `StayOverviewPanel`: consistent hero pattern, but no skeletons/loading
- `TripSwitcherPanel`: no confirmation on trip switch; list buttons small
- `VisitDetailDrawer`: delete has no confirmation; Escape handled manually

**TripMap subsystem**

- `index.tsx`: ~15-prop surface, should group
- `ClusteredMarkers`: no moveend debounce; icon creation inline
- `DayFilterPills`: fine
- `MapControlsPanel`: fixed width, small touch targets, legend not semantic
- `MapHandlers`: clean; some magic constants could get comments
- `markerFactories`: `renderToStaticMarkup` hot path — memoize/cache
- `RouteSegments`: route polylines have no aria-description
- `StayOverviewLayer`: same renderToStaticMarkup concern; inconsistent flyTo durations

**UI primitives (19 files)** — shadcn-generated, maintained upstream. Only `ModalBase`, `LocationPicker`, `kbd` are custom; rest are standard.

---

## Recommended next step

Three ways to approach this:

**A. Ship the P0 fixes as a standalone PR.** Destructive-action guards + map perf + VisitFormModal split + error boundary hardening. ~1 focused session. Highest impact, lowest risk.

**B. Tackle P0 + the cross-modal consistency work.** Adds button-ordering, header scale, shared ErrorMessage, DialogDescription fix. Bigger diff (~2 sessions) but closes the biggest state-of-the-art gap in one pass.

**C. Full sweep.** All P0 + P1 across every component. Multi-PR series.

My recommendation is **B** — the consistency work is cheap individually but compounds, and the UI just got rewritten so now is the moment to lock patterns in before they multiply.
