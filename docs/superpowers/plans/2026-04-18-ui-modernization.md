# UI Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install a coherent visual identity (Petrol Teal primary, Travel-Warm × Technical direction, Jewel Tones stay palette, neutral-shell canvas, Inter + Geist Mono typography) in one PR, keeping all layout and features identical.

**Architecture:** Token-first. All visual decisions live in `src/index.css` as CSS variables. shadcn/ui components already read `--color-primary`, `--background`, etc., so most components inherit the new look without edits. Hardcoded color literals and numeric-heavy text sites are swept directly. One new primitive (`Kbd`) extracted because it recurs 4+ times.

**Tech Stack:** React 18 + TypeScript, Tailwind v4 (via `@tailwindcss/vite`), shadcn/ui (nova preset), `@fontsource-variable/geist` + new `@fontsource-variable/geist-mono`, Vitest + Testing Library for unit tests.

**Spec:** `docs/superpowers/specs/2026-04-18-ui-modernization-design.md`

---

## Task ordering rationale

Tokens first so every downstream component picks up new values without edits. Orphan file cleanup second so no one wastes time touching dead code. Constants third (data-layer change with a test). Then sweep hardcoded literals. Then new primitives. Then typography utility. Then manual visual QA + docs.

After each task: `npm run lint && npm run test && npm run build` must pass. Commit after each task unless noted.

---

## Task 1 — Add Geist Mono font dependency

**Files:**

- Modify: `package.json`
- Modify: `src/main.tsx` (or wherever fonts are imported — verify first)

- [ ] **Step 1: Verify where Geist Sans is currently imported.**

```bash
grep -rn "fontsource-variable" src/
```

Expected: a single import, likely in `src/index.css` (line 5). Confirm path.

- [ ] **Step 2: Install Geist Mono.**

```bash
npm install @fontsource-variable/geist-mono
```

Expected: `package.json` dependencies now lists `@fontsource-variable/geist-mono`.

- [ ] **Step 3: Import Geist Mono alongside Geist in `src/index.css`.**

Find line 5:

```css
@import '@fontsource-variable/geist';
```

Replace with:

```css
@import '@fontsource-variable/geist';
@import '@fontsource-variable/geist-mono';
```

- [ ] **Step 4: Verify build.**

```bash
npm run build
```

Expected: PASS. No errors about missing `@fontsource-variable/geist-mono`.

- [ ] **Step 5: Commit.**

```bash
git add package.json package-lock.json src/index.css
git commit -m "chore: add Geist Mono font for numeric UI text"
```

---

## Task 2 — Rewrite token layer in `src/index.css`

This is the big one. All visual decisions land here. Split into sub-steps so each change is reviewable, but commit once at the end.

**Files:**

- Modify: `src/index.css`

- [ ] **Step 1: Replace the `:root` color tokens.**

Find the current `:root { ... }` block (lines 7–48) and replace the listed variables with the new values below. Keep `--day-col-width` and `--day-col-gap` untouched.

