# PRD — CHRONOS Itinerary Planner

> **Living document.** Update this file whenever a new feature is added or changed.

---

## TL;DR

CHRONOS is a browser-based trip planner with three linked views: a **Gantt timeline** of destinations, a **kanban activity board** per destination, and a **Leaflet map**. Trips are stored locally (localStorage) and optionally synced to Firebase. AI generation via Gemini (user API key). Single-user, desktop-first.

**Stack:** React 18 + TypeScript, Tailwind v4, @dnd-kit, react-leaflet, react-day-picker + date-fns, Firebase Auth + Realtime DB, Gemini REST API.

---

## Features

### Timeline
Horizontal scrollable Gantt (CSS Grid layout). Each **Stay** = colored block spanning days. Draggable, resizable from both ends. Overlap detection (visual warning only). Zoom slider. 3 slots/day (morning · afternoon · evening). **Blocked buffer days** shown before/after the trip range with diagonal stripe pattern — clicking them extends the trip by one day in that direction.

### Stays
City-level destinations. Create via geocoded search (Nominatim) + day-count stepper. Edit name, color, default lodging. Delete with confirmation. Between stays: a **route chip** shows transport mode (train/flight/drive/ferry/bus/walk), duration, notes.

### Activities (Visits)
Each stay has a kanban board: one column per day, three buckets (morning/afternoon/evening). Cards show name, type badge, area, notes. Draggable between slots and to/from the **unplanned inbox** (left sidebar). Types: `landmark` · `museum` · `food` · `walk` · `shopping` (`area` / `hotel` kept for legacy data only).

Each visit supports:
- **Checklist** — to-do items with done/undone toggle. Progress badge shown on card.
- **Links** — external URLs with optional label. Link count badge shown on card.

### Accommodations
Per-night hotel records (`NightAccommodation`) separate from the stay's default lodging. Geocoded, with cost/notes/link fields. Consecutive nights at the same hotel are collapsed into a grouped chip in the day column header. Night range is editable (select which nights within the stay the accommodation applies to). Removal correctly clears the `lodging` fallback field.

### Stay Overview Panel
Clicking a stay in the timeline opens its **Overview** tab in the left sidebar (desktop) or bottom drawer (mobile):
- **Hero image** — destination photo (Unsplash) with color dot + name + date range overlay
- **Stats grid** — days / nights / places count
- **Sleeping** — accommodation group summary
- **Notes** — freeform textarea, auto-saved on blur
- **Links** — external URLs with optional labels
- **To-Do** — collapsible checklist for the whole stay (e.g. "Book Shinkansen pass")

### Map
Two modes:
- **Overview** — all stays as labeled markers, connected by route lines with transport icons.
- **Detail** — visits for the selected stay, colored by type, optional clustering, accommodation pins, route arrows between visits.

Day-filter pills narrow markers to a single day. Basemap toggle (CartoDB / ArcGIS English). Panel is resizable and collapsible.

### AI Planner
Gemini REST API (user-supplied key). Two modes: **From Scratch** (full trip generation) or **Refine Existing** (fills gaps around current stays). Output previewed before applying. Undo available immediately after apply.

### Auth & Cloud Sync
Firebase Auth (email/password + Google OAuth). On login, local and cloud trips are compared by ID. If both have unique trips → **MergeDialog** (Merge / Keep Local / Use Cloud / Decide Later). Auto-save debounced 2s after any change. Demo mode bypasses save.

### Import / Export
JSON (native `HybridTrip` format) and Markdown (human-readable, grouped by day). Import validates with Zod. Access via profile menu.

### Multi-Trip & Welcome Screen
Trip switcher modal. Shown when no trips exist: "Plan a trip" → new empty trip, "See a demo" → loads Japan sample without persisting. Deleting the last trip returns to welcome screen.

### Date Range Editing
Trip dates edited via an inline calendar (react-day-picker v9). When shortening the trip:
- Stays partially outside the new range are **clamped** (shortened to fit). Visits on removed days become unplanned.
- Stays fully outside the new range are **removed** with a confirmation dialog listing affected destinations.
- Handles both start-date shifts (moving start forward) and end-date shrinks.

### Undo / Redo
50-step in-memory history. Cmd/Ctrl+Z · Cmd/Ctrl+Y. Toolbar buttons. History browser modal shows snapshot diffs.

---

## Data Model

