# Mobile Tab-Bar Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mobile FAB + 85%-height bottom sheet with a native-feel 3-tab shell (Plan / Map / More), a push-navigation stack for visit and stay detail pages, and a persistent stay chip on Plan that surfaces stay overview from every day.

**Architecture:** A `useMobileNav` state-machine hook owns the tab + push-page stack. `MobileShell` renders the bottom tab bar and active tab content, persistently mounting all three tabs (inactive ones use `display: none`) so Leaflet survives tab switches and scroll positions stick. `App.tsx` renders `<MobileShell>` at `<768px` widths via `useMediaQuery`; desktop is untouched. All trip state stays in `App.tsx` and flows down as props.

**Tech Stack:** React 18 + TypeScript, Tailwind v4, shadcn/ui, react-leaflet, Vitest + Testing Library + `@testing-library/user-event`. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-04-21-mobile-tab-shell-design.md`

---

## File structure

**New files:**

```
src/hooks/
  useMobileNav.ts
  __tests__/useMobileNav.test.tsx

src/components/mobile/
  MobileShell.tsx
  MobileShell.test.tsx
  BottomTabBar.tsx
  BottomTabBar.test.tsx
  PlanTab.tsx
  PlanTab.test.tsx
  MapTab.tsx
  MapTab.test.tsx
  MoreTab.tsx
  MoreTab.test.tsx
  VisitPage.tsx
  VisitPage.test.tsx
  StayPage.tsx
  StayPage.test.tsx
  StayChip.tsx
  MarkerPeekSheet.tsx
```

**Modified:**
- `src/App.tsx` — at mobile widths render `<MobileShell>`; delete the FAB + 85% Sheet code.

Pipeline gate after every task: `npm run lint && npm run test && npm run build`. Commits pre-authorized.

---

## Task ordering rationale

Hook first (testable in isolation, no UI deps). Primitives next (TabBar, StayChip, MarkerPeekSheet — small, focused). Then shell skeleton wired into `App.tsx` (gets mobile rendering the empty shell). Then one tab at a time: Plan → Visit/Stay pages (they're the next consumers of the shell) → Map → More. Last step deletes old FAB code and updates docs.

---

## Task 1 — `useMobileNav` hook (TDD)

**Files:**
- Create: `src/hooks/useMobileNav.ts`
- Create: `src/hooks/__tests__/useMobileNav.test.tsx`

- [ ] **Step 1: Write failing test.**

Create `src/hooks/__tests__/useMobileNav.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMobileNav } from '../useMobileNav';

