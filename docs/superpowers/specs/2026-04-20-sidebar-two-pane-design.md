# Sidebar two-pane split — design spec

**Date:** 2026-04-20
**Status:** Design approved, plan pending
**Branch target:** `feat/sidebar-two-pane` — one PR
**Visual source of truth:** `.superpowers/brainstorm/20117-1776635015/content/sidebar-deep-dive.html` (Option 2) and `sidebar-mobile.html` (Option 2).

---

## Goal

Replace the current Details/Inbox tab switcher with a two-pane sidebar where both are visible at once. Details pane on top, Inbox pane pinned below, separated by a resizable horizontal splitter. Mobile keeps the current tab pattern — two-pane doesn't make sense at phone width.

**Non-goals**

- No changes to what each pane shows internally — Details still renders `StayOverviewPanel` / `VisitDetailDrawer` / welcome prompt; Inbox still renders `DraggableInventoryCard` list / candidate stays list / empty state.
- No refactor of the inbox data model or drag-drop plumbing.
- Not touching the right-side map panel.
- No change to the mobile flow (tabs stay).

---

## Why this over tabs

From the IA critique + visual deep-dive:

- The inbox is **how you feed the plan**. Hiding it behind a tab means users don't drag from it while working on a day.
- Tabs force a mutually exclusive view where none is justified — both surfaces are about the same stay at the same time.
- Two-pane keeps both visible, preserves the existing drag-drop plumbing, and is the cheapest way to fix the hiddenness problem.

Tradeoff accepted: details pane gets shorter on short laptops (≤ 768px height). Mitigation below.

---

## Layout decisions

### Desktop (`md` breakpoint and up)

```
┌────────────────────────────┬─────────────────┬────────────┐
│  timeline strip            │                 │            │
├────────────────────────────┤                 │            │
│  sidebar (w-64)            │                 │            │
│  ┌──────────────────────┐  │   day columns   │   map      │
│  │                      │  │                 │            │
│  │  Details pane        │  │                 │            │
│  │  (StayOverview or    │  │                 │            │
│  │   VisitDetail or     │  │                 │            │
│  │   welcome)           │  │                 │            │
│  │                      │  │                 │            │
│  ├━━━━━━━ splitter ━━━━━┤  │                 │            │
│  │  Inbox pane          │  │                 │            │
│  │  Header: "Inbox · 3" │  │                 │            │
│  │  + add button        │  │                 │            │
│  │                      │  │                 │            │
│  │  DraggableInventory  │  │                 │            │
│  │  ...                 │  │                 │            │
│  │                      │  │                 │            │
│  └──────────────────────┘  │                 │            │
└────────────────────────────┴─────────────────┴────────────┘
```

- **Default ratio:** details 60%, inbox 40%. Stored in localStorage as `sidebar-split-ratio` (number between 0 and 1 representing the details share).
- **Splitter:** 6px horizontal bar centered between the two panes. Teal tint (`bg-primary/15`) at rest, brighter (`bg-primary/40`) on hover. Cursor `row-resize`. Drag to adjust ratio; drop commits to localStorage.
- **Clamp:** ratio clamps to `[0.15, 0.85]`. Below 0.15 or above 0.85, it snaps to that bound (no fully-collapsed state — use the collapse toggle for that).
- **Collapse toggle:** small chevron button in the splitter center. Click collapses the inbox pane entirely (details becomes full-height). Click again restores the last non-collapsed ratio. Persisted as `sidebar-inbox-collapsed` boolean.
- **Keyboard:** splitter is focusable (`role="separator"`, `aria-orientation="horizontal"`, `aria-valuemin / max / now`). ↑ / ↓ arrows adjust the ratio by 5% per press. Enter toggles collapse.
- **Reduced motion:** splitter drag animation disabled (already handled via `useReducedMotion`). Splitter position still updates, just without transition.

### Inbox pane header

Above the inbox content, a compact header:

```
┌──────────────────────────────────────┐
│ INBOX  [3]                     [ + ] │
├──────────────────────────────────────┤
│ content scrolls below                │
```

- Left: label `INBOX` in the existing `text-[11px] font-semibold tracking-wide uppercase` style, with the count badge next to it.
- Right: the existing "+" button that today lives in the tab bar (with the context-aware behavior: `setAddingToInbox` if stay selected, `setAddingCandidate` otherwise).
- Background matches the pane body. Separated from content below by a subtle `border-b border-border` hairline.

The "+" button's existing invisibility logic (`${sidebarTab === 'unplanned' ? '' : 'invisible pointer-events-none'}`) goes away — in two-pane mode the inbox pane is always rendered, so the button is always visible.

### Mobile (`<md` breakpoint)

