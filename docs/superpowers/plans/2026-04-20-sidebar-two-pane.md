# Sidebar Two-Pane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Details/Inbox tab switcher in the desktop sidebar with a two-pane layout (Details on top, Inbox on bottom) separated by a resizable splitter. Mobile keeps the existing tabs.

**Architecture:** New `SidebarSplit` layout component owns the flex-ratio state + splitter UI. Two small hooks (`useLocalStorage`, `useMediaQuery`) make the ratio persistent and the desktop/mobile switch clean. `App.tsx` calls `SidebarSplit` at desktop widths, keeps the current `<Tabs>` markup at mobile widths.

**Tech Stack:** React 18 + TypeScript, Tailwind v4, shadcn/ui, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-04-20-sidebar-two-pane-design.md`

---

## File structure

**New files:**
- `src/hooks/useLocalStorage.ts` + `.test.tsx`
- `src/hooks/useMediaQuery.ts` + `.test.tsx`
- `src/components/layout/SidebarSplit.tsx` + `.test.tsx`

**Modified:**
- `src/App.tsx` — gate sidebar rendering by media query; render `SidebarSplit` on desktop, existing `<Tabs>` on mobile.

---

## Task ordering rationale

Hooks first (independent primitives, TDD-able in isolation). Then `SidebarSplit` component (depends on both hooks). Then `App.tsx` wiring (depends on the component). Pipeline gate (`npm run lint && npm run test && npm run build`) after each task.

---

## Task 1 — `useLocalStorage` hook (if not already present)

**Files:**
- Create (or skip if exists): `src/hooks/useLocalStorage.ts`
- Create (or skip): `src/hooks/__tests__/useLocalStorage.test.tsx`

- [ ] **Step 1: Check if the hook already exists.**

```bash
grep -rn "useLocalStorage" src/hooks/ src/lib/ 2>/dev/null
```

If any file exports `useLocalStorage`, skip this entire task and note the existing module path. Reuse it in later tasks.

- [ ] **Step 2: Write the failing test.**

Create `src/hooks/__tests__/useLocalStorage.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from '../useLocalStorage';

describe('useLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('returns the default when nothing is stored', () => {
    const { result } = renderHook(() => useLocalStorage('k', 'default'));
    expect(result.current[0]).toBe('default');
  });

  it('returns the stored value when present', () => {
    localStorage.setItem('k', JSON.stringify('stored'));
    const { result } = renderHook(() => useLocalStorage('k', 'default'));
    expect(result.current[0]).toBe('stored');
  });

  it('persists updates to localStorage', () => {
    const { result } = renderHook(() => useLocalStorage<number>('n', 1));
    act(() => result.current[1](42));
    expect(result.current[0]).toBe(42);
    expect(JSON.parse(localStorage.getItem('n')!)).toBe(42);
  });

  it('falls back to default on malformed JSON', () => {
    localStorage.setItem('k', '{{not json');
    const { result } = renderHook(() => useLocalStorage('k', 'default'));
    expect(result.current[0]).toBe('default');
  });
});
```

- [ ] **Step 3: Run the test — expect failure.**

```bash
npx vitest run src/hooks/__tests__/useLocalStorage.test.tsx
```

Expected: FAIL (module not found).

- [ ] **Step 4: Implement.**

Create `src/hooks/useLocalStorage.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from 'react';

export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return defaultValue;
      return JSON.parse(raw) as T;
    } catch {
      return defaultValue;
    }
  });

  const keyRef = useRef(key);
  useEffect(() => {
    keyRef.current = key;
  }, [key]);

  const update = useCallback(
    (next: T) => {
      setValue(next);
      if (typeof window === 'undefined') return;
      try {
        window.localStorage.setItem(keyRef.current, JSON.stringify(next));
      } catch {
        // quota exceeded / disabled — fail silently
      }
    },
    [],
  );

  return [value, update];
}
```

- [ ] **Step 5: Re-run test.**

```bash
npx vitest run src/hooks/__tests__/useLocalStorage.test.tsx
```

Expected: 4/4 PASS.

- [ ] **Step 6: Full suite.**

```bash
npm run test
```

Expected: all pass.

- [ ] **Step 7: Commit.**

```bash
git add src/hooks/useLocalStorage.ts src/hooks/__tests__/useLocalStorage.test.tsx
git commit -m "feat(hooks): add useLocalStorage"
```

---

## Task 2 — `useMediaQuery` hook

**Files:**
- Create: `src/hooks/useMediaQuery.ts`
- Create: `src/hooks/__tests__/useMediaQuery.test.tsx`

- [ ] **Step 1: Check if the hook already exists.**

```bash
grep -rn "useMediaQuery" src/hooks/ src/lib/ 2>/dev/null
```

If present, skip this task.

- [ ] **Step 2: Write the failing test.**

Create `src/hooks/__tests__/useMediaQuery.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaQuery } from '../useMediaQuery';

