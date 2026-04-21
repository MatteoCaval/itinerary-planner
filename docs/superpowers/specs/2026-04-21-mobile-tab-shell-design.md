# Mobile tab-bar shell — design spec

**Date:** 2026-04-21
**Status:** Design approved, plan pending
**Branch target:** `feat/mobile-tab-shell` — one PR
**Visual source of truth:** `.superpowers/brainstorm/68313-1776776920/content/mobile-nav-options.html` (Option 1), `stay-overview-entry.html` (Option a), `visit-detail-options.html` (Option a), `nav-state-options.html` (Option a).

---

## Goal

Replace the current mobile UI — a teal FAB that opens an 85%-height bottom sheet — with a proper native-feel mobile shell: three-tab bottom navigation (**Plan / Map / More**), auto-scroll to "today" on the Plan tab, a push-navigation stack for visit and stay detail pages, and a header stay chip that makes the current stay's details reachable from every day card.

**Primary use case:** reviewing a planned trip while traveling. Reading the day's activities, marking checklist items, checking hotel info, opening the map for directions. Trip-structure edits (new stays, new visits, rescheduling) stay a desktop concern.

## Non-goals

- Desktop is completely untouched. The two-pane sidebar, timeline, day columns, right-side map panel — all stay exactly as they are at ≥768px.
- No dark-mode audit (still deferred).
- No new features beyond the mobile shell itself — everything it shows is content that already exists on desktop.
- No URL routing / deep linking. Mobile nav state is session-only. If deep links are needed later, React Router can be layered on top without rewriting the screens.
- No offline-first changes, PWA install flow, or push notifications.

---

## Decisions (all locked through Q&A)

| #   | Question            | Answer                                                                                                                                                       |
| --- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Primary use case    | **Review during travel.** Reading, marking done, checking directions.                                                                                        |
| 2   | Tab structure       | **3 tabs: Plan / Map / More.** Inbox tucks into More.                                                                                                        |
| 3   | Plan tab landing    | **Auto-scroll to today** if today ∈ trip range; else day 1.                                                                                                  |
| 4   | Visit detail        | **Push full-screen page** with back button.                                                                                                                  |
| 5   | Stay overview entry | **Header stay chip** on Plan tab. Tap → push stay page.                                                                                                      |
| 6   | Edit affordance     | **Asymmetric** — visits fully editable (checklist, notes, rename, delete). Trip structure (new stay, new visit, accommodations, routes) read-only on mobile. |
| 7   | Navigation state    | **State machine hook** (`useMobileNav`). Tab + push stack. No routing dep.                                                                                   |

Secondary decisions locked during section walkthrough:

- Tab bar always visible, including on push pages. Tapping an already-active tab scrolls its content to top (iOS convention).
- Drag-drop disabled on mobile. All interactions are taps.
- Map controls panel on mobile strips to basemap picker + day filters; fullscreen/mini/collapse buttons don't apply (tab is already full-screen).
- Rename visits on mobile (content edit). Rename stays **not** on mobile (structural).
- Browser back button wired to `pop()` via `popstate` + `pushState` on each push.
- Use `useMediaQuery` branching in `App.tsx` rather than CSS `md:hidden` / `md:flex` — avoids mounting both trees.

---

## Architecture

### New files

```
src/hooks/
  useMobileNav.ts            # state machine: tab + push stack
  useMobileNav.test.tsx

src/components/mobile/
  MobileShell.tsx            # orchestrator — tab bar + active content + page stack
  MobileShell.test.tsx
  BottomTabBar.tsx           # the 3-tab bar primitive
  BottomTabBar.test.tsx
  PlanTab.tsx                # header chip + timeline + day columns
  PlanTab.test.tsx
  MapTab.tsx                 # full-screen map + peek drawer for marker tap
  MapTab.test.tsx
  MoreTab.tsx                # list of actions, opens existing modals
  MoreTab.test.tsx
  VisitPage.tsx              # push page — editable visit detail
  VisitPage.test.tsx
  StayPage.tsx               # push page — stay detail (partial read-only)
  StayPage.test.tsx
  StayChip.tsx               # header chip on Plan tab
  MarkerPeekSheet.tsx        # bottom-peek drawer used by MapTab
```

### Modified files

