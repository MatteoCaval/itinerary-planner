# Component Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close all P0 + P1 findings from the 2026-04-19 audit by installing shared primitives (ErrorMessage, PlaceSearchField, ChecklistSection, LinksSection, sonner toast, useReducedMotion) and normalizing every component around them: one button-ordering rule, one confirmation pattern, one error surface, one modal shell.

**Architecture:** Primitives-first. Each new primitive ships with its own TDD test, gets committed, then existing components migrate to it one by one. Cross-cutting rules (button ordering, aria labels, touch targets) are applied as each component is touched. Map perf fixes are module-local (icon cache in `markerFactories.tsx`, debounces in `ClusteredMarkers` / `RouteSegments`).

**Tech Stack:** React 18 + TypeScript, Tailwind v4, shadcn/ui, `sonner` (new), dnd-kit, react-leaflet, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-04-19-component-polish-design.md`
**Audit:** `docs/superpowers/audits/2026-04-19-component-audit.md`

---

## File structure

**New files:**

- `src/components/ui/ErrorMessage.tsx` + `.test.tsx`
- `src/components/ui/Skeleton.tsx`
- `src/components/ui/sonner.tsx` (toast container — shadcn sonner)
- `src/components/ui/PlaceSearchField.tsx` + `.test.tsx`
- `src/components/ui/ChecklistSection.tsx` + `.test.tsx`
- `src/components/ui/LinksSection.tsx` + `.test.tsx`
- `src/hooks/useReducedMotion.ts` + `.test.tsx`
- `src/domain/periodDisplay.ts`
- `src/domain/transportDisplay.ts`

**Modified (large):**

- `src/components/ui/ModalBase.tsx` — add `accent` + `footer` slots
- `src/components/modals/VisitFormModal.tsx` — split into subcomponents
- `src/components/TripMap/markerFactories.tsx` — LRU icon cache
- `src/components/TripMap/ClusteredMarkers.tsx` — debounce + cache
- `src/components/TripMap/RouteSegments.tsx` — debounce + aria
- `src/components/TripMap/StayOverviewLayer.tsx` — cache + flyTo consistency
- `src/components/TripMap/MapControlsPanel.tsx` — responsive + a11y
- `src/components/TripMap/index.tsx` — prop-surface cleanup
- `src/App.tsx` — mount toast container, update TripMap call, toast+undo hooks

**Modified (targeted):**

- Every modal under `src/components/modals/` — footer normalization + ErrorMessage + labels + aria-live
- Every panel under `src/components/panels/` — confirmation pattern
- `src/components/cards/*.tsx` — memo, button semantics, touch targets
- `src/components/WelcomeScreen.tsx`, `ChronosErrorBoundary.tsx`, `InlineDateRangePicker.tsx`
- `src/components/timeline/DroppablePeriodSlot.tsx`

Pipeline gate after every task: `npm run lint && npm run test && npm run build` must pass. The user pre-authorizes commits per-task.

---

## Task 1 — Install sonner and mount the toast container

**Files:**

- Modify: `package.json`
- Create: `src/components/ui/sonner.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Install sonner.**

```bash
npm install sonner
```

Expected: `package.json` dependencies contains `sonner`.

- [ ] **Step 2: Create the Toaster wrapper.**

Write `src/components/ui/sonner.tsx`:

```tsx
import { Toaster as SonnerToaster } from 'sonner';

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
          error: 'group-[.toaster]:border-destructive/40',
        },
      }}
    />
  );
}
```

- [ ] **Step 3: Mount the Toaster in App.**

Open `src/App.tsx`. Find the root JSX element returned by the default export (`<div className="flex flex-col h-screen ..."` or similar). Directly inside the root, after existing children, render:

```tsx
<Toaster />
```

Import at top of file:

```tsx
import { Toaster } from '@/components/ui/sonner';
```

- [ ] **Step 4: Verify build and lint.**

```bash
npm run lint && npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add package.json package-lock.json src/components/ui/sonner.tsx src/App.tsx
git commit -m "feat(ui): mount sonner toast container"
```

---

## Task 2 — `useReducedMotion` hook

**Files:**

- Create: `src/hooks/useReducedMotion.ts`
- Create: `src/hooks/__tests__/useReducedMotion.test.tsx`

- [ ] **Step 1: Write the failing test.**

Create `src/hooks/__tests__/useReducedMotion.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReducedMotion } from '../useReducedMotion';

type MqlListener = (event: MediaQueryListEvent) => void;

function stubMatchMedia(matches: boolean) {
  let listener: MqlListener | null = null;
  const mql = {
    matches,
    addEventListener: (_: string, l: MqlListener) => {
      listener = l;
    },
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal('matchMedia', () => mql);
  return {
    fire: (next: boolean) => listener?.({ matches: next } as MediaQueryListEvent),
  };
}

describe('useReducedMotion', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns initial matchMedia value', () => {
    stubMatchMedia(true);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });

  it('updates when the media query changes', () => {
    const { fire } = stubMatchMedia(false);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
    act(() => fire(true));
    expect(result.current).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test — expect failure.**

```bash
npx vitest run src/hooks/__tests__/useReducedMotion.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the hook.**

Create `src/hooks/useReducedMotion.ts`:

```ts
import { useEffect, useState } from 'react';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
```

- [ ] **Step 4: Re-run the test.**

```bash
npx vitest run src/hooks/__tests__/useReducedMotion.test.tsx
```

Expected: 2/2 PASS.

- [ ] **Step 5: Run the full suite.**

```bash
npm run test
```

Expected: all pass.

- [ ] **Step 6: Commit.**

```bash
git add src/hooks/useReducedMotion.ts src/hooks/__tests__/useReducedMotion.test.tsx
git commit -m "feat(hooks): add useReducedMotion"
```

---

## Task 3 — `ErrorMessage` primitive

**Files:**

- Create: `src/components/ui/ErrorMessage.tsx`
- Create: `src/components/ui/ErrorMessage.test.tsx`

- [ ] **Step 1: Write the failing test.**

Create `src/components/ui/ErrorMessage.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorMessage } from './ErrorMessage';

describe('ErrorMessage', () => {
  it('renders the message content', () => {
    render(<ErrorMessage>Name is required</ErrorMessage>);
    expect(screen.getByText('Name is required')).toBeInTheDocument();
  });

  it('uses role="alert" with assertive live region for destructive tone', () => {
    render(<ErrorMessage>boom</ErrorMessage>);
    const el = screen.getByRole('alert');
    expect(el).toHaveAttribute('aria-live', 'assertive');
  });

  it('uses polite live region and status role for warning tone', () => {
    render(<ErrorMessage tone="warning">careful</ErrorMessage>);
    const el = screen.getByRole('status');
    expect(el).toHaveAttribute('aria-live', 'polite');
  });

  it('applies the destructive color classes by default', () => {
    render(<ErrorMessage>err</ErrorMessage>);
    expect(screen.getByRole('alert').className).toContain('text-destructive');
  });

  it('merges a custom className', () => {
    render(<ErrorMessage className="extra">err</ErrorMessage>);
    expect(screen.getByRole('alert').className).toContain('extra');
  });

  it('renders a custom icon', () => {
    render(<ErrorMessage icon={<svg data-testid="ico" />}>err</ErrorMessage>);
    expect(screen.getByTestId('ico')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect failure.**

```bash
npx vitest run src/components/ui/ErrorMessage.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement.**

Create `src/components/ui/ErrorMessage.tsx`:

```tsx
import * as React from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tone = 'destructive' | 'warning' | 'info';

const toneStyles: Record<Tone, { container: string; text: string; defaultIcon: React.ReactNode }> =
  {
    destructive: {
      container: 'border-destructive/30 bg-destructive/10',
      text: 'text-destructive',
      defaultIcon: <AlertCircle className="size-3.5 shrink-0" />,
    },
    warning: {
      container: 'border-warning/30 bg-warning/10',
      text: 'text-warning',
      defaultIcon: <AlertCircle className="size-3.5 shrink-0" />,
    },
    info: {
      container: 'border-info/30 bg-info/10',
      text: 'text-info',
      defaultIcon: <AlertCircle className="size-3.5 shrink-0" />,
    },
  };

interface ErrorMessageProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: Tone;
  icon?: React.ReactNode;
}

export function ErrorMessage({
  tone = 'destructive',
  icon,
  className,
  children,
  ...props
}: ErrorMessageProps) {
  const styles = toneStyles[tone];
  const isDestructive = tone === 'destructive';
  return (
    <div
      role={isDestructive ? 'alert' : 'status'}
      aria-live={isDestructive ? 'assertive' : 'polite'}
      className={cn(
        'flex items-start gap-2 rounded-md border px-3 py-2 text-xs',
        styles.container,
        styles.text,
        className,
      )}
      {...props}
    >
      <span aria-hidden="true" className="mt-[1px]">
        {icon ?? styles.defaultIcon}
      </span>
      <div className="flex-1">{children}</div>
    </div>
  );
}
```

- [ ] **Step 4: Re-run test.**

```bash
npx vitest run src/components/ui/ErrorMessage.test.tsx
```

Expected: 6/6 PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/components/ui/ErrorMessage.tsx src/components/ui/ErrorMessage.test.tsx
git commit -m "feat(ui): add ErrorMessage primitive"
```

---

## Task 4 — `Skeleton` primitive

**Files:**

- Create: `src/components/ui/Skeleton.tsx`

- [ ] **Step 1: Implement.**

Create `src/components/ui/Skeleton.tsx`:

```tsx
import * as React from 'react';
import { cn } from '@/lib/utils';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  );
}
```

- [ ] **Step 2: Verify build.**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 3: Commit.**

```bash
git add src/components/ui/Skeleton.tsx
git commit -m "feat(ui): add Skeleton primitive for loading placeholders"
```

---

## Task 5 — Rework `ModalBase` (accent + footer slots)

**Files:**

- Modify: `src/components/ui/ModalBase.tsx`

- [ ] **Step 1: Replace the whole file.**

Replace the contents of `src/components/ui/ModalBase.tsx` with:

```tsx
import type React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const widthMap: Record<string, string> = {
  'max-w-sm': 'sm:max-w-sm',
  'max-w-md': 'sm:max-w-md',
  'max-w-lg': 'sm:max-w-lg',
  'max-w-xl': 'sm:max-w-xl',
};

type FooterSlot = {
  destructive?: React.ReactNode;
  cancel?: React.ReactNode;
  primary?: React.ReactNode;
};

interface ModalBaseProps {
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: FooterSlot;
  width?: string;
  accent?: 'none' | 'gradient';
}

export default function ModalBase({
  title,
  description,
  onClose,
  children,
  footer,
  width = 'max-w-md',
  accent = 'none',
}: ModalBaseProps) {
  const hasFooter = !!footer && (footer.destructive || footer.cancel || footer.primary);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className={cn(
          'max-h-[90dvh] flex flex-col gap-0 p-0 overflow-hidden',
          widthMap[width] ?? width,
        )}
      >
        {accent === 'gradient' && (
          <div
            aria-hidden="true"
            className="h-1 w-full bg-[linear-gradient(90deg,var(--primary-700),var(--primary-500))]"
          />
        )}
        <DialogHeader className="px-4 py-3 border-b border-border flex-shrink-0">
          <DialogTitle className="text-base font-semibold tracking-tight">{title}</DialogTitle>
          <DialogDescription className="sr-only">
            {description ?? `Dialog for: ${title}`}
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto overflow-x-hidden flex-1 px-4 py-3.5">{children}</div>
        {hasFooter && (
          <div className="flex items-center gap-2 border-t border-border px-4 py-3">
            {footer?.destructive && <div className="flex-shrink-0">{footer.destructive}</div>}
            <div className="flex-1" />
            {footer?.cancel}
            {footer?.primary}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export type { ModalBaseProps, FooterSlot };
```

- [ ] **Step 2: Verify existing ModalBase consumers still compile.**

```bash
npm run build
```

Expected: PASS. (Existing consumers render with no `footer` prop, so the footer block stays hidden. Header size changed from `xs` to `base` — this is expected and intentional per spec rule 6. Visual sanity-check comes at the end of the phase.)

- [ ] **Step 3: Run tests.**

```bash
npm run test
```

Expected: all pass.

- [ ] **Step 4: Commit.**

```bash
git add src/components/ui/ModalBase.tsx
git commit -m "feat(ui): extend ModalBase with accent and footer slots"
```

---

## Task 6 — Migrate the four rogue modals into `ModalBase`

**Files:**

- Modify: `src/components/modals/AuthModalSimple.tsx`
- Modify: `src/components/modals/ImportFromCodeDialog.tsx`
- Modify: `src/components/modals/MergeDialog.tsx`
- Modify: `src/components/modals/ShareTripDialog.tsx`

Migration pattern for each: the modal's outer `<Dialog><DialogContent>...</DialogContent></Dialog>` gets replaced with `<ModalBase title={...} onClose={...} accent={...} footer={...}>...</ModalBase>`. Inner header markup (`DialogHeader`, `DialogTitle`, custom-size title) is deleted — the title string goes into the `title` prop. Explicit close button (if any — there isn't one in these) is also removed; ModalBase renders the standard close via the Dialog overlay.

- [ ] **Step 1: `AuthModalSimple.tsx` migration.**

The existing modal wraps a `<Dialog><DialogContent>` with custom header + gradient strip + sign-in form.

Changes:

1. Replace the outer Dialog/DialogContent/DialogHeader markup with `<ModalBase title="Sign in" description="Sign in or create an account" onClose={() => onOpenChange(false)} accent="gradient" footer={{ cancel, primary }}>...`.
2. Remove the manually rendered accent bar (line 61-64 area — the current `<div className="h-... bg-gradient...">`). ModalBase now renders it via `accent="gradient"`.
3. Remove the custom-size title (`text-[22px]` etc.) — ModalBase renders the title.
4. The primary CTA button (sign-in or create-account) moves into `footer.primary`; "Cancel" becomes `footer.cancel` with `<Button variant="outline" onClick={...}>Cancel</Button>`.
5. Email validation: at top of submit handler, reject empty and invalid emails with `<ErrorMessage>` surfaced via local `error` state (already exists — ensure it flows through `<ErrorMessage>` instead of inline markup).

Pseudocode skeleton to follow:

```tsx
import ModalBase from '@/components/ui/ModalBase';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { Button } from '@/components/ui/button';
// ...

const isValidEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

const primary = (
  <Button type="submit" form="auth-form" disabled={loading} className="min-w-[96px]">
    {mode === 'signin' ? 'Sign in' : 'Create account'}
  </Button>
);
const cancel = (
  <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
    Cancel
  </Button>
);

return (
  <ModalBase
    title={mode === 'signin' ? 'Sign in' : 'Create account'}
    description="Sign in or create an account to sync your trips"
    onClose={() => !loading && onOpenChange(false)}
    accent="gradient"
    width="max-w-sm"
    footer={{ cancel, primary }}
  >
    <form id="auth-form" onSubmit={handleSubmit} className="flex flex-col gap-3">
      {/* mode tabs, inputs, google button — unchanged except errors */}
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </form>
  </ModalBase>
);
```

Also:

- Clear `error` state when the mode tabs flip (add `setError(null)` inside the tab-click handler).
- Inputs get `<label htmlFor="auth-email" className="sr-only">Email</label>` and `<Input id="auth-email" ... />` (same pattern for password).

- [ ] **Step 2: `ImportFromCodeDialog.tsx` migration.**

1. Outer `Dialog` → `ModalBase` with `title="Import trip"` and `description="Enter a share code to import a trip"`.
2. Status message → `<ErrorMessage tone="destructive">` for errors, `<ErrorMessage tone="info">` for loading ("Looking up code…" → spinner icon + message). Success state keeps a positive surface (create a small inline success banner — not an ErrorMessage, just a neutral div; the successful state quickly transitions away per the existing 800ms delay).
3. Cancel button remains enabled even during loading: drop the `disabled={status.type === 'loading'}` on the Cancel button.
4. Primary button ("Import") moves into `footer.primary`; Cancel into `footer.cancel`.

- [ ] **Step 3: `MergeDialog.tsx` migration.**

1. Outer `Dialog` → `ModalBase` with `title="Choose merge strategy"` and `description="Your local and cloud trips differ — choose how to reconcile"`.
2. The four action buttons (`Merge`, `Keep local`, `Use cloud`, `Decide later`) stay inside the body — this modal has no single primary action, so pass an empty footer (`footer` prop omitted) and let the buttons stay in-body.

- [ ] **Step 4: `ShareTripDialog.tsx` migration.**

1. Outer `Dialog` → `ModalBase` with `title` dynamic based on mode (`"Share trip"` initially, `"Manage sharing"` after code exists).
2. Copy button (`<Button aria-label="Copy share code">`). Add `<Kbd>C</Kbd>` after the label text if feasible.
3. Revoke action becomes an `AlertDialog` (see Task 16 for the general pattern; this one in particular: replace the `showRevokeConfirm` boolean + inline confirm UI with `<AlertDialog>...<AlertDialogContent>...<AlertDialogAction onClick={onRevoke}>Revoke code</AlertDialogAction>...` ).
4. Primary action (Create / Close) moves into `footer.primary`.

- [ ] **Step 5: Verify build and tests.**

```bash
npm run lint && npm run test && npm run build
```

Expected: PASS (tests 124/124). If any test refs a DOM structure that has moved (AddStayModal tests should be fine — they don't target these four modals), fix up selectors.

- [ ] **Step 6: Commit.**

```bash
git add -u
git commit -m "refactor(modals): migrate Auth/Import/Merge/Share to ModalBase"
```

---

## Task 7 — Normalize footers on the remaining modals

**Files:**

- Modify: `src/components/modals/AccommodationEditorModal.tsx`
- Modify: `src/components/modals/AddStayModal.tsx`
- Modify: `src/components/modals/AIPlannerModal.tsx`
- Modify: `src/components/modals/RouteEditorModal.tsx`
- Modify: `src/components/modals/StayEditorModal.tsx`
- Modify: `src/components/modals/TripEditorModal.tsx`
- Modify: `src/components/modals/VisitFormModal.tsx`

Each modal moves its footer buttons out of the body and into the `footer` prop of `ModalBase`. Destructive action (Delete / Unschedule / Move to inbox) goes in `footer.destructive`. Cancel goes in `footer.cancel`. Primary (Save / Add / Generate / etc.) goes in `footer.primary`.

- [ ] **Step 1: Pattern to apply (do this for each of the 7 files).**

Before:

```tsx
<ModalBase title="..." onClose={...}>
  {/* body */}
  <div className="flex gap-2 pt-3 border-t mt-3">
    <Button variant="destructive" onClick={handleDelete}>Delete</Button>
    <div className="flex-1" />
    <Button variant="outline" onClick={onClose}>Cancel</Button>
    <Button onClick={handleSave} disabled={!canSave}>Save</Button>
  </div>