```css
:root {
  --day-col-width: 288px;
  --day-col-gap: 20px;

  /* ── Canvas / neutrals ─────────────────────────── */
  --background: #fafaf9;
  --foreground: #18181b;
  --card: #ffffff;
  --card-foreground: #18181b;
  --popover: #ffffff;
  --popover-foreground: #18181b;
  --muted: #f4f4f5;
  --muted-foreground: #71717a;
  --accent: #f4f4f5;
  --accent-foreground: #18181b;
  --border: #ececec;
  --input: #ececec;

  /* ── Primary (Petrol Teal) ─────────────────────── */
  --primary-50: #f0fdfa;
  --primary-100: #ccfbf1;
  --primary-200: #99f6e4;
  --primary-500: #14b8a6;
  --primary-600: #0d9488;
  --primary-700: #0f766e;
  --primary-800: #115e59;
  --primary-900: #134e4a;
  --primary: var(--primary-700);
  --primary-foreground: #ffffff;
  --ring: var(--primary-700);

  /* ── Secondary (neutral surface for toggles) ───── */
  --secondary: #f4f4f5;
  --secondary-foreground: #18181b;

  /* ── Semantic ──────────────────────────────────── */
  --destructive: #dc2626;
  --destructive-foreground: #ffffff;
  --success: #059669;
  --success-foreground: #ffffff;
  --warning: #d97706;
  --warning-foreground: #ffffff;
  --info: #2563eb;
  --info-foreground: #ffffff;

  /* ── Chart (stay palette hooks, kept here for shadcn) ── */
  --chart-1: #b8304f;
  --chart-2: #c15a2a;
  --chart-3: #2e3f8a;
  --chart-4: #6b7a3a;
  --chart-5: #7b3b6b;

  /* ── Radius scale ──────────────────────────────── */
  --radius-sm: 5px;
  --radius-md: 7px;
  --radius-lg: 10px;
  --radius-xl: 14px;
  --radius-2xl: 18px;
  --radius-full: 999px;
  --radius: var(--radius-lg);

  /* ── Elevation ─────────────────────────────────── */
  --shadow-xs: 0 1px 2px rgba(15, 23, 42, 0.04);
  --shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.04), 0 2px 4px -2px rgba(15, 23, 42, 0.04);
  --shadow-md: 0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 16px -6px rgba(15, 118, 110, 0.1);
  --shadow-lg: 0 1px 2px rgba(15, 23, 42, 0.05), 0 20px 40px -12px rgba(15, 118, 110, 0.18);

  /* ── Sidebar (used by shadcn sidebar primitive — kept harmonized) ── */
  --sidebar: #fafaf9;
  --sidebar-foreground: #18181b;
  --sidebar-primary: var(--primary-700);
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: #f4f4f5;
  --sidebar-accent-foreground: #18181b;
  --sidebar-border: #ececec;
  --sidebar-ring: var(--primary-700);
}
```

- [ ] **Step 2: Remove the stale `--color-primary: #ec5b13` literal.**

Find the existing `@theme { ... }` block (around line 60). Replace the block with:

```css
@theme {
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-background-light: var(--background);
  --color-background-dark: #0f0d0c;
  --color-border-neutral: var(--border);
  --color-border-dark: #27272a;
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
  --color-info: var(--info);
  --color-info-foreground: var(--info-foreground);
  --font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
  --font-mono: 'Geist Mono Variable', ui-monospace, SFMono-Regular, monospace;
}
```

- [ ] **Step 3: Delete the `@theme inline` override that silently swaps Inter for Geist Sans.**

Find the block beginning `@theme inline { ... }` (around line 577). Replace the entire block with the one below — note especially that `--font-sans: 'Geist Variable'` is gone, so the `@theme` declaration from Step 2 wins.

```css
@theme inline {
  --color-sidebar-ring: var(--sidebar-ring);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar: var(--sidebar);
  --color-chart-5: var(--chart-5);
  --color-chart-4: var(--chart-4);
  --color-chart-3: var(--chart-3);
  --color-chart-2: var(--chart-2);
  --color-chart-1: var(--chart-1);
  --color-ring: var(--ring);
  --color-input: var(--input);
  --color-border: var(--border);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent: var(--accent);
  --color-muted-foreground: var(--muted-foreground);
  --color-muted: var(--muted);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-secondary: var(--secondary);
  --color-popover-foreground: var(--popover-foreground);
  --color-popover: var(--popover);
  --color-card-foreground: var(--card-foreground);
  --color-card: var(--card);
  --color-foreground: var(--foreground);
  --color-background: var(--background);
  --radius-sm: var(--radius-sm);
  --radius-md: var(--radius-md);
  --radius-lg: var(--radius-lg);
  --radius-xl: var(--radius-xl);
  --radius-2xl: var(--radius-2xl);
  --shadow-xs: var(--shadow-xs);
  --shadow-sm: var(--shadow-sm);
  --shadow-md: var(--shadow-md);
  --shadow-lg: var(--shadow-lg);
}
```

- [ ] **Step 4: Update the calendar (`rdp-inline`) overrides.**

Find the block `.rdp-inline .rdp-root { ... }` (around line 317). Replace the six orange values so the calendar picks up teal.

Changes (do each in turn):