describe('useMobileNav', () => {
  beforeEach(() => {
    // Reset history between tests
    window.history.replaceState(null, '');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with tab=plan and empty stack', () => {
    const { result } = renderHook(() => useMobileNav());
    expect(result.current.tab).toBe('plan');
    expect(result.current.stack).toEqual([]);
    expect(result.current.currentPage).toBeNull();
  });

  it('setTab changes active tab', () => {
    const { result } = renderHook(() => useMobileNav());
    act(() => result.current.setTab('map'));
    expect(result.current.tab).toBe('map');
  });

  it('push appends to stack and sets currentPage', () => {
    const { result } = renderHook(() => useMobileNav());
    act(() => result.current.push({ kind: 'visit', id: 'v1' }));
    expect(result.current.stack).toHaveLength(1);
    expect(result.current.currentPage).toEqual({ kind: 'visit', id: 'v1' });
  });

  it('pop removes the last stack entry', () => {
    const { result } = renderHook(() => useMobileNav());
    act(() => {
      result.current.push({ kind: 'stay', id: 's1' });
      result.current.push({ kind: 'visit', id: 'v1' });
    });
    act(() => result.current.pop());
    expect(result.current.stack).toEqual([{ kind: 'stay', id: 's1' }]);
  });

  it('setTab with non-empty stack clears the stack', () => {
    const { result } = renderHook(() => useMobileNav());
    act(() => {
      result.current.push({ kind: 'visit', id: 'v1' });
    });
    expect(result.current.stack).toHaveLength(1);
    act(() => result.current.setTab('more'));
    expect(result.current.tab).toBe('more');
    expect(result.current.stack).toEqual([]);
  });

  it('reset clears the stack without changing tab', () => {
    const { result } = renderHook(() => useMobileNav());
    act(() => {
      result.current.setTab('map');
      result.current.push({ kind: 'visit', id: 'v1' });
    });
    act(() => result.current.reset());
    expect(result.current.stack).toEqual([]);
    expect(result.current.tab).toBe('map');
  });

  it('push calls history.pushState', () => {
    const spy = vi.spyOn(window.history, 'pushState');
    const { result } = renderHook(() => useMobileNav());
    act(() => result.current.push({ kind: 'visit', id: 'v1' }));
    expect(spy).toHaveBeenCalled();
  });

  it('popstate pops the stack when non-empty', () => {
    const { result } = renderHook(() => useMobileNav());
    act(() => {
      result.current.push({ kind: 'visit', id: 'v1' });
    });
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(result.current.stack).toEqual([]);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

```bash
npx vitest run src/hooks/__tests__/useMobileNav.test.tsx
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement.**

Create `src/hooks/useMobileNav.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from 'react';

export type Tab = 'plan' | 'map' | 'more';

export type MobilePage =
  | { kind: 'visit'; id: string }
  | { kind: 'stay'; id: string };

export interface MobileNavApi {
  tab: Tab;
  setTab: (t: Tab) => void;
  stack: MobilePage[];
  currentPage: MobilePage | null;
  push: (page: MobilePage) => void;
  pop: () => void;
  reset: () => void;
}

export function useMobileNav(): MobileNavApi {
  const [tab, setTabState] = useState<Tab>('plan');
  const [stack, setStack] = useState<MobilePage[]>([]);

  // Keep a live ref to the stack so the popstate handler (attached once) sees latest.
  const stackRef = useRef(stack);
  useEffect(() => {
    stackRef.current = stack;
  }, [stack]);

  const push = useCallback((page: MobilePage) => {
    setStack((prev) => [...prev, page]);
    if (typeof window !== 'undefined') {
      try {
        window.history.pushState(null, '');
      } catch {
        // pushState can throw in some sandboxed contexts — ignore
      }
    }
  }, []);

  const pop = useCallback(() => {
    setStack((prev) => (prev.length > 0 ? prev.slice(0, -1) : prev));
  }, []);

  const reset = useCallback(() => {
    setStack([]);
  }, []);

  const setTab = useCallback((next: Tab) => {
    setStack([]); // tab change always clears the push stack
    setTabState(next);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPopState = () => {
      if (stackRef.current.length > 0) {
        setStack((prev) => prev.slice(0, -1));
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const currentPage = stack.length > 0 ? stack[stack.length - 1] : null;

  return { tab, setTab, stack, currentPage, push, pop, reset };
}
```

- [ ] **Step 4: Re-run — expect 8/8 PASS.**

```bash
npx vitest run src/hooks/__tests__/useMobileNav.test.tsx
```

- [ ] **Step 5: Full suite + lint + build.**

```bash
npm run test && npm run lint && npm run build
```

- [ ] **Step 6: Commit.**

```bash
git add src/hooks/useMobileNav.ts src/hooks/__tests__/useMobileNav.test.tsx
git commit -m "feat(hooks): add useMobileNav state machine"
```

---

## Task 2 — `BottomTabBar` primitive (TDD)

**Files:**
- Create: `src/components/mobile/BottomTabBar.tsx`
- Create: `src/components/mobile/BottomTabBar.test.tsx`

- [ ] **Step 1: Write failing test.**

Create `src/components/mobile/BottomTabBar.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BottomTabBar } from './BottomTabBar';

function renderBar(overrides: Partial<React.ComponentProps<typeof BottomTabBar>> = {}) {
  return render(
    <BottomTabBar
      tab="plan"
      onTabChange={() => {}}
      inboxCount={0}
      {...overrides}
    />,
  );
}

describe('BottomTabBar', () => {
  it('renders three tabs', () => {
    renderBar();
    expect(screen.getByRole('tab', { name: /plan/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /map/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /more/i })).toBeInTheDocument();
  });

  it('marks the active tab with aria-selected=true', () => {
    renderBar({ tab: 'map' });
    expect(screen.getByRole('tab', { name: /map/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: /plan/i })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('calls onTabChange with the tapped tab', async () => {
    const onTabChange = vi.fn();
    renderBar({ onTabChange });
    await userEvent.click(screen.getByRole('tab', { name: /map/i }));
    expect(onTabChange).toHaveBeenCalledWith('map');
  });

  it('renders inbox badge on More when inboxCount > 0', () => {
    renderBar({ inboxCount: 3 });
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('does not render badge when inboxCount = 0', () => {
    renderBar({ inboxCount: 0 });
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

```bash
npx vitest run src/components/mobile/BottomTabBar.test.tsx
```

- [ ] **Step 3: Implement.**

Create `src/components/mobile/BottomTabBar.tsx`:

```tsx
import * as React from 'react';
import { Calendar, Map as MapIcon, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Tab } from '@/hooks/useMobileNav';

interface BottomTabBarProps {
  tab: Tab;
  onTabChange: (t: Tab) => void;
  inboxCount?: number;
}

const tabs: Array<{ key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'plan', label: 'Plan', icon: Calendar },
  { key: 'map', label: 'Map', icon: MapIcon },
  { key: 'more', label: 'More', icon: Menu },
];

export function BottomTabBar({ tab, onTabChange, inboxCount = 0 }: BottomTabBarProps) {
  return (
    <div
      role="tablist"
      aria-label="Mobile navigation"
      className="flex flex-shrink-0 bg-white border-t border-border pb-safe"
    >
      {tabs.map(({ key, label, icon: Icon }) => {
        const active = key === tab;
        const showBadge = key === 'more' && inboxCount > 0;
        return (
          <button
            key={key}
            role="tab"
            aria-selected={active}
            aria-label={label}
            onClick={() => onTabChange(key)}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-1 py-2 relative',
              'text-[10px] font-medium transition-colors',
              active ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            {active && (
              <span
                aria-hidden="true"
                className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-primary rounded-b"
              />
            )}
            <span className="relative">
              <Icon className="size-[18px]" />
              {showBadge && (
                <span className="absolute -top-1 -right-2 size-[14px] rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground flex items-center justify-center">
                  {inboxCount}
                </span>
              )}
            </span>
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Re-run — expect 5/5 PASS.**

```bash
npx vitest run src/components/mobile/BottomTabBar.test.tsx
```

- [ ] **Step 5: Full suite + commit.**

```bash
npm run test
git add src/components/mobile/BottomTabBar.tsx src/components/mobile/BottomTabBar.test.tsx
git commit -m "feat(mobile): add BottomTabBar primitive"
```

---

## Task 3 — `StayChip` component

**Files:**
- Create: `src/components/mobile/StayChip.tsx`

No test file — this is a thin visual component; covered by `PlanTab` integration tests later.

- [ ] **Step 1: Create the component.**

Create `src/components/mobile/StayChip.tsx`:

```tsx
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StayChipProps {
  name: string;
  color: string;
  dayOfStay: number;   // 1-based
  totalDays: number;
  onClick: () => void;
}

export function StayChip({ name, color, dayOfStay, totalDays, onClick }: StayChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-2 bg-primary/5 border-b border-border',
        'text-left hover:bg-primary/10 active:bg-primary/15 transition-colors',
      )}
      aria-label={`View ${name} stay details`}
    >
      <span
        aria-hidden="true"
        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
        style={{ background: color }}
      />
      <span className="font-semibold text-sm text-foreground truncate">{name}</span>
      <span className="font-num text-xs text-muted-foreground flex-shrink-0">
        · Day {dayOfStay} of {totalDays}
      </span>
      <span className="flex-1" />
      <span className="text-xs font-semibold text-primary flex-shrink-0">View stay</span>
      <ChevronRight className="size-4 text-primary flex-shrink-0" aria-hidden="true" />
    </button>
  );
}
```

- [ ] **Step 2: Verify build.**

```bash
npm run lint && npm run build
```

- [ ] **Step 3: Commit.**

```bash
git add src/components/mobile/StayChip.tsx
git commit -m "feat(mobile): add StayChip header component"
```

---

## Task 4 — `MarkerPeekSheet` component

**Files:**
- Create: `src/components/mobile/MarkerPeekSheet.tsx`

- [ ] **Step 1: Create the component.**

Create `src/components/mobile/MarkerPeekSheet.tsx`:

```tsx
import { ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MarkerPeekSheetProps {
  open: boolean;
  name: string;
  subtitle?: string;
  onOpen: () => void;
  onDismiss: () => void;
  openLabel?: string;
  className?: string;
}

export function MarkerPeekSheet({
  open,
  name,
  subtitle,
  onOpen,
  onDismiss,
  openLabel = 'Open',
  className,
}: MarkerPeekSheetProps) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-label={`${name} preview`}
      className={cn(
        'absolute left-2 right-2 bottom-2 z-[1000]',
        'bg-white border border-border rounded-xl shadow-lg',
        'p-3 flex items-center gap-3 animate-slide-up',
        className,
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-foreground truncate">{name}</div>
        {subtitle && (
          <div className="text-xs text-muted-foreground truncate">{subtitle}</div>
        )}
      </div>
      <Button size="sm" onClick={onOpen}>
        {openLabel}
        <ChevronRight className="size-3.5 ml-0.5" aria-hidden="true" />
      </Button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss preview"
        className="p-1 text-muted-foreground hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
```

The `animate-slide-up` class already exists in `src/index.css`.

- [ ] **Step 2: Verify build.**

```bash
npm run lint && npm run build
```

- [ ] **Step 3: Commit.**

```bash
git add src/components/mobile/MarkerPeekSheet.tsx
git commit -m "feat(mobile): add MarkerPeekSheet for map marker taps"
```

---

## Task 5 — `MobileShell` skeleton + `App.tsx` integration (gates at mobile width)

**Files:**
- Create: `src/components/mobile/MobileShell.tsx`
- Create: `src/components/mobile/MobileShell.test.tsx`
- Modify: `src/App.tsx`

Ship an **empty shell** first. The three tabs render placeholder text; push pages not yet wired. Goal: mobile devices see the tab bar at the bottom; desktop is unchanged. Delete the FAB + Sheet only after Task 9.

- [ ] **Step 1: Write failing test.**

Create `src/components/mobile/MobileShell.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MobileShell } from './MobileShell';

describe('MobileShell', () => {
  it('renders the bottom tab bar', () => {
    render(<MobileShell />);
    expect(screen.getByRole('tablist', { name: /mobile navigation/i })).toBeInTheDocument();
  });

  it('shows Plan content by default', () => {
    render(<MobileShell />);
    expect(screen.getByTestId('plan-tab-content')).toBeInTheDocument();
  });

  it('switches to Map when Map tab is tapped', async () => {
    render(<MobileShell />);
    await userEvent.click(screen.getByRole('tab', { name: /map/i }));
    expect(screen.getByTestId('map-tab-content')).toBeVisible();
  });

  it('keeps inactive tabs mounted but hidden', async () => {
    render(<MobileShell />);
    // Switch away from Plan
    await userEvent.click(screen.getByRole('tab', { name: /map/i }));
    // Plan still in the DOM (display:none), so still queryable
    expect(screen.queryByTestId('plan-tab-content')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

```bash
npx vitest run src/components/mobile/MobileShell.test.tsx
```

- [ ] **Step 3: Implement the skeleton shell.**

Create `src/components/mobile/MobileShell.tsx`:

```tsx
import { useMobileNav } from '@/hooks/useMobileNav';
import { BottomTabBar } from './BottomTabBar';

interface MobileShellProps {
  inboxCount?: number;
}

export function MobileShell({ inboxCount = 0 }: MobileShellProps) {
  const nav = useMobileNav();

  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      <div className="flex-1 min-h-0 relative">
        <div
          data-testid="plan-tab-content"
          style={{ display: nav.tab === 'plan' ? 'flex' : 'none' }}
          className="absolute inset-0 flex-col"
        >
          <div className="p-4 text-sm text-muted-foreground">Plan tab — skeleton</div>
        </div>
        <div
          data-testid="map-tab-content"
          style={{ display: nav.tab === 'map' ? 'flex' : 'none' }}
          className="absolute inset-0 flex-col"
        >
          <div className="p-4 text-sm text-muted-foreground">Map tab — skeleton</div>
        </div>
        <div
          data-testid="more-tab-content"
          style={{ display: nav.tab === 'more' ? 'flex' : 'none' }}
          className="absolute inset-0 flex-col"
        >
          <div className="p-4 text-sm text-muted-foreground">More tab — skeleton</div>
        </div>
      </div>
      <BottomTabBar tab={nav.tab} onTabChange={nav.setTab} inboxCount={inboxCount} />
    </div>
  );
}
```

- [ ] **Step 4: Re-run — expect 4/4 PASS.**

```bash
npx vitest run src/components/mobile/MobileShell.test.tsx
```

- [ ] **Step 5: Wire into `App.tsx`.**

Open `src/App.tsx`. Near other `useMediaQuery` usage (there should be at least one — check), add:

```tsx
import { MobileShell } from '@/components/mobile/MobileShell';
```

Inside the `ChronosApp` component body, after `useMediaQuery` is called (add the hook if not present — it's already imported for the sidebar split):

```tsx
const isMobile = useMediaQuery('(max-width: 767px)');
```

Find the top-level return of `ChronosApp` (the big JSX block starting around line 833 with `return (` at the end of state-setup code). Just before that `return`, add an early exit:

```tsx
if (isMobile) {
  return <MobileShell inboxCount={inboxVisits.length} />;
}
```

**Important:** this early-exit must come AFTER the Welcome Screen early-return (around line 825) and AFTER all state hooks / memoizations, so hooks run in the same order whether mobile or desktop. Place it immediately before the main `return (` statement.

- [ ] **Step 6: Run the build and check.**

```bash
npm run lint && npm run test && npm run build
```

Expected: all pass. At `<768px`, the browser shows the tab bar with "Plan tab — skeleton" text. Desktop renders unchanged.

Quick manual smoke: `docker compose restart`, open http://localhost:5173/itinerary-planner/ in mobile emulation, verify tab bar appears and tabs switch.

- [ ] **Step 7: Commit.**

```bash
git add src/components/mobile/MobileShell.tsx src/components/mobile/MobileShell.test.tsx src/App.tsx
git commit -m "feat(mobile): MobileShell skeleton + App.tsx integration"
```

---

## Task 6 — `PlanTab` — timeline strip, stay chip, day cards, auto-scroll

**Files:**
- Create: `src/components/mobile/PlanTab.tsx`
- Create: `src/components/mobile/PlanTab.test.tsx`
- Modify: `src/components/mobile/MobileShell.tsx`
- Modify: `src/App.tsx`

The Plan tab renders the same timeline + day content as desktop but without drag handles and without `+` add-visit buttons. Auto-scrolls to today on first mount.

- [ ] **Step 1: Define the PlanTab prop interface.**

`PlanTab` receives:
- `trip: HybridTrip` — the current trip.
- `sortedStays: Stay[]` — stays ordered by `startSlot`.
- `selectedStay: Stay | null` — the active stay.
- `stayDays: StayDay[]` — days of the selected stay (from App.tsx `deriveStayDays`).
- `accommodationGroups: AccommodationGroup[]` — hotel groupings.
- `todayOffset: number | null` — index of today's day within the trip (0-based), or null if today is outside the trip.
- `onSelectStay: (id: string) => void` — timeline strip tap.
- `onOpenStay: () => void` — stay chip tap (opens stay push page).
- `onOpenVisit: (id: string) => void` — visit card tap (opens visit push page).

- [ ] **Step 2: Write failing test.**

Create `src/components/mobile/PlanTab.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlanTab } from './PlanTab';
import type { HybridTrip, Stay, VisitItem } from '@/domain/types';

const mockStay: Stay = {
  id: 'stay-1',
  name: 'Kyoto',
  color: '#b8304f',
  startSlot: 0,
  endSlot: 12,
  lodging: '',
};

const mockTrip: HybridTrip = {
  id: 'trip-1',
  name: 'Japan 2026',
  startDate: '2026-10-14',
  totalDays: 4,
  stays: [mockStay],
  visits: [],
  candidateStays: [],
};

function renderTab(overrides: Partial<React.ComponentProps<typeof PlanTab>> = {}) {
  const scrollSpy = vi.fn();
  Element.prototype.scrollIntoView = scrollSpy;
  return {
    scrollSpy,
    ...render(
      <PlanTab
        trip={mockTrip}
        sortedStays={[mockStay]}
        selectedStay={mockStay}
        stayDays={[]}
        accommodationGroups={[]}
        todayOffset={null}
        onSelectStay={() => {}}
        onOpenStay={() => {}}
        onOpenVisit={() => {}}
        {...overrides}
      />,
    ),
  };
}

describe('PlanTab', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the stay chip when a stay is selected', () => {
    renderTab();
    expect(screen.getByRole('button', { name: /view kyoto stay details/i })).toBeInTheDocument();
  });

  it('calls onOpenStay when the stay chip is tapped', async () => {
    const onOpenStay = vi.fn();
    renderTab({ onOpenStay });
    await userEvent.click(screen.getByRole('button', { name: /view kyoto stay details/i }));
    expect(onOpenStay).toHaveBeenCalled();
  });

  it('renders timeline stay pills for each stay', () => {
    renderTab();
    // Timeline pill renders with stay name
    const pills = screen.getAllByText('Kyoto');
    expect(pills.length).toBeGreaterThan(0);
  });

  it('auto-scrolls to today on first mount when todayOffset is provided', () => {
    const { scrollSpy } = renderTab({ todayOffset: 2 });
    expect(scrollSpy).toHaveBeenCalled();
  });

  it('does not auto-scroll when todayOffset is null', () => {
    const { scrollSpy } = renderTab({ todayOffset: null });
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it('hides the stay chip when no stay is selected', () => {
    renderTab({ selectedStay: null });
    expect(screen.queryByText(/view stay/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run — expect FAIL.**

```bash
npx vitest run src/components/mobile/PlanTab.test.tsx
```

- [ ] **Step 4: Implement.**

Create `src/components/mobile/PlanTab.tsx`:

```tsx
import * as React from 'react';
import type {
  AccommodationGroup,
  HybridTrip,
  Stay,
  StayDay,
  VisitItem,
} from '@/domain/types';
import { fmt, safeDate, addDaysTo } from '@/domain/dateUtils';
import { DAY_PARTS } from '@/domain/constants';
import { getVisitTypeBg } from '@/domain/visitTypeDisplay';
import { StayChip } from './StayChip';
import { cn } from '@/lib/utils';

interface PlanTabProps {
  trip: HybridTrip;
  sortedStays: Stay[];
  selectedStay: Stay | null;
  stayDays: StayDay[];
  accommodationGroups: AccommodationGroup[];
  /** 0-based day-of-trip index for today, or null if today is outside the trip. */
  todayOffset: number | null;
  onSelectStay: (id: string) => void;
  onOpenStay: () => void;
  onOpenVisit: (id: string) => void;
}

export function PlanTab({
  trip,
  sortedStays,
  selectedStay,
  stayDays,
  accommodationGroups,
  todayOffset,
  onSelectStay,
  onOpenStay,
  onOpenVisit,
}: PlanTabProps) {
  const todayRef = React.useRef<HTMLDivElement>(null);
  const didAutoScroll = React.useRef(false);

  React.useEffect(() => {
    if (didAutoScroll.current) return;
    if (todayOffset === null) return;
    if (todayRef.current) {
      todayRef.current.scrollIntoView({ block: 'start', behavior: 'auto' });
      didAutoScroll.current = true;
    }
  }, [todayOffset]);

  // Day-of-stay computation for the chip label
  const stayStartDay = selectedStay
    ? Math.floor(selectedStay.startSlot / 3)
    : 0;
  const stayTotalDays = selectedStay
    ? Math.ceil((selectedStay.endSlot - selectedStay.startSlot) / 3)
    : 0;
  const dayOfStayForToday =
    selectedStay && todayOffset !== null
      ? Math.max(0, Math.min(stayTotalDays - 1, todayOffset - stayStartDay)) + 1
      : 1;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Stay chip */}
      {selectedStay && (
        <StayChip
          name={selectedStay.name}
          color={selectedStay.color}
          dayOfStay={dayOfStayForToday}
          totalDays={stayTotalDays}
          onClick={onOpenStay}
        />
      )}

      {/* Timeline strip */}
      <div className="flex-shrink-0 border-b border-border px-2 py-2 overflow-x-auto scroll-hide">
        <div className="flex items-center gap-1.5">
          {sortedStays.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelectStay(s.id)}
              className={cn(
                'flex-shrink-0 px-3 h-7 rounded-md text-xs font-semibold text-white',
                s.id === selectedStay?.id ? 'ring-2 ring-primary/40' : '',
              )}
              style={{ background: s.color }}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {/* Day column list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 pb-safe">
        {stayDays.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
            <p className="text-sm font-semibold text-foreground">
              {selectedStay ? 'No days yet' : 'Pick a destination above'}
            </p>
            <p className="text-xs text-muted-foreground max-w-[240px]">
              {selectedStay
                ? 'Open on desktop to add activities for this stay.'
                : 'Tap a destination in the timeline to see its days.'}
            </p>
          </div>
        )}

        {stayDays.map((day) => {
          const dayDate = addDaysTo(trip.startDate, day.absoluteOffset);
          const isToday = day.absoluteOffset === todayOffset;
          const dayVisits = trip.visits.filter(
            (v) => v.stayId === selectedStay?.id && v.dayOffset === day.dayIndexWithinStay,
          );
          const dayAccom = accommodationGroups.find(
            (g) => g.dayIndex === day.dayIndexWithinStay,
          );

          return (
            <div
              key={day.dayIndexWithinStay}
              ref={isToday ? todayRef : undefined}
              className={cn(
                'bg-card border border-border rounded-lg p-3',
                isToday && 'ring-1 ring-primary/40',
              )}
            >
              <div className="flex items-baseline justify-between pb-2 border-b border-border mb-2">
                <span className="font-num text-sm font-semibold">
                  Day {day.dayIndexWithinStay + 1}
                </span>
                <span className="font-num text-xs text-muted-foreground">
                  {fmt(safeDate(dayDate), { month: 'short', day: 'numeric' })}
                </span>
              </div>

              {dayAccom && (
                <div className="flex items-center gap-2 text-xs bg-muted/50 rounded-md px-2 py-1.5 mb-2">
                  <span className="shrink-0">🛏</span>
                  <span className="font-medium truncate">{dayAccom.name}</span>
                </div>
              )}

              {DAY_PARTS.map((period) => {
                const periodVisits = dayVisits.filter((v) => v.dayPart === period);
                if (periodVisits.length === 0) return null;
                return (
                  <React.Fragment key={period}>
                    <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold pt-2 pb-1">
                      {period}
                    </div>
                    {periodVisits.map((visit) => (
                      <VisitRow
                        key={visit.id}
                        visit={visit}
                        onOpen={() => onOpenVisit(visit.id)}
                      />
                    ))}
                  </React.Fragment>
                );
              })}

              {dayVisits.length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-4">
                  No activities
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VisitRow({
  visit,
  onOpen,
}: {
  visit: VisitItem;
  onOpen: () => void;
}) {
  const bg = getVisitTypeBg(visit.type);
  const checkDone = visit.checklist?.filter((c) => c.done).length ?? 0;
  const checkTotal = visit.checklist?.length ?? 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/50 hover:bg-muted active:bg-muted/70 text-left"
    >
      <span
        aria-hidden="true"
        className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', bg)}
      />
      <span className="text-xs font-medium flex-1 truncate">{visit.name}</span>
      {checkTotal > 0 && (
        <span className="font-num text-[10px] text-muted-foreground flex-shrink-0">
          ✓ {checkDone}/{checkTotal}
        </span>
      )}
    </button>
  );
}
```

- [ ] **Step 5: Add `todayOffset` computation in App.tsx.**

In `src/App.tsx`, inside `ChronosApp`, add alongside other memoizations:

```tsx
const todayOffset = React.useMemo(() => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = safeDate(trip.startDate);
  start.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0 || diffDays >= trip.totalDays) return null;
  return diffDays;
}, [trip.startDate, trip.totalDays]);
```

- [ ] **Step 6: Wire `PlanTab` into `MobileShell`.**

Update `MobileShell.tsx` to take trip-related props and render the real `PlanTab`. Rename the placeholder content:

Replace the current body of `MobileShell.tsx` with:

```tsx
import { useMobileNav } from '@/hooks/useMobileNav';
import { BottomTabBar } from './BottomTabBar';
import { PlanTab } from './PlanTab';
import type {
  AccommodationGroup,
  HybridTrip,
  Stay,
  StayDay,
} from '@/domain/types';

interface MobileShellProps {
  trip: HybridTrip;
  sortedStays: Stay[];
  selectedStay: Stay | null;
  stayDays: StayDay[];
  accommodationGroups: AccommodationGroup[];
  todayOffset: number | null;
  inboxCount: number;
  onSelectStay: (id: string) => void;
  onOpenStay: () => void;
  onOpenVisit: (id: string) => void;
}

export function MobileShell(props: MobileShellProps) {
  const nav = useMobileNav();

  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      <div className="flex-1 min-h-0 relative">
        <div
          data-testid="plan-tab-content"
          style={{ display: nav.tab === 'plan' ? 'flex' : 'none' }}
          className="absolute inset-0 flex-col"
        >
          <PlanTab
            trip={props.trip}
            sortedStays={props.sortedStays}
            selectedStay={props.selectedStay}
            stayDays={props.stayDays}
            accommodationGroups={props.accommodationGroups}
            todayOffset={props.todayOffset}
            onSelectStay={props.onSelectStay}
            onOpenStay={props.onOpenStay}
            onOpenVisit={props.onOpenVisit}
          />
        </div>
        <div
          data-testid="map-tab-content"
          style={{ display: nav.tab === 'map' ? 'flex' : 'none' }}
          className="absolute inset-0 flex-col"
        >
          <div className="p-4 text-sm text-muted-foreground">Map tab — coming</div>
        </div>
        <div
          data-testid="more-tab-content"
          style={{ display: nav.tab === 'more' ? 'flex' : 'none' }}
          className="absolute inset-0 flex-col"
        >
          <div className="p-4 text-sm text-muted-foreground">More tab — coming</div>
        </div>
      </div>
      <BottomTabBar tab={nav.tab} onTabChange={nav.setTab} inboxCount={props.inboxCount} />
    </div>
  );
}
```

Fix `MobileShell.test.tsx` to pass the required props. Replace the test file contents with:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MobileShell } from './MobileShell';
import type { HybridTrip, Stay } from '@/domain/types';

const mockStay: Stay = {
  id: 's1',
  name: 'Kyoto',
  color: '#b8304f',
  startSlot: 0,
  endSlot: 9,
  lodging: '',
};
const mockTrip: HybridTrip = {
  id: 't1',
  name: 'Japan',
  startDate: '2026-10-14',
  totalDays: 3,
  stays: [mockStay],
  visits: [],
  candidateStays: [],
};

function mount() {
  return render(
    <MobileShell
      trip={mockTrip}
      sortedStays={[mockStay]}
      selectedStay={mockStay}
      stayDays={[]}
      accommodationGroups={[]}
      todayOffset={null}
      inboxCount={0}
      onSelectStay={() => {}}
      onOpenStay={() => {}}
      onOpenVisit={() => {}}
    />,
  );
}

describe('MobileShell', () => {
  it('renders the bottom tab bar', () => {
    mount();
    expect(screen.getByRole('tablist', { name: /mobile navigation/i })).toBeInTheDocument();
  });

  it('shows Plan content by default', () => {
    mount();
    expect(screen.getByTestId('plan-tab-content')).toBeInTheDocument();
  });

  it('switches to Map when Map tab is tapped', async () => {
    mount();
    await userEvent.click(screen.getByRole('tab', { name: /map/i }));
    expect(screen.getByTestId('map-tab-content')).toBeVisible();
  });

  it('keeps inactive tabs mounted', async () => {
    mount();
    await userEvent.click(screen.getByRole('tab', { name: /map/i }));
    expect(screen.queryByTestId('plan-tab-content')).toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Update `App.tsx` to pass real props to MobileShell.**

Replace the existing mobile early-exit in `App.tsx` (the `if (isMobile) return <MobileShell inboxCount={...} />` from Task 5) with:

```tsx
if (isMobile) {
  return (
    <MobileShell
      trip={trip}
      sortedStays={sortedStays}
      selectedStay={selectedStay}
      stayDays={stayDays}
      accommodationGroups={accommodationGroups}
      todayOffset={todayOffset}
      inboxCount={inboxVisits.length}
      onSelectStay={(id) => setSelectedStayId(id)}
      onOpenStay={() => {
        // Will be wired in Task 8 via nav.push; for now, no-op
      }}
      onOpenVisit={(id) => {
        // Will be wired in Task 8 via nav.push; for now, no-op
        setSelectedVisitId(id);
      }}
    />
  );
}
```

Variable names (`sortedStays`, `selectedStay`, `stayDays`, `accommodationGroups`, `inboxVisits`, `setSelectedStayId`, `setSelectedVisitId`) all already exist in `ChronosApp`. Verify each is in scope.

- [ ] **Step 8: Full pipeline.**

```bash
npm run lint && npm run test && npm run build
```

- [ ] **Step 9: Commit.**

```bash
git add src/components/mobile/PlanTab.tsx src/components/mobile/PlanTab.test.tsx \
        src/components/mobile/MobileShell.tsx src/components/mobile/MobileShell.test.tsx \
        src/App.tsx
git commit -m "feat(mobile): PlanTab with timeline strip, stay chip, day cards, auto-scroll"
```

---

## Task 7 — `VisitPage` push page

**Files:**
- Create: `src/components/mobile/VisitPage.tsx`
- Create: `src/components/mobile/VisitPage.test.tsx`

Editable visit detail page. Reuses `ChecklistSection` and `LinksSection` primitives shipped in the polish PR. Drop-in replacement for `VisitDetailDrawer` on mobile, with structural actions removed.

- [ ] **Step 1: Define prop interface.**

`VisitPage` receives:
- `visit: VisitItem`
- `stayName: string`
- `dayLabel: string` (e.g., `"Day 2 · Afternoon"` or `"Unplanned"`)
- `onBack: () => void`
- `onUpdateVisit: (updates: Partial<VisitItem>) => void`
- `onDelete: () => void`

- [ ] **Step 2: Write failing test.**

Create `src/components/mobile/VisitPage.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VisitPage } from './VisitPage';
import type { VisitItem } from '@/domain/types';

const mockVisit: VisitItem = {
  id: 'v1',
  name: 'Fushimi Inari',
  stayId: 's1',
  dayOffset: 0,
  dayPart: 'morning',
  type: 'landmark',
  lat: 35.0116,
  lng: 135.7681,
  duration: '',
  notes: '',
  order: 0,
};

function mount(overrides: Partial<React.ComponentProps<typeof VisitPage>> = {}) {
  return render(
    <VisitPage
      visit={mockVisit}
      stayName="Kyoto"
      dayLabel="Day 1 · Morning"
      onBack={() => {}}
      onUpdateVisit={() => {}}
      onDelete={() => {}}
      {...overrides}
    />,
  );
}

describe('VisitPage', () => {
  it('renders the visit name as the page title', () => {
    mount();
    expect(screen.getByText('Fushimi Inari')).toBeInTheDocument();
  });

  it('renders Navigate and Open-in-Maps CTAs when coords are present', () => {
    mount();
    expect(screen.getByRole('link', { name: /navigate/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open in maps/i })).toBeInTheDocument();
  });

  it('calls onBack when the back button is tapped', async () => {
    const onBack = vi.fn();
    mount({ onBack });
    await userEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(onBack).toHaveBeenCalled();
  });

  it('does not render unschedule or move-to-stay buttons (structural)', () => {
    mount();
    expect(screen.queryByRole('button', { name: /unschedule/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /move to/i })).not.toBeInTheDocument();
  });

  it('allows editing notes (calls onUpdateVisit on blur)', async () => {
    const onUpdateVisit = vi.fn();
    mount({ onUpdateVisit });
    const notes = screen.getByPlaceholderText(/notes/i);
    await userEvent.type(notes, 'Go early');
    notes.blur();
    expect(onUpdateVisit).toHaveBeenCalledWith(
      expect.objectContaining({ notes: expect.stringContaining('Go early') }),
    );
  });
});
```

- [ ] **Step 3: Run — expect FAIL.**

```bash
npx vitest run src/components/mobile/VisitPage.test.tsx
```

- [ ] **Step 4: Implement.**

Create `src/components/mobile/VisitPage.tsx`:

```tsx
import * as React from 'react';
import { ArrowLeft, Navigation, MapPin, Trash2, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChecklistSection } from '@/components/ui/ChecklistSection';
import { LinksSection } from '@/components/ui/LinksSection';
import { getVisitTypeBg, getVisitLabel } from '@/domain/visitTypeDisplay';
import type { VisitItem } from '@/domain/types';
import { cn } from '@/lib/utils';

interface VisitPageProps {
  visit: VisitItem;
  stayName: string;
  dayLabel: string;
  onBack: () => void;
  onUpdateVisit: (updates: Partial<VisitItem>) => void;
  onDelete: () => void;
}

export function VisitPage({
  visit,
  stayName,
  dayLabel,
  onBack,
  onUpdateVisit,
  onDelete,
}: VisitPageProps) {
  const [name, setName] = React.useState(visit.name);
  const [notes, setNotes] = React.useState(visit.notes ?? '');

  const hasCoords = typeof visit.lat === 'number' && typeof visit.lng === 'number';
  const navigateHref = hasCoords
    ? `https://www.google.com/maps/dir/?api=1&destination=${visit.lat},${visit.lng}`
    : undefined;
  const mapsHref = hasCoords
    ? `https://www.google.com/maps/search/?api=1&query=${visit.lat},${visit.lng}`
    : undefined;

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-background">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 border-b border-border bg-white">
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={onBack}
          aria-label="Back"
        >
          <ArrowLeft className="size-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-muted-foreground truncate">{stayName}</div>
          <div className="text-sm font-semibold text-foreground truncate">
            {visit.name}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label="More actions">
              <MoreVertical className="size-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="flex items-center gap-2 w-full px-2 py-1.5 text-destructive hover:bg-destructive/10 rounded-sm text-sm">
                    <Trash2 className="size-4" /> Delete visit
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete "{visit.name}"?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This removes the place from your itinerary. You can undo from history.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={onDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto pb-safe">
        <div className="p-4 space-y-4">
          {/* Meta row */}
          <div className="flex flex-wrap gap-2">
            <span
              className={cn(
                'px-2 py-1 rounded-md text-[10px] font-semibold uppercase',
                getVisitTypeBg(visit.type),
              )}
            >
              {getVisitLabel(visit.type)}
            </span>
            <span className="px-2 py-1 rounded-md text-[10px] font-semibold uppercase bg-muted text-muted-foreground">
              {dayLabel}
            </span>
            {hasCoords && (
              <span className="px-2 py-1 rounded-md font-num text-[10px] bg-muted text-muted-foreground">
                {visit.lat!.toFixed(4)}°N · {visit.lng!.toFixed(4)}°E
              </span>
            )}
          </div>

          {/* CTAs */}
          {hasCoords && (
            <div className="flex gap-2">
              <a
                href={navigateHref}
                target="_blank"
                rel="noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-1.5 bg-primary text-primary-foreground rounded-md py-2 text-sm font-semibold"
              >
                <Navigation className="size-4" /> Navigate
              </a>
              <a
                href={mapsHref}
                target="_blank"
                rel="noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-1.5 bg-muted text-foreground border border-border rounded-md py-2 text-sm font-semibold"
              >
                <MapPin className="size-4" /> Open in Maps
              </a>
            </div>
          )}

          {/* Rename */}
          <div>
            <label
              htmlFor="visit-name"
              className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold block mb-1"
            >
              Name
            </label>
            <input
              id="visit-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                if (name.trim() && name !== visit.name) onUpdateVisit({ name });
              }}
              className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:border-primary"
            />
          </div>

          {/* Notes */}
          <div>
            <label
              htmlFor="visit-notes"
              className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold block mb-1"
            >
              Notes
            </label>
            <textarea
              id="visit-notes"
              placeholder="Notes about this place"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => {
                if (notes !== (visit.notes ?? '')) onUpdateVisit({ notes });
              }}
              rows={3}
              className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:border-primary resize-none"
            />
          </div>

          {/* Checklist */}
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">
              Checklist
            </div>
            <ChecklistSection
              items={visit.checklist ?? []}
              onChange={(items) =>
                onUpdateVisit({ checklist: items.length > 0 ? items : undefined })
              }
            />
          </div>

          {/* Links */}
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">
              Links
            </div>
            <LinksSection
              items={
                (visit.links ?? []).map((l, i) => ({
                  id: `link-${i}`,
                  label: l.label ?? l.url,
                  url: l.url,
                })) ?? []
              }
              onChange={(items) =>
                onUpdateVisit({
                  links:
                    items.length > 0
                      ? items.map((i) => ({ url: i.url, label: i.label }))
                      : undefined,
                })
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
```

Note on the `LinksSection` shape adapter: the `VisitItem.links` shape is `{ url, label? }[]`; `LinksSection` uses `{ id, label, url }[]`. Map in/out at the boundary (see the JSX above). If the existing polish-PR `LinksSection` expects a different shape, adjust the mapping.

- [ ] **Step 5: Re-run — expect 5/5 PASS.**

```bash
npx vitest run src/components/mobile/VisitPage.test.tsx
```

If a test fails because `ChecklistSection` or `LinksSection` requires a specific prop shape, adapt the mapping (do not alter the test semantics).

- [ ] **Step 6: Commit.**

```bash
git add src/components/mobile/VisitPage.tsx src/components/mobile/VisitPage.test.tsx
git commit -m "feat(mobile): VisitPage editable push page"
```

---

## Task 8 — `StayPage` push page

**Files:**
- Create: `src/components/mobile/StayPage.tsx`
- Create: `src/components/mobile/StayPage.test.tsx`

Stay push page with editable notes + checklist + links, **read-only accommodation list**, no rename/delete/color (structural).

- [ ] **Step 1: Write failing test.**

Create `src/components/mobile/StayPage.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StayPage } from './StayPage';
import type { Stay } from '@/domain/types';

const mockStay: Stay = {
  id: 's1',
  name: 'Kyoto',
  color: '#b8304f',
  startSlot: 0,
  endSlot: 12,
  lodging: 'Hotel Granvia',
};

function mount(overrides: Partial<React.ComponentProps<typeof StayPage>> = {}) {
  return render(
    <StayPage
      stay={mockStay}
      visitCount={5}
      totalDays={4}
      totalNights={3}
      accommodationGroups={[]}
      onBack={() => {}}
      onUpdateStay={() => {}}
      {...overrides}
    />,
  );
}

describe('StayPage', () => {
  it('renders the stay name', () => {
    mount();
    expect(screen.getByText('Kyoto')).toBeInTheDocument();
  });

  it('renders stats (days, nights, places)', () => {
    mount();
    expect(screen.getByText('4')).toBeInTheDocument(); // days
    expect(screen.getByText('5')).toBeInTheDocument(); // places
  });

  it('calls onBack when the back button is tapped', async () => {
    const onBack = vi.fn();
    mount({ onBack });
    await userEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(onBack).toHaveBeenCalled();
  });

  it('does not render rename, delete, or color buttons (structural)', () => {
    mount();
    expect(screen.queryByRole('button', { name: /rename/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete stay/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /change color/i })).not.toBeInTheDocument();
  });

  it('allows editing stay notes', async () => {
    const onUpdateStay = vi.fn();
    mount({ onUpdateStay });
    const notes = screen.getByPlaceholderText(/notes/i);
    await userEvent.type(notes, 'Great city');
    notes.blur();
    expect(onUpdateStay).toHaveBeenCalledWith(
      expect.objectContaining({ notes: expect.stringContaining('Great city') }),
    );
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

```bash
npx vitest run src/components/mobile/StayPage.test.tsx
```

- [ ] **Step 3: Implement.**

Create `src/components/mobile/StayPage.tsx`:

```tsx
import * as React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChecklistSection } from '@/components/ui/ChecklistSection';
import { LinksSection } from '@/components/ui/LinksSection';
import type { AccommodationGroup, Stay } from '@/domain/types';

interface StayPageProps {
  stay: Stay;
  visitCount: number;
  totalDays: number;
  totalNights: number;
  accommodationGroups: AccommodationGroup[];
  onBack: () => void;
  onUpdateStay: (updates: Partial<Stay>) => void;
}

export function StayPage({
  stay,
  visitCount,
  totalDays,
  totalNights,
  accommodationGroups,
  onBack,
  onUpdateStay,
}: StayPageProps) {
  const [notes, setNotes] = React.useState(stay.notes ?? '');

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-background">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 border-b border-border bg-white">
        <Button size="icon-sm" variant="ghost" onClick={onBack} aria-label="Back">
          <ArrowLeft className="size-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground truncate">
            {stay.name}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto pb-safe">
        <div className="p-4 space-y-5">
          {/* Hero */}
          <div
            className="h-32 rounded-xl flex items-end p-3"
            style={{
              background: `linear-gradient(135deg, ${stay.color}55 0%, ${stay.color}aa 100%)`,
            }}
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span
                  aria-hidden="true"
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: stay.color }}
                />
                <span className="text-white text-lg font-serif italic drop-shadow">
                  {stay.name}
                </span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="font-num text-lg font-semibold text-primary">
                {totalDays}
              </div>
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">
                Days
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="font-num text-lg font-semibold text-primary">
                {totalNights}
              </div>
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">
                Nights
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="font-num text-lg font-semibold text-primary">
                {visitCount}
              </div>
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">
                Places
              </div>
            </div>
          </div>

          {/* Sleeping (read-only) */}
          {accommodationGroups.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">
                Sleeping
              </div>
              <div className="space-y-1.5">
                {accommodationGroups.map((g, i) => (
                  <div
                    key={`${g.name}-${i}`}
                    className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span>🛏</span>
                      <span className="text-sm font-medium truncate">{g.name}</span>
                    </div>
                    <span className="font-num text-xs text-muted-foreground flex-shrink-0">
                      {g.nights} night{g.nights !== 1 ? 's' : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label
              htmlFor="stay-notes"
              className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold block mb-1"
            >
              Notes
            </label>
            <textarea
              id="stay-notes"
              placeholder="Notes about this stay"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => {
                if (notes !== (stay.notes ?? '')) onUpdateStay({ notes });
              }}
              rows={3}
              className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:border-primary resize-none"
            />
          </div>

          {/* Checklist */}
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">
              To-do
            </div>
            <ChecklistSection
              items={stay.checklist ?? []}
              onChange={(items) =>
                onUpdateStay({ checklist: items.length > 0 ? items : undefined })
              }
            />
          </div>

          {/* Links */}
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">
              Links
            </div>
            <LinksSection
              items={(stay.links ?? []).map((l, i) => ({
                id: `link-${i}`,
                label: l.label ?? l.url,
                url: l.url,
              }))}
              onChange={(items) =>
                onUpdateStay({
                  links:
                    items.length > 0
                      ? items.map((i) => ({ url: i.url, label: i.label }))
                      : undefined,
                })
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Re-run — expect 5/5 PASS.**

```bash
npx vitest run src/components/mobile/StayPage.test.tsx
```

- [ ] **Step 5: Commit.**

```bash
git add src/components/mobile/StayPage.tsx src/components/mobile/StayPage.test.tsx
git commit -m "feat(mobile): StayPage push page with read-only sleeping list"
```

---

## Task 9 — Wire push pages into `MobileShell` + `App.tsx`

**Files:**
- Modify: `src/components/mobile/MobileShell.tsx`
- Modify: `src/App.tsx`

Render `VisitPage` / `StayPage` on top of the active tab when `nav.currentPage` is non-null.

- [ ] **Step 1: Update `MobileShell.tsx` to accept push-page render props.**

Replace the file contents with:

```tsx
import { useMobileNav, type MobileNavApi } from '@/hooks/useMobileNav';
import { BottomTabBar } from './BottomTabBar';
import { PlanTab } from './PlanTab';
import type {
  AccommodationGroup,
  HybridTrip,
  Stay,
  StayDay,
} from '@/domain/types';

interface MobileShellProps {
  trip: HybridTrip;
  sortedStays: Stay[];
  selectedStay: Stay | null;
  stayDays: StayDay[];
  accommodationGroups: AccommodationGroup[];
  todayOffset: number | null;
  inboxCount: number;
  onSelectStay: (id: string) => void;
  onOpenStay: (nav: MobileNavApi) => void;
  onOpenVisit: (id: string, nav: MobileNavApi) => void;
  /** Render the currently-pushed page (Visit or Stay) on top of the active tab. */
  renderCurrentPage: (nav: MobileNavApi) => React.ReactNode;
}

export function MobileShell(props: MobileShellProps) {
  const nav = useMobileNav();
  const currentPageNode = nav.currentPage ? props.renderCurrentPage(nav) : null;

  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      <div className="flex-1 min-h-0 relative">
        {/* Tabs stay mounted */}
        <div
          data-testid="plan-tab-content"
          style={{ display: nav.tab === 'plan' && !currentPageNode ? 'flex' : 'none' }}
          className="absolute inset-0 flex-col"
        >
          <PlanTab
            trip={props.trip}
            sortedStays={props.sortedStays}
            selectedStay={props.selectedStay}
            stayDays={props.stayDays}
            accommodationGroups={props.accommodationGroups}
            todayOffset={props.todayOffset}
            onSelectStay={props.onSelectStay}
            onOpenStay={() => props.onOpenStay(nav)}
            onOpenVisit={(id) => props.onOpenVisit(id, nav)}
          />
        </div>
        <div
          data-testid="map-tab-content"
          style={{ display: nav.tab === 'map' && !currentPageNode ? 'flex' : 'none' }}
          className="absolute inset-0 flex-col"
        >
          <div className="p-4 text-sm text-muted-foreground">Map tab — coming</div>
        </div>
        <div
          data-testid="more-tab-content"
          style={{ display: nav.tab === 'more' && !currentPageNode ? 'flex' : 'none' }}
          className="absolute inset-0 flex-col"
        >
          <div className="p-4 text-sm text-muted-foreground">More tab — coming</div>
        </div>

        {/* Push page overlay */}
        {currentPageNode && (
          <div className="absolute inset-0 flex flex-col bg-background">
            {currentPageNode}
          </div>
        )}
      </div>
      <BottomTabBar tab={nav.tab} onTabChange={nav.setTab} inboxCount={props.inboxCount} />
    </div>
  );
}
```

Update `MobileShell.test.tsx` — add a `renderCurrentPage={() => null}` prop to the mount helper so existing tests still pass.

```tsx
// At the top of MobileShell.test.tsx, replace the mount() helper body:
function mount() {
  return render(
    <MobileShell
      trip={mockTrip}
      sortedStays={[mockStay]}
      selectedStay={mockStay}
      stayDays={[]}
      accommodationGroups={[]}
      todayOffset={null}
      inboxCount={0}
      onSelectStay={() => {}}
      onOpenStay={() => {}}
      onOpenVisit={() => {}}
      renderCurrentPage={() => null}
    />,
  );
}
```

- [ ] **Step 2: Update `App.tsx` to supply render + navigation callbacks.**

Replace the early-exit block in `App.tsx` with:

```tsx
if (isMobile) {
  return (
    <>
      <MobileShell
        trip={trip}
        sortedStays={sortedStays}
        selectedStay={selectedStay}
        stayDays={stayDays}
        accommodationGroups={accommodationGroups}
        todayOffset={todayOffset}
        inboxCount={inboxVisits.length}
        onSelectStay={(id) => setSelectedStayId(id)}
        onOpenStay={(nav) => {
          if (selectedStay) nav.push({ kind: 'stay', id: selectedStay.id });
        }}
        onOpenVisit={(id, nav) => {
          setSelectedVisitId(id);
          nav.push({ kind: 'visit', id });
        }}
        renderCurrentPage={(nav) => {
          const page = nav.currentPage;
          if (!page) return null;
          if (page.kind === 'visit') {
            const visit = trip.visits.find((v) => v.id === page.id);
            const parentStay = visit ? sortedStays.find((s) => s.id === visit.stayId) : null;
            if (!visit || !parentStay) return null;
            const dayLabel =
              visit.dayOffset !== null
                ? `Day ${visit.dayOffset + 1}${
                    visit.dayPart
                      ? ' · ' + visit.dayPart[0].toUpperCase() + visit.dayPart.slice(1)
                      : ''
                  }`
                : 'Unplanned';
            return (
              <VisitPage
                visit={visit}
                stayName={parentStay.name}
                dayLabel={dayLabel}
                onBack={() => nav.pop()}
                onUpdateVisit={(updates) => {
                  setTrip((t) => ({
                    ...t,
                    visits: t.visits.map((v) =>
                      v.id === visit.id ? { ...v, ...updates } : v,
                    ),
                  }));
                }}
                onDelete={() => {
                  setTrip((t) => ({
                    ...t,
                    visits: t.visits.filter((v) => v.id !== visit.id),
                  }));
                  nav.pop();
                }}
              />
            );
          }
          if (page.kind === 'stay') {
            const stay = sortedStays.find((s) => s.id === page.id);
            if (!stay) return null;
            const visitCount = trip.visits.filter((v) => v.stayId === stay.id).length;
            const totalDays = Math.ceil((stay.endSlot - stay.startSlot) / 3);
            return (
              <StayPage
                stay={stay}
                visitCount={visitCount}
                totalDays={totalDays}
                totalNights={totalDays - 1}
                accommodationGroups={accommodationGroups}
                onBack={() => nav.pop()}
                onUpdateStay={(updates) => {
                  setTrip((t) => ({
                    ...t,
                    stays: t.stays.map((s) =>
                      s.id === stay.id ? { ...s, ...updates } : s,
                    ),
                  }));
                }}
              />
            );
          }
          return null;
        }}
      />
      {/* Modals still render at root — they continue to work */}
    </>
  );
}
```

Add imports:

```tsx
import { VisitPage } from '@/components/mobile/VisitPage';
import { StayPage } from '@/components/mobile/StayPage';
```

- [ ] **Step 3: Pipeline.**

```bash
npm run lint && npm run test && npm run build
```

- [ ] **Step 4: Commit.**

```bash
git add src/components/mobile/MobileShell.tsx src/components/mobile/MobileShell.test.tsx src/App.tsx
git commit -m "feat(mobile): wire VisitPage and StayPage via push stack"
```

---

## Task 10 — `MapTab`

**Files:**
- Create: `src/components/mobile/MapTab.tsx`
- Create: `src/components/mobile/MapTab.test.tsx`
- Modify: `src/components/mobile/MobileShell.tsx`
- Modify: `src/App.tsx`

Full-screen map with peek drawer on marker tap. Reuses existing `<TripMap>`.

- [ ] **Step 1: Write failing test.**

Create `src/components/mobile/MapTab.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MapTab } from './MapTab';

describe('MapTab', () => {
  it('renders a map container region', () => {
    render(
      <MapTab
        renderMap={() => <div data-testid="trip-map">map</div>}
        peek={null}
        onOpenPeek={() => {}}
        onDismissPeek={() => {}}
      />,
    );
    expect(screen.getByTestId('trip-map')).toBeInTheDocument();
  });

  it('renders the peek drawer when peek prop is set', () => {
    render(
      <MapTab
        renderMap={() => <div />}
        peek={{ name: 'Fushimi', subtitle: 'Landmark', openLabel: 'Open' }}
        onOpenPeek={() => {}}
        onDismissPeek={() => {}}
      />,
    );
    expect(screen.getByText('Fushimi')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

```bash
npx vitest run src/components/mobile/MapTab.test.tsx
```

- [ ] **Step 3: Implement.**

Create `src/components/mobile/MapTab.tsx`:

```tsx
import { MarkerPeekSheet } from './MarkerPeekSheet';

interface MapTabPeek {
  name: string;
  subtitle?: string;
  openLabel?: string;
}

interface MapTabProps {
  renderMap: () => React.ReactNode;
  peek: MapTabPeek | null;
  onOpenPeek: () => void;
  onDismissPeek: () => void;
}

export function MapTab({ renderMap, peek, onOpenPeek, onDismissPeek }: MapTabProps) {
  return (
    <div className="flex flex-col flex-1 min-h-0 relative">
      <div className="flex-1 min-h-0 relative">{renderMap()}</div>
      <MarkerPeekSheet
        open={!!peek}
        name={peek?.name ?? ''}
        subtitle={peek?.subtitle}
        openLabel={peek?.openLabel}
        onOpen={onOpenPeek}
        onDismiss={onDismissPeek}
      />
    </div>
  );
}
```

- [ ] **Step 4: Re-run — expect 2/2 PASS.**

- [ ] **Step 5: Wire into `MobileShell`.**

Update `MobileShell.tsx` — replace the `map-tab-content` placeholder with:

```tsx
<div
  data-testid="map-tab-content"
  style={{ display: nav.tab === 'map' && !currentPageNode ? 'flex' : 'none' }}
  className="absolute inset-0 flex-col"
>
  {props.renderMapTab(nav)}
</div>
```

Add to `MobileShellProps`:

```tsx
renderMapTab: (nav: MobileNavApi) => React.ReactNode;
```

Update `MobileShell.test.tsx` mount helper to supply a simple `renderMapTab={() => <div />}`.

- [ ] **Step 6: Wire into `App.tsx`.**

In the `<MobileShell>` invocation, add:

```tsx
renderMapTab={(nav) => (
  <MapTab
    renderMap={() => (
      <TripMap
        /* pass the same props as desktop; probably a subset */
        trip={trip}
        sortedStays={sortedStays}
        selectedStay={selectedStay}
        selectedVisitId={selectedVisitId}
        /* When map signals a visit/stay tap, set the peek. If the peek is already set,
           tapping Open pushes the page. */
        onMarkerTap={(kind, id, name, subtitle) => {
          setMobilePeek({ kind, id, name, subtitle });
        }}
        /* ...other existing TripMap props... */
      />
    )}
    peek={mobilePeek ? { name: mobilePeek.name, subtitle: mobilePeek.subtitle } : null}
    onOpenPeek={() => {
      if (!mobilePeek) return;
      if (mobilePeek.kind === 'visit') {
        setSelectedVisitId(mobilePeek.id);
        nav.push({ kind: 'visit', id: mobilePeek.id });
      } else {
        nav.push({ kind: 'stay', id: mobilePeek.id });
      }
      setMobilePeek(null);
    }}
    onDismissPeek={() => setMobilePeek(null)}
  />
)}
```

Add state to `ChronosApp`:

```tsx
const [mobilePeek, setMobilePeek] = useState<{
  kind: 'visit' | 'stay';
  id: string;
  name: string;
  subtitle?: string;
} | null>(null);
```

**Important:** `TripMap` does not currently expose `onMarkerTap` with this signature. Adapt — either add the callback to `TripMap` or wire the existing visit-selection callback (`onSelectVisit`) to set the peek. The cleanest path:
- When `onSelectVisit(id)` fires, look up the visit in `trip.visits`, set `mobilePeek` with its name.
- Same for stay selection.

If `TripMap` needs to be aware of mobile specifically to suppress its desktop popup, add a `mode="mobile-peek"` prop. If that's a sizeable change, defer the peek to a follow-up and have `onOpenPeek` fire directly on tap (skip the peek drawer for now). **Prefer the full peek implementation** — it's the spec, but don't break `TripMap`'s desktop behavior.

Call `map.invalidateSize()` on tab return — add a `useEffect` in `MapTab` that fires a custom event, or pass a `mapReady` callback that `App.tsx` uses to call `invalidateSize` when `nav.tab === 'map'`.

- [ ] **Step 7: Pipeline.**

```bash
npm run lint && npm run test && npm run build
```

- [ ] **Step 8: Commit.**

```bash
git add src/components/mobile/MapTab.tsx src/components/mobile/MapTab.test.tsx \
        src/components/mobile/MobileShell.tsx src/components/mobile/MobileShell.test.tsx \
        src/App.tsx
git commit -m "feat(mobile): MapTab with marker peek drawer"
```

---

## Task 11 — `MoreTab`

**Files:**
- Create: `src/components/mobile/MoreTab.tsx`
- Create: `src/components/mobile/MoreTab.test.tsx`
- Modify: `src/components/mobile/MobileShell.tsx`
- Modify: `src/App.tsx`

The More tab is a scrollable list of action rows grouped by section. Each row either fires a callback (opening an existing modal) or pushes a sub-page (for Inbox).

- [ ] **Step 1: Write failing test.**

Create `src/components/mobile/MoreTab.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MoreTab } from './MoreTab';

function mount(overrides: Partial<React.ComponentProps<typeof MoreTab>> = {}) {
  return render(
    <MoreTab
      inboxCount={0}
      onSwitchTrip={() => {}}
      onEditTrip={() => {}}
      onOpenHistory={() => {}}
      onOpenAIPlanner={() => {}}
      onOpenShare={() => {}}
      onImportCode={() => {}}
      onExportMarkdown={() => {}}
      onExportJson={() => {}}
      onImportJson={() => {}}
      onOpenAuth={() => {}}
      onOpenInbox={() => {}}
      isAuthenticated={false}
      authEmail={null}
      syncStatus="saved"
      version="v1.2.0"
      {...overrides}
    />,
  );
}

describe('MoreTab', () => {
  it('renders the main action groups', () => {
    mount();
    expect(screen.getByText(/trip/i)).toBeInTheDocument();
    expect(screen.getByText(/destinations/i)).toBeInTheDocument();
    expect(screen.getByText(/data/i)).toBeInTheDocument();
    expect(screen.getByText(/power/i)).toBeInTheDocument();
    expect(screen.getByText(/account/i)).toBeInTheDocument();
  });

  it('shows inbox count when > 0', () => {
    mount({ inboxCount: 5 });
    // Both BottomTabBar badge and MoreTab show counts — we check MoreTab row
    const inboxRow = screen.getByRole('button', { name: /inbox/i });
    expect(inboxRow).toHaveTextContent('5');
  });

  it('fires onSwitchTrip when Switch trip is tapped', async () => {
    const onSwitchTrip = vi.fn();
    mount({ onSwitchTrip });
    await userEvent.click(screen.getByRole('button', { name: /switch trip/i }));
    expect(onSwitchTrip).toHaveBeenCalled();
  });

  it('shows "Sign in" when not authenticated', () => {
    mount({ isAuthenticated: false });
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows email when authenticated', () => {
    mount({ isAuthenticated: true, authEmail: 'x@y.com' });
    expect(screen.getByText(/x@y.com/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

```bash
npx vitest run src/components/mobile/MoreTab.test.tsx
```

- [ ] **Step 3: Implement.**

Create `src/components/mobile/MoreTab.tsx`:

```tsx
import {
  ChevronRight,
  FolderKanban,
  Calendar,
  Inbox,
  History,
  Download,
  Upload,
  FileText,
  Sparkles,
  Share2,
  UserCircle2,
  Cloud,
  HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MoreTabProps {
  inboxCount: number;
  onSwitchTrip: () => void;
  onEditTrip: () => void;
  onOpenInbox: () => void;
  onOpenHistory: () => void;
  onImportCode: () => void;
  onExportMarkdown: () => void;
  onExportJson: () => void;
  onImportJson: () => void;
  onOpenAIPlanner: () => void;
  onOpenShare: () => void;
  onOpenAuth: () => void;
  isAuthenticated: boolean;
  authEmail: string | null;
  syncStatus: 'saved' | 'saving' | 'error' | 'local';
  version: string;
}

function Row({
  icon: Icon,
  label,
  badge,
  onClick,
  trailing,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  badge?: React.ReactNode;
  onClick?: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3 bg-white border-b border-border',
        'text-left',
        onClick
          ? 'hover:bg-muted/50 active:bg-muted'
          : 'cursor-default',
      )}
    >
      <Icon className="size-4 text-muted-foreground flex-shrink-0" />
      <span className="flex-1 text-sm font-medium text-foreground truncate">
        {label}
      </span>
      {badge}
      {trailing ?? (onClick && <ChevronRight className="size-4 text-muted-foreground" />)}
    </button>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-4 pt-4 pb-1.5">
      {children}
    </div>
  );
}

export function MoreTab(props: MoreTabProps) {
  const syncLabel = {
    saved: '● Synced',
    saving: '● Saving',
    error: '● Error',
    local: '● Local',
  }[props.syncStatus];

  return (
    <div className="flex-1 overflow-y-auto pb-safe bg-background">
      <SectionHeader>Trip</SectionHeader>
      <Row icon={FolderKanban} label="Switch trip" onClick={props.onSwitchTrip} />
      <Row icon={Calendar} label="Edit trip" onClick={props.onEditTrip} />

      <SectionHeader>Destinations</SectionHeader>
      <Row
        icon={Inbox}
        label="Inbox"
        onClick={props.onOpenInbox}
        badge={
          props.inboxCount > 0 ? (
            <span className="font-num text-[11px] font-bold text-primary min-w-[18px] text-center">
              {props.inboxCount}
            </span>
          ) : undefined
        }
      />
      <Row icon={History} label="History" onClick={props.onOpenHistory} />

      <SectionHeader>Data</SectionHeader>
      <Row icon={Upload} label="Import from code" onClick={props.onImportCode} />
      <Row icon={FileText} label="Export markdown" onClick={props.onExportMarkdown} />
      <Row icon={Download} label="Export JSON" onClick={props.onExportJson} />
      <Row icon={Upload} label="Import JSON" onClick={props.onImportJson} />

      <SectionHeader>Power</SectionHeader>
      <Row icon={Sparkles} label="AI Planner" onClick={props.onOpenAIPlanner} />
      <Row icon={Share2} label="Share trip" onClick={props.onOpenShare} />

      <SectionHeader>Account</SectionHeader>
      {props.isAuthenticated && props.authEmail ? (
        <Row
          icon={UserCircle2}
          label={props.authEmail}
          onClick={props.onOpenAuth}
        />
      ) : (
        <Row icon={UserCircle2} label="Sign in" onClick={props.onOpenAuth} />
      )}
      <Row
        icon={Cloud}
        label={syncLabel}
      />

      <SectionHeader>App</SectionHeader>
      <Row
        icon={HelpCircle}
        label="Help & shortcuts"
        trailing={<span className="text-[10px] text-muted-foreground">Soon</span>}
      />
      <div className="px-4 py-3 text-[10px] text-muted-foreground">
        Version {props.version}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Re-run — expect 5/5 PASS.**

- [ ] **Step 5: Wire into `MobileShell` and `App.tsx`.**

Update `MobileShell.tsx` — replace the `more-tab-content` placeholder:

```tsx
<div
  data-testid="more-tab-content"
  style={{ display: nav.tab === 'more' && !currentPageNode ? 'flex' : 'none' }}
  className="absolute inset-0 flex-col"
>
  {props.renderMoreTab(nav)}
</div>
```

Add to `MobileShellProps`:

```tsx
renderMoreTab: (nav: MobileNavApi) => React.ReactNode;
```

In `App.tsx`, inside the `MobileShell` invocation:

```tsx
renderMoreTab={(nav) => (
  <MoreTab
    inboxCount={inboxVisits.length}
    onSwitchTrip={() => setShowTripSwitcher(true)}
    onEditTrip={() => setShowTripEditor(true)}
    onOpenHistory={() => setShowHistory(true)}
    onOpenInbox={() => {
      // Handled internally by MoreTab's inline-expand (see Step 6).
      // App.tsx supplies a `renderInbox` renderer; the "Inbox" row toggles expansion.
    }}
    onImportCode={() => setShowImportCode(true)}
    onExportMarkdown={handleExportMarkdown}
    onExportJson={handleExportJson}
    onImportJson={() => importFileInputRef.current?.click()}
    onOpenAIPlanner={() => setShowAIPlanner(true)}
    onOpenShare={() => setShowShareDialog(true)}
    onOpenAuth={() => setShowAuthModal(true)}
    isAuthenticated={isAuthenticated}
    authEmail={authEmail}
    syncStatus={syncStatus}
    version={appVersion /* source from package.json or a constant */}
  />
)}
```

**Inbox sub-page caveat:** the "Inbox" row should push a simple list of unscheduled visits + candidate stays. We don't have an `'inbox'` kind in `MobilePage`. Two options:

- **A.** Render the inbox list **inline in MoreTab** (expand/collapse below the Inbox row). Simpler.
- **B.** Add a new `MobilePage` kind `'inbox'` and a `InboxPage` component. More work.

Pick A for this PR. Add an `inboxOpen: boolean` state inside `MoreTab` and render the list below the Inbox row when expanded. Update `MoreTab.tsx` and its test accordingly — ship the expand-inline behavior.

- [ ] **Step 6: Implement inline Inbox expand in `MoreTab.tsx`.**

Add local state and a collapsible section. Append the Inbox content directly after the Inbox row:

```tsx
// inside MoreTab body, before the "History" row — or restructure:
const [inboxOpen, setInboxOpen] = useState(false);
// replace the Inbox Row onClick with:
<Row
  icon={Inbox}
  label="Inbox"
  onClick={() => setInboxOpen((o) => !o)}
  badge={...}
  trailing={inboxOpen ? <ChevronUp ... /> : <ChevronRight ... />}
/>
{inboxOpen && props.renderInbox && (
  <div className="bg-muted/30 border-b border-border">
    {props.renderInbox()}
  </div>
)}
```

Add `renderInbox?: () => React.ReactNode` to `MoreTabProps`. In `App.tsx`, supply a renderer that maps `inboxVisits` + `trip.candidateStays` to tap-to-push rows.

- [ ] **Step 7: Pipeline.**

```bash
npm run lint && npm run test && npm run build
```

- [ ] **Step 8: Commit.**

```bash
git add src/components/mobile/MoreTab.tsx src/components/mobile/MoreTab.test.tsx \
        src/components/mobile/MobileShell.tsx src/App.tsx
git commit -m "feat(mobile): MoreTab with grouped actions + inline inbox"
```

---

## Task 12 — Remove legacy FAB + 85% Sheet

**Files:**
- Modify: `src/App.tsx`

The mobile shell now fully replaces the old mobile surface. Delete the dead code.

- [ ] **Step 1: Delete the FAB block.**

In `src/App.tsx`, find and remove the block starting `{/* ── Mobile FAB for unplanned items ── */}` through the end of its closing tag (`</button>` plus `)}`). It's the `<button>` with `className="md:hidden fixed right-5 z-50 size-14 rounded-full bg-primary ..."`.

- [ ] **Step 2: Delete the Sheet block.**

Find `{/* ── Mobile overlay panel ── */}` and remove everything through the closing `</Sheet>`. Includes the SheetContent, SheetHeader, and all branches (visit detail + unplanned list).

- [ ] **Step 3: Remove now-unused state and imports.**

Find:

```tsx
const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
```

If no remaining references exist (grep), delete the declaration.

Remove the `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle`, `SheetDescription` imports if they aren't used anywhere else in `src/App.tsx`.

Verify with:

```bash
grep -n "Sheet\b\|mobileDrawerOpen" src/App.tsx
```

Expected: zero matches (or only unrelated matches like "Sheet" inside string literals).

- [ ] **Step 4: Pipeline.**

```bash
npm run lint && npm run test && npm run build
```

- [ ] **Step 5: Commit.**

```bash
git add src/App.tsx
git commit -m "chore(mobile): remove legacy FAB and 85% bottom sheet"
```

---

## Task 13 — Desktop regression check + manual QA + docs

**Files:**
- Modify: `docs/PRD.md`
- Modify: `docs/IMPROVEMENTS.md`

- [ ] **Step 1: Desktop regression test.**

Add a test to `src/App.test.tsx` (create the file if it doesn't exist):

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

function stubMatchMedia(matchMobile: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('max-width: 767px') ? matchMobile : !matchMobile,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

describe('App responsive rendering', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('renders desktop layout at ≥768px', () => {
    stubMatchMedia(false);
    render(<App />);
    // Desktop renders a tablist named "Mobile navigation"? No — mobile does.
    expect(screen.queryByRole('tablist', { name: /mobile navigation/i })).not.toBeInTheDocument();
  });

  it('renders mobile shell at <768px', () => {
    stubMatchMedia(true);
    render(<App />);
    expect(screen.getByRole('tablist', { name: /mobile navigation/i })).toBeInTheDocument();
  });
});
```

Skip if `<App>` fails to mount without heavy setup (Firebase, etc.) — in that case the regression check is manual-only, noted below.

- [ ] **Step 2: Manual QA on mobile emulation.**

```bash
docker compose restart
```

Open http://localhost:5173/itinerary-planner/ in Chrome devtools mobile emulation (iPhone 14 preset).

Checklist:

- [ ] Tab bar visible at the bottom with Plan / Map / More.
- [ ] Plan tab: timeline strip, stay chip (when a stay is selected), day cards.
- [ ] Today's day card has a teal ring (if today ∈ trip range).
- [ ] Auto-scroll to today on first open.
- [ ] Tap a visit card → push to VisitPage with back button, CTAs, editable notes/checklist.
- [ ] Edit notes → blur → see change reflected back on Plan tab.
- [ ] Tap Delete in VisitPage kebab → AlertDialog → confirm → back to Plan, visit gone.
- [ ] Tap stay chip → push to StayPage. Stats, read-only Sleeping list, editable notes, checklist, links.
- [ ] No rename / color / delete buttons on StayPage.
- [ ] Switch to Map tab → full-screen map, day filter pills.
- [ ] Tap a marker → peek drawer slides up → Open pushes to VisitPage. Tab bar stays visible.
- [ ] Switch to More tab → see grouped rows. Tap Switch trip → sheet opens. Tap AI Planner → modal.
- [ ] Tap Inbox row → expands inline with unscheduled items. Tap item → pushes to VisitPage.
- [ ] Browser back button pops the push stack.
- [ ] Resize to desktop (≥768px) → existing desktop sidebar layout returns unchanged.
- [ ] Reduced-motion OS setting: no jarring animations.

- [ ] **Step 3: Update `docs/PRD.md`.**

Find the "Sidebar layout" / "Stay Overview Panel" / "Mobile layout" section. Add a mobile-shell subsection:

```markdown
### Mobile layout

At `<768px` the app renders a bottom tab bar (Plan / Map / More) instead of the desktop sidebar layout.

- **Plan** — timeline strip + day cards. Header stay chip links to the selected stay's overview. Auto-scrolls to today on first mount.
- **Map** — full-screen `TripMap` with day filter pills. Tapping a marker surfaces a peek drawer; tapping Open pushes to visit or stay detail.
- **More** — grouped action rows: Switch trip, Edit trip, Inbox (inline expand), History, Import/Export, AI Planner, Share, Account, Sync status, Version.

Push-page stack handles drill-in: Plan → Visit detail, Plan → Stay overview, Map → Visit detail, Inbox → Visit detail. Browser back pops the stack.

Edit affordance on mobile is asymmetric: visits fully editable (checklist, notes, links, rename, delete). Trip structure (new stays, new visits, accommodations, routes, unschedule, move-to-stay) is read-only on mobile — use desktop for structural edits.
```

- [ ] **Step 4: Update `docs/IMPROVEMENTS.md`.**

In the IA critique section, tick the mobile-nav item:

```markdown
- [x] **Mobile tab bar shipped.** 3 tabs (Plan / Map / More), push-page stack for visit and stay detail, header stay chip on Plan. Edit affordance asymmetric — visits editable, trip structure read-only.
```

If the mobile-related item is phrased differently in the file, adapt the wording but mark it done.

- [ ] **Step 5: Commit docs.**

```bash
git add docs/PRD.md docs/IMPROVEMENTS.md
git commit -m "docs: document mobile tab-bar shell"
```

- [ ] **Step 6: Stop. Do NOT push without user approval.**

Report summary (commits, test count, QA findings). Wait for explicit push approval.

---

## Out of scope

- Don't push the branch or open the PR without explicit user approval.
- Don't implement the Trip Summary feature (greyed-out placeholder only).
- Don't implement the `?` help sheet (separate follow-up).
- Don't add URL routing / deep links.
- Don't modify desktop layout, sidebar, or right-side map panel.
- Don't add a 4th `MobilePage.kind === 'inbox'` — inbox is inline-expanded in MoreTab.
- Don't change existing modal internals — they continue to render at `App.tsx` root.
- Don't re-enable drag-drop on mobile cards. Tap only.
