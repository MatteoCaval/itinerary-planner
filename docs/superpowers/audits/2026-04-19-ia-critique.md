# IA + component-placement critique — 2026-04-19

A product-design layer on top of the 2026-04-19 component audit. That audit was about polish (colors, a11y, memoization). This one is about **whether each component earns its place** and whether the IA itself could be better.

---

## 1. Modal overload

**The app ships 14 modals.** Every meaningful action that isn't a drag — editing a stay, editing a visit, editing a route, editing accommodation, editing the trip, switching trip, viewing history, AI planning, sharing, importing, resolving merge, signing in — opens a centered dialog.

Modals have real cost:

- They **lose context** — you can no longer see the thing you were editing while you edit it.
- They **queue** — two open one after another (auth → share → confirm) with no breadcrumbs.
- On mobile they compete with the bottom-sheet paradigm the app already uses, giving two modal metaphors.

### Candidates to un-modal

- **`RouteEditorModal`** — editing the transport between two stays is a quick decision (mode, duration, notes). Today you have to open a modal. Could be an **inline popover** anchored to the transit chip, same way macOS Keynote lets you edit arrow style. Kills a full context switch for a 3-field edit.
- **`AccommodationEditorModal`** — similar story. Hotel name, cost, night range. Could live inline under the day-header chip it's attached to, expanding in place.
- **`StayEditorModal`** — when you click a stay in the sidebar, it already shows stay metadata inline. The "Edit" button then opens a modal to rename / recolor / delete. **Why not edit those fields directly in the sidebar?** Delete can stay as the one guarded step.
- **`AddStayModal`** — after you pick a date range on the timeline, popping a modal to name the destination is reasonable; but it could equally be a drawer from the right so the timeline stays in view while you type.

### Modals that should stay

- `VisitFormModal` — complex, multi-section (place, type, checklist, links, move-to-stay). Inline would crowd the sidebar.
- `AIPlannerModal` — multi-step, has its own settings tab, preview.
- `AuthModalSimple`, `MergeDialog`, `ImportFromCodeDialog` — discrete, one-off flows.
- `TripEditorModal` — dates + delete + shrink-impact is too much inline.

### Recommendation

**Down from 14 to ~8 modals.** RouteEditor, AccommodationEditor, StayEditor, and AddStay become inline popovers/drawers. Nothing else moves.

---

## 2. The sidebar is doing two jobs badly

The left sidebar toggles between **stay overview** (when a stay is selected) and **inbox** (unscheduled destinations + visits). You can't see both. That's the wrong tradeoff for a trip planner:

- The inbox is how you **feed** the plan. Seeing what's left to schedule while you schedule is the point of an inbox.
- The overview is context about the current selection.

### Options

1. **Two-column sidebar** — details on top, inbox pinned at the bottom with a height the user can drag. Both visible always.
2. **Inbox as a horizontal rail** — a single row along the bottom of the day columns, like the "backlog" row in a Kanban board. Scheduled items flow up into the day grid; unscheduled sit underneath.
3. **Collapsible twin panels** — current model, but with a persistent "inbox badge" on the tab so you know there's pending work.

Option 2 (backlog rail) is the most ambitious — it treats the plan like a kanban with an inbox row, which matches the drag-drop mental model you already have. Option 1 is the cheapest win.

---

## 3. The three-dot menu is a black hole

Features buried in the header kebab menu today:

- **AI Planner** — the single most differentiating feature
- **Share trip** — a first-class collaboration feature
- **Import from code** — the other half of share
- **Account / Sign in**

Burying AI Planner in a kebab means nobody discovers it. The prior UI-modernization PR landed a clean teal identity — there's visual real estate for a proper toolbar.

### Recommendation

- **AI Planner** → dedicated button with the Sparkles icon, in the header, labeled "Generate".
- **Share** + **Import** → a single "Collaborate" button that opens a panel with both flows as tabs. One entry point, two directions.
- **Account** → bottom-left persistent avatar (standard pattern), not a menu entry.
- The kebab stays for rarer utilities: Export markdown, import JSON, view history.

---

## 4. Timeline and day columns are two Gantt views of the same data

You have a **Gantt timeline** at the top and **day columns** as the main content. Both are time-ordered views of the trip. The timeline is coarse (one row, stays as blocks). The day columns are fine (kanban per day).

The question nobody asks: **does the timeline need to be always-visible?** It's a navigator, not a destination. Once you've selected a stay and are placing visits, the timeline is rarely the thing you're interacting with — it just takes up screen space.

### Options

1. **Collapsible timeline** — auto-collapses to a thin strip (32px) when the user is working in day columns; expands on hover or on stay-switching.
2. **Minimap pattern** — the timeline becomes a "where am I in the trip" indicator in the corner, not a primary region.
3. **Tab switch** — "Timeline" and "Days" as two views, not two layers stacked. Desktop power users get split-view.

The current model is defensible — users can grab a stay edge and resize without switching modes. But the vertical space it claims on laptop screens is not small.

---

## 5. The map is a permanent guest that sometimes wants to be the host

The right panel is the map. It's always there (unless collapsed). It's resizable. It has overview/detail/stay modes. It has a collapsed mini state, an expanded full-screen state, a shrink-to-nothing state — **four modes**.

Questions:

- **Who uses the map during planning?** The day columns are where visits get added. The map is a reference, not a workbench. Does it deserve half the screen by default?
- **When is the full-screen map useful?** When you've added a bunch of visits and want to see the geography. At that point the day columns aren't what you need.

### Options