type MqlListener = (event: MediaQueryListEvent) => void;

function stub(matches: boolean) {
  let listener: MqlListener | null = null;
  const mql = {
    matches,
    addEventListener: (_: string, l: MqlListener) => { listener = l; },
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal('matchMedia', () => mql);
  return { fire: (next: boolean) => listener?.({ matches: next } as MediaQueryListEvent) };
}

describe('useMediaQuery', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('returns the initial match value', () => {
    stub(true);
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(true);
  });

  it('updates on change', () => {
    const { fire } = stub(false);
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(false);
    act(() => fire(true));
    expect(result.current).toBe(true);
  });
});
```

- [ ] **Step 3: Run — expect FAIL.**

```bash
npx vitest run src/hooks/__tests__/useMediaQuery.test.tsx
```

- [ ] **Step 4: Implement.**

Create `src/hooks/useMediaQuery.ts`:

```ts
import { useEffect, useState } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', onChange);
    setMatches(mql.matches);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
```

- [ ] **Step 5: Re-run — expect 2/2 PASS.**

```bash
npx vitest run src/hooks/__tests__/useMediaQuery.test.tsx
```

- [ ] **Step 6: Full suite + commit.**

```bash
npm run test
git add src/hooks/useMediaQuery.ts src/hooks/__tests__/useMediaQuery.test.tsx
git commit -m "feat(hooks): add useMediaQuery"
```

---

## Task 3 — `SidebarSplit` component (TDD)

**Files:**
- Create: `src/components/layout/SidebarSplit.tsx`
- Create: `src/components/layout/SidebarSplit.test.tsx`

- [ ] **Step 1: Write the failing test.**

Create `src/components/layout/SidebarSplit.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SidebarSplit } from './SidebarSplit';

function renderSplit(overrides: Partial<React.ComponentProps<typeof SidebarSplit>> = {}) {
  return render(
    <SidebarSplit
      top={<div data-testid="top">top content</div>}
      bottomHeader={<div data-testid="bottom-header">Inbox</div>}
      bottom={<div data-testid="bottom">bottom content</div>}
      {...overrides}
    />,
  );
}

