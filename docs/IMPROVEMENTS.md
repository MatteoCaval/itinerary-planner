# App Review — Issues & Improvements

Full audit conducted after the shadcn/ui migration. Covers every component, modal, panel, and the main App.tsx layout.

---

## P0 — Bugs / Broken Behavior

- [x] ~~**StayOverviewPanel crashes if stayDays is empty**~~ — already uses optional chaining, not a crash (false positive)
- [x] ~~**AuthModalSimple missing DialogTitle**~~ — already has DialogTitle at line 77 (false positive)
- [x] **ImportFromCodeDialog Cancel not disabled during loading** — added `disabled={status?.type === 'loading'}` → `ImportFromCodeDialog.tsx:159`
- [x] **Material Icons class used without import** — replaced `<span className="material-icons">#</span>` with Lucide `Hash` icon → `App.tsx:1893`
- [x] **Timeline stay block has duplicate settings icons** — removed decorative grip icon, replaced edit button icon with `Pencil`, made it visible on hover for all stays (not just selected) → `App.tsx:1469-1488`

---

## P1 — shadcn Migration Gaps

### Raw `<button>` elements (~30 in App.tsx)

These should use shadcn `Button` for consistent styling, focus states, and accessibility.

**Timeline section:**

- [x] ~~Extend before button~~ — left as-is (custom striped background styling)
- [x] ~~Extend after button~~ — left as-is (same)
- [x] ~~Shrink before button~~ — left as-is (custom absolute positioned)
- [x] ~~Shrink after button~~ — left as-is (same)
- [x] Add first stay (empty state) → migrated to `Button variant="outline"`
- [x] ~~Transit chip buttons~~ — left as-is (circular custom styling)
- [x] ~~Stay edit button~~ — fixed in P0 (replaced icon with Pencil)

**Map panel controls:**

- [x] ~~Layers/overview toggle~~ — left as-is (inside TooltipTrigger asChild)
- [x] ~~Mini/restore toggle~~ — left as-is (same)
- [x] ~~Fullscreen toggle~~ — left as-is (same)
- [x] ~~Hide map button~~ — left as-is (same)
- [x] ~~Show map (collapsed tab)~~ — left as-is (custom positioning)
- [x] Visit overlay close button → migrated to `Button variant="ghost" size="icon-sm"`
- [x] Visit overlay edit button → migrated to `Button variant="outline" size="xs"`

**Day columns:**

- [x] Add first stay (second instance) → migrated to `Button variant="outline"`
- [x] ~~Set accommodation (dashed)~~ — left as-is (custom dashed border)
- [x] ~~Accommodation bar button~~ — left as-is (complex spanning layout)
- [x] Add first stay (third instance) → migrated to `Button`

**Header:**

- [x] ~~Trip selector button~~ — left as-is (complex custom trigger)
- [x] ~~Date range button (desktop)~~ — left as-is (custom layout)
- [x] ~~Date range button (mobile)~~ — left as-is (same)
- [x] Mobile search close → migrated to `Button variant="ghost" size="icon-sm"`
- [x] Desktop search clear → migrated to `Button variant="ghost" size="icon-xs"`

**Other components:**

- [x] ChronosErrorBoundary — 2 raw buttons → migrated to `Button`
- [x] InlineDateRangePicker "Clear" button → migrated to `Button variant="link"`
- [x] DroppablePeriodSlot "Drop or add" button → migrated to `Button variant="outline"`
- [x] ~~HistoryPanel navigation buttons~~ — left as-is (custom list items)
- [x] ~~TripSwitcherPanel trip buttons~~ — left as-is (custom list items, "New Trip" already Button)
- [x] ~~StayOverviewPanel collapsible To-Do header~~ — left as-is (custom collapsible trigger)
- [x] VisitDetailDrawer "Back to stay" button → migrated to `Button variant="ghost"`
- [x] MergeDialog "Decide later" button → migrated to `Button variant="ghost"`

### Raw `<input>` elements (2 in App.tsx)

- [x] Mobile search input → migrated to `Input`
- [x] Desktop search input → migrated to `Input`

### Raw toggle buttons that should use ToggleGroup

- [x] AIPlannerModal mode toggle (scratch/refine) → migrated to `ToggleGroup`
- [x] AIPlannerModal model selector buttons → migrated to `ToggleGroup`

---

## P2 — Design System (Hardcoded Colors → Semantic Tokens) ✅

### Semantic tokens added to `index.css`

- [x] `--success` / `--success-foreground` (green)
- [x] `--warning` / `--warning-foreground` (amber)
- [x] `--info` / `--info-foreground` (blue)
- [x] Tailwind theme mappings (`--color-success`, etc.)