1. **Collapsed by default** — ship with the map as a pinned icon button. Expands when the user clicks a visit or asks for overview. That saves 500px for new users who haven't added much yet.
2. **Tabbed workspace** — "Plan" (timeline + day columns) and "Map" (full-width map) as two mutually exclusive tabs. Simpler mental model, fewer modes.
3. **Context-aware** — when no stay has geocoded visits yet, hide the map. When the first pin drops, it auto-appears.

Map-heavy users would hate option 1; route-planner users would love it. A sensible default with a preference would serve both.

---

## 6. Accommodation has no first-class entry point

Accommodations are **huge** in a trip — where you sleep, how much it costs, transfers. Today:

- You add one by clicking a small chip inside a day column header.
- You edit via a modal triggered from that chip.
- There's no "Accommodations" overview anywhere.

Compare to `StayOverviewPanel` which has a whole `Sleeping` section showing grouped accommodation blocks — that's the right surface, but it's read-only. Editing happens in the chip-modal flow.

### Options

1. **Inline edit in the Sleeping section** — tap a grouped block, it expands in place. The modal disappears.
2. **Dedicated "Where you're sleeping" tab** in the sidebar — lists all nights, all hotels, with aggregate cost. Single source of truth for the user, separate from day-column clutter.
3. **Smart default** — when the user creates a stay, auto-prompt for the hotel. First-class at creation time.

---

## 7. The mobile and desktop paradigms diverge

On desktop:

- Sidebar = stay details / inbox
- Bottom of screen = nothing
- Right panel = map
- Drawer from right = visit detail

On mobile:

- Sidebar = tab-swappable
- Bottom drawer = visit detail (*different from desktop!*)
- Map = hidden behind a button

The VisitDetailDrawer behaves like a right-slide sheet on desktop and a bottom sheet on mobile. That inconsistency makes the two experiences feel like different products. Users on a desktop who then pick up their phone have to re-learn where the visit drawer lives.

### Recommendation

Pick one paradigm. **Bottom sheet for transient selections on both platforms** (the pattern pioneered by Google Maps and Airbnb) is more cross-platform coherent than side drawer. Desktop users lose a little refinement, but they gain the same gesture grammar.

Alternative: keep both, but make the transition explicit — desktop has a user preference toggle.

---

## 8. Empty-state is abstract

New user journey today:

1. Welcome screen — CTA wall, decorative timeline preview.
2. Click "Plan a trip" → trip-name + date range modal.
3. Land in the app with empty timeline, empty sidebar, empty map, empty day columns.

That's a lot of blank canvases at once. The app doesn't **teach**. Nothing says "your next step is to add a stay." Compare to Notion's templates, Linear's onboarding cards, Figma's "start with a template."

### Options

1. **First-run overlay** — three dotted callouts ("Drag here to add a stay," "Click a day to plan activities," "Search a city in the sidebar"). Dismissable once.
2. **Pre-seed a sample stay** — a draft "Tokyo" stay placed on day 1, with a single example visit, labeled "Click to edit or delete." Teaches by example.
3. **Template starter** — on new-trip creation, offer "Start blank" or "Start from a 7-day Japan template." Templates get you from zero to populated faster.

Option 3 is the cheapest to implement and the closest to industry standard. The existing `createSampleTrip` (the Japan demo) is already built.

---

## 9. Discoverability misses

Features that exist but users won't find unaided:

| Feature | Current entry point | Gap |
|---|---|---|
| AI Planner | Kebab menu | Buried under 1 click + scroll |
| Import from code | Kebab menu / Welcome | Two entry points, both hidden |
| Route editing | Transit chip between stays | Easy to miss — chips are tiny |
| Accommodation editing | Chip inside day column | Discoverable only by hovering |
| History navigation | "History" button (header) | Decent, but toast-undo only shows for recent |
| Sync status | Dot in header | Desktop-only |
| Keyboard shortcuts | None documented | Undo/Redo wired but users won't know |

The pattern: **most of the app's power is hidden behind icons without labels, or menus of menus**. A dedicated `?` help sheet with the feature list and keyboard shortcuts would cover a lot of this.

---

## 10. Tiny things with outsized effect

- **Visit "type" is a 5-option category** (food/landmark/museum/walk/shopping). But trips often have outliers: meetings, hotels-as-stops, shopping sprees, hikes. The list feels western-tourist-coded. Could either expand or collapse to a simpler one-letter chip.
- **Day cards don't show the day's headline** (e.g., "Arashiyama day" or "Tokyo → Osaka travel"). Users write mental trip plans as "the museum day, the onsen day" — the app doesn't have a field for that.
- **The timeline has three sub-slots per day** (morning/afternoon/evening). That's a strong claim. Real trips blur those boundaries (long walk across morning+afternoon). Consider a free-form timeline where visits have a duration instead of a slot.
- **No trip overview page** — when you open the app to a trip, you're dropped into the planning UI. There's no "zoom out" summary: total places, estimated cost (accommodations have cost fields), hotels booked, days planned vs empty. A "Summary" tab on the trip would be valuable for sharing / reviewing / finalizing.

---

## Priority matrix

**Ship-now (small, high leverage)**
- Promote AI Planner, Share, Import out of the kebab menu into the toolbar.
- Add a `?` help sheet with features + keyboard shortcuts.
- First-run overlay or templated starter trip.

**Worth-a-spec (medium redesigns)**
- Inline popovers for Route / Accommodation / Stay editing (un-modal the small stuff).
- Unify desktop + mobile to bottom-sheet pattern for transient selections.
- Sidebar split: details + inbox visible simultaneously (two-column or backlog-rail).

**Question-the-premise (big conversations)**
- Is the always-visible map the right default?
- Is the morning/afternoon/evening slot model the right granularity?
- Should timeline and day columns be unified or separated into two tabs?
- Should the app have a trip-summary overview page?

None of this is action-before-approval. Pick the threads that resonate and we brainstorm each individually.