describe('SidebarSplit', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders both panes and header', () => {
    renderSplit();
    expect(screen.getByTestId('top')).toBeInTheDocument();
    expect(screen.getByTestId('bottom-header')).toBeInTheDocument();
    expect(screen.getByTestId('bottom')).toBeInTheDocument();
  });

  it('exposes the splitter as role=separator with horizontal orientation', () => {
    renderSplit();
    const sep = screen.getByRole('separator');
    expect(sep).toHaveAttribute('aria-orientation', 'horizontal');
  });

  it('reflects ratio in aria-valuenow', () => {
    renderSplit({ defaultRatio: 0.4 });
    const sep = screen.getByRole('separator');
    expect(sep).toHaveAttribute('aria-valuenow', '40');
  });

  it('decreases ratio by 5% on ArrowUp', async () => {
    renderSplit({ defaultRatio: 0.5 });
    const sep = screen.getByRole('separator');
    sep.focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(sep).toHaveAttribute('aria-valuenow', '45');
  });

  it('increases ratio by 5% on ArrowDown', async () => {
    renderSplit({ defaultRatio: 0.5 });
    const sep = screen.getByRole('separator');
    sep.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(sep).toHaveAttribute('aria-valuenow', '55');
  });

  it('toggles inbox-collapsed on Enter', async () => {
    renderSplit({ defaultRatio: 0.6 });
    const sep = screen.getByRole('separator');
    sep.focus();
    await userEvent.keyboard('{Enter}');
    // When collapsed, the bottom pane region is visually absent from flex.
    // We expose a data attr on the root to make this testable.
    const root = sep.parentElement;
    expect(root).toHaveAttribute('data-collapsed', 'true');
  });

  it('clamps ratio to [0.15, 0.85]', async () => {
    renderSplit({ defaultRatio: 0.15 });
    const sep = screen.getByRole('separator');
    sep.focus();
    await userEvent.keyboard('{ArrowUp}');
    // Already at min — should stay at 15 (clamp does not go below).
    expect(sep).toHaveAttribute('aria-valuenow', '15');
  });

  it('persists ratio to localStorage', async () => {
    renderSplit({ defaultRatio: 0.5, storageKey: 'test-split-ratio' });
    const sep = screen.getByRole('separator');
    sep.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(JSON.parse(localStorage.getItem('test-split-ratio')!)).toBe(0.55);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

```bash
npx vitest run src/components/layout/SidebarSplit.test.tsx
```

- [ ] **Step 3: Implement.**

Create `src/components/layout/SidebarSplit.tsx`:

```tsx
import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocalStorage } from '@/hooks/useLocalStorage';

const RATIO_MIN = 0.15;
const RATIO_MAX = 0.85;
const KEYBOARD_STEP = 0.05;

interface SidebarSplitProps {
  top: React.ReactNode;
  bottom: React.ReactNode;
  bottomHeader?: React.ReactNode;
  defaultRatio?: number;
  storageKey?: string;
  collapseKey?: string;
  className?: string;
}

function clamp(n: number): number {
  return Math.max(RATIO_MIN, Math.min(RATIO_MAX, n));
}

export function SidebarSplit({
  top,
  bottom,
  bottomHeader,
  defaultRatio = 0.6,
  storageKey = 'sidebar-split-ratio',
  collapseKey = 'sidebar-inbox-collapsed',
  className,
}: SidebarSplitProps) {
  const [ratio, setRatio] = useLocalStorage<number>(storageKey, defaultRatio);
  const [collapsed, setCollapsed] = useLocalStorage<boolean>(collapseKey, false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = React.useState(false);

  const effectiveRatio = collapsed ? 1 : clamp(ratio);
  const percent = Math.round(effectiveRatio * 100);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setRatio(clamp(ratio - KEYBOARD_STEP));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setRatio(clamp(ratio + KEYBOARD_STEP));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setCollapsed(!collapsed);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (collapsed) return;
    e.preventDefault();
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    setDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || !rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    const next = (e.clientY - rect.top) / rect.height;
    setRatio(clamp(next));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    setDragging(false);
  };

  return (
    <div
      ref={rootRef}
      data-collapsed={collapsed ? 'true' : 'false'}
      className={cn('h-full flex flex-col', className)}
    >
      <div
        style={{ flex: effectiveRatio }}
        className="min-h-0 overflow-y-auto"
      >
        {top}
      </div>

      <div
        role="separator"
        aria-orientation="horizontal"
        aria-valuemin={Math.round(RATIO_MIN * 100)}
        aria-valuemax={Math.round(RATIO_MAX * 100)}
        aria-valuenow={percent}
        aria-label="Resize inbox panel"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={cn(
          'relative h-[6px] flex-shrink-0 cursor-row-resize select-none',
          'bg-primary/15 hover:bg-primary/30 focus-visible:bg-primary/40',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
          dragging && 'bg-primary/40',
        )}
      >
        <button
          type="button"
          aria-label={collapsed ? 'Expand inbox' : 'Collapse inbox'}
          onClick={(e) => {
            e.stopPropagation();
            setCollapsed(!collapsed);
          }}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-4 rounded-sm bg-card border border-border flex items-center justify-center hover:bg-muted"
        >
          <ChevronDown
            className={cn(
              'size-3 transition-transform',
              collapsed ? 'rotate-180' : 'rotate-0',
            )}
          />
        </button>
      </div>

      {!collapsed && (
        <div
          style={{ flex: 1 - effectiveRatio }}
          className="min-h-0 flex flex-col"
        >
          {bottomHeader && (
            <div className="flex-shrink-0 border-b border-border">
              {bottomHeader}
            </div>
          )}
          <div className="min-h-0 overflow-y-auto flex-1">{bottom}</div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Re-run tests.**

```bash
npx vitest run src/components/layout/SidebarSplit.test.tsx
```

Expected: 8/8 PASS.

- [ ] **Step 5: Run full suite.**

```bash
npm run test
```

Expected: all pass.

- [ ] **Step 6: Commit.**

```bash
git add src/components/layout/SidebarSplit.tsx src/components/layout/SidebarSplit.test.tsx
git commit -m "feat(layout): add SidebarSplit two-pane component"
```

---

## Task 4 — Wire `SidebarSplit` into `App.tsx`

**Files:**
- Modify: `src/App.tsx`

This is the main integration. The current `<aside>` contains a `<Tabs>` with two branches. At desktop widths, render `<SidebarSplit>` with the same branches' contents in top/bottom slots. At mobile widths, keep the current `<Tabs>` markup.

- [ ] **Step 1: Add imports at the top of `src/App.tsx`.**

Add (alongside existing imports, not duplicating):

```tsx
import { SidebarSplit } from '@/components/layout/SidebarSplit';
import { useMediaQuery } from '@/hooks/useMediaQuery';
```

- [ ] **Step 2: Compute the breakpoint inside the component body.**

Near the top of the main component (after other `useMemo`/`useState` calls, before the JSX return), add:

```tsx
const isDesktop = useMediaQuery('(min-width: 768px)');
```

- [ ] **Step 3: Extract the "details" pane content.**

Inside the existing sidebar `<aside>` block, today the Details (overview) content is rendered inside `sidebarTab === 'overview' && ...` conditionals (around lines 1803–1876 of `App.tsx` on this branch). Wrap that block as a named variable just above the `<aside>` JSX:

```tsx
const detailsPane = (
  <>
    {selectedStay && selectedVisitId && (() => {
      const visit = trip.visits.find((v) => v.id === selectedVisitId);
      if (!visit) return null;
      const dayLabel =
        visit.dayOffset !== null
          ? `Day ${visit.dayOffset + 1}${visit.dayPart ? ', ' + visit.dayPart.charAt(0).toUpperCase() + visit.dayPart.slice(1) : ''}`
          : 'Unplanned';
      return (
        <VisitDetailDrawer
          key={visit.id}
          visit={visit}
          dayLabel={dayLabel}
          onClose={() => setSelectedVisitId(null)}
          onEdit={() => { /* existing body — copy verbatim from the current block */ }}
          /* copy remaining props verbatim */
        />
      );
    })()}
    {selectedStay && !selectedVisitId && (
      <StayOverviewPanel
        /* copy props verbatim from the existing block */
      />
    )}
    {!selectedStay && (
      <div className="flex flex-col items-center justify-center py-8 gap-3 h-full">
        {/* the existing welcome/empty prompt — copy verbatim */}
      </div>
    )}
  </>
);
```

Actually this is messy because the current JSX inlines these cases. Don't rewrite the inner logic — just **extract the three branches into a single `detailsPane` variable that preserves the existing `sidebarTab === 'overview' && ...` conditions, but drops the `sidebarTab === 'overview' &&` wrappers** (since the two-pane always shows details). Leave the inner JSX (including what `StayOverviewPanel` / `VisitDetailDrawer` / welcome receives) byte-identical.

Review the existing `<aside>` block in detail before extracting. If any of the callbacks close over `setSidebarTab`, keep those calls — they're harmless on desktop because `sidebarTab` is only read on mobile.

- [ ] **Step 4: Extract the "inbox" pane content.**

Same treatment for the Inbox block (around lines 1879–1989). Extract into an `inboxPane` variable with the body byte-identical to the current `sidebarTab === 'unplanned' && (...)` JSX, minus the outer conditional.

- [ ] **Step 5: Build the inbox header.**

The "+" button that currently lives in the tab bar (lines ~1787–1799) becomes the inbox header's right side. Define:

```tsx
const inboxHeader = (
  <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40">
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] font-semibold tracking-wide uppercase text-muted-foreground">
        Inbox
      </span>
      {inboxVisits.length > 0 && (
        <Badge
          variant="secondary"
          className="h-4 px-1.5 rounded-full text-[9px] font-bold"
        >
          {inboxVisits.length}
        </Badge>
      )}
    </div>
    <button
      onClick={() => {
        if (selectedStay) {
          setAddingToInbox(true);
        } else {
          setAddingCandidate(true);
        }
      }}
      className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-white transition-colors"
      aria-label="Add new place"
    >
      <Plus className="w-3.5 h-3.5" />
    </button>
  </div>
);
```

- [ ] **Step 6: Replace the `<aside>` body with a media-query branch.**

Replace the existing Tab-based body of the `<aside>` with:

```tsx
<aside
  className={`border-r border-border-neutral flex flex-col bg-white transition-all duration-300 ${mapExpanded ? 'w-0 overflow-hidden opacity-0' : 'w-64 hidden md:flex'}`}
>
  {isDesktop ? (
    <SidebarSplit
      top={<div className="p-4">{detailsPane}</div>}
      bottomHeader={inboxHeader}
      bottom={<div className="p-4 space-y-3 scroll-hide">{inboxPane}</div>}
    />
  ) : (
    <>
      {/* existing Tabs + old body, unchanged */}
    </>
  )}
</aside>
```

Keep the mobile markup exactly as it is. For safety, leave the existing `<Tabs>` block under `md:hidden` — there's already a `<aside className="... hidden md:flex">` wrapper today, so you need a second `<aside className="flex md:hidden ...">` for mobile, OR render the whole existing block unchanged inside a mobile-only branch. Given the existing layout already only renders the aside on `md+`, mobile may use a different surface (bottom sheet). **Verify the mobile flow before assuming — if mobile doesn't render the aside at all, the branch below only runs on desktop and mobile is unchanged.** Read line ~2710 area, where mobile inbox / drawer rendering might happen, before deciding.

If mobile indeed uses a separate drawer flow and the aside is desktop-only, simplify: the aside always renders `SidebarSplit`, no branch needed. That's the likely case here — confirm by reading the file.

- [ ] **Step 7: Decide on the final shape based on code inspection.**

- If the `<aside>` is already `hidden md:flex` and mobile uses a separate drawer elsewhere, replace the aside body with `<SidebarSplit ... />` directly. No media-query branch.
- If mobile actually renders the aside's tabs (unlikely given the `hidden md:flex` class), add the `isDesktop` branch as in Step 6.

Pick the simplest path that preserves mobile behavior.

- [ ] **Step 8: Pipeline.**

```bash
npm run lint && npm run test && npm run build
```

Expected: all pass.

- [ ] **Step 9: Commit.**

```bash
git add src/App.tsx
git commit -m "refactor(app): render sidebar as two-pane split on desktop"
```

---

## Task 5 — Visual QA, docs, restart

- [ ] **Step 1: Dev-server walkthrough.**

```bash
docker compose restart
```

Wait for `VITE ready`. Open http://localhost:5173/itinerary-planner/.

Walk every flow:
- Select a stay — Details pane shows `StayOverviewPanel`. Inbox pane shows unplanned visits or "All scheduled" empty state.
- Deselect — Details shows welcome. Inbox shows candidate stays.
- Drag an inbox item into a day column (across the splitter boundary — dnd-kit should still work since the drag overlay is portal-based).
- Drag the splitter — ratio updates smoothly, clamps at 15% and 85%.
- Keyboard: Tab onto the splitter, ArrowUp/Down to resize, Enter to collapse.
- Click the collapse chevron — inbox collapses, details goes full-height.
- Click again — inbox restores to the last ratio.
- Refresh page — ratio and collapsed state persist.
- Resize window to mobile (≤767px). The existing tab/drawer flow still works. Resize back — two-pane returns.
- Select a visit — `VisitDetailDrawer` shows in Details pane; clicking close returns to `StayOverviewPanel`.

- [ ] **Step 2: Update `docs/PRD.md`.**

Find the `## Stay Overview Panel` or similar sidebar-related section. Add a note:

```markdown
On desktop, the sidebar is a **two-pane layout**: stay details (or visit detail) on top, Inbox (unscheduled destinations / visits) pinned below, separated by a resizable splitter. Mobile keeps the Details/Inbox tab pattern.
```

- [ ] **Step 3: Update `docs/IMPROVEMENTS.md`.**

In the "IA & Layout Critique — 2026-04-19" section, change the sidebar-split bullet from unchecked to checked, noting option 2 (two-pane) shipped:

```markdown
- [x] **B. Sidebar split.** Shipped as two-pane (details on top, inbox pinned below, resizable splitter). Mobile keeps tabs. Backlog rail option (B3) kept on file as a future upgrade.
```

- [ ] **Step 4: Commit docs.**

```bash
git add docs/PRD.md docs/IMPROVEMENTS.md
git commit -m "docs: document two-pane sidebar"
```

- [ ] **Step 5: Do NOT push. Stop and report.**

Summarize commits, test count, and any QA findings. Wait for explicit user approval to push.

---

## Out of scope

- Do not push the branch or open the PR without explicit user approval.
- Do not add a fully-collapsible sidebar (hide both panes entirely).
- Do not touch the mobile drawer flow.
- Do not change the inbox's internal content rendering — only wrap it.
- Do not change the "+" button's behavior — only its position.