### Bulk migration completed

- [x] `App.tsx` — text, border, bg, hover, status dots all migrated
- [x] All 10 modal files — full migration
- [x] All 5 panel files — full migration
- [x] Both card files — full migration
- [x] WelcomeScreen, ChronosErrorBoundary, InlineDateRangePicker, DroppablePeriodSlot

**~200 hardcoded colors replaced.** ~43 intentional `slate-200/300` remain (very faint decorative elements: timeline buffer labels, grip handles, separators, lock icons — lighter than `muted-foreground` by design).

### Badge variant gaps (still open)

- [ ] Badges still use className overrides for success/destructive colors — could add proper Badge variants later

---

## P3 — UX Polish

### Forms & validation

- [x] **AddStayModal missing required `*` indicator** — added `text-destructive` asterisk
- [x] **RouteEditorModal / VisitFormModal have no `<form>` wrapper** — wrapped in `<form>`, Save→`type="submit"`, Enter-key submission works
- [x] ~~**Duration field accepts any text**~~ — placeholder "e.g. 2h 30m" provides guidance, free-text is intentional
- [x] **Checklist items can be duplicated** — added case-insensitive dedup check
- [x] ~~**No loading state on save buttons**~~ — saves are synchronous state updates, no spinner needed
- [x] **AuthModalSimple doesn't block Escape during loading** — onOpenChange now checks `!loading`

### Touch targets

- [x] **Delete buttons too small** — upgraded `icon-xs` to `icon-sm` in StayOverviewPanel and VisitDetailDrawer

### Text overflow

- [x] **Long visit notes show single line** — added `line-clamp-2` to SortableVisitCard
- [x] **Long visit/stay names truncated without tooltip** — added native `title` attributes
- [x] **Long email in ProfileMenu truncated without tooltip** — added `title={user.email}`
- [x] **Trip name in footer uses `slice(0, 24)`** — replaced with CSS `truncate max-w-[200px]`

### Layout

- [x] **AI explanation can overflow modal** — added `max-h-40 overflow-y-auto`
- [x] **ProfileMenu dropdown is fixed `w-60`** — added `max-w-[calc(100vw-2rem)]`
- [x] **HistoryPanel has fixed `max-h-96`** — changed to `max-h-[min(24rem,calc(100vh-12rem))]`
- [x] ~~**Timeline height hardcoded to 140px**~~ — intentional for compact timeline, no change needed
- [x] ~~**StayOverviewPanel stats grid unconditionally 3-col**~~ — sidebar is fixed `w-64` and hidden on mobile, 3-col is fine

### Mobile

- [x] **No sync status visible on mobile** — added sync dot indicator in header (`md:hidden`)
- [x] **Sheet height `h-[85dvh]`** — changed to `h-[85vh]` for universal support
- [x] **Mobile tab bar shipped.** 3 tabs (Plan / Map / More), push-page stack for visit and stay detail, header stay chip on Plan. Edit affordance asymmetric — visits editable, trip structure read-only. Deferred for follow-up: map controls stripping, `map.invalidateSize()` on tab return, help sheet, trip summary page.

### Labeling & copy

- [x] **"Go Back" button in TripEditor shrink confirmation** — changed to "Adjust Dates"
- [x] **ImportFromCodeDialog placeholder** — changed to "Enter share code (e.g. TRIP-ABC123)"
- [x] **AI model selector has no descriptions** — added "Fast & free", "Balanced", "Best quality" under each model
- [x] **AddStayModal search error UX** — improved copy: "try a different name, or just type your destination and save"

---

## P4 — Low Priority / Nice to Have

### Accessibility

- [x] `aria-live="polite"` on ImportFromCodeDialog status messages — added `role="status" aria-live="polite"`
- [x] MergeDialog trip name lists — added `aria-label="Local trips"` / `aria-label="Cloud trips"`
- [x] Focus-visible styling on HistoryPanel and TripSwitcherPanel buttons — added `focus-visible:ring-2 focus-visible:ring-ring`
- [x] ModalBase `DialogDescription` — changed to "Dialog for: {title}"
- [x] ~~StayEditorModal color buttons focus ring~~ — already correct, focus ring is outside the ternary

### Code quality

- [x] ~~Magic numbers in stay slot calculations~~ — comments already present in code
- [x] ~~Three duplicate "Add first stay" buttons~~ — intentional, each has different context/styling
- [x] **CSS variables fallback in accommodation bar** — added `var(--day-col-width, 288px)` and `var(--day-col-gap, 20px)`
- [x] **`prefers-reduced-motion` on map resize handle** — added `motion-reduce:transition-none`
- [x] ~~Inconsistent modal padding~~ — intentional: AuthModal has branded layout, MergeDialog/ImportDialog are standalone

