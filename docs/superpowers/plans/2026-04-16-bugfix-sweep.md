# Bugfix & Edge Case Sweep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all runtime bugs, UX edge cases, accessibility gaps, and validation issues identified in the full codebase audit.

**Architecture:** Fixes are organized by file/subsystem. Each task is self-contained — a focused fix to one or two files. No new abstractions; all changes are surgical edits to existing components and hooks.

**Tech Stack:** React 18, TypeScript, Tailwind v4, shadcn/ui, dnd-kit, Vitest + Testing Library

---

## File Map

| Task | Files Modified                                       | What Changes                                            |
| ---- | ---------------------------------------------------- | ------------------------------------------------------- |
| 1    | `src/hooks/usePlaceSearch.ts`                        | Fix loading state stuck on abort                        |
| 2    | `src/hooks/useCloudSync.ts`                          | Fix stale closure in auto-save setTimeout               |
| 3    | `src/hooks/useRouteGeometry.ts`                      | Fix state update after unmount                          |
| 4    | `src/App.tsx`                                        | Fix fire-and-forget async photo fetches                 |
| 5    | `src/services/sync/firebase.ts`                      | Safe error handling in onValue callback                 |
| 6    | `src/components/panels/StayOverviewPanel.tsx`        | Accessibility: hover-only buttons, checklist max-height |
| 7    | `src/components/panels/VisitDetailDrawer.tsx`        | Accessibility: hover-only checklist delete buttons      |
| 8    | `src/components/panels/TripSwitcherPanel.tsx`        | Empty state, trip name truncation                       |
| 9    | `src/components/panels/HistoryPanel.tsx`             | Empty state message                                     |
| 10   | `src/components/timeline/DroppablePeriodSlot.tsx`    | Better drop target feedback                             |
| 11   | `src/components/cards/DraggableInventoryCard.tsx`    | Visual drag handle indicator                            |
| 12   | `src/components/modals/AccommodationEditorModal.tsx` | Cost validation, night picker scroll                    |
| 13   | `src/components/modals/AddStayModal.tsx`             | Loading timeout feedback                                |
| 14   | `src/components/modals/AIPlannerModal.tsx`           | Generation timeout feedback                             |
| 15   | `src/components/modals/VisitFormModal.tsx`           | Duplicate checklist feedback                            |
| 16   | `src/components/modals/RouteEditorModal.tsx`         | Duration format hint                                    |

---

### Task 1: Fix loading state stuck on abort in usePlaceSearch

**Files:**

- Modify: `src/hooks/usePlaceSearch.ts:40-43`

The `finally` block skips `setLoading(false)` when the request is aborted, leaving UI in permanent loading state.

- [ ] **Step 1: Fix the finally block**

In `src/hooks/usePlaceSearch.ts`, change the finally block to always clear loading:

```typescript
// Before (line 40-43):
finally {
  if (!controller.signal.aborted) {
    setLoading(false);
  }
}

// After:
finally {
  setLoading(false);
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/hooks/usePlaceSearch.ts
git commit -m "fix: always clear loading state in usePlaceSearch even on abort"
```

---

### Task 2: Fix stale closure in useCloudSync auto-save

**Files:**

- Modify: `src/hooks/useCloudSync.ts:220-240`

The setTimeout callback at line 220 captures `store.trips` from the effect closure. By the time it fires (2s later), the store may have changed. Line 240 writes stale refs.

- [ ] **Step 1: Use storeRef inside the timeout callback**

In `src/hooks/useCloudSync.ts`, change line 240 to read from `storeRef.current` instead of the stale `store.trips`:

```typescript
// Before (line 240):
store.trips.forEach((t) => {
  lastPushedRef.current[t.id] = t;
});

// After:
storeRef.current.trips.forEach((t) => {
  lastPushedRef.current[t.id] = t;
});
```

- [ ] **Step 2: Run existing cloud sync tests**