Unchanged — the existing `<Tabs>` switcher stays. Only applies at desktop widths. Implementation: render two-pane markup inside a `hidden md:flex` container; render the existing `<Tabs>` markup inside a `md:hidden` container. Duplicated markup, but scoped and small.

Actually simpler and DRYer: render a single sidebar component that picks its layout based on a `useMediaQuery('(min-width: 768px)')` hook. Keeps the two codepaths in one component. Recommended.

---

## State changes

New state (in `src/App.tsx` or a dedicated `useSidebarSplit` hook):

```ts
const [splitRatio, setSplitRatio] = useLocalStorage<number>('sidebar-split-ratio', 0.6);
const [inboxCollapsed, setInboxCollapsed] = useLocalStorage<boolean>(
  'sidebar-inbox-collapsed',
  false,
);
```

Existing state:

- `sidebarTab` — keep, only used on mobile. Default stays `'unplanned'`.
- All other inbox / overview state — unchanged.

A new small hook **`useLocalStorage`** is justified (one implementation, used for both fields). Standard `useState` + `useEffect` wrapping `localStorage.get/set`. SSR-safe (`typeof window` guard). If a hook already exists in the project, reuse it.

---

## Components

One new component, otherwise in-place edits:

### `src/components/layout/SidebarSplit.tsx` (new)

```
interface SidebarSplitProps {
  top: React.ReactNode;        // Details pane content
  bottom: React.ReactNode;     // Inbox pane content
  bottomHeader: React.ReactNode; // Inbox header (label + add button)
  defaultRatio?: number;       // default 0.6
}
```

Renders:

```tsx
<div className="h-full flex flex-col">
  <div style={{ flex: topFlex }} className="overflow-y-auto min-h-0">
    {top}
  </div>
  <Splitter /> {/* the 6px bar with keyboard + collapse toggle */}
  <div style={{ flex: bottomFlex }} className="overflow-y-auto min-h-0">
    {bottomHeader}
    {bottom}
  </div>
</div>
```

- `topFlex = collapsed ? 1 : ratio`.
- `bottomFlex = collapsed ? 0 : (1 - ratio)`.
- `min-height: 0` on both flex children is required for inner scroll to work.

### Why a new component, not inline

The split + splitter + keyboard + persistence logic is ~100 lines. Putting it inline in `App.tsx` (already 3000+ lines) is worse. Placing under `src/components/layout/` sets up a directory for other layout primitives later (map panel, top bar if ever refactored).

---

## Responsive behavior

`useMediaQuery('(min-width: 768px)')` gates which sidebar variant renders. At `< 768px`:

- The existing `<Tabs>` markup renders.
- `splitRatio` and `inboxCollapsed` are still read/written but have no visual effect.

At `>= 768px`:

- `<SidebarSplit top={...} bottom={...} bottomHeader={...} />`.
- `sidebarTab` is not read.

No double-render — pick one branch in JSX based on the media-query result.

Edge case: user resizes from mobile to desktop on the same page. `useMediaQuery` subscribes to the media query; the JSX re-renders with the new branch. State (`sidebarTab` vs `splitRatio`) is independent, so nothing resets or jumps.

---

## Rollout

One PR. Scoped into 5 phases:

1. Add `useLocalStorage` hook (if not already present).
2. Add `useMediaQuery` hook (if not already present).
3. Build `SidebarSplit` component with splitter + keyboard + collapse.
4. Wire `SidebarSplit` into `App.tsx`, gated by media query. Keep existing `<Tabs>` branch for mobile.
5. Visual QA + docs.

Manual visual QA after phase 4: drag splitter, keyboard arrows, collapse toggle, resize window mobile↔desktop, check drag-from-inbox-to-day works across the splitter boundary.

---

## Risks

- **Inner scroll breaks.** Nested flex + scroll is fiddly. Mitigation: `min-h-0` on both children; test explicitly with a long notes section and a long inbox list.
- **dnd-kit across the splitter.** Dragging from the inbox pane into a day column crosses the sidebar boundary — dnd-kit already handles this today across the tab boundary because the drag uses overlay position. Verify during manual QA.
- **Splitter hit-area.** 6px is thin for touch. Mobile doesn't render the splitter so this only affects desktop pointer users. Cursor `row-resize` signals the affordance. Accept.
- **ResizeObserver during drag.** The day columns don't need to re-measure on splitter drag — only the sidebar reflows. Confirm no perf issue.

---

## Out of scope

- Collapsing the entire sidebar (hide completely) — separate feature, not this PR.
- Moving the "+" button behavior or adding new inbox features.
- Any change to the mobile inbox drawer pattern.
- Toolbar reshuffle, help sheet, or any other "little" from the IA critique — those are bundled separately.