### Security

- [x] **AI API key placeholder** — changed from "AIza…" to "Paste your API key"

### Data integrity

- [x] ~~StayEditorModal custom color input~~ — native `<input type="color">` always returns valid `#rrggbb`
- [x] **Password hint on AuthModalSimple** — added "Password should be at least 6 characters" warning for signup

---

## Feature Ideas (from Notion)

### 1. Custom block for flights

- [ ] **Flight card between stays** — replace or augment the current transit chip (circular icon between stays on the timeline) with a richer "flight card" that shows airline, flight number, departure/arrival times, terminal, booking reference
- **Approach:** Create a `FlightInfo` type extending the existing `travelNotesToNext` field on `Stay`. Add a dedicated `FlightEditorModal` (similar to `RouteEditorModal` but with structured fields: airline, flight #, departure time, arrival time, terminal, booking ref, seat). Render as an expanded card between stays on the timeline when transport mode is `flight`. In the day columns, show a flight summary card at the transition between stays.
- **Complexity:** Medium — new data type + modal + timeline rendering. No external API needed.

### 2. Map inside the page, not as overlay

- [ ] **Inline map layout** — replace the floating/overlay map panel with a side-by-side layout where the map is a permanent panel alongside the day columns
- **Approach:** Two layout options to consider:
  - **(A) Split pane:** Map takes the right portion of the main area (like current expanded mode but permanent). Day columns scroll on the left. Use a draggable divider (already have `startMapResize`). The current floating panel + collapse/expand/mini modes would be replaced by a simpler toggle.
  - **(B) Map as a tab/row:** Map sits below the timeline as a full-width band, with day columns below it. Less ideal for side-by-side reference.
  - Option A is better — it's closer to Google Maps / Wanderlog UX. Keep the current floating mode as a mobile fallback. Desktop gets permanent split. The map resize handle already exists; just change the CSS from `absolute` positioning to `flex` layout.
- **Complexity:** Medium-High — layout restructuring, but no new features. Must preserve mobile (Sheet) behavior.

### 3. Destination wishlist / inbox ✅ Shipped

A **parking lot for destinations** — mirrors how visits have an unplanned inbox, but one level up for stays. Candidate stays live in `trip.candidateStays` (data model v3) and are not placed on the timeline.

**Implemented:**

- `AddStayModal` — "Save to inbox" path saves a candidate without dates; "Pick from inbox" chip lets users promote a candidate onto the timeline with dates
- `StayEditorModal` — "Move to inbox" button demotes any scheduled stay to the inbox; visits travel with the stay and become unscheduled
- Overview map shows candidate stays as ghost markers to indicate potential destinations
- Migration v2→v3 adds `candidateStays: []` to existing trips; `normalizeTrip` defends against Firebase stripping empty arrays

#### Per-stay to-do (already exists)

`StayTodoSection` in `StayOverviewPanel.tsx` provides a collapsible checklist per stay. Accessible via sidebar "Details" tab. Enhancement ideas:

- Show to-do progress on timeline stay block (e.g., "3/5" badge)
- Show uncompleted to-dos in the global itinerary view
- Add due dates or priority to checklist items

### 4. Click unplanned place to see it on map

- [x] **Map preview for unplanned visits** — MapPin button on inbox cards flies to location on map, temporarily shows marker
- **Approach:** Unplanned visits already have `lat/lng` from geocoding. When clicking an inbox card:
  1. Set `selectedVisitId` to that visit's id
  2. Temporarily include unplanned visits in `mapVisits` (currently filtered to scheduled-only)
  3. The map's `SelectedVisitHandler` will fly to the visit's location
  4. Show a subtle marker (maybe with a dashed outline or different opacity to indicate "unplanned")
  5. Clicking away or selecting another item clears it
- **Complexity:** Low-Medium — need to adjust `mapVisits` filter logic and add the inbox card click handler. Marker is already supported.

### 5. Google Maps integration features

- [ ] **"Open in Google Maps" links** — add contextual links/buttons to open locations in Google Maps
- **Approach — multiple features under this umbrella:**
  - **Open in Google Maps button** on visit detail drawer and stay overview panel. URL format: `https://www.google.com/maps/search/?api=1&query={lat},{lng}` or `https://www.google.com/maps/place/?q=place_id:{name}`. Simple external link, no API key needed.
  - **Navigate to** button — deep link to Google Maps navigation: `https://www.google.com/maps/dir/?api=1&destination={lat},{lng}`. Opens turn-by-turn in the user's Google Maps app on mobile.
  - **Embed Google Street View** — show a Street View thumbnail for each visit using the Street View Static API (requires API key). Nice-to-have, adds visual context.
  - **Google Places autocomplete** — replace Nominatim search with Google Places API for better results, photos, ratings, opening hours. Significant upgrade but requires API key + billing.
  - **Route planning via Google Directions** — replace OSRM with Google Directions API for more accurate travel times between visits. Could show driving/transit/walking time estimates.
- **Recommended first step:** Just add "Open in Google Maps" and "Navigate" buttons — zero API cost, immediate value. Use `ExternalLink` and `Navigation` lucide icons.
- **Complexity:** Low for links, High for full Places/Directions integration.

---

## Data Model v2 Migration ✅

Implemented. See PR description for full rationale.

---

## IA & Layout Critique — 2026-04-19

Follow-up to the component polish PR. This section is about **whether each surface earns its place** and whether the app's information architecture could be better, rather than code quality. Full analysis in `docs/superpowers/audits/2026-04-19-ia-critique.md`.

### Littles — actionable, low-risk, one PR

- [ ] **Toolbar reshuffle.** AI Planner + Share + Import promoted out of the kebab menu into the top bar. Kebab retains Export/Import-JSON/History as utility overflow. Account moves to a persistent avatar.
- [ ] **`?` help sheet.** Keyboard shortcuts, feature list, one-line descriptions of non-obvious features (AI planner, share code, day filters, undo/redo). New component, one button.
- [ ] **Route edit → inline popover.** Clicking a transit chip opens a Popover right there with mode/duration/notes. `RouteEditorModal` deleted.
- [ ] **Accommodation inline edit.** Tap a grouped block in `StayOverviewPanel`'s Sleeping section → expands in place. `AccommodationEditorModal` retained only for "add new" from the day chip.

### Bigs — need a decision before speccing

Each of these changes how the app fundamentally works. Not to be shipped without a dedicated conversation.

- [ ] **A. Map default visibility.** Today the map claims ~500px of the right side always. Options:
  - _Collapsed by default, expands on first map-relevant action;_
  - _Tabbed workspace ("Plan" / "Map" mutually exclusive);_
  - _Context-aware auto-appear (once visits have coords)._
- [x] **B. Sidebar split.** Shipped as two-pane (details on top, inbox pinned below, resizable splitter with keyboard + collapse). Mobile tab-bar shell ships separately (Plan / Map / More tabs, push-page stack, asymmetric edit). Backlog rail option kept on file as a possible future upgrade.
- [ ] **C. Desktop/mobile drawer paradigm.** Visit detail is a right-drawer on desktop, a bottom-sheet on mobile. Unify on bottom-sheet everywhere (Google Maps / Airbnb pattern) or keep divergence behind a preference.
- [ ] **D. Timeline vs day columns.** Both always visible; both time-ordered. Options:
  - _Auto-collapse timeline to a 32px strip when working in day columns;_
  - _Two tabs (Timeline / Days) as mutually exclusive views;_
  - _Status quo._
- [ ] **E. M/A/E slot model.** Morning/afternoon/evening slots enforce a structure real trips often blur. Options:
  - _Add "all-day" as a fourth bucket;_
  - _Switch to free-form time ranges (start/end with proportional rendering);_
  - _Progressive disclosure — keep slots as default, allow per-visit precise time as opt-in._
- [ ] **F. Trip summary page.** No overview today — opening a trip drops you into planning. Add a "Summary" tab: total days/places/hotels, accommodation cost total, % days planned vs empty, first/last dates, transport breakdown.

### Discoverability and polish bits

- [ ] **Visit type list is western-tourist-coded** (food/landmark/museum/walk/shopping). Missing: hotels-as-stops, hikes, meetings, shopping districts. Either expand or switch to free-form tags.
- [ ] **Day cards have no headline field.** Users think "the museum day," "the onsen day" — the app doesn't have a slot for that per-day label.
- [ ] **Checklist and Links features are invisible** unless you open a visit's detail. No onboarding hint, no count badge in card views.
- [ ] **Sync status hidden on mobile** — the existing footer sync dot doesn't appear on small screens (noted in CLAUDE.md but still open).
- [ ] **Keyboard shortcuts undocumented.** Undo/redo wired, no user-facing mention.

### Redundant / overlapping surfaces

- [ ] **Three entry points to edit a stay** (timeline pencil, sidebar edit button, StayEditorModal). Consolidate.
- [ ] **Two inboxes conceptually** — sidebar inbox tab + mobile bottom drawer inventory. Works, but makes "inbox" feel ambiguous (stay-scoped vs global).
- [ ] **Share and Import are sibling flows in different modals.** Could be one "Collaborate" surface with tabs.