- Line ~319: `--rdp-accent-color: #ec5b13;` → `--rdp-accent-color: #0f766e;`
- Line ~320: `--rdp-accent-background-color: #fef3ee;` → `--rdp-accent-background-color: #ccfbf1;`
- Line ~322: `--rdp-range_middle-background-color: #fef3ee;` → `--rdp-range_middle-background-color: #ccfbf1;`
- Line ~323: `--rdp-range_middle-color: #9a3412;` → `--rdp-range_middle-color: #134e4a;`
- Line ~326: `--rdp-range_start-date-background-color: #ec5b13;` → `--rdp-range_start-date-background-color: #0f766e;`
- Line ~327: `--rdp-range_end-date-background-color: #ec5b13;` → `--rdp-range_end-date-background-color: #0f766e;`
- Line ~328: `--rdp-range_start-background: linear-gradient(90deg, transparent 50%, #fef3ee 50%);` → `--rdp-range_start-background: linear-gradient(90deg, transparent 50%, #ccfbf1 50%);`
- Line ~329: `--rdp-range_end-background: linear-gradient(90deg, #fef3ee 50%, transparent 50%);` → `--rdp-range_end-background: linear-gradient(90deg, #ccfbf1 50%, transparent 50%);`

Also update the calendar rules that still use orange literals:

- `.rdp-inline .rdp-today:not(.rdp-range_start):not(.rdp-range_end) .rdp-day_button { box-shadow: inset 0 0 0 1.5px #ec5b13; ... color: #ec5b13; }` → swap both `#ec5b13` → `#0f766e`.
- `.rdp-inline .rdp-range_start .rdp-day_button, .rdp-inline .rdp-range_end .rdp-day_button { background: #ec5b13 !important; ... }` → `background: #0f766e !important;`
- `.rdp-inline .rdp-range_middle { background: #fef3ee; ... }` → `background: #ccfbf1;`
- `.rdp-inline .rdp-range_middle .rdp-day_button { ... color: #9a3412; ... }` → `color: #134e4a;`
- `.rdp-inline .rdp-range_middle .rdp-day_button:hover { background: rgba(236, 91, 19, 0.12); }` → `background: rgba(15, 118, 110, 0.12);`

- [ ] **Step 5: Update the global focus-visible outline.**

Find (around line 281):

```css
button:focus-visible,
[role='button']:focus-visible,
input:focus-visible,
textarea:focus-visible,
select:focus-visible,
a:focus-visible {
  outline: 2px solid rgba(236, 91, 19, 0.5);
  outline-offset: 2px;
}
```

Change the outline color to `rgba(15, 118, 110, 0.45)`.

- [ ] **Step 6: Fix leftover orange / blue rgbas in map marker styles.**

Find (around line 526):

```css
.map-marker-container.hovered .marker-circle {
  transform: scale(1.2);
  box-shadow: 0 3px 8px rgba(13, 110, 253, 0.35);
}
```

Change shadow to `0 3px 8px rgba(15, 118, 110, 0.35)`.

Find (around line 552):

```css
.cluster-marker-circle {
  ...
  box-shadow: 0 2px 8px rgba(236, 91, 19, 0.35);
  ...
}
```

Change shadow to `0 2px 8px rgba(15, 118, 110, 0.35)`.

- [ ] **Step 7: Add the `.font-num` utility under `@layer utilities`.**

Find the `@layer utilities { ... }` block (starts around line 75). At the end of the block (before the closing `}`) add:

```css
.font-num {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
}
```

- [ ] **Step 8: Update the dark-mode `.dark { ... }` block.**

Find the block `.dark { ... }` (around line 620) and replace with teal-tuned dark values. Components are not verified in dark mode in this PR, but the tokens need to be sane.

