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
- [ ] **No loading state on save buttons** — user gets zero feedback after clicking Save → all modals
- [x] **AuthModalSimple doesn't block Escape during loading** — onOpenChange now checks `!loading`

### Touch targets
- [x] **Delete buttons too small** — upgraded `icon-xs` to `icon-sm` in StayOverviewPanel and VisitDetailDrawer

### Text overflow
- [x] **Long visit notes show single line** — added `line-clamp-2` to SortableVisitCard
- [ ] **Long visit/stay names truncated without tooltip** → `VisitDetailDrawer.tsx:111`, `StayOverviewPanel.tsx:104`
- [ ] **Long email in ProfileMenu truncated without tooltip** → `ProfileMenu.tsx:131`
- [x] **Trip name in footer uses `slice(0, 24)`** — replaced with CSS `truncate max-w-[200px]`

### Layout
- [x] **AI explanation can overflow modal** — added `max-h-40 overflow-y-auto`
- [x] **ProfileMenu dropdown is fixed `w-60`** — added `max-w-[calc(100vw-2rem)]`
- [x] **HistoryPanel has fixed `max-h-96`** — changed to `max-h-[min(24rem,calc(100vh-12rem))]`
- [ ] **Timeline height hardcoded to 140px** → `App.tsx:1075`
- [ ] **StayOverviewPanel stats grid unconditionally 3-col** — can compress on narrow widths → `StayOverviewPanel.tsx:80`

### Mobile
- [x] **No sync status visible on mobile** — added sync dot indicator in header (`md:hidden`)
- [x] **Sheet height `h-[85dvh]`** — changed to `h-[85vh]` for universal support

### Labeling & copy
- [x] **"Go Back" button in TripEditor shrink confirmation** — changed to "Adjust Dates"
- [ ] **ImportFromCodeDialog placeholder "e.g. TRIP-ABCD"** — insufficient format guidance → `ImportFromCodeDialog.tsx:132`
- [ ] **AI model selector has no descriptions** — users can't distinguish between models → `AIPlannerModal.tsx:314-337`
- [x] **AddStayModal search error UX** — improved copy: "try a different name, or just type your destination and save"

---

## P4 — Low Priority / Nice to Have

### Accessibility
- [ ] `aria-live="polite"` missing on ImportFromCodeDialog status messages → `ImportFromCodeDialog.tsx:137`
- [ ] MergeDialog trip name lists missing `aria-label` → `MergeDialog.tsx:60-85`
- [ ] Focus-visible styling missing on HistoryPanel buttons, TripSwitcherPanel buttons, DroppablePeriodSlot add button
- [ ] ModalBase `DialogDescription` just repeats the title — should be meaningful → `ModalBase.tsx:41`
- [ ] StayEditorModal color buttons — focus ring only visible when color matches → `StayEditorModal.tsx:65-73`

### Code quality
- [ ] Magic numbers in stay slot calculations (`< 6` for 2 days, `< 3` for 1 day) — extract as constants → `App.tsx:1426-1427`
- [ ] Three duplicate "Add first stay" buttons in different locations → `App.tsx:1271, 1786, 1945`
- [ ] CSS variables `--day-col-width` / `--day-col-gap` used without fallback in accommodation bar → `App.tsx:1869`
- [ ] `prefers-reduced-motion` not checked on map resize handle animation → `App.tsx:2002-2008`
- [ ] Inconsistent modal padding: ModalBase uses `px-4 py-3.5`, AuthModal uses `px-8 pt-7 pb-6`, MergeDialog/ImportDialog use `p-5`

### Security
- [ ] AI API key placeholder "AIza..." reveals key prefix pattern → `AIPlannerModal.tsx:290`

### Data integrity
- [ ] StayEditorModal custom color input has no hex validation → `StayEditorModal.tsx:76-83`
- [ ] No password strength indicator on AuthModalSimple → `AuthModalSimple.tsx:120`