```
TripStore       { trips: HybridTrip[], activeTripId: string }

HybridTrip      { id, name, startDate: "YYYY-MM-DD", totalDays, stays: Stay[] }

Stay            { id, name, color, startSlot, endSlot,
                  centerLat, centerLng, lodging,
                  nightAccommodations?: Record<dayOffset, NightAccommodation>,
                  travelModeToNext, travelDurationToNext?, travelNotesToNext?,
                  notes?: string,
                  links?: VisitLink[],
                  checklist?: ChecklistItem[],
                  visits: VisitItem[] }

NightAccommodation  { name, lat?, lng?, cost?, notes?, link? }

VisitItem       { id, name, type: VisitType, area, lat, lng,
                  dayOffset: number|null,   // null = unscheduled inbox
                  dayPart: DayPart|null,
                  order, durationHint?, notes?,
                  checklist?: ChecklistItem[],
                  links?: VisitLink[] }

ChecklistItem   { id, text, done: boolean }
VisitLink       { url, label?: string }
```

**Slot arithmetic:** 1 day = 3 slots. `startSlot = dayIndex * 3`. Stay night count = `ceil((endSlot - startSlot) / 3)`.

**Persistence keys** (checked in order on load): `itinerary-trips-v1` → `itinerary-hybrid-trips-v2` → `itinerary-hybrid-v3`. Cloud: `users/{uid}/tripStore`.

---

## Feature Status

| Feature | Status | Notes |
|---|---|---|
| Gantt timeline | ✅ | Drag, resize, zoom, overlap detection, blocked buffer days, extend trip |
| Date range shrink/shift | ✅ | Clamping, removal confirmation, visit unscheduling |
| Stay CRUD | ✅ | Geocoding, color, route chips |
| Activity kanban + inbox | ✅ | DnD, search, type grid |
| Accommodation per-night | ✅ | Geocoding, cost, grouping, night-range editing |
| Stay overview panel | ✅ | Hero, stats, notes, links, accommodation summary, to-do |
| Visit checklist + links | ✅ | Per-visit to-do items and external links |
| Stay notes + links + todo | ✅ | Freeform notes, external links, collapsible checklist |
| Map — overview | ✅ | Stay markers + route lines |
| Map — detail | ✅ | Visit/accommodation markers, clustering, arrows |
| Map resize + day filter | ✅ | Collapsed/expanded/mini state persisted across refresh |
| AI planner (Gemini) | ✅ | From scratch + refine |
| Firebase Auth + cloud sync | ✅ | Email + Google OAuth, merge dialog |
| JSON + Markdown export | ✅ | |
| JSON import | ✅ | Zod validation |
| Undo/redo + history browser | ✅ | 50-step, keyboard shortcuts |
| Multi-trip + welcome screen | ✅ | Demo mode |
| Mobile layout | ✅ | Adaptive layout: map hidden <768px, sidebar → bottom drawer FAB (with swipe-to-dismiss), snap-scroll day columns (85vw) with correct scroll-padding-left, footer hidden, touch DnD (long-press), responsive header; safe-area insets on FAB + drawer; conflict/demo banners visible on all sizes |
| Passcode sharing | ⚠️ | Firebase functions exist; not exposed in UI |
| Cost/budget dashboard | ❌ | `cost` field exists, no aggregate display |
| Markdown import | ❌ | |
| Trip duplication | ❌ | |

---

## Known Limitations

- **Overlap is visual-only** — overlapping stays persist without error.
- **Slot granularity is morning/afternoon/evening only** — no clock times.
- **Deleting a stay deletes all its visits** — no "move to another stay" option.
- **AI coords are Gemini-generated** — not verified against a map DB; can be inaccurate.
- **AI refine mode doesn't see existing visits** — may generate duplicates.
- **Merge is all-or-nothing** — same trip edited on two devices: last write wins.
- **No sync indicator** — no "saving…" / "saved" / "offline" status visible.
- **History is in-memory** — page reload resets the undo stack.
- **`src/App.tsx` is still large** (~4800 lines). Domain logic has been extracted to `src/domain/` (10 modules, 36 tests). Service layer, hooks, and UI component extraction are planned (Phases 2-4).
- **Legacy app removed** — the old Mantine-based UI has been fully deleted. Only the CHRONOS app remains.
- **Dark mode not implemented** — light mode only for now.