```css
.dark {
  --background: #0a0a0b;
  --foreground: #fafaf9;
  --card: #18181b;
  --card-foreground: #fafaf9;
  --popover: #18181b;
  --popover-foreground: #fafaf9;
  --muted: #27272a;
  --muted-foreground: #a1a1aa;
  --accent: #27272a;
  --accent-foreground: #fafaf9;
  --border: rgba(255, 255, 255, 0.08);
  --input: rgba(255, 255, 255, 0.12);

  --primary-50: #134e4a;
  --primary-100: #115e59;
  --primary-200: #0f766e;
  --primary-500: #14b8a6;
  --primary-600: #2dd4bf;
  --primary-700: #5eead4;
  --primary-800: #99f6e4;
  --primary-900: #ccfbf1;
  --primary: var(--primary-700);
  --primary-foreground: #134e4a;
  --ring: var(--primary-700);

  --secondary: #27272a;
  --secondary-foreground: #fafaf9;

  --destructive: #f87171;
  --success: #34d399;
  --warning: #fbbf24;
  --info: #60a5fa;

  --sidebar: #18181b;
  --sidebar-foreground: #fafaf9;
  --sidebar-primary: var(--primary-700);
  --sidebar-primary-foreground: #134e4a;
  --sidebar-accent: #27272a;
  --sidebar-accent-foreground: #fafaf9;
  --sidebar-border: rgba(255, 255, 255, 0.08);
  --sidebar-ring: var(--primary-700);
}
```

- [ ] **Step 9: Verify build, lint, format.**

```bash
npm run lint && npm run build
```

Expected: PASS. There should be no TypeScript or ESLint errors.

- [ ] **Step 10: Start the dev server and open the app in a browser.**

```bash
npm run dev
```

Open `http://localhost:5173/itinerary-planner/`. Expected: app loads, main chrome is teal (buttons, active sidebar item, brand). No orange anywhere. Existing trips with old stay colors still display with their old hexes — that's expected.

Leave the dev server running; later tasks will re-verify against it.

- [ ] **Step 11: Commit.**

```bash
git add src/index.css
git commit -m "feat(theme): rewrite token layer for Petrol Teal identity

Replace orange primary with #0f766e teal scale, neutral shell canvas
(#fafaf9), Inter + Geist Mono fonts, radius/shadow/semantic scales,
and add .font-num utility. Dark-mode tokens laid down (not yet
component-verified). Calendar (rdp) and map marker styles updated."
```

---

## Task 3 — Replace `STAY_COLORS` with Jewel Tones

**Files:**

- Modify: `src/domain/constants.ts`
- Test: `src/domain/__tests__/constants.test.ts` (create if missing)

- [ ] **Step 1: Check whether a constants test file exists.**

```bash
ls src/domain/__tests__/
```

Expected: list includes existing tests; constants may not have one yet.

- [ ] **Step 2: Write a failing test that pins the new palette.**

Create `src/domain/__tests__/constants.test.ts` (or append to an existing one):

```ts
import { describe, it, expect } from 'vitest';
import { STAY_COLORS } from '../constants';

describe('STAY_COLORS', () => {
  it('is the P1 Jewel Tones palette with eight entries', () => {
    expect(STAY_COLORS).toEqual([
      '#b8304f', // Claret
      '#c15a2a', // Rust
      '#2e3f8a', // Indigo
      '#6b7a3a', // Olive
      '#7b3b6b', // Plum
      '#3a4a5a', // Slate
      '#a7772b', // Ochre
      '#3d6b4a', // Moss
    ]);
  });

  it('contains no teal/cyan hues (reserved for chrome)', () => {
    const banned = /#(0f766e|0d9488|14b8a6|5eead4|99f6e4|ccfbf1|22d3ee)/i;
    STAY_COLORS.forEach((hex) => expect(hex).not.toMatch(banned));
  });
});
```

- [ ] **Step 3: Run the test to confirm it fails.**

```bash
npx vitest run src/domain/__tests__/constants.test.ts
```

Expected: FAIL. The first assertion does not match the current array.

- [ ] **Step 4: Swap the palette in `src/domain/constants.ts`.**

Find the `export const STAY_COLORS = [...]` block (lines 15–24) and replace with:

```ts
export const STAY_COLORS = [
  '#b8304f', // Claret
  '#c15a2a', // Rust
  '#2e3f8a', // Indigo
  '#6b7a3a', // Olive
  '#7b3b6b', // Plum
  '#3a4a5a', // Slate
  '#a7772b', // Ochre
  '#3d6b4a', // Moss
];
```

