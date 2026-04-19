# Component polish — design spec

**Date:** 2026-04-19
**Status:** Design approved, plan pending
**Branch target:** `feat/component-polish` — one PR, full sweep of P0 + P1 findings from the 2026-04-19 audit

**Source audit:** `docs/superpowers/audits/2026-04-19-component-audit.md`

---

## Goal

Close the P0 correctness/data-loss risks and the P1 state-of-the-art gaps from the component audit, in one coordinated PR. Lock cross-cutting patterns (button ordering, error surface, confirmations, reduced-motion) so future components inherit them automatically.

**Non-goals**

- No visual redesign beyond what's required to close audit findings. The UI-modernization PR already shipped the identity; this PR is consistency + robustness on top of it.
- No feature additions.
- No framework or dep overhaul (React, Tailwind, shadcn, dnd-kit, react-leaflet stay as-is). One new dep: `sonner` (shadcn's toast primitive).
- No layout or IA changes.
- Dark-mode audit stays out of scope (same deferral as before).

---

## Cross-cutting decisions (apply everywhere)

These are rules, not individual component fixes. Every component fix below assumes these are in effect.

### 1. Modal button ordering

**Cancel on the left, primary CTA on the right.** Destructive/secondary actions (e.g. `Delete`, `Move to inbox`) go far-left, separated by `flex-1`/spacer from the Cancel+CTA pair. This matches web industry default and avoids the macOS-right-primary convention that confuses users on linked web clients.

Pattern for `ModalBase` footer:

```
[Delete (destructive)]            [Cancel] [Primary CTA]
```

Audit all 11 modals and normalize. The modals currently in violation: `AccommodationEditorModal:275`, `StayEditorModal:140`, `TripEditorModal:230`.

### 2. Destructive-action confirmation

Two patterns, never mixed in one flow:

- **Reversible actions** (history snapshot nav, trip switch, accommodation removal, inbox-demote a stay): no confirmation — but apply a **toast with "Undo"** that reverts the action for 5 seconds. Use `sonner` via the shadcn toast primitive.
- **Destructive actions** (delete trip, delete stay, delete visit, revoke share, sign out): `AlertDialog` two-step. The confirmation must state **what exactly** is being lost (e.g. `"Delete Kyoto and its 12 places?"` — not just `"Are you sure?"`).

Add toast infrastructure once, use everywhere. Replace `window.alert()` in `ProfileMenu` with a destructive toast.

### 3. Shared `ErrorMessage` primitive

New component: `src/components/ui/ErrorMessage.tsx`.

```tsx
<ErrorMessage>Email is required</ErrorMessage>
<ErrorMessage tone="warning">Dates overlap with existing stay</ErrorMessage>
<ErrorMessage icon={<AlertCircle />}>Auth failed — check your password</ErrorMessage>
```

Props: `tone?: 'destructive' | 'warning' | 'info'` (default destructive), `icon?`, `children`, `className?`. Always renders as `<div role="alert" aria-live="polite">` when `tone==='destructive'`, `aria-live="polite"` otherwise.

Migrate every inline error in modals, panels, and `AuthModalSimple` to this primitive. Delete the one-off `bg-destructive/10` / `border-red-500/10` variants scattered across files.

### 4. Reduced-motion

- Keep the global CSS `@media (prefers-reduced-motion: reduce)` block in `src/index.css` — it handles duration/iteration overrides for keyframes.
- Add a `useReducedMotion()` hook in `src/hooks/useReducedMotion.ts` that returns `boolean`. Components that apply JS-driven motion (scale transforms on cards, hover pulses, drag opacity) opt in by gating with this hook. Simple `window.matchMedia('(prefers-reduced-motion: reduce)')` with subscription.

### 5. Touch targets

Anywhere an interactive element is currently below 44×44 CSS px, expand it. Use the existing `icon-sm` button size (28px) only when stacked vertically with padding that brings the hit region to 44px+. For side-by-side icon button rows, switch to `icon` (32px) or add padding around the group.

### 6. Modal header typography

`ModalBase` dictates the title style: `text-base font-semibold tracking-tight` (16px/semibold). Delete the custom larger heading in `AuthModalSimple`. All three non-`ModalBase` modals (`AuthModalSimple`, `ImportFromCodeDialog`, `MergeDialog`, `ShareTripDialog`) migrate to `ModalBase` — it already supports custom width, headers, and scrollable bodies.

If a modal needs a decorative accent (e.g. the teal gradient strip at the top of `AuthModalSimple`), that becomes a `<ModalBase accent>` prop — a thin teal gradient bar above the header. Don't let modals diverge in shell markup.

### 7. `DialogDescription` required

Every dialog ships a `DialogDescription` (sr-only is fine) summarizing the dialog's purpose. `ModalBase` already does this; the three migrations in rule 6 pick it up for free. Audit that `MergeDialog`, `ImportFromCodeDialog`, `ShareTripDialog` keep meaningful descriptions during migration.

### 8. Input labels

Every `Input`/`Textarea` field gets an associated `<label htmlFor>`. Visual design stays the same (placeholder-as-visual-label is allowed only when the field icon + placeholder fully convey intent, and the `<label>` is `sr-only`). Files to sweep: `AuthModalSimple`, `AccommodationEditorModal`, `RouteEditorModal`, `VisitFormModal`.

### 9. `aria-live` for async state

Geocoded-search modals (`AddStayModal`, `AccommodationEditorModal`, `VisitFormModal`, `StayOverviewPanel` inline search) wrap their "searching… / no results / stale" status strings in `<span aria-live="polite">`. AI planner loading/slow-warning message gets the same treatment.

### 10. Map a11y baseline

- Map container (`TripMap/index.tsx` — the root Leaflet container) gets `aria-label="Trip map"` and `role="application"`.
- Cluster markers get `aria-label={\`${count} places in cluster\`}`.
- Stay markers get `aria-label={\`${stayName}, ${dayCount} days\`}`.
- Route polylines get `aria-description={\`${transportMode} ${durationLabel} from ${fromName} to ${toName}\`}` where available.
- A `<div role="status" aria-live="polite" class="sr-only">` near the map announces major state changes: "map recentered on Kyoto", "5 markers visible", "day 3 filter applied".

---

## New primitives

Four new files under `src/components/ui/` and one hook:

| File                   | Purpose                                                                                                                                                                                                                                       |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ErrorMessage.tsx`     | Shared inline error/warning/info message per rule 3.                                                                                                                                                                                          |
| `PlaceSearchField.tsx` | Extracted from `VisitFormModal`/`AddStayModal`/`AccommodationEditorModal`: geocoded search input with debounced autocomplete, loading indicator, error + stale surfaces, map-pick button. Generic — receives `onPick(latlng, name)` callback. |
| `ChecklistSection.tsx` | Extracted from `VisitFormModal`: add/toggle/delete checklist items, duplicate warning. Receives `items`, `onChange`.                                                                                                                          |
| `LinksSection.tsx`     | Extracted from `VisitFormModal`: add/edit/delete links with URL normalization. Receives `items`, `onChange`.                                                                                                                                  |

One hook:

| File                            | Purpose                                                                          |
| ------------------------------- | -------------------------------------------------------------------------------- |
| `src/hooks/useReducedMotion.ts` | Subscribes to `matchMedia('(prefers-reduced-motion: reduce)')`. Returns boolean. |

One updated shadcn primitive:

- `src/components/ui/sonner.tsx` (new) — toast container using the `sonner` package. Mounted once in `App.tsx`.
- `npm install sonner` (+ types).

---

## Per-component fixes

Grouped by area. Each bullet maps to a concrete change. The plan turns these into tasks.

### Cards

**`DraggableInventoryCard.tsx`**

- Wrap in `React.memo`. Accept callbacks; require parent to pass stable references (use `useCallback` in `App.tsx`).
- Add `role="button"` + `tabIndex={0}` + keyboard handler on the card itself so keyboard users can focus and drag (dnd-kit keyboard sensor already present — just surface it).
- Side-by-side edit + locate buttons: change from `icon-sm` (28px) to `icon` (32px) and add horizontal padding to the group so the hit region is 44px+.
- Gate drag-opacity transition behind `useReducedMotion`.
- Increase grip handle contrast at rest: `text-muted-foreground/40` → `text-muted-foreground/60`.

**`SortableVisitCard.tsx`**

- Convert the select handler from `<p onClick={onSelect}>` to a proper `<button>` wrapping the name (or wrap `<p>` in a focusable `<button>`). `focus-visible:ring-2 ring-primary/40`. `aria-pressed` reflects selected state.
- Wrap in `React.memo`.
- Simplify ring logic: at most two visual states — `selected` and `drag-over`. Collapse the 4-state ternary into data-attributes (`data-selected`, `data-over`) and CSS variants.
- Gate `scale` / `opacity` transforms behind `useReducedMotion`.

### Timeline

**`DroppablePeriodSlot.tsx`**

- Memoize `visits.map()` for `SortableContext` `items` prop via `useMemo`.
- Increase period icons from `w-3 h-3` (12px) to `w-4 h-4` (16px).
- Replace `scale-[1.02]` hover animation with a background-tint change (no layout shift). Motion-safe already.
- Extract the `PeriodIcon` / `PeriodLabel` ternary into a `src/domain/periodDisplay.ts` helper (mirror of `visitTypeDisplay.ts`).
- Add `aria-describedby` wiring so screen readers hear which day + period they're in.

### Landing / error

**`WelcomeScreen.tsx`**

- Wrap the hero text in an `<h1>`. Add `<section>` landmarks. Mark the decorative timeline `aria-hidden="true"` / `role="presentation"`.
- Hide the decorative timeline at `<md` breakpoint (`hidden md:block` on its wrapper).
- Hoist the demo `stayPreviews` / transit chips arrays outside the component.
- Drop the inline `color-mix()` styles; use token-based Tailwind classes (`bg-[color:var(--primary-100)]` etc.). If `color-mix` is genuinely needed, assign to a named CSS class in `src/index.css`.
- CTAs: the primary ("Plan a trip") stays filled; demo and import become outline (consistent with rule 1).

**`ChronosErrorBoundary.tsx`**

- Add `role="alert"` + `aria-live="assertive"` on the fallback container.
- Route the caught error to `src/services/telemetry.ts` (already exists) instead of only `console.error`.
- Sanitize the rendered `error.message` — render via `{String(error.message).slice(0, 400)}` with no `dangerouslySetInnerHTML` (already the case, but add the length cap). Add an `aria-describedby` pointing at the message container.
- Focus management: call `focus()` on the primary "Try again" button on mount. Keep the class-component shape (React error-boundary API still requires it).

### Date picker

**`InlineDateRangePicker.tsx`**

- Wrap `parseDate` results in `useMemo` keyed on the string inputs.
- Validate input strings with `isValid` from date-fns before parsing; fall back to undefined silently.
- Add `aria-label` to the rendered summary span.
- Bump summary text from `text-[11px]` to `text-xs` (12px) on mobile.

### Modals (cross-cutting rewrites)

All modals converge on `ModalBase` + footer rule + `ErrorMessage` + `<label htmlFor>` + `aria-live` as described in cross-cutting decisions. Per-modal specifics below.

**`AccommodationEditorModal.tsx`**

- Migrate both dropdowns (autocomplete + geocoding) to `Popover` anchored to the input, so they can't overflow the modal on mobile.
- Replace inline `bg-destructive/10` + `text-red-600` error with `<ErrorMessage>`.
- Remove tri-state (autocomplete vs geocoding vs picked) by unifying into one `PlaceSearchField` instance. (The stay-local autocomplete is an override — pass `localSuggestions` prop to `PlaceSearchField` to list them above the geocoder results.)

**`AddStayModal.tsx`**

- Use `PlaceSearchField`.
- Duration stepper buttons get `aria-label="Increase days"` / `"Decrease days"` and arrow-key keyboard support (`onKeyDown` ↑/↓).
- Inline error box → `<ErrorMessage>`.

**`AIPlannerModal.tsx`**

- Extract the AI-result mapping (lines 83–163) into `src/aiService.ts` helpers: `transformAIResult(raw): HybridTrip`. The modal calls it instead of doing the work inline.
- Wrap tab row in `role="tablist"` with `aria-selected` on each tab. Drop the `-mb-px` hack.
- Loading skeleton + slow-warning get `aria-live="polite"`.
- Inline error → `<ErrorMessage>`.

**`AuthModalSimple.tsx`**

- Migrate to `ModalBase` with `accent="gradient"` to keep the top teal strip.
- Header text uses the shared title size.
- Email validation: simple regex (`^[^\s@]+@[^\s@]+\.[^\s@]+$`) at submit; surface with `<ErrorMessage>`.
- `<label htmlFor>` for both inputs; `Kbd` for the Cmd+Enter submit hint if present.
- Clear error on mode tab switch.
- Extract gradient button styling into a CSS class `.btn-gradient-primary` in `src/index.css`.

**`ImportFromCodeDialog.tsx`**

- Migrate to `ModalBase`.
- Cancel button stays enabled during loading.
- Status panel → `<ErrorMessage tone="...">` variants.

**`MergeDialog.tsx`**

- Migrate to `ModalBase`.
- No other changes required — modal is already clean.

**`RouteEditorModal.tsx`**

- Add `htmlFor`/`id` for duration + notes fields.
- Extract `modeConfig` into `src/domain/transportDisplay.ts`.
- Replace inline `borderColor` / `color` styles with token-driven Tailwind classes (each mode gets a CSS class with the color stored as a CSS variable).
- Required-field validation — at minimum, mode must be picked (it's pre-filled today, but validate on save).

**`ShareTripDialog.tsx`**

- Migrate to `ModalBase`.
- Copy button gets `aria-label="Copy share code"` + `Kbd`.
- Revoke confirmation uses `AlertDialog` (rule 2) instead of inline confirm state.
- Mode picker wrapped in `<fieldset>` with a `<legend className="sr-only">`.

**`StayEditorModal.tsx`**

- Require non-empty name; disable Save otherwise.
- "Move to inbox" keeps its two-step `AlertDialog` — no change.
- Normalize footer ordering per rule 1: `[Delete] ... [Cancel] [Save]`.

**`TripEditorModal.tsx`**

- Delete confirmation now shows impact (stays + visits count), matching the Shrink flow's pattern.
- Footer ordering per rule 1.

**`VisitFormModal.tsx`**

- **Split:** extract `ChecklistSection`, `LinksSection`, `PlaceSearchField`. Target: main modal at ≤ 300 lines.
- `<label htmlFor>` on every input; remaining inline errors → `<ErrorMessage>`.
- Category grid responsive: `grid-cols-3 md:grid-cols-5`.
- Duplicate-checklist-item warning gets `role="alert"` (but not `aria-live` since it's already a static message).

**`ModalBase.tsx`**

- Add `accent` prop (`'none' | 'gradient'`) for the AuthModal case.
- Expose a `footer` slot so modals can pass footer markup declaratively — `ModalBase` handles the ordering (destructive left, Cancel+CTA right) automatically. No modal writes its own footer `<div className="flex">` anymore.

### Panels

**`HistoryPanel.tsx`**

- `useMemo` the reversed history array.
- Show a toast with "Undo" when navigating to a past snapshot (rule 2).
- Wrap list in `<ul role="list">` with `<li>` children for semantic structure.

**`ProfileMenu.tsx`**

- Replace `window.alert()` with destructive toast.
- Sign-out uses `AlertDialog` (rule 2) — destructive by nature.

**`StayOverviewPanel.tsx`**

- Add skeleton placeholders for the hero image and stat tiles while `photo` or stay data are loading. Small, use the shared `Skeleton` primitive (add one under `src/components/ui/skeleton.tsx` if it doesn't already exist).
- Accommodation night counts switch to `font-num`.

**`TripSwitcherPanel.tsx`**

- Trip switch gets a toast+undo (rule 2).
- Row buttons: raise from 30px to 44px hit region.

**`VisitDetailDrawer.tsx`**

- Delete wraps in `AlertDialog` with impact text (rule 2).

### TripMap subsystem

**`markerFactories.tsx`**

- Introduce a module-level `Map<string, L.DivIcon>` cache keyed by `${kind}:${type ?? ''}:${selected ? 's' : ''}:${color ?? ''}`. Cap at 200 entries (LRU eviction via deletion of the oldest inserted key). Applies to `createIcon`, `createAccommodationIcon`, `createStayMarkerIcon`, `createClusterIcon`.
- Memoize `renderToStaticMarkup` output per icon identity. The cache entry already holds the resulting `DivIcon`.

**`ClusteredMarkers.tsx`**

- Debounce the `moveend` recompute to 120ms with a trailing-edge call.
- Use the new icon cache; drop the per-render `createIcon()` calls.

**`RouteSegments.tsx`**

- `aria-description` on polylines per rule 10.
- Debounce `useRouteGeometry` calls by 150ms so rapid visit reordering doesn't spray OSRM requests.
- Cache polyline `ChevronRight` HTML strings using the marker-factory cache.

**`StayOverviewLayer.tsx`**

- Same `renderToStaticMarkup` cache.
- Standardize `flyTo` duration to 0.4s (matching `ClusteredMarkers`).
- Candidate markers render lazily — skip map mount until first pan/zoom hits a candidate bounds (only relevant if candidate count > 20, otherwise render everything).

**`MapControlsPanel.tsx`**

- Width becomes responsive: `w-56 max-md:w-[min(90vw,14rem)]`.
- Settings button grows to `size-10` (40px) — just under 44 but within shadcn's `icon-lg`. If we need strict 44, switch to `size-11` with bigger padding. Go with `icon-lg` (40px).
- Legend: wrap in `<dl>` with `<dt>`/`<dd>` pairs.

**`DayFilterPills.tsx`** — no changes.

**`MapHandlers.tsx`** — add inline comments for the 150ms mount delay and 80ms `moveend` debounce rationale.

**`TripMap/index.tsx`**

- Group the ~15 props into `{ data, selection, mode, callbacks }` objects and update the single caller in `src/App.tsx`. This is the only "refactor" allowed by the non-goal rule — it's a prop surface cleanup, not a restructure.

### UI primitives (low-touch)

- `kbd.tsx` — already good.
- `LocationPicker.tsx` — add `aria-label="Pick location on map"` and keyboard support (Enter/Space to toggle). Pin drop updates an `aria-live` region announcing the new coordinates.
- Everything else (`button`, `input`, `dialog`, etc.) unchanged — they're shadcn-maintained.

---

## Rollout

Single PR on `feat/component-polish`. Scoped into 10 phases in the implementation plan, each phase a single subagent task + review:

1. Install `sonner`, add shadcn toast primitive + `useReducedMotion` hook.
2. Build `ErrorMessage` primitive + replace inline error sites.
3. Build `PlaceSearchField`, `ChecklistSection`, `LinksSection`. Migrate their call sites.
4. Rework `ModalBase` (add `accent` + `footer` slots). Migrate `AuthModalSimple`, `ImportFromCodeDialog`, `MergeDialog`, `ShareTripDialog` to `ModalBase`.
5. Button-ordering + footer normalization across the remaining modals.
6. Label associations + `aria-live` sweep across modals.
7. Cards + timeline: memo, semantic button roles, touch targets.
8. Destructive-action guards: integrate toast+undo for reversible, AlertDialog for destructive.
9. Map subsystem: icon cache, clustering debounce, route-geometry debounce, a11y labels.
10. Panels: skeletons, `<h1>` on Welcome, accommodation `font-num`, `TripSwitcherPanel` touch, final QA.

Each phase commits green (`npm run lint && npm run test && npm run build`). Manual visual QA runs after phases 2, 4, 7, 9, 10.

---

## Risks

- **Scope creep during the migration to `ModalBase`.** Three modals currently implement their own shell; moving them to the shared base will expose small inconsistencies. Mitigation: the rewrite is mechanical; the accent/footer slots are the only ModalBase additions allowed.
- **Icon cache eviction bugs.** The LRU is simple; test that selection/hover state changes still produce fresh icons.
- **Toast undo semantics.** The toast library's Undo action must fire synchronously from the user click — test that rapid-fire undo doesn't race a new commit. Accept that if a user issues a second reversible action before undoing the first, the first is no longer reversible (standard toast-undo UX).
- **Map a11y labels are verbose.** Screen reader users may get firehose messages. Mitigation: the `role="status" aria-live="polite"` announcer fires only on intentional state changes (filter toggles, mode switches), not on every render.

---

## Out of scope

- Dark-mode audit (still deferred).
- Any visual redesign beyond spacing/typography fixes.
- Test coverage expansion — existing tests must still pass; new tests only for the new primitives (`ErrorMessage`, `PlaceSearchField`, `ChecklistSection`, `LinksSection`, `useReducedMotion`).
- Storybook introduction.
- Performance optimization beyond the concrete map perf fixes called out.
- Refactors outside the prop-surface cleanup in `TripMap/index.tsx`.