</ModalBase>
```

After:

```tsx
const footer = {
  destructive: onDelete ? (
    <Button variant="destructive" onClick={handleDelete} size="sm">Delete</Button>
  ) : undefined,
  cancel: <Button variant="outline" onClick={onClose} size="sm">Cancel</Button>,
  primary: (
    <Button onClick={handleSave} disabled={!canSave} size="sm">Save</Button>
  ),
};

return (
  <ModalBase title="..." onClose={...} footer={footer}>
    {/* body */}
  </ModalBase>
);
```

The body no longer contains footer markup — delete that block.

Specific per-modal notes:

- **`AccommodationEditorModal.tsx`**: `Remove` goes into `destructive`; `Cancel` and `Save accommodation` into cancel/primary. The modal already has a delete-equivalent (`onRemove`), so reuse it.
- **`AddStayModal.tsx`**: No destructive action. Only cancel + primary. Primary label is `Save to inbox` or `Add destination` depending on `mode` (keep existing logic).
- **`AIPlannerModal.tsx`**: No destructive. Primary is `Generate` or `Apply to timeline` depending on state. Footer only shows when not on the Settings tab (keep existing conditional — pass `footer={undefined}` on the Settings tab).
- **`RouteEditorModal.tsx`**: No destructive. Primary is `Save route`.
- **`StayEditorModal.tsx`**: `Delete` (with its AlertDialog) in destructive. `Move to inbox` is a secondary action — render it inside the body above the footer (not in footer, to avoid overcrowding). Primary is `Save`.
- **`TripEditorModal.tsx`**: `Delete trip` (with AlertDialog) in destructive. Primary is `Save changes`.
- **`VisitFormModal.tsx`**: `Delete` in destructive (with AlertDialog). `Unschedule` is a secondary action rendered inside the body. Primary is `Save` or `Add`.

- [ ] **Step 2: Verify build + tests.**

```bash
npm run lint && npm run test && npm run build
```

Expected: PASS.

- [ ] **Step 3: Commit.**

```bash
git add -u
git commit -m "refactor(modals): normalize footer layout via ModalBase.footer slot"
```

---

## Task 8 — Sweep error surfaces: replace inline error markup with `ErrorMessage`

**Files to sweep:**

- `src/components/modals/AccommodationEditorModal.tsx`
- `src/components/modals/AddStayModal.tsx`
- `src/components/modals/AIPlannerModal.tsx`
- `src/components/modals/AuthModalSimple.tsx` (already partially covered in Task 6 — verify)
- `src/components/modals/ImportFromCodeDialog.tsx`
- `src/components/modals/VisitFormModal.tsx`
- `src/components/panels/ProfileMenu.tsx`

- [ ] **Step 1: Search for inline error markup.**

```bash
grep -rn "bg-destructive/10\|bg-red-500\|bg-red-600\|border-red-" src/components/ --include="*.tsx"
```

Expected: a handful of sites using ad-hoc error styles.

- [ ] **Step 2: For each site, replace with `ErrorMessage`.**

Before:

```tsx
<div className="text-xs text-red-600 bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
  {error}