- [ ] **Step 5: Re-run the test.**

```bash
npx vitest run src/domain/__tests__/constants.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run the full test suite to catch any tests that assumed old colors.**

```bash
npm run test
```

Expected: PASS. If any test hard-coded old hexes like `#2167d7`, update it to the new palette.

- [ ] **Step 7: Commit.**

```bash
git add src/domain/constants.ts src/domain/__tests__/constants.test.ts
git commit -m "feat(theme): swap stay palette to P1 Jewel Tones"
```

---

## Task 4 — Delete orphan Mantine files

**Files:**

- Delete: `src/theme.ts`
- Delete: `src/components/AppHeader.tsx`

- [ ] **Step 1: Confirm no other file imports these orphans.**

```bash
grep -rn "from ['\"].*theme['\"]" src/ && grep -rn "AppHeader" src/
```

Expected: no matches, or only matches inside the orphan files themselves.

- [ ] **Step 2: Delete both files.**

```bash
rm src/theme.ts src/components/AppHeader.tsx
```

- [ ] **Step 3: Verify build still passes.**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Commit.**

```bash
git add -u src/theme.ts src/components/AppHeader.tsx
git commit -m "chore: drop orphan Mantine exploration files"
```

---

## Task 5 — Sweep hardcoded `#ec5b13` sites

**Files:**

- Modify: `src/components/ui/LocationPicker.tsx`
- Modify: `src/components/modals/AuthModalSimple.tsx`
- Modify: `src/components/TripMap/markerFactories.tsx`

- [ ] **Step 1: Update `LocationPicker.tsx` line 11.**

Find:

```tsx
  html: '<div style="width:16px;height:16px;background:#ec5b13;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div>',
```

Replace `#ec5b13` with `#0f766e`.

- [ ] **Step 2: Update `AuthModalSimple.tsx` lines 63 and 157.**

Find line 63:

```tsx
style={{ background: 'linear-gradient(90deg, #ec5b13, #f5844a)' }}
```

Replace with:

```tsx
style={{ background: 'linear-gradient(90deg, #0f766e, #14b8a6)' }}
```

Find line 157:

```tsx
background: 'linear-gradient(135deg, #ec5b13 0%, #d44e0f 100%)',
```

Replace with:

```tsx
background: 'linear-gradient(135deg, #0f766e 0%, #0d9488 100%)',
```

- [ ] **Step 3: Update `markerFactories.tsx` line 11.**

Find the visit-type color map:

```tsx
  landmark: '#ec5b13',
```

Replace with:

```tsx
  landmark: '#0f766e',
```

- [ ] **Step 4: Verify no hardcoded orange remains in `src/`.**

```bash
grep -rn "#ec5b13\|ec5b13" src/
```

Expected: zero matches outside of (possibly) comments that explicitly describe the old palette. If any survive, fix or remove them.

- [ ] **Step 5: Re-open the dev server and spot-check.**

With `npm run dev` running, open:

- The auth modal (sign-in flow) — header gradient now teal.
- The map with a landmark visit — marker fill now teal.
- The "Pick on map" flow — drop pin is now teal.

- [ ] **Step 6: Commit.**

```bash
git add src/components/ui/LocationPicker.tsx src/components/modals/AuthModalSimple.tsx src/components/TripMap/markerFactories.tsx
git commit -m "feat(theme): replace remaining orange literals with teal"
```

---

## Task 6 — Create the `Kbd` primitive

**Files:**

- Create: `src/components/ui/kbd.tsx`
- Create: `src/components/ui/kbd.test.tsx`

- [ ] **Step 1: Write the failing test.**

