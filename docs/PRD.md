# PRD — CHRONOS Itinerary Planner

> **Living document.** Update this file whenever a new feature is added or changed.

---

## TL;DR

CHRONOS is a browser-based trip planner with three linked views: a **Gantt timeline** of destinations, a **kanban activity board** per destination, and a **Leaflet map**. Trips are stored locally (localStorage) and optionally synced to Firebase. AI generation via Gemini (user API key). Single-user, desktop-first.

**Stack:** React 18 + TypeScript, Tailwind v4, @dnd-kit, react-leaflet, Firebase Auth + Realtime DB, Gemini REST API.

---

## Features

### Timeline
Horizontal scrollable Gantt. Each **Stay** = colored block spanning days. Draggable, resizable from both ends. Overlap detection (visual warning only). Zoom slider. 3 slots/day (morning · afternoon · evening).

### Stays
City-level destinations. Create via geocoded search (Nominatim) + day-count stepper. Edit name, color, default lodging. Delete with confirmation. Between stays: a **route chip** shows transport mode (train/flight/drive/ferry/bus/walk), duration, notes.

### Activities (Visits)
Each stay has a kanban board: one column per day, three buckets (morning/afternoon/evening). Cards show name, type badge, area, notes. Draggable between slots and to/from the **unplanned inbox** (left sidebar). Types: `landmark` · `museum` · `food` · `walk` · `shopping` (`area` / `hotel` kept for legacy data only).

### Accommodations
Per-night hotel records (`NightAccommodation`) separate from the stay's default lodging. Geocoded, with cost/notes/link fields. Consecutive nights at the same hotel are collapsed into a grouped chip in the day column header.

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
                  visits: VisitItem[] }

NightAccommodation  { name, lat?, lng?, cost?, notes?, link? }

VisitItem       { id, name, type: VisitType, area, lat, lng,
                  dayOffset: number|null,   // null = unscheduled inbox
                  dayPart: DayPart|null,
                  order, durationHint?, notes? }
```

**Slot arithmetic:** 1 day = 3 slots. `startSlot = dayIndex * 3`. Stay night count = `ceil((endSlot - startSlot) / 3)`.

**Persistence keys** (checked in order on load): `itinerary-trips-v1` → `itinerary-hybrid-trips-v2` → `itinerary-hybrid-v3`. Cloud: `users/{uid}/tripStore`.

---

## Feature Status

| Feature | Status | Notes |
|---|---|---|
| Gantt timeline | ✅ | Drag, resize, zoom, overlap detection |
| Stay CRUD | ✅ | Geocoding, color, route chips |
| Activity kanban + inbox | ✅ | DnD, search, type grid |
| Accommodation per-night | ✅ | Geocoding, cost, grouping |
| Map — overview | ✅ | Stay markers + route lines |
| Map — detail | ✅ | Visit/accommodation markers, clustering, arrows |
| Map resize + day filter | ✅ | |
| AI planner (Gemini) | ✅ | From scratch + refine |
| Firebase Auth + cloud sync | ✅ | Email + Google OAuth, merge dialog |
| JSON + Markdown export | ✅ | |
| JSON import | ✅ | Zod validation |
| Undo/redo + history browser | ✅ | 50-step, keyboard shortcuts |
| Multi-trip + welcome screen | ✅ | Demo mode |
| Mobile layout | ⚠️ | Sidebar hidden on small screens; search bar responsive; touch timeline drag supported |
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
- **`src/App.tsx` is a monolith** (~2500 lines, intentional for now).
- **Dark mode not implemented** — light mode only for now.