</div>
```

After:

```tsx
import { ErrorMessage } from '@/components/ui/ErrorMessage';
// ...
<ErrorMessage>{error}</ErrorMessage>;
```

For warning-tone boxes (e.g. "Dates overlap" in `TripEditorModal`), use `<ErrorMessage tone="warning">`.

- [ ] **Step 3: Replace `window.alert()` calls in `ProfileMenu.tsx`.**

Find every `window.alert()` or bare `alert()`. Replace with a sonner toast:

```tsx
import { toast } from 'sonner';
// ...
toast.error('Something went wrong', { description: errMessage });
```

- [ ] **Step 4: Final grep to confirm.**

```bash
grep -rn "window.alert\|^\s*alert(" src/ --include="*.tsx" --include="*.ts"
grep -rn "bg-destructive/10\|border-destructive/30" src/ --include="*.tsx"
```

Expected: `window.alert` is zero. Inline destructive-bg markup should only remain in `ErrorMessage.tsx` itself.

- [ ] **Step 5: Pipeline.**

```bash
npm run lint && npm run test && npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit.**

```bash
git add -u
git commit -m "refactor: migrate inline error markup to ErrorMessage primitive"
```

---

## Task 9 — `PlaceSearchField` primitive

**Files:**

- Create: `src/components/ui/PlaceSearchField.tsx`
- Create: `src/components/ui/PlaceSearchField.test.tsx`

- [ ] **Step 1: Write the failing test.**