- `src/App.tsx` — at mobile widths (`useMediaQuery('(max-width: 767px)')`) render `<MobileShell />` instead of the existing desktop shell. Existing mobile code (FAB, `mobileDrawerOpen` state, 85% Sheet) is deleted. Shared trip state stays in `App.tsx` and flows to `<MobileShell />` as props.

### `useMobileNav` hook shape

```ts
export type Tab = 'plan' | 'map' | 'more';

export type MobilePage = { kind: 'visit'; id: string } | { kind: 'stay'; id: string };

export interface MobileNavApi {
  tab: Tab;
  setTab: (t: Tab) => void;
  stack: MobilePage[];
  currentPage: MobilePage | null; // top of stack, or null
  push: (page: MobilePage) => void;
  pop: () => void;
  reset: () => void; // clears stack (used by tab taps)
}

export function useMobileNav(): MobileNavApi;
```

Behavior:

- `setTab(t)` — if current stack is non-empty, pops the whole stack and switches tab. If target tab is already active and stack is empty, fires a `scrollToTop` custom event that active tab content listens for.
- `push(page)` — appends to stack, calls `history.pushState(null, '')`.
- `pop()` — removes last stack entry. If stack becomes empty, calls `history.replaceState` to avoid mid-stack browser history pollution.
- `popstate` listener — when fired, calls `pop()` if stack is non-empty; otherwise the default browser behavior (leaves the app).

Session-only. No localStorage persistence.

### Integration in `App.tsx`

```tsx
const isMobile = useMediaQuery('(max-width: 767px)');
// ...
return isMobile ? (
  <MobileShell
    trip={trip}
    setTrip={setTrip}
    selectedStayId={selectedStayId}
    setSelectedStayId={setSelectedStayId}
    /* ...other props... */
  />
) : (
  <DesktopShell /* unchanged */ />
);
```

`DesktopShell` is the existing JSX extracted into a named render (no behavior change — just moved behind a conditional).

Modals (AuthModal, AIPlannerModal, ShareTripDialog, ImportFromCodeDialog, MergeDialog, HistoryPanel, etc.) continue to render at the `App.tsx` root outside the shells, so they float above both mobile and desktop UIs correctly.

---

## Per-tab specs

### Plan tab

Top-to-bottom:

1. **App row** (44px) — `[≡] CHRONOS [TripName ▾] [●sync] [⋯]`. Same content as the current mobile top bar.
2. **Stay chip** (44px, conditional) — `[●color] Kyoto · Day 1 of 4 [View stay ›]`. Present when a stay is selected. Tap anywhere → `push({ kind: 'stay', id })`. When no stay is selected, chip is hidden; placeholder instruction renders in the day columns area ("Pick a destination below").
3. **Timeline strip** (44px, scrollable) — horizontal row of colored stay blocks. Tap = select that stay (existing behavior, updates chip + day scroll position).
4. **Day column list** (scrollable, fills remaining space above tab bar):
   - Each day = full-width card.
   - Card header: `Day N · Wed Oct 15` (mono).
   - Accommodation chip below header if present (read-only).
   - Period sections: Morning / Afternoon / Evening.
   - Visit cards: tap → `push({ kind: 'visit', id })`.
   - **No `+` add-visit buttons.** **No drag handles.** Cards are tap-only.
   - "Today" card gets a subtle teal outline (`ring-1 ring-primary/40`) as a visual anchor.

**Auto-scroll to today:** on first mount of the `MobileShell` in a session, call `scrollIntoView({ block: 'start', behavior: 'auto' })` on the "today" day card if `today` ∈ trip range. Fires exactly once per session — subsequent tab switches or data refreshes do NOT re-scroll. The user's scroll position is preserved when switching Map → Plan → Map. Motion-safe (use `behavior: 'auto'` not `'smooth'` on the initial scroll; smooth scroll is fine for later taps).

### Map tab

Top-to-bottom:

1. **App row** (44px) — minimal: `[≡] CHRONOS [TripName ▾] [⋯]`. **No stay chip here.**
2. **Day filter pills** (floating, top-center, 32px under the app row) — existing component, unchanged.
3. **Map** (fills the rest of the space above tab bar). `<TripMap mode="overview">` mounted persistently.
4. **Marker peek drawer** — when a marker is tapped, a 120px peek slides up from above the tab bar with `[name] · [type] · [Open ›]`. Swipe down dismisses. The "Open" button calls `push({ kind: 'visit', id })` (or `'stay'` for stay markers).