Create `src/components/ui/kbd.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Kbd } from './kbd';

describe('Kbd', () => {
  it('renders the shortcut text', () => {
    render(<Kbd>⌘K</Kbd>);
    expect(screen.getByText('⌘K')).toBeInTheDocument();
  });

  it('uses a <kbd> element for semantics', () => {
    render(<Kbd>N</Kbd>);
    const el = screen.getByText('N');
    expect(el.tagName).toBe('KBD');
  });

  it('applies the mono font utility class', () => {
    render(<Kbd>⌘K</Kbd>);
    expect(screen.getByText('⌘K').className).toContain('font-mono');
  });

  it('merges custom className', () => {
    render(<Kbd className="extra">N</Kbd>);
    expect(screen.getByText('N').className).toContain('extra');
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails.**

```bash
npx vitest run src/components/ui/kbd.test.tsx
```

Expected: FAIL. `Kbd` cannot be imported.

- [ ] **Step 3: Write the minimal implementation.**

Create `src/components/ui/kbd.tsx`:

```tsx
import * as React from 'react';
import { cn } from '@/lib/utils';

export function Kbd({ className, children, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        'inline-flex items-center rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground tabular-nums',
        className,
      )}
      {...props}
    >
      {children}
    </kbd>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes.**

```bash
npx vitest run src/components/ui/kbd.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/components/ui/kbd.tsx src/components/ui/kbd.test.tsx
git commit -m "feat(ui): add Kbd primitive for keyboard shortcut chips"
```

---

## Task 7 — Apply `.font-num` to numeric display sites

**Files:** (read each to confirm exact text before editing)

- Modify: `src/App.tsx`
- Modify: `src/components/panels/StayOverviewPanel.tsx`
- Modify: `src/components/cards/SortableVisitCard.tsx`
- Modify: `src/components/cards/DraggableInventoryCard.tsx`
- Modify: `src/components/modals/AccommodationEditorModal.tsx`
- Modify: `src/components/panels/HistoryPanel.tsx`

The utility was added in Task 2 (Step 7). Apply it to the six site types listed in the spec. Each file edit is a separate step so changes stay bite-sized.

- [ ] **Step 1: Stay date ranges in `panels/StayOverviewPanel.tsx`.**

Open the file, find the element that renders the date range under the hero (typically a `<span>` or `<div>` showing `startDate → endDate` with nights count). Add `font-num` to its `className`.

Example shape to look for and change:

```tsx
<span className="text-xs text-muted-foreground">
  {format(start, 'MMM d')} – {format(end, 'MMM d')} · {nights} nights
</span>
```

Becomes:

```tsx
<span className="text-xs text-muted-foreground font-num">
  {format(start, 'MMM d')} – {format(end, 'MMM d')} · {nights} nights
</span>
```

Also apply to the stat numerals (the 3-up "places / days / hotels"): the `<span>` that holds the number (not the label) gets `font-num`.

- [ ] **Step 2: Day column headers in `src/App.tsx`.**

The day column header renders `Day N` and a date underneath (or next to it). Find the JSX (use grep for `Day {` or the date formatter name used there). Add `font-num` to the numeric parts only:

- The day number span (the digit itself, not the word "Day").
- The date span.

Do **not** apply `font-num` to the word "Day".

- [ ] **Step 3: Visit order numbers in the cards.**

`src/components/cards/SortableVisitCard.tsx` and `src/components/cards/DraggableInventoryCard.tsx` render an order/index badge on each card. Find that span (often a small circled number) and add `font-num`.

- [ ] **Step 4: ISO dates in `AccommodationEditorModal.tsx`.**

Find every rendered date in the modal — night ranges, check-in/out. Add `font-num` to those spans.

- [ ] **Step 5: Version strings in `HistoryPanel.tsx`.**

The history panel shows timestamps or version numbers per snapshot. Add `font-num` to those spans.

- [ ] **Step 6: Full search to catch numeric spots I missed.**

```bash
grep -rn "tabular-nums" src/
```

Expected: previously zero matches except inside `kbd.tsx` and the new utility. Review each find to confirm `font-num` is a better fit; don't replace unless it is.

- [ ] **Step 7: Lint, test, build, visual check.**

```bash
npm run lint && npm run test && npm run build
```

Expected: PASS. Then visit the dev server, open a stay, look at stats / day headers / inventory cards — numerals should read in Geist Mono.

- [ ] **Step 8: Commit.**

```bash
git add -u
git commit -m "feat(theme): apply font-num utility to numeric display sites"
```

---

## Task 8 — Wire the `Kbd` primitive into existing ad-hoc kbd sites

**Files:** (use grep to locate)