Create `src/components/ui/PlaceSearchField.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlaceSearchField } from './PlaceSearchField';

describe('PlaceSearchField', () => {
  it('renders the provided placeholder', () => {
    render(
      <PlaceSearchField
        value=""
        onValueChange={() => {}}
        onPick={() => {}}
        placeholder="Search a city"
      />,
    );
    expect(screen.getByPlaceholderText('Search a city')).toBeInTheDocument();
  });

  it('calls onValueChange when the user types', async () => {
    const onValueChange = vi.fn();
    render(<PlaceSearchField value="" onValueChange={onValueChange} onPick={() => {}} />);
    await userEvent.type(screen.getByRole('textbox'), 'Kyoto');
    expect(onValueChange).toHaveBeenCalled();
  });

  it('invokes onPick when a result is clicked', async () => {
    const onPick = vi.fn();
    render(
      <PlaceSearchField
        value="k"
        onValueChange={() => {}}
        onPick={onPick}
        results={[{ id: 'r1', label: 'Kyoto', lat: 35, lng: 135 }]}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Kyoto/ }));
    expect(onPick).toHaveBeenCalledWith({
      id: 'r1',
      label: 'Kyoto',
      lat: 35,
      lng: 135,
    });
  });

  it('announces loading state via aria-live', () => {
    render(<PlaceSearchField value="k" onValueChange={() => {}} onPick={() => {}} loading />);
    const live = screen.getByText(/searching/i);
    expect(live.closest('[aria-live]')?.getAttribute('aria-live')).toBe('polite');
  });
});
```

- [ ] **Step 2: Run — expect failure.**

```bash
npx vitest run src/components/ui/PlaceSearchField.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement.**

Create `src/components/ui/PlaceSearchField.tsx`:

```tsx
import * as React from 'react';
import { Search, Check, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { ErrorMessage } from './ErrorMessage';

export type PlaceResult = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  sublabel?: string;
};

interface PlaceSearchFieldProps {
  value: string;
  onValueChange: (v: string) => void;
  onPick: (result: PlaceResult) => void;
  results?: PlaceResult[];
  loading?: boolean;
  error?: string | null;
  stale?: boolean;
  placeholder?: string;
  picked?: boolean;
  id?: string;
  label?: string;
  className?: string;
}

export function PlaceSearchField({
  value,
  onValueChange,
  onPick,
  results,
  loading,
  error,
  stale,
  placeholder,
  picked,
  id,
  label,
  className,
}: PlaceSearchFieldProps) {
  const inputId = id ?? React.useId();
  const hasResults = !!results && results.length > 0;
  const open = hasResults && !picked;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label
          htmlFor={inputId}
          className="text-[11px] font-semibold tracking-wide uppercase text-muted-foreground"
        >
          {label}
        </label>
      )}
      <Popover open={open}>
        <PopoverAnchor asChild>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              id={inputId}
              value={value}
              onChange={(e) => onValueChange(e.target.value)}
              placeholder={placeholder ?? 'Search a place…'}
              className="pl-9 pr-9"
              aria-autocomplete="list"
              aria-expanded={open}
            />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground animate-spin" />
            )}
            {!loading && picked && (
              <Check className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-primary" />
            )}
          </div>
        </PopoverAnchor>
        <PopoverContent
          align="start"
          sideOffset={4}
          className="p-1 w-[var(--radix-popover-trigger-width)]"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <ul className="flex flex-col gap-0.5" role="listbox">
            {results?.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onPick(r)}
                  className="w-full text-left rounded-sm px-2 py-1.5 text-xs hover:bg-muted focus:bg-muted focus:outline-none"
                >
                  <div className="font-medium">{r.label}</div>
                  {r.sublabel && (
                    <div className="text-muted-foreground text-[11px]">{r.sublabel}</div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
      <span aria-live="polite" className="sr-only">
        {loading ? 'Searching' : stale ? 'Results may be stale' : ''}
      </span>
      {loading && <span className="text-[11px] text-muted-foreground">Searching…</span>}
      {stale && !loading && (
        <span className="text-[11px] text-muted-foreground">
          Showing previous results while typing…
        </span>
      )}
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </div>
  );
}
```

- [ ] **Step 4: Re-run tests.**

```bash
npx vitest run src/components/ui/PlaceSearchField.test.tsx
```

Expected: 4/4 PASS. If Popover requires a portal root in jsdom, the test may need to await a tick; if so, wrap the click assertion in `await waitFor(...)`.

- [ ] **Step 5: Commit.**

```bash
git add src/components/ui/PlaceSearchField.tsx src/components/ui/PlaceSearchField.test.tsx
git commit -m "feat(ui): add PlaceSearchField primitive with Popover anchoring"
```

---

## Task 10 — `ChecklistSection` + `LinksSection`

**Files:**

- Create: `src/components/ui/ChecklistSection.tsx`
- Create: `src/components/ui/ChecklistSection.test.tsx`
- Create: `src/components/ui/LinksSection.tsx`
- Create: `src/components/ui/LinksSection.test.tsx`

- [ ] **Step 1: `ChecklistSection` test (failing).**

Create `src/components/ui/ChecklistSection.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChecklistSection } from './ChecklistSection';

describe('ChecklistSection', () => {
  it('renders existing items', () => {
    render(
      <ChecklistSection
        items={[{ id: '1', text: 'Buy tickets', done: false }]}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText('Buy tickets')).toBeInTheDocument();
  });

  it('adds a new item', async () => {
    const onChange = vi.fn();
    render(<ChecklistSection items={[]} onChange={onChange} />);
    await userEvent.type(screen.getByPlaceholderText(/add item/i), 'Pack');
    await userEvent.click(screen.getByRole('button', { name: /add/i }));
    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls.at(-1)?.[0];
    expect(next).toHaveLength(1);
    expect(next[0].text).toBe('Pack');
    expect(next[0].done).toBe(false);
  });

  it('flags duplicate entries', async () => {
    render(
      <ChecklistSection items={[{ id: '1', text: 'Pack', done: false }]} onChange={() => {}} />,
    );
    await userEvent.type(screen.getByPlaceholderText(/add item/i), 'pack');
    expect(screen.getByRole('alert')).toHaveTextContent(/already/i);
  });

  it('toggles done state', async () => {
    const onChange = vi.fn();
    render(
      <ChecklistSection items={[{ id: '1', text: 'Pack', done: false }]} onChange={onChange} />,
    );
    await userEvent.click(screen.getByRole('checkbox'));
    const next = onChange.mock.calls.at(-1)?.[0];
    expect(next[0].done).toBe(true);
  });
});
```

- [ ] **Step 2: Implement `ChecklistSection`.**

Create `src/components/ui/ChecklistSection.tsx`:

```tsx
import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from './ErrorMessage';
import { cn } from '@/lib/utils';

export type ChecklistItem = { id: string; text: string; done: boolean };

interface ChecklistSectionProps {
  items: ChecklistItem[];
  onChange: (next: ChecklistItem[]) => void;
  className?: string;
}

