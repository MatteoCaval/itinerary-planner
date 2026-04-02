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

## P2 — Design System (Hardcoded Colors → Semantic Tokens)

### Missing semantic tokens

The app has ~200+ hardcoded Tailwind color classes. Define these tokens in `index.css` then migrate:

```css
:root {
  --success: oklch(0.55 0.15 155);
  --success-foreground: oklch(0.98 0 0);
  --warning: oklch(0.7 0.15 75);
  --warning-foreground: oklch(0.98 0 0);
  --info: oklch(0.55 0.15 250);
  --info-foreground: oklch(0.98 0 0);
}
```

### Migration map

| Hardcoded | Semantic replacement | Occurrences |
|-----------|---------------------|-------------|
| `text-slate-400`, `text-slate-500` | `text-muted-foreground` | ~80+ |
| `text-slate-700`, `text-slate-800` | `text-foreground` | ~40+ |
| `text-slate-900` | `text-foreground` | ~10 |
| `border-slate-200` | `border-border` | ~30+ |
| `bg-slate-50` | `bg-muted` | ~20+ |
| `hover:bg-slate-50` | `hover:bg-muted` | ~15+ |
| `text-emerald-*` / `bg-emerald-*` | `text-success` / `bg-success/10` | ~15 |
| `text-red-*` / `bg-red-*` (non-destructive) | `text-destructive` / `bg-destructive/10` | ~10 |
| `text-blue-*` / `bg-blue-*` | `text-info` / `bg-info/10` | ~5 |

### Files with most violations

- `App.tsx` — pervasive throughout header, timeline, sidebar, map panel, footer
- `StayOverviewPanel.tsx` — ~20 instances
- `VisitDetailDrawer.tsx` — ~15 instances
- `ProfileMenu.tsx` — ~15 instances (emerald, blue, violet, slate)
- `HistoryPanel.tsx` — ~10 instances (emerald, red, slate)
- `DraggableInventoryCard.tsx` / `SortableVisitCard.tsx` — ~10 each
- `WelcomeScreen.tsx` — ~10 instances
- `ChronosErrorBoundary.tsx` — ~8 instances
- `DroppablePeriodSlot.tsx` — ~5 instances
- `InlineDateRangePicker.tsx` — ~3 instances

### Badge variant gaps

Badges use hardcoded color overrides via className instead of proper variants:
- `text-emerald-600 bg-emerald-50` → need `variant="success"`
- `text-red-500 bg-red-50` → need `variant="destructive"` (may exist, verify)
- `text-primary bg-primary/10` → already works with `variant="secondary"`

Affected: `HistoryPanel.tsx:64-80`, `StayOverviewPanel.tsx:253`, `VisitDetailDrawer.tsx:154`

---

## P3 — UX Polish

### Forms & validation
- [ ] **AddStayModal missing required `*` indicator** on destination field — `AddStayModal.tsx:68`
- [ ] **RouteEditorModal / VisitFormModal have no `<form>` wrapper** — no Enter-key submission → multiple files
- [ ] **Duration field accepts any text** without format validation → `RouteEditorModal.tsx:85-90`
- [ ] **Checklist items can be duplicated** — no dedup check → `VisitFormModal.tsx:78-82`
- [ ] **No loading state on save buttons** — user gets zero feedback after clicking Save → all modals
- [ ] **AuthModalSimple doesn't block Escape during loading** — can interrupt auth flow → `AuthModalSimple.tsx:50-54`

### Touch targets
- [ ] **Delete buttons too small** — `icon-xs` (24px) below 44px minimum for touch → `StayOverviewPanel.tsx:156,164`, `VisitDetailDrawer.tsx:175,179`

### Text overflow
- [ ] **Long visit notes show single line** — should use `line-clamp-2` → `SortableVisitCard.tsx:88`
- [ ] **Long visit/stay names truncated without tooltip** → `VisitDetailDrawer.tsx:111`, `StayOverviewPanel.tsx:104`
- [ ] **Long email in ProfileMenu truncated without tooltip** → `ProfileMenu.tsx:131`
- [ ] **Trip name in footer uses `slice(0, 24)`** — should use CSS `truncate` instead → `App.tsx:2485`

### Layout
- [ ] **AI explanation can overflow modal** — no max-height/scroll on long AI responses → `AIPlannerModal.tsx:232-244`
- [ ] **ProfileMenu dropdown is fixed `w-60`** — could overflow on very small screens → `ProfileMenu.tsx:120`
- [ ] **HistoryPanel has fixed `max-h-96`** — could dominate viewport on short screens → `HistoryPanel.tsx:20`
- [ ] **Timeline height hardcoded to 140px** → `App.tsx:1075`
- [ ] **StayOverviewPanel stats grid unconditionally 3-col** — can compress on narrow widths → `StayOverviewPanel.tsx:80`

### Mobile
- [ ] **No sync status visible on mobile** — footer is `hidden md:flex`, mobile users can't see sync state → `App.tsx:2459`
- [ ] **Sheet height `h-[85dvh]`** — no fallback if `dvh` unsupported → `App.tsx:2342`

### Labeling & copy
- [ ] **"Go Back" button in TripEditor shrink confirmation is ambiguous** — should say "Edit dates" or "Adjust dates" → `TripEditorModal.tsx:175`
- [ ] **ImportFromCodeDialog placeholder "e.g. TRIP-ABCD"** — insufficient format guidance → `ImportFromCodeDialog.tsx:132`
- [ ] **AI model selector has no descriptions** — users can't distinguish between models → `AIPlannerModal.tsx:314-337`
- [ ] **AddStayModal search error UX** — says "you can still save" but doesn't explain how to retry → `AddStayModal.tsx:117`

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