- Modify: the 4+ files currently rendering keyboard hints manually (e.g., `⌘K`, `⌘N`, or `Ctrl+...` strings)

- [ ] **Step 1: Locate existing kbd-like sites.**

```bash
grep -rn "⌘\|Cmd+\|Ctrl+" src/ --include="*.tsx"
```

Expected: a handful of matches — typically inside buttons, menu items, or tooltip hints.

- [ ] **Step 2: For each site, replace the inline `<span>` (or similar) with `<Kbd>`.**

Example shape:

```tsx
<span className="text-[10px] font-mono border border-border rounded px-1">⌘K</span>
```

Becomes:

```tsx
import { Kbd } from '@/components/ui/kbd';
// ...
<Kbd>⌘K</Kbd>;
```

If the site is inside a primary (teal-fill) button, pass the tint variant:

```tsx
<Kbd className="bg-primary-800 text-primary-100 border-transparent">N</Kbd>
```

(Use inline Tailwind arbitrary classes only where needed; don't add new variants to the component.)

- [ ] **Step 3: Run the test suite.**

```bash
npm run test
```

Expected: PASS. `Kbd` import + render everywhere.

- [ ] **Step 4: Spot-check the dev server — command palette, add-stay button, history entries.**

- [ ] **Step 5: Commit.**

```bash
git add -u
git commit -m "refactor(ui): use Kbd primitive for keyboard hint sites"
```

---

## Task 9 — Component sweep for stale class names

Most components already consume `bg-primary`, `text-primary`, `border-primary/40` — those pick up teal for free because `--color-primary` now resolves to teal. This task is the visual QA pass to catch anything that still reads wrong.

**Files:** (inspect each — the list is every component using primary-token utilities, from the grep in the spec)

- Modify as needed: all files listed in the spec's "Component restyling" section.

- [ ] **Step 1: Start the dev server if it isn't running.**

```bash
npm run dev
```

- [ ] **Step 2: Walk through each user-facing flow with the checklist below. For every issue, fix it in-place and continue. Don't batch fixes — fix as you find, so the app is always demoable.**

Checklist (tick each):

- Welcome screen loads: brand mark teal, CTA teal, illustration doesn't clash.
- Create a new trip: modal opens with 2xl radius, primary CTA teal, secondary ghost.
- Timeline: blocks use new Jewel Tones for new stays; existing stays keep their old colors (expected).
- Active sidebar stay: highlighted with `primary-100` background, teal text.
- Day columns: headers show `Day N` + date in `font-num`; visit cards render with 10px radius.
- Open a visit: drawer slides in, form inputs focus-ring is teal, kbd chips are `Kbd`.
- Open the calendar popover (date range picker): teal range band, teal selected day, today ring teal.
- Open the trip map: marker cluster is teal, landmark visits are teal, route arrows readable, "Pick on map" pin teal.
- Open the AI planner modal: gradient brand strip teal.
- Open the accommodation editor: dates render in `font-num`, primary CTA teal.
- Open the history panel: entries show timestamps in `font-num`, active entry teal.
- Open the share trip dialog: primary button teal, read-only banner neutral.
- Open the profile menu: active auth state teal accent.
- Toggle dark mode (if a toggle exists): the app is readable but may have small glitches — **do not fix dark-mode bugs in this PR**. Just note any regressions in the PR description.

- [ ] **Step 3: Fix every issue the walk-through surfaces.**

Common patterns you will hit and how to resolve them:

- **Orange appears on hover:** grep the component for `hover:bg-orange`, `from-orange`, `text-orange` Tailwind utilities. Swap to `hover:bg-primary/10`, `from-primary`, `text-primary` respectively.
- **A panel looks too sharp:** it's probably using `rounded-lg` where `rounded-xl` (now 14px) would help. Bump the radius class if the visual design in the spec asks for it (cards, panels → `lg`; stay hero + map card → `xl`; modals → `2xl`).
- **A badge is too big or too small:** shadcn `Badge` now inherits primary. Verify variants still look right; rarely needs a change.
- **A drop shadow looks cold:** swap `shadow-md` to `shadow-[var(--shadow-md)]` — the token's teal-tinted shadow reads warmer.

Commit in small batches as you fix, one logical area at a time.

- [ ] **Step 4: Run the full pipeline.**

```bash
npm run lint && npm run test && npm run build
```

Expected: PASS.

- [ ] **Step 5: Final commit for any fixups.**

```bash
git add -u
git commit -m "feat(theme): component sweep for Petrol Teal identity"
```

---

## Task 10 — Update docs

**Files:**

- Modify: `docs/PRD.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update `docs/PRD.md` "Stack" line.**

Find the line:

```
**Stack:** React 18 + TypeScript, Tailwind v4, shadcn/ui (nova preset), @dnd-kit, react-leaflet, react-day-picker + date-fns, Firebase Auth + Realtime DB, Gemini REST API.
```

Replace with:

```
**Stack:** React 18 + TypeScript, Tailwind v4, shadcn/ui (nova preset), Inter + Geist Mono, @dnd-kit, react-leaflet, react-day-picker + date-fns, Firebase Auth + Realtime DB, Gemini REST API.
```

- [ ] **Step 2: Add an "Identity" note just before "Features" in `docs/PRD.md`.**

Insert:

```markdown
## Identity

Petrol Teal (`#0f766e`) primary, reserved for chrome (brand, CTA, active state, focus, kbd, links). Neutral warm-white canvas (`#fafaf9`), white card surfaces, soft teal-tinted shadows on lift. Inter for UI, Geist Mono for numerals/dates/coords/kbd. Stay palette: Jewel Tones (claret, rust, indigo, olive, plum, slate, ochre, moss) — explicitly avoids teal/cyan so content never collides with chrome.

---
```

- [ ] **Step 3: Update `CLAUDE.md` design-tokens bullet.**

Find:

```
- **Design tokens:** Primary orange `#ec5b13`, font Inter. Semantic colors: success (green), warning (amber), info (blue), destructive (red).
```

Replace with:

```
- **Design tokens:** Primary Petrol Teal `#0f766e` (chrome only), font Inter for UI and Geist Mono for numerals/dates/kbd (`font-num` utility). Neutral canvas `#fafaf9`, white cards. Radius scale `sm/md/lg/xl/2xl/full` via `--radius-*`. Shadow scale `xs/sm/md/lg` via `--shadow-*` — `md`/`lg` carry a subtle teal tint. Semantic colors: success (green `#059669`), warning (amber `#d97706`), info (blue `#2563eb`), destructive (red `#dc2626`).
```

- [ ] **Step 4: Run any doc validations (lint) and commit.**

```bash
npm run lint
```

Expected: PASS (no JSX linting on markdown, but this catches other regressions).

```bash
git add docs/PRD.md CLAUDE.md
git commit -m "docs: document new visual identity and design tokens"
```

---

## Task 11 — Final verification

- [ ] **Step 1: Run the full pipeline one last time.**

```bash
npm run format:check && npm run lint && npm run test && npm run build
```

Expected: all pass. If `format:check` fails, run `npm run format` and commit the diff as `style: prettier pass`.

- [ ] **Step 2: One more manual pass on the dev server.**

Open `http://localhost:5173/itinerary-planner/`. Hit every major flow (welcome → create trip → add stay → add visit → open map → open calendar → open AI planner → open profile → sign in modal → export markdown). Confirm:

- No orange anywhere.
- No broken focus rings.
- No obviously misaligned spacing from changed radii.
- Calendar range picker renders teal cleanly.
- Numeric text feels crisp (mono) and non-numeric text is Inter.

- [ ] **Step 3: Push branch and open PR when ready.**

Stop here — do not push or open the PR until the user asks. Present the final diff summary instead.

---

## Out of scope / explicit non-actions

- Do not migrate existing stored trip colors to the new palette. Old stays keep their old hexes (documented in spec Risks).
- Do not audit or patch dark-mode components. Tokens are in place; a separate future task handles dark mode.
- Do not introduce Storybook.
- Do not extract additional primitives beyond `Kbd`.
- Do not change any layout math (`--day-col-width`, `--day-col-gap`).
- Do not push the branch or open the PR without explicit user approval.
