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

### 3. Destination wishlist / inbox

A **parking lot for destinations** — mirrors how visits have an unplanned inbox, but one level up for stays. Stays with `startSlot: -1` are "unplaced" — they exist with name, coords, color, notes, and even pre-planned visits, but aren't on the timeline.

#### Use cases
- **Research phase** — "I want to visit Kyoto, Nara, Osaka, maybe Hiroshima" — add them all to the wishlist, then place the ones you commit to on the timeline
- **Refactoring** — "I need to rearrange my timeline" — park a stay temporarily in the wishlist, move other stays around, then place it back
- **Maybe / stretch goals** — "If we have time, add Nara as a day trip" — keep it in the wishlist with notes and visits pre-planned, ready to slot in

#### Data model
No schema change needed. A wishlist stay is a regular `Stay` with sentinel values `startSlot: -1, endSlot: -1`. Everything else (name, color, coords, visits, notes, checklist, links, accommodations) is preserved. The timeline already filters by slot range, so these stays would be naturally excluded.

#### UX design decisions

**Where does the wishlist live?**

| Option | Pros | Cons |
|--------|------|------|
| **(A) New sidebar tab** — "Planned / Inbox / Wishlist" (3 tabs) | Always accessible, clear separation | Tab bar gets crowded |
| **(B) Section in the global view** — wishlist cards below planned stays when no stay is selected | No UI clutter, contextual | Hidden when a stay is selected |
| **(C) Section above/below timeline** — always visible strip | Always visible, easy drag-to-timeline | Takes vertical space from timeline |
| **(D) Collapsible section at the bottom of the sidebar** — visible in both tabs | Non-intrusive, always accessible | Can feel tucked away |

**Recommended: B + D hybrid** — show wishlist prominently in the global view (when no stay selected), and as a collapsible section at the bottom of the sidebar when a stay is selected. This way it's always reachable but never in the way.

**Adding to wishlist:**
- Current "Add destination" button opens `AddStayModal` → places on timeline
- Add a toggle or second button: "Add to wishlist" — same modal but skips duration picker, saves with `startSlot: -1`
- Or: the modal gets a "Save to wishlist" secondary action alongside "Add to Timeline"

**Placing from wishlist to timeline:**
- Click "Place on timeline" on a wishlist card → opens a lightweight modal with just a duration picker (name/coords already set)
- Or: drag the wishlist card onto the timeline → auto-creates with default 3 days at the drop position
- The stay's existing visits are preserved — if they had `dayOffset` values from a previous placement, they restore; otherwise they sit in the stay's inbox

**Parking a stay (timeline → wishlist):**
- In `StayEditorModal`, add a "Park in wishlist" button alongside Delete
- This sets `startSlot: -1, endSlot: -1` but **preserves everything** — visits keep their `dayOffset/dayPart` so if placed back at the same duration, the schedule restores
- Timeline gap left by the parked stay remains empty (user can shrink or fill)

**Map behavior:**
- Wishlist stays show on the map overview with a **distinct marker style** — e.g., dashed outline, lower opacity, or a "?" badge — to differentiate from placed stays
- Clicking a wishlist marker on the map could open its detail panel

**Wishlist card design:**
- Compact card showing: color dot, destination name, visit count, "Place" button
- Expandable to show notes, checklist progress, visit list
- Edit button opens `StayEditorModal` as usual
- Delete removes from wishlist entirely

#### Implementation steps
1. Filter `sortedStays` to exclude `startSlot < 0` for timeline rendering
2. Add `wishlistStays` derived value filtering `startSlot < 0`
3. Render wishlist section in global view and sidebar
4. Update `AddStayModal` with "Save to wishlist" option
5. Add "Park in wishlist" to `StayEditorModal`
6. Add "Place on timeline" action on wishlist cards (opens duration picker)
7. Show wishlist stays on map with distinct marker style

#### Complexity
Medium — no data model changes, mostly UI work. The stay already supports all fields; we just need the sentinel value convention and the UI to manage unplaced stays.

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

Implemented. See `docs/decisions/001-data-model-v2.md` for full details.