**Persistent mounting:** all three tab contents stay mounted across tab switches — inactive tabs use `display: none` rather than conditional rendering. This keeps the Leaflet instance alive (expensive to re-init), preserves Plan-tab scroll position, and preserves More-tab scroll position. On tab-return for Map, call `map.invalidateSize()` to recompute dimensions after the `display` flip.

**Controls:** basemap picker (existing `MapControlsPanel` stripped to just this) + day filter pills. The fullscreen, mini, collapse, restore buttons are all hidden on mobile.

### More tab

Scrollable list of grouped rows. Each row = icon + label + chevron (or status badge for sync).

Grouping:

```
TRIP
  Switch trip                      › (opens TripSwitcherPanel sheet)
  Edit trip                        › (opens TripEditorModal)
  Trip summary                     › (placeholder — deferred, greyed out for now)

DESTINATIONS
  Inbox                  [3]       › (push sub-page: list, read-only)
  History                          › (opens HistoryPanel sheet)

DATA
  Import from code                 › (opens ImportFromCodeDialog)
  Export markdown                  ↓
  Export JSON                      ↓
  Import JSON                      ↑

POWER
  AI Planner                       › (opens AIPlannerModal)
  Share trip                       › (opens ShareTripDialog)

ACCOUNT
  [avatar] Matteo · signed in      › (opens AuthModalSimple with sign-out option)
  Sync     ● synced                · (status-only, non-interactive)

APP
  Help & shortcuts                 › (opens `?` sheet — deferred, shipped separately)
  Version  v1.2.0                  · (static text)
```

- **Inbox sub-page** — same list of unscheduled visits + candidate stays that desktop shows. Tap a visit → `push({ kind: 'visit', id })`. **Scheduling actions (promote / drag / add) disabled on mobile** per edit-affordance rule; tapping a disabled action shows a toast `"Scheduling happens on desktop."`
- **Trip summary** — spec placeholder; greyed out until the trip-summary feature (IA critique item F) ships. Row visible, non-interactive.

### Push pages

**Shared chrome:**

- Header (44px): `[←] [title] [⋯]`. Back label optional (can be just arrow). Kebab opens page-specific actions.
- Body (scrollable).
- Tab bar below (unchanged).

**`VisitPage`:**

- **Hero** — Unsplash image if available, else color-tinted placeholder with visit type icon.
- **Meta row** — type chip, day/period chip, coords chip (mono).
- **Primary CTAs** — side-by-side full-width:
  - `🧭 Navigate` → opens Google Maps directions in a new tab: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
  - `📍 Open in Maps` → opens Google Maps place: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
- **Notes section** — editable textarea, auto-saves on blur.
- **Checklist section** — reuses the `ChecklistSection` primitive from the polish PR. Fully editable.
- **Links section** — reuses `LinksSection` primitive. Fully editable.
- **Rename** — tap the title in the header → inline input. Save on blur or Enter.
- **Delete** — kebab → Delete (AlertDialog). Pops the stack on confirmation.
- **Hidden:** unschedule, move-to-another-stay (structural).

**`StayPage`:**

- **Hero** — Unsplash photo + color dot + name + date range overlay.
- **Stats row** — days / nights / places (mono numerals, `font-num`).
- **Sleeping list** — accommodations as read-only rows (name, nights, cost). No edit, no add.
- **Notes section** — editable textarea (content, not structure).
- **Stay checklist** — reuses `StayTodoSection` or `ChecklistSection`. Fully editable.
- **Links section** — editable.
- **Hidden:** rename, color change, delete, move-to-inbox (all structural).

### Bottom tab bar

- Fixed to bottom. Height 64px + safe-area bottom padding.
- White background, `border-t border-border`.
- Three tab items, equal width. Icon on top (18px), label below (10px, medium).
- Active tab: teal foreground (`text-primary`) + 2px teal bar at the top of the active tab slot.
- Taps: `setTab(name)`. If already active and stack empty, fire `scrollToTop` event.

---

## Edit affordance matrix