Run: `npx vitest run src/hooks/__tests__/useCloudSync.test.ts`
Expected: All tests pass

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useCloudSync.ts
git commit -m "fix: use storeRef in auto-save callback to avoid stale closure"
```

---

### Task 3: Fix state update after unmount in useRouteGeometry

**Files:**

- Modify: `src/hooks/useRouteGeometry.ts:46-48`

After `await fetchRouteGeometry(...)`, the `cancelled` check passes but `setRouteShapes` still fires on unmounted component if timing is unlucky.

- [ ] **Step 1: Move cancelled check before state mutation**

In `src/hooks/useRouteGeometry.ts`, ensure the check gates the state update:

```typescript
// Before (lines 46-48):
if (cancelled || !geometry) continue;
routeShapesRef.current = { ...routeShapesRef.current, [segment.key]: geometry };
setRouteShapes(routeShapesRef.current);

// After:
if (cancelled || !geometry) continue;
const updated = { ...routeShapesRef.current, [segment.key]: geometry };
routeShapesRef.current = updated;
if (!cancelled) setRouteShapes(updated);
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useRouteGeometry.ts
git commit -m "fix: guard setRouteShapes against unmount race in useRouteGeometry"
```

---

### Task 4: Fix fire-and-forget async photo fetches in App.tsx

**Files:**

- Modify: `src/App.tsx:173-186` and `src/App.tsx:511-527`

Both effects use `forEach(async ...)` which launches untracked promises. If component unmounts mid-fetch, the `updateTripRef` callback fires on stale state.

- [ ] **Step 1: Add cancellation to stay photo fetch (lines 173-186)**

```typescript
// Before:
useEffect(() => {
  if (!import.meta.env.VITE_UNSPLASH_ACCESS_KEY) return;
  const staysNeedingImages = trip.stays.filter((s) => !s.imageUrl);
  if (staysNeedingImages.length === 0) return;
  staysNeedingImages.forEach(async (stay) => {
    const url = await searchPhoto(`${stay.name} city travel`);
    if (url)
      updateTripRef.current((t) => ({
        ...t,
        stays: t.stays.map((s) => (s.id === stay.id ? { ...s, imageUrl: url } : s)),
      }));
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [trip.stays.map((s) => `${s.id}:${s.imageUrl ?? ''}`).join('|')]);

// After:
useEffect(() => {
  if (!import.meta.env.VITE_UNSPLASH_ACCESS_KEY) return;
  const staysNeedingImages = trip.stays.filter((s) => !s.imageUrl);
  if (staysNeedingImages.length === 0) return;
  let cancelled = false;
  staysNeedingImages.forEach(async (stay) => {
    try {
      const url = await searchPhoto(`${stay.name} city travel`);
      if (url && !cancelled)
        updateTripRef.current((t) => ({
          ...t,
          stays: t.stays.map((s) => (s.id === stay.id ? { ...s, imageUrl: url } : s)),
        }));
    } catch {
      /* search failed — skip silently */
    }
  });
  return () => {
    cancelled = true;
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [trip.stays.map((s) => `${s.id}:${s.imageUrl ?? ''}`).join('|')]);
```

- [ ] **Step 2: Add cancellation to visit photo fetch (lines 511-527)**

```typescript
// Before:
useEffect(() => {
  if (!import.meta.env.VITE_UNSPLASH_ACCESS_KEY || !selectedStay) return;
  const visitsNeedingImages = trip.visits.filter(
    (v) => v.stayId === selectedStay.id && !v.imageUrl,
  );
  if (visitsNeedingImages.length === 0) return;
  visitsNeedingImages.forEach(async (visit) => {
    const url = await searchPhoto(visit.name);
    if (url)
      updateTripRef.current((t) => ({
        ...t,
        visits: t.visits.map((v) => (v.id === visit.id ? { ...v, imageUrl: url } : v)),
      }));
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [selectedStay?.id, trip.visits]);

// After:
useEffect(() => {
  if (!import.meta.env.VITE_UNSPLASH_ACCESS_KEY || !selectedStay) return;
  const visitsNeedingImages = trip.visits.filter(
    (v) => v.stayId === selectedStay.id && !v.imageUrl,
  );
  if (visitsNeedingImages.length === 0) return;
  let cancelled = false;
  visitsNeedingImages.forEach(async (visit) => {
    try {
      const url = await searchPhoto(visit.name);
      if (url && !cancelled)
        updateTripRef.current((t) => ({
          ...t,
          visits: t.visits.map((v) => (v.id === visit.id ? { ...v, imageUrl: url } : v)),
        }));
    } catch {
      /* search failed — skip silently */
    }
  });
  return () => {
    cancelled = true;
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [selectedStay?.id, trip.visits]);
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "fix: add cancellation to async photo fetch effects"
```

---

### Task 5: Safe error handling in firebase.ts onValue callback

**Files:**

- Modify: `src/services/sync/firebase.ts:147,159`

The error callback passes `error.message` without checking if `error` is an Error object.

- [ ] **Step 1: Guard error.message access**

In `src/services/sync/firebase.ts`, update both onValue error callbacks:

```typescript
// Before (line 147):
(error) => callbacks.onError(error.message),

// After:
(error) => callbacks.onError(error instanceof Error ? error.message : 'Sync listener failed'),
```

```typescript
// Before (line 159):
(error) => callbacks.onError(error.message),

// After:
(error) => callbacks.onError(error instanceof Error ? error.message : 'Sync listener failed'),
```

- [ ] **Step 2: Run firebase sync tests**

Run: `npx vitest run src/services/sync/__tests__/firebaseSyncService.test.ts`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add src/services/sync/firebase.ts
git commit -m "fix: safe error handling in firebase onValue callbacks"
```

---

### Task 6: Fix accessibility and overflow in StayOverviewPanel

**Files:**

- Modify: `src/components/panels/StayOverviewPanel.tsx`

Two issues:

1. Delete buttons (links section line ~107, checklist section line ~167) are `opacity-0 group-hover:opacity-100` — invisible to keyboard users and touch devices.
2. Checklist section (line ~158) has no max-height — 50 items breaks the panel.

- [ ] **Step 1: Make delete buttons accessible (always visible when focused, visible on touch)**

Replace the hover-only pattern with focus-visible support. In the links delete button (~line 107):

```typescript
// Before:
className =
  'opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive';

// After:
className =
  'opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive sm:max-md:opacity-100';
```

Apply the same change to the checklist delete button (~line 167):

```typescript
// Before:
className =
  'opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive';

// After:
className =
  'opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive sm:max-md:opacity-100';
```

- [ ] **Step 2: Add max-height with scroll to checklist section**

In the `StayTodoSection` component, wrap the checklist items in a scrollable container. Change line ~158:

```typescript
// Before:
{open && (
  <div className="px-4 pb-3 space-y-1.5">
    {checklist.map((item) => (

// After:
{open && (
  <div className="px-4 pb-3 space-y-1.5">
    <div className="max-h-48 overflow-y-auto space-y-1.5">
    {checklist.map((item) => (
```

And close the new div after the checklist items map, before the add input:

```typescript
// After the checklist.map closing ))}:
    </div>
    <div className="flex items-center gap-1.5 mt-1">
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/components/panels/StayOverviewPanel.tsx
git commit -m "fix: make delete buttons keyboard/touch accessible, cap checklist scroll height"
```

---

### Task 7: Fix accessibility in VisitDetailDrawer checklist

**Files:**

- Modify: `src/components/panels/VisitDetailDrawer.tsx:181`

Same hover-only delete button pattern.

- [ ] **Step 1: Make delete button keyboard/touch accessible**

```typescript
// Before (line 181):
className =
  'opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive';

// After:
className =
  'opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive sm:max-md:opacity-100';
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/components/panels/VisitDetailDrawer.tsx
git commit -m "fix: make checklist delete button accessible in VisitDetailDrawer"
```

---

### Task 8: Empty state and truncation in TripSwitcherPanel

**Files:**

- Modify: `src/components/panels/TripSwitcherPanel.tsx`

Two issues:

1. No message when trip list is empty (unlikely but possible after deleting all trips).
2. Long trip names overflow without truncation.

- [ ] **Step 1: Add empty state and truncation**

In `TripSwitcherPanel.tsx`, add an empty state and truncate class:

```typescript
// Before (line 20-46):
<div className="space-y-2 mb-4">
  {store.trips.map((t) => (
    // ...
    <div>
      <p className="text-sm font-bold text-foreground">{t.name}</p>

// After:
<div className="space-y-2 mb-4">
  {store.trips.length === 0 && (
    <p className="text-sm text-muted-foreground text-center py-6">
      No trips yet. Create your first one below!
    </p>
  )}
  {store.trips.map((t) => (
    // ...
    <div className="min-w-0">
      <p className="text-sm font-bold text-foreground truncate">{t.name}</p>
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/components/panels/TripSwitcherPanel.tsx
git commit -m "fix: add empty state and name truncation to TripSwitcherPanel"
```

---

### Task 9: Empty state in HistoryPanel

**Files:**

- Modify: `src/components/panels/HistoryPanel.tsx`

No message when history has only the initial snapshot (length <= 1).

- [ ] **Step 1: Add empty state**

In `HistoryPanel.tsx`, add a message before the history list:

```typescript
// Before (line 20):
<div className="space-y-0.5 max-h-[min(24rem,calc(100vh-12rem))] overflow-y-auto -mx-1 px-1">

// After:
{history.length <= 1 ? (
  <p className="text-sm text-muted-foreground text-center py-8">
    No changes yet. Edits will appear here as you build your trip.
  </p>
) : (
<div className="space-y-0.5 max-h-[min(24rem,calc(100vh-12rem))] overflow-y-auto -mx-1 px-1">
```

And close the ternary after the existing closing `</div>`:

```typescript
// After the existing </div> that closes the history list:
</div>
)}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/components/panels/HistoryPanel.tsx
git commit -m "fix: add empty state message to HistoryPanel"
```

---

### Task 10: Better drop target feedback in DroppablePeriodSlot

**Files:**

- Modify: `src/components/timeline/DroppablePeriodSlot.tsx`

Drop zone only shows subtle background change. Add a text hint when dragging over.

- [ ] **Step 1: Add "Drop here" text when dragging over empty slot**

In `DroppablePeriodSlot.tsx`, enhance the button area. Change the existing button (line ~37-41):

```typescript
// Before:
<Button
  variant="outline"
  onClick={() => onAddVisit(dayOffset, period)}
  className="w-full h-10 border-2 border-dashed border-border text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 gap-1.5 group"
>
  <PlusCircle className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
  <span className="text-[11px] font-bold uppercase tracking-tight">Drop or add</span>
</Button>

// After:
<Button
  variant="outline"
  onClick={() => onAddVisit(dayOffset, period)}
  className={`w-full h-10 border-2 border-dashed gap-1.5 group transition-all ${
    isOver
      ? 'border-primary bg-primary/10 text-primary scale-[1.02]'
      : 'border-border text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5'
  }`}
>
  <PlusCircle className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
  <span className="text-[11px] font-bold uppercase tracking-tight">
    {isOver ? 'Drop here' : 'Drop or add'}
  </span>
</Button>
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/components/timeline/DroppablePeriodSlot.tsx
git commit -m "fix: enhance drop target feedback with text and stronger visual cue"
```

---

### Task 11: Visual drag handle in DraggableInventoryCard

**Files:**

- Modify: `src/components/cards/DraggableInventoryCard.tsx`

The grip icon exists but is very faint (`text-muted-foreground/40`). Make it more visible.

- [ ] **Step 1: Increase grip visibility**

In `DraggableInventoryCard.tsx`, change the grip icon styling (line ~45):

```typescript
// Before:
<div className="p-2.5 text-muted-foreground/40" aria-hidden="true">
  <GripVertical className="w-4 h-4" />
</div>

// After:
<div className="p-2.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" aria-hidden="true">
  <GripVertical className="w-4 h-4" />
</div>
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/components/cards/DraggableInventoryCard.tsx
git commit -m "fix: increase drag handle visibility on hover"
```

---

### Task 12: Cost validation and night picker scroll in AccommodationEditorModal

**Files:**

- Modify: `src/components/modals/AccommodationEditorModal.tsx`

Two issues:

1. Cost field accepts negative values and NaN silently (lines 213-221, 92).
2. Night picker for long stays overflows without scroll (lines 225-250).

- [ ] **Step 1: Add cost validation**

In `AccommodationEditorModal.tsx`, update the cost onChange handler (line 220):

```typescript
// Before:
onChange={(e) => setCost(e.target.value)}

// After:
onChange={(e) => {
  const val = e.target.value;
  if (val === '' || (/^\d*\.?\d{0,2}$/.test(val) && Number(val) >= 0)) {
    setCost(val);
  }
}}
```

- [ ] **Step 2: Add scroll to night picker**

In `AccommodationEditorModal.tsx`, add max-height to the night list container (line 230):

```typescript
// Before:
<div className="border border-border rounded-lg overflow-hidden">

// After:
<div className="border border-border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/components/modals/AccommodationEditorModal.tsx
git commit -m "fix: validate cost input and add scroll to night picker"
```

---

### Task 13: Loading timeout feedback in AddStayModal

**Files:**

- Modify: `src/components/modals/AddStayModal.tsx`

If Nominatim API hangs, user sees infinite spinner with no timeout message.

- [ ] **Step 1: Add a search timeout indicator**

In `AddStayModal.tsx`, add a `searchStale` state to show feedback after 8 seconds. Add after line 26:

```typescript
const [searchStale, setSearchStale] = useState(false);
```

In the useEffect (line 28-52), add a stale timer inside the timeout callback:

```typescript
// After (line 35-46), replace with:
const tid = window.setTimeout(async () => {
  setIsSearching(true);
  setSearchError(false);
  setSearchStale(false);
  const staleTimer = window.setTimeout(() => setSearchStale(true), 8000);
  try {
    const results = await searchPlace(name.trim(), { signal: controller.signal });
    setSearchResults(results.slice(0, 6));
    setShowResults(true);
  } catch {
    if (!controller.signal.aborted) setSearchError(true);
  } finally {
    clearTimeout(staleTimer);
    if (!controller.signal.aborted) {
      setIsSearching(false);
      setSearchStale(false);
    }
  }
}, 500);
```

Update the cleanup to also reset stale:

```typescript
return () => {
  clearTimeout(tid);
  controller.abort();
  setSearchStale(false);
};
```

Add a stale message after the search error display (after line 121):

```typescript
{isSearching && searchStale && (
  <p className="text-[11px] text-muted-foreground font-medium mt-1">
    Search is taking longer than expected…
  </p>
)}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/components/modals/AddStayModal.tsx
git commit -m "fix: show timeout feedback when place search is slow"
```

---

### Task 14: Generation timeout feedback in AIPlannerModal

**Files:**

- Modify: `src/components/modals/AIPlannerModal.tsx`

AI generation can hang with no timeout indication.

- [ ] **Step 1: Add a slow-generation message**

In `AIPlannerModal.tsx`, add state after line 42:

```typescript
const [loadingSlow, setLoadingSlow] = useState(false);
```

In `handleGenerate` (line 44-173), add a timer after `setLoading(true)`:

```typescript
// After setLoading(true) (line 51):
setLoadingSlow(false);
const slowTimer = window.setTimeout(() => setLoadingSlow(true), 15000);
```

And clear it in the finally block:

```typescript
// In finally (line 170-172):
finally {
  clearTimeout(slowTimer);
  setLoading(false);
  setLoadingSlow(false);
}
```

Display the message in the loading animation area (after line 264):

```typescript
// After the existing "Generating your itinerary…" text:
{loadingSlow && (
  <p className="text-[11px] text-warning font-medium">
    This is taking longer than usual — hang tight…
  </p>
)}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/components/modals/AIPlannerModal.tsx
git commit -m "fix: show feedback when AI generation is slow"
```

---

### Task 15: Duplicate checklist feedback in VisitFormModal

**Files:**

- Modify: `src/components/modals/VisitFormModal.tsx`

Adding a duplicate checklist item is silently rejected (line 87). User gets no feedback.

- [ ] **Step 1: Add visual feedback for duplicates**

In `VisitFormModal.tsx`, add a state after line 83:

```typescript
const [checklistDupe, setChecklistDupe] = useState(false);
```

Update `addChecklistItem` (lines 84-90):

```typescript
const addChecklistItem = () => {
  const text = newChecklistText.trim();
  if (!text) return;
  if (checklist.some((c) => c.text.toLowerCase() === text.toLowerCase())) {
    setChecklistDupe(true);
    return;
  }
  setChecklistDupe(false);
  setChecklist((c) => [...c, { id: `cl-${Date.now()}`, text, done: false }]);
  setNewChecklistText('');
};
```

Clear dupe state when input changes. Update the input onChange (line 319):

```typescript
// Before:
onChange={(e) => setNewChecklistText(e.target.value)}

// After:
onChange={(e) => { setNewChecklistText(e.target.value); setChecklistDupe(false); }}
```

Add a dupe message after the checklist input row (after line 335):

```typescript
{checklistDupe && (
  <p className="text-[11px] text-warning font-medium px-1">Item already in the list.</p>
)}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/components/modals/VisitFormModal.tsx
git commit -m "fix: show feedback when adding duplicate checklist item"
```

---

### Task 16: Duration format hint in RouteEditorModal

**Files:**

- Modify: `src/components/modals/RouteEditorModal.tsx`

Duration input accepts any text with no guidance beyond placeholder.

- [ ] **Step 1: Add hint text below input**

In `RouteEditorModal.tsx`, add a hint after the duration input (after line 99):

```typescript
<p className="text-[11px] text-muted-foreground mt-1">
  Free-form text — e.g. &ldquo;2h 30m&rdquo;, &ldquo;45 min&rdquo;, &ldquo;overnight&rdquo;
</p>
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/components/modals/RouteEditorModal.tsx
git commit -m "fix: add duration format hint in RouteEditorModal"
```

---

## Notes on Deferred Issues

These were identified in the audit but are **intentionally deferred** — they're either low-risk, would require larger refactors, or have mitigating factors:

| Issue                                                      | Why Deferred                                                                                                                                                                                                                        |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useCloudSync:209` reference equality for change detection | The pattern works correctly when trips are updated immutably (which they are via `setStore`). The `!==` check is actually correct — same reference = no change. Only a concern if trips are mutated in place, which doesn't happen. |
| `App.tsx:201` selectedStayId defaults to `''`              | Downstream code already uses optional chaining and the `selectedStay` variable (which is derived via `.find()`) handles this gracefully.                                                                                            |
| `stayLogic.ts:35` nightAccommodation caller assumptions    | Callers already check `hasNight` and `nightAccommodation` existence. The type annotation is for documentation.                                                                                                                      |
| `useCloudSync:186-191` remote echo                         | The `prev.activeTripId === id` check prevents unnecessary re-renders. Low impact.                                                                                                                                                   |
| Color picker accessibility                                 | `aria-pressed` attribute already provides screen reader support. Visual selection indicator (ring + scale) is sufficient for most users.                                                                                            |
| Trip sorting/search for large lists                        | Feature request, not a bug.                                                                                                                                                                                                         |
| Days stepper debounce                                      | `Math.max(1, d-1)` and `Math.min(90, d+1)` are instant — no performance concern.                                                                                                                                                    |