export function ChecklistSection({ items, onChange, className }: ChecklistSectionProps) {
  const [draft, setDraft] = React.useState('');

  const trimmed = draft.trim();
  const isDuplicate =
    trimmed.length > 0 && items.some((i) => i.text.trim().toLowerCase() === trimmed.toLowerCase());

  const add = () => {
    if (!trimmed || isDuplicate) return;
    const next: ChecklistItem[] = [
      ...items,
      { id: crypto.randomUUID(), text: trimmed, done: false },
    ];
    onChange(next);
    setDraft('');
  };

  const toggle = (id: string) =>
    onChange(items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));

  const remove = (id: string) => onChange(items.filter((i) => i.id !== id));

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={item.done}
              onCheckedChange={() => toggle(item.id)}
              aria-label={`Toggle "${item.text}"`}
            />
            <span className={cn('flex-1', item.done && 'line-through text-muted-foreground')}>
              {item.text}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => remove(item.id)}
              aria-label={`Remove "${item.text}"`}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <Input
          placeholder="Add item"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          aria-describedby={isDuplicate ? 'checklist-dupe' : undefined}
        />
        <Button type="button" onClick={add} disabled={!trimmed || isDuplicate} size="sm">
          <Plus className="size-3.5" />
          Add
        </Button>
      </div>
      {isDuplicate && (
        <ErrorMessage tone="warning" id="checklist-dupe">
          This item is already in the list.
        </ErrorMessage>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Re-run ChecklistSection test.**

```bash
npx vitest run src/components/ui/ChecklistSection.test.tsx
```

Expected: 4/4 PASS.

- [ ] **Step 4: `LinksSection` test (failing).**

Create `src/components/ui/LinksSection.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LinksSection } from './LinksSection';

describe('LinksSection', () => {
  it('normalizes a URL missing protocol', async () => {
    const onChange = vi.fn();
    render(<LinksSection items={[]} onChange={onChange} />);
    await userEvent.type(screen.getByPlaceholderText(/url/i), 'example.com');
    await userEvent.click(screen.getByRole('button', { name: /add/i }));
    const next = onChange.mock.calls.at(-1)?.[0];
    expect(next[0].url).toBe('https://example.com');
  });

  it('rejects an invalid URL', async () => {
    render(<LinksSection items={[]} onChange={() => {}} />);
    await userEvent.type(screen.getByPlaceholderText(/url/i), 'not a url at all');
    await userEvent.click(screen.getByRole('button', { name: /add/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/valid url/i);
  });

  it('removes an item when trash clicked', async () => {
    const onChange = vi.fn();
    render(
      <LinksSection
        items={[{ id: '1', label: 'Doc', url: 'https://x.com' }]}
        onChange={onChange}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /remove/i }));
    const next = onChange.mock.calls.at(-1)?.[0];
    expect(next).toHaveLength(0);
  });
});
```

- [ ] **Step 5: Implement `LinksSection`.**

Create `src/components/ui/LinksSection.tsx`:

```tsx
import * as React from 'react';
import { Plus, Trash2, ExternalLink } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from './ErrorMessage';
import { cn } from '@/lib/utils';

export type LinkItem = { id: string; label: string; url: string };

interface LinksSectionProps {
  items: LinkItem[];
  onChange: (next: LinkItem[]) => void;
  className?: string;
}

function normalize(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProto);
    if (!url.hostname.includes('.')) return null;
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

export function LinksSection({ items, onChange, className }: LinksSectionProps) {
  const [label, setLabel] = React.useState('');
  const [url, setUrl] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const add = () => {
    const normalized = normalize(url);
    if (!normalized) {
      setError('Enter a valid URL (e.g. example.com or https://example.com).');
      return;
    }
    onChange([
      ...items,
      {
        id: crypto.randomUUID(),
        label: label.trim() || normalized,
        url: normalized,
      },
    ]);
    setLabel('');
    setUrl('');
    setError(null);
  };

  const remove = (id: string) => onChange(items.filter((i) => i.id !== id));

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2 text-sm">
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="flex-1 truncate text-primary hover:underline flex items-center gap-1"
            >
              <ExternalLink className="size-3 shrink-0" />
              <span className="truncate">{item.label}</span>
            </a>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => remove(item.id)}
              aria-label={`Remove link ${item.label}`}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <Input
          placeholder="Label (optional)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="max-w-[140px]"
        />
        <Input
          placeholder="URL"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" onClick={add} disabled={!url.trim()} size="sm">
          <Plus className="size-3.5" />
          Add
        </Button>
      </div>
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </div>
  );
}
```

- [ ] **Step 6: Re-run both tests + full suite.**

```bash
npx vitest run src/components/ui/ChecklistSection.test.tsx src/components/ui/LinksSection.test.tsx
npm run test
```

Expected: PASS.

- [ ] **Step 7: Commit.**

```bash
git add src/components/ui/ChecklistSection.tsx src/components/ui/ChecklistSection.test.tsx \
        src/components/ui/LinksSection.tsx src/components/ui/LinksSection.test.tsx
git commit -m "feat(ui): add ChecklistSection and LinksSection primitives"
```

---

## Task 11 — Split `VisitFormModal` and adopt the new primitives

**Files:**

- Modify: `src/components/modals/VisitFormModal.tsx`

- [ ] **Step 1: Replace inline checklist management with `ChecklistSection`.**

Open `src/components/modals/VisitFormModal.tsx`. Find the block managing `checklistItems` state + the UI rendering checkbox rows (the large block around lines 300–370). Replace with:

```tsx
<div>
  <label className="text-[11px] font-semibold tracking-wide uppercase text-muted-foreground">
    Checklist
  </label>
  <ChecklistSection items={checklist} onChange={setChecklist} className="mt-1.5" />
</div>
```

Remove the local `addChecklistItem` / `toggleChecklistItem` / `removeChecklistItem` handlers — they're now inside the primitive.

Import at top:

```tsx
import { ChecklistSection } from '@/components/ui/ChecklistSection';
```

Confirm that the types align: `checklist` local state should be `ChecklistItem[]` (import from the primitive) and `setChecklist` signature matches `(next: ChecklistItem[]) => void`.

- [ ] **Step 2: Replace inline links management with `LinksSection`.**

Find the block managing `links` state + UI (~lines 373–430). Replace with:

```tsx
<div>
  <label className="text-[11px] font-semibold tracking-wide uppercase text-muted-foreground">
    Links
  </label>
  <LinksSection items={links} onChange={setLinks} className="mt-1.5" />
</div>
```

Remove the local `addLink` / `removeLink` helpers and the associated `newLink` / `newLinkLabel` state. Import `LinksSection` and `LinkItem`.

- [ ] **Step 3: Replace place search with `PlaceSearchField`.**

Find the Search input + dropdown block (~lines 173–236). Replace with:

```tsx
<PlaceSearchField
  id="visit-place-name"
  label="Place"
  value={name}
  onValueChange={(v) => {
    setName(v);
    setPickedCoords(null);
  }}
  onPick={(r) => {
    setName(r.label);
    setPickedCoords({ lat: r.lat, lng: r.lng });
    setResults(undefined);
  }}
  results={results}
  loading={searching}
  error={searchError}
  placeholder="Search a place or address"
  picked={!!pickedCoords}
/>
```

Drop the local state for `showResults` (the Popover manages open/closed via `results?.length`).

- [ ] **Step 4: Replace any remaining inline error markup with `ErrorMessage`.**

Grep within the file for `bg-destructive` or `text-red-600`. Replace with `<ErrorMessage>` / `<ErrorMessage tone="warning">`.

- [ ] **Step 5: Make category grid responsive.**

Find the category toggle grid (`grid-cols-5`). Change to `grid-cols-3 md:grid-cols-5`.

- [ ] **Step 6: Add htmlFor/id pairs.**

Every remaining `Input`/`Textarea` (duration, notes) gets an `id`. Add an `<label htmlFor={...}>` matching — can be `sr-only` if the design uses placeholder-only visuals.

- [ ] **Step 7: Verify line count.**

```bash
wc -l src/components/modals/VisitFormModal.tsx
```

Expected: ≤ 320 lines. If still over, flag it in the commit message.

- [ ] **Step 8: Pipeline.**

```bash
npm run lint && npm run test && npm run build
```

Expected: PASS.

- [ ] **Step 9: Commit.**

```bash
git add -u
git commit -m "refactor(modals): split VisitFormModal via new primitives"
```

---

## Task 12 — Adopt `PlaceSearchField` in the other two modals

**Files:**

- Modify: `src/components/modals/AddStayModal.tsx`
- Modify: `src/components/modals/AccommodationEditorModal.tsx`

- [ ] **Step 1: `AddStayModal` swap.**

Find the search input + geocoded-results dropdown block (~lines 173–248). Replace with a `<PlaceSearchField>` invocation mirroring Task 11 Step 3. Keep all state (`name`, `results`, `searching`, `searchError`, `stale`, `pickedCoords`) — only the JSX changes.

- [ ] **Step 2: `AccommodationEditorModal` swap.**

Two search surfaces exist here: the autocomplete dropdown (suggestions from already-used hotels in this stay) and the geocoding dropdown. Combine them — pass a merged `results` array to `PlaceSearchField`. Local suggestions appear first with `sublabel: 'In this stay'`; geocoded results follow.

Replace the existing two `<div className="absolute z-50 ...">` blocks with one `<PlaceSearchField>`. Keep the existing debounced geocoder effect and local-autocomplete computation — only the rendering changes.

- [ ] **Step 3: Pipeline.**

```bash
npm run lint && npm run test && npm run build
```

Expected: PASS.

- [ ] **Step 4: Commit.**

```bash
git add -u
git commit -m "refactor(modals): adopt PlaceSearchField in AddStay and Accommodation"
```

---

## Task 13 — Labels + aria-live sweep across modals

**Files:** every modal under `src/components/modals/`.

- [ ] **Step 1: Ensure every Input/Textarea has a label.**

For each modal, inspect every `<Input>` / `<Textarea>`. Add an explicit `id` to the input and a matching `<Label htmlFor={...}>` (or `<label htmlFor={...}>` if `Label` isn't already imported — check existing patterns in the file). If the field currently relies on a placeholder, keep visual parity by making the label `sr-only`.

Sweep target list (non-exhaustive — add any the grep surfaces):

- `AccommodationEditorModal.tsx`: name, notes, cost, night picker toggles.
- `AddStayModal.tsx`: days stepper (add `aria-label="Days" `and visible label already exists).
- `AuthModalSimple.tsx`: email, password (covered in Task 6 — verify).
- `RouteEditorModal.tsx`: duration, notes.
- `VisitFormModal.tsx`: duration, notes (covered in Task 11 — verify).
- `TripEditorModal.tsx`: trip name.

- [ ] **Step 2: Ensure every async status uses aria-live.**

Wherever a status is rendered ("Searching…", "Loading…", "No results", "Slow response"), wrap the text in:

```tsx
<span aria-live="polite">{message}</span>
```

`PlaceSearchField` already handles this for search inputs. The remaining sites are `AIPlannerModal` (loading slow warning, skeleton state).

- [ ] **Step 3: Stepper button aria-labels.**

In `AddStayModal.tsx`, the `−` / `+` duration buttons get `aria-label="Decrease days"` / `"Increase days"` and keyboard support:

```tsx
<button
  type="button"
  aria-label="Decrease days"
  onClick={() => setDays(Math.max(1, days - 1))}
  onKeyDown={(e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setDays(Math.max(1, days - 1));
    }
  }}
  // existing classes
>
  −
</button>
```

(And mirror for the increment button.)

- [ ] **Step 4: Pipeline.**

```bash
npm run lint && npm run test && npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add -u
git commit -m "a11y(modals): label associations, aria-live, stepper labels"
```

---

## Task 14 — Cards + timeline: memo, semantic buttons, touch targets

**Files:**

- Modify: `src/components/cards/DraggableInventoryCard.tsx`
- Modify: `src/components/cards/SortableVisitCard.tsx`
- Modify: `src/components/timeline/DroppablePeriodSlot.tsx`
- Create: `src/domain/periodDisplay.ts`

- [ ] **Step 1: `DraggableInventoryCard` — memo + touch targets.**

Wrap the exported component in `React.memo`:

```tsx
import React from 'react';
// ...
const DraggableInventoryCard = React.memo(function DraggableInventoryCard(props: Props) {
  // existing body
});
export default DraggableInventoryCard;
```

Increase edit + locate button size from `icon-sm` (28px) to `icon` (32px). Add horizontal padding so the hit region is ≥ 44px: wrap both in a `<div className="px-1 flex items-center gap-1">` group.

Gate the drag-opacity transition:

```tsx
import { useReducedMotion } from '@/hooks/useReducedMotion';
// inside component body
const reduce = useReducedMotion();
// ...
style={{
  transform: CSS.Translate.toString(transform),
  opacity: isDragging ? (reduce ? 1 : 0.4) : 1,
}}
```

Increase grip handle contrast: swap `text-muted-foreground/30` / `/60` for `text-muted-foreground/50` / `/80` respectively.

- [ ] **Step 2: `SortableVisitCard` — button semantics + memo.**

The current select handler wraps the `<p>` with an `onClick`. Replace with a wrapping `<button>`:

```tsx
<button
  type="button"
  onClick={() => onSelect(visit.id)}
  aria-pressed={isSelected}
  className="text-left w-full rounded-sm focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
>
  <p className="font-medium truncate">{visit.name}</p>
  {/* existing children */}
</button>
```

Wrap component in `React.memo`. Collapse the 4-ring ternary to two data attributes + CSS:

```tsx
<div
  data-selected={isSelected ? '' : undefined}
  data-over={isOver ? '' : undefined}
  className={cn(
    'relative rounded-md border border-border bg-card transition-colors',
    'data-[over]:ring-2 data-[over]:ring-primary/40',
    'data-[selected]:ring-2 data-[selected]:ring-primary',
  )}
>
```

Gate any scale/pulse on `useReducedMotion`.

- [ ] **Step 3: Create `src/domain/periodDisplay.ts`.**

```ts
import { Sunrise, Sun, Moon, type LucideIcon } from 'lucide-react';

export type PeriodKey = 'morning' | 'afternoon' | 'evening';

const META: Record<PeriodKey, { icon: LucideIcon; label: string }> = {
  morning: { icon: Sunrise, label: 'Morning' },
  afternoon: { icon: Sun, label: 'Afternoon' },
  evening: { icon: Moon, label: 'Evening' },
};

export const getPeriodIcon = (p: PeriodKey): LucideIcon => META[p].icon;
export const getPeriodLabel = (p: PeriodKey): string => META[p].label;
```

- [ ] **Step 4: `DroppablePeriodSlot` — memoize items, use helper, larger icons.**

Replace the inline icon/label ternary with the helper:

```tsx
import { getPeriodIcon, getPeriodLabel } from '@/domain/periodDisplay';
// ...
const PeriodIcon = getPeriodIcon(period);
const label = getPeriodLabel(period);
```

Memoize the sortable items:

```tsx
const sortableIds = React.useMemo(
  () => visits.map((v) => v.id),
  [visits],
);
// ...
<SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
```

Bump the period icon from `w-3 h-3` to `w-4 h-4`.

Replace `scale-[1.02]` hover on the add-visit button with `hover:bg-muted/70` (no layout shift).

Add `aria-describedby={`${period}-slot-description`}` — but since the slot already has a visible label, the simpler fix is: the slot's visible `<span>` gets an `id`, and the inner `<button>` (add-visit) gets `aria-describedby={sameId}`.

- [ ] **Step 5: Pipeline.**

```bash
npm run lint && npm run test && npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit.**

```bash
git add -u
git commit -m "refactor(cards,timeline): memoize, use button semantics, enlarge touch targets"
```

---

## Task 15 — Destructive action guards: AlertDialog + toast undo

**Files:**

- Modify: `src/components/panels/HistoryPanel.tsx`
- Modify: `src/components/panels/TripSwitcherPanel.tsx`
- Modify: `src/components/panels/ProfileMenu.tsx`
- Modify: `src/components/panels/VisitDetailDrawer.tsx`
- Modify: `src/components/modals/StayEditorModal.tsx`
- Modify: `src/components/modals/TripEditorModal.tsx`
- Modify: `src/components/modals/VisitFormModal.tsx`
- Modify: `src/components/modals/ShareTripDialog.tsx` (Task 6 partially covered — verify AlertDialog replaces inline confirm)
- Modify: `src/App.tsx` (wire toast + undo plumbing)

- [ ] **Step 1: Toast-with-undo pattern.**

In `src/App.tsx`, at the top of the component, create a helper:

```tsx
import { toast } from 'sonner';

function useReversibleAction<T>() {
  // returns a function you pass (description, commit, revert) to
  return React.useCallback((label: string, revert: () => void, description?: string) => {
    toast(label, {
      description,
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: () => revert(),
      },
    });
  }, []);
}

// inside App:
const notifyReversible = useReversibleAction();
```

Pass `notifyReversible` as a prop down to `HistoryPanel`, `TripSwitcherPanel`, `VisitDetailDrawer`, etc.

- [ ] **Step 2: `HistoryPanel` — toast+undo on snapshot nav.**

When the user clicks a past snapshot:

```tsx
const previousIndex = historyIndex;
navigateHistory(targetIndex);
notifyReversible(`Switched to snapshot ${targetIndex + 1}`, () => navigateHistory(previousIndex));
```

Also memoize the reversed list:

```tsx
const reversed = React.useMemo(() => [...history].reverse(), [history]);
```

- [ ] **Step 3: `TripSwitcherPanel` — toast+undo on trip switch.**

```tsx
const prev = activeTripId;
onSwitchTrip(tripId);
notifyReversible(`Switched to "${tripName}"`, () => onSwitchTrip(prev));
```

- [ ] **Step 4: `ProfileMenu` — sign-out confirmation + alert replacement.**

Wrap Sign out in `AlertDialog`:

```tsx
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="ghost" className="w-full justify-start">
      Sign out
    </Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Sign out of {authEmail}?</AlertDialogTitle>
      <AlertDialogDescription>
        You'll need to sign back in to resume cloud sync.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={onSignOut}>Sign out</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

- [ ] **Step 5: `VisitDetailDrawer` — delete confirmation.**

Wrap the delete button in `AlertDialog`:

```tsx
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="destructive" size="sm">
      <Trash2 className="size-3.5" /> Delete
    </Button>
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
        onClick={() => onDelete(visit.id)}
        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
      >
        Delete
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

- [ ] **Step 6: `TripEditorModal` — delete-with-impact.**

The existing Delete button already uses AlertDialog. Update the AlertDialogDescription to include impact text:

```tsx
<AlertDialogDescription>
  Delete "{tripName}" along with its {stayCount} {stayCount === 1 ? 'stay' : 'stays'} and{' '}
  {visitCount} {visitCount === 1 ? 'place' : 'places'}? This cannot be undone.
</AlertDialogDescription>
```

Compute `stayCount` and `visitCount` from the trip data at the top of the component.

- [ ] **Step 7: `StayEditorModal` — require non-empty name.**

Add at top of component:

```tsx
const canSave = name.trim().length > 0;
```

Wire into the Save button's `disabled` prop.

- [ ] **Step 8: `VisitFormModal` — delete with AlertDialog.**

If not already wrapped (per Task 7 Step 1, yes it is), verify the Delete button uses AlertDialog with impact (visit name + "this cannot be undone").

- [ ] **Step 9: `ShareTripDialog` — revoke AlertDialog.**

Replace the existing `showRevokeConfirm` boolean state + inline confirm button pair with a single `<AlertDialog>` wrapping the Revoke trigger. Remove `showRevokeConfirm` state.

- [ ] **Step 10: Pipeline.**

```bash
npm run lint && npm run test && npm run build
```

Expected: PASS.

- [ ] **Step 11: Commit.**

```bash
git add -u
git commit -m "feat(ux): add destructive-action guards and reversible toasts"
```

---

## Task 16 — Map subsystem: icon cache + debounces + a11y

**Files:**

- Modify: `src/components/TripMap/markerFactories.tsx`
- Modify: `src/components/TripMap/ClusteredMarkers.tsx`
- Modify: `src/components/TripMap/RouteSegments.tsx`
- Modify: `src/components/TripMap/StayOverviewLayer.tsx`
- Modify: `src/components/TripMap/MapControlsPanel.tsx`
- Modify: `src/components/TripMap/index.tsx`

- [ ] **Step 1: Icon cache in `markerFactories.tsx`.**

At top of file:

```tsx
const ICON_CACHE = new Map<string, L.DivIcon>();
const ICON_CACHE_LIMIT = 200;

function cached(key: string, build: () => L.DivIcon): L.DivIcon {
  const hit = ICON_CACHE.get(key);
  if (hit) return hit;
  const icon = build();
  ICON_CACHE.set(key, icon);
  if (ICON_CACHE.size > ICON_CACHE_LIMIT) {
    const first = ICON_CACHE.keys().next().value;
    if (first !== undefined) ICON_CACHE.delete(first);
  }
  return icon;
}
```

Wrap each `createIcon`, `createAccommodationIcon`, `createStayMarkerIcon`, `createClusterIcon` body in a `cached(key, () => ...)` call. Keys:

- `createIcon(type, index, selected)` → key `visit:${type}:${index}:${selected ? 's' : ''}`
- `createAccommodationIcon()` → key `accom`
- `createStayMarkerIcon(name, color, highlighted)` → key `stay:${color}:${name}:${highlighted ? 'h' : ''}`
- `createClusterIcon(count)` → key `cluster:${count}`

- [ ] **Step 2: Debounce clustering in `ClusteredMarkers.tsx`.**

Find the `moveend` handler that recomputes clusters. Wrap the recompute in a trailing-debounce of 120ms:

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
// inside the component:
const pendingRef = useRef<number | null>(null);
const debouncedRecompute = useMemo(
  () => (fn: () => void) => {
    if (pendingRef.current) window.clearTimeout(pendingRef.current);
    pendingRef.current = window.setTimeout(() => {
      pendingRef.current = null;
      fn();
    }, 120);
  },
  [],
);
useEffect(() => {
  const onMoveEnd = () => debouncedRecompute(() => recomputeClusters());
  map.on('moveend', onMoveEnd);
  return () => {
    map.off('moveend', onMoveEnd);
    if (pendingRef.current) window.clearTimeout(pendingRef.current);
  };
}, [map, debouncedRecompute, recomputeClusters]);
```

Adapt to the exact names in the file; the pattern stays.

- [ ] **Step 3: Debounce `useRouteGeometry`.**

In `src/hooks/useRouteGeometry.ts`, debounce the segment-to-fetch conversion by 150ms so rapid changes collapse. Find the `useEffect` that fires the fetch; wrap with:

```tsx
useEffect(() => {
  const t = window.setTimeout(() => {
    // existing fetch logic
  }, 150);
  return () => window.clearTimeout(t);
}, [serialized - key - of - segments]);
```

The existing code already has the fetch body — just add the 150ms wrapper and clear on cleanup.

- [ ] **Step 4: `RouteSegments` — aria on polylines.**

For every `<Polyline>` rendered, add:

```tsx
eventHandlers={{
  add: (e) => {
    const path = (e.target as L.Path).getElement();
    if (path) {
      path.setAttribute(
        'aria-description',
        `${transportType} route from ${fromName} to ${toName}`,
      );
      path.setAttribute('role', 'img');
    }
  },
}}
```

(Leaflet strips declarative ARIA; attach via the `add` event.)

- [ ] **Step 5: `StayOverviewLayer` — cache usage + flyTo duration.**

Any direct `renderToStaticMarkup` call in this file moves behind the icon-cache helpers in `markerFactories`. Standardize `flyTo(..., { duration: 0.4 })`.

- [ ] **Step 6: `MapControlsPanel` — responsive + a11y.**

- Width: replace `w-56` with `w-56 max-md:w-[min(90vw,14rem)]`.
- Settings toggle button: size `icon-lg` (40px).
- Wrap the legend in `<dl className="...">` with pairs:

```tsx
<dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs">
  <dt>
    <span className="size-3 rounded-full" style={{ background: color }} />
  </dt>
  <dd>{label}</dd>
</dl>
```

- [ ] **Step 7: `TripMap/index.tsx` — prop grouping.**

Replace the 15-prop interface with four grouped objects:

```tsx
interface TripMapProps {
  data: {
    trip: HybridTrip;
    accommodations: NightAccommodation[];
    overviewStays: Stay[];
    overviewCandidates: Stay[];
  };
  selection: {
    selectedVisitId: string | null;
    highlightedVisitId: string | null;
    selectedStayId: string | null;
  };
  mode: 'detail' | 'overview';
  callbacks: {
    onSelectVisit: (id: string) => void;
    onSelectStay: (id: string) => void;
    onHoverVisit: (id: string | null) => void;
    onEditAccommodation?: (id: string) => void;
    onMapClick?: (latlng: L.LatLng) => void;
  };
}
```

Update `src/App.tsx` — the single caller — to pass these groups. This is mechanical but spans both files.

- [ ] **Step 8: Pipeline.**

```bash
npm run lint && npm run test && npm run build
```

Expected: PASS.

- [ ] **Step 9: Commit.**

```bash
git add -u
git commit -m "perf(map): icon LRU cache, debounce clustering and route geometry

Adds aria-description to polylines, standardizes flyTo duration,
makes MapControlsPanel responsive, groups TripMap props into
data/selection/mode/callbacks objects."
```

---

## Task 17 — Landing, error boundary, date picker polish

**Files:**

- Modify: `src/components/WelcomeScreen.tsx`
- Modify: `src/components/ChronosErrorBoundary.tsx`
- Modify: `src/components/InlineDateRangePicker.tsx`

- [ ] **Step 1: `WelcomeScreen` cleanup.**

- Wrap hero heading in `<h1>`.
- Wrap decorative timeline in a `<div aria-hidden="true" role="presentation" className="hidden md:block">`.
- Hoist `stayPreviews` and `transitChips` arrays outside the component function.
- Remove inline `color-mix(...)` styles — use `bg-[color:var(--primary-100)]` Tailwind arbitrary-value classes.
- Primary CTA stays filled; demo + import buttons switch to `variant="outline"`.
- Gate `active:scale-95` via `useReducedMotion`.

- [ ] **Step 2: `ChronosErrorBoundary` hardening.**

- Add `role="alert"` + `aria-live="assertive"` to the fallback wrapper.
- In `componentDidCatch`, import and call `telemetry.captureException(error, { componentStack: info.componentStack })`:

```tsx
import { captureException } from '@/services/telemetry';
// ...
componentDidCatch(error: Error, info: ErrorInfo) {
  captureException(error, { componentStack: info.componentStack });
}
```

(Check `src/services/telemetry.ts` for the actual export name — adapt to it.)

- Cap error message length: `const safeMessage = String(this.state.error?.message ?? '').slice(0, 400);` then render `{safeMessage}`.

- Focus the "Try again" button on mount:

```tsx
componentDidMount() {
  this.retryBtnRef.current?.focus();
}
```

- [ ] **Step 3: `InlineDateRangePicker`.**

- Memoize parsed dates:

```tsx
const from = React.useMemo(() => {
  if (!startDate) return undefined;
  const d = fnsParse(startDate, 'yyyy-MM-dd', new Date());
  return isValid(d) ? d : undefined;
}, [startDate]);
```

Same pattern for `to`.

- Add `aria-label` to the summary span:

```tsx
<span aria-label={`Date range: ${summary}`} className="text-xs font-num">
  {summary}
</span>
```

- [ ] **Step 4: Pipeline.**

```bash
npm run lint && npm run test && npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add -u
git commit -m "feat(polish): Welcome/ErrorBoundary/DatePicker a11y and hardening"
```

---

## Task 18 — Panel skeletons + accommodation `font-num`

**Files:**

- Modify: `src/components/panels/StayOverviewPanel.tsx`

- [ ] **Step 1: Skeleton for hero image.**

Wrap the Unsplash hero `<img>` area with a `<Skeleton className="aspect-[3/1] w-full">` while the photo URL is loading:

```tsx
{
  photoUrl ? (
    <img src={photoUrl} alt={stay.name} className="..." />
  ) : (
    <Skeleton className="aspect-[3/1] w-full" />
  );
}
```

- [ ] **Step 2: Skeleton for stat tiles.**

Stats load instantly (local state) so skeletons aren't needed here — skip. Only the hero image warrants it.

- [ ] **Step 3: Accommodation night counts get `font-num`.**

Find the `{nights} nights` / `Night {i}` renders. Wrap numeric parts in `<span className="font-num">{count}</span>`.

- [ ] **Step 4: Pipeline + commit.**

```bash
npm run lint && npm run test && npm run build
git add -u
git commit -m "feat(panels): skeleton loader on stay hero, font-num on accommodations"
```

---

## Task 19 — LocationPicker a11y

**Files:**

- Modify: `src/components/ui/LocationPicker.tsx`

- [ ] **Step 1: Pick-on-map button a11y.**

- Wrap in a `<button>` with `aria-label="Pick location on map"` if not already.
- Add Enter/Space key handler if the element is not already a real `<button>`.
- When a pin drops, render an `aria-live="polite"` region:

```tsx
<span className="sr-only" aria-live="polite">
  {picked ? `Location set at ${picked.lat.toFixed(4)}, ${picked.lng.toFixed(4)}.` : ''}
</span>
```

- [ ] **Step 2: Pipeline + commit.**

```bash
npm run lint && npm run test && npm run build
git add -u
git commit -m "a11y(ui): LocationPicker keyboard and live-region support"
```

---

## Task 20 — Final verification pass

- [ ] **Step 1: Format + lint + test + build.**

```bash
npm run format:check
npm run lint
npm run test
npm run build
```

Expected: all green. If `format:check` fails, run `npm run format` and commit as `style: prettier pass`.

- [ ] **Step 2: Grep sanity.**

```bash
grep -rn "window.alert\|bg-red-500\|bg-destructive/10" src/ --include="*.tsx" --include="*.ts"
```

Expected: zero matches outside `ErrorMessage.tsx`.

- [ ] **Step 3: Line-count regression check.**

```bash
wc -l src/components/modals/VisitFormModal.tsx
```

Expected: ≤ 320.

- [ ] **Step 4: Manual visual QA on dev server.**

Restart the docker container (`docker compose restart`) and walk every flow from the spec (welcome → create trip → add stay → add visit → open map → open calendar → open AI planner → destructive actions on each panel).

For each:

- Toast undo works where expected (history, trip switch).
- AlertDialog appears for delete/revoke/sign-out.
- No orange left (regression guard from prior PR).
- Focus rings teal, mono numerals, Geist Mono where expected.
- `Kbd` chips render identically.
- Error messages render via `ErrorMessage`.
- Keyboard-only test: tab through a modal, every control focusable; aria-live regions fire on search.

- [ ] **Step 5: Update docs.**

Edit `docs/PRD.md` — add a short "UX conventions" paragraph:

```markdown
## UX conventions

- **Button ordering:** destructive far-left, Cancel and primary CTA right.
- **Destructive actions:** reversible ones (history navigation, trip switch) show a toast with Undo (5s); permanent ones (delete, revoke, sign out) gate with an AlertDialog that names the impact.
- **Errors:** surfaced via the shared `<ErrorMessage>` primitive with `tone="destructive|warning|info"`.
- **Motion:** respects `prefers-reduced-motion` globally and via the `useReducedMotion()` hook on JS-driven animations.
```

Edit `CLAUDE.md` — add a "Component conventions" bullet under "Key Conventions":

```markdown
- **Component conventions:** Every modal uses `ModalBase` with `footer={{ destructive, cancel, primary }}`. Inline errors use `<ErrorMessage>`. Destructive actions use `AlertDialog` (permanent) or sonner toast with Undo (reversible). Every `Input`/`Textarea` has a `<label htmlFor>` pair (visible or `sr-only`). Touch targets ≥ 44px. Animations gated on `useReducedMotion()` when JS-driven.
```

- [ ] **Step 6: Final commit + push decision.**

```bash
git add -u
git commit -m "docs: document UX conventions from polish PR"
```

Stop here. Report summary to the user; push only when asked.

---

## Out of scope / non-actions

- Do not push the branch or open the PR without explicit user approval.
- Do not touch dark-mode component styling — still deferred.
- Do not refactor anything outside the grouped `TripMap` prop surface (spec rule).
- Do not add Storybook.
- Do not migrate additional stay colors or touch trip data.
- Do not expand test coverage beyond the new primitives' tests — existing tests must remain green.