| Action                                   | Desktop | Mobile                      |
| ---------------------------------------- | ------- | --------------------------- |
| Rename visit                             | ✅      | ✅ (tap title in push page) |
| Edit visit notes / checklist / links     | ✅      | ✅                          |
| Delete visit                             | ✅      | ✅ (AlertDialog in kebab)   |
| Unschedule visit                         | ✅      | ❌ hidden                   |
| Move visit to another stay               | ✅      | ❌ hidden                   |
| Reorder visits (drag)                    | ✅      | ❌ disabled                 |
| Add new visit                            | ✅      | ❌ no `+` buttons           |
| Edit stay notes / stay-checklist / links | ✅      | ✅                          |
| Rename stay / change color / delete stay | ✅      | ❌ hidden                   |
| Move stay to inbox                       | ✅      | ❌ hidden                   |
| Add new stay                             | ✅      | ❌ hidden                   |
| Edit accommodation                       | ✅      | ❌ read-only list           |
| Add accommodation                        | ✅      | ❌ hidden                   |
| Edit route (transport)                   | ✅      | ❌ hidden                   |
| Schedule candidate / promote from inbox  | ✅      | ❌ disabled in inbox list   |

---

## Testing

- **`useMobileNav`** (TDD) — initial state, push appends, pop removes, tab tap with non-empty stack pops + switches, `popstate` listener wired, `history.pushState` called on push. ~8 tests.
- **`BottomTabBar`** — renders 3 tabs, active indicator, click handler.
- **`MobileShell`** — mounts, switches tabs, renders push pages when stack has entries. Integration-ish with stubbed children.
- **`PlanTab`** — auto-scroll-to-today (mock `scrollIntoView`, set `trip.start` to today), visit tap pushes.
- **`VisitPage`** — fields render, title editable, delete triggers AlertDialog, structural actions absent from DOM.
- **`StayPage`** — fields render, accommodations list read-only (no edit button), structural actions absent.
- **Desktop regression** — stub `matchMedia` with `matches: false` for `(max-width: 767px)`, assert existing sidebar markup still present.
- **Manual QA** on Netlify preview, on a real phone: open trip, auto-scroll, tap visit, push page, edit, back, switch tabs, open More → modal, tap Map marker → peek → open.

---

## Rollout

Single PR on `feat/mobile-tab-shell`. Scoped into phases:

1. Hooks: `useMobileNav` + tests.
2. Primitives: `BottomTabBar` + tests.
3. Shell skeleton: `MobileShell` renders tab bar + empty tab contents. Wire `useMobileNav`. Integrate into `App.tsx` behind `useMediaQuery`. Desktop unchanged.
4. `PlanTab` — timeline + day cards + stay chip + auto-scroll-to-today. Visit tap pushes.
5. `VisitPage` — full content + CTAs + edits + delete.
6. `StayPage` — full content + partial-read-only semantics.
7. `MapTab` — mount existing TripMap, strip controls, add peek drawer.
8. `MoreTab` — list of rows, wire to existing modals. Inbox sub-page.
9. Delete existing mobile FAB + Sheet code.
10. Manual QA + docs (PRD, IMPROVEMENTS).

Each phase: `npm run lint && npm run test && npm run build` green before commit.

---

## Risks

- **Existing dnd-kit bindings** — drag handlers on visit cards must no-op on mobile. Mitigation: render a different card component in `PlanTab` (no dnd wrappers) instead of reusing the desktop `SortableVisitCard`.
- **Leaflet map resize** — switching tabs with `display: none` may leave Leaflet with stale dimensions. Call `map.invalidateSize()` on tab-return.
- **iOS safe-area** — bottom tab bar must respect `env(safe-area-inset-bottom)`. Already handled via existing `pb-safe` utility.
- **Deep-link back to a visit** — out of scope, but if a user reloads the page mid-push, they land back on Plan tab with no stack. Acceptable for session-only state.
- **Scroll-to-today across data refreshes** — if the trip data changes while the Plan tab is mounted (e.g. via cloud sync), we do NOT re-scroll. Only first mount scrolls.
- **History pollution** — `pushState` / `popstate` can interact badly with modal close logic. Mitigation: modals continue to render outside the shell; their open/close state is not tied to history.

---

## Out of scope

- Don't push the branch or open the PR without explicit user approval.
- Don't implement the trip summary feature (item F from the IA critique) — placeholder row only.
- Don't implement the `?` help sheet (separate little from the IA critique).
- Don't touch desktop layout.
- Don't migrate any existing modal internals — they render inside the mobile shell unchanged.
- Don't add URL routing / deep links.
- Don't rework the timeline strip — mobile uses the same component as desktop.
- Don't add offline / PWA features.
