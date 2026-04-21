# PRD — CHRONOS Itinerary Planner

> **Living document.** Update this file whenever a new feature is added or changed.

---

## TL;DR

CHRONOS is a browser-based trip planner with three linked views: a **Gantt timeline** of destinations, a **kanban activity board** per destination, and a **Leaflet map**. Trips are stored locally (localStorage) and optionally synced to Firebase. AI generation via Gemini (user API key). Single-user, desktop-first.

**Stack:** React 18 + TypeScript, Tailwind v4, shadcn/ui (nova preset), Inter + Geist Mono, @dnd-kit, react-leaflet, react-day-picker + date-fns, Firebase Auth + Realtime DB, Gemini REST API.

---

## Identity

Petrol Teal (`#0f766e`) primary, reserved for chrome (brand, CTA, active state, focus, kbd, links). Neutral warm-white canvas (`#fafaf9`), white card surfaces, soft teal-tinted shadows on lift. Inter for UI, Geist Mono for numerals/dates/coords/kbd. Stay palette: Jewel Tones (claret, rust, indigo, olive, plum, slate, ochre, moss) — explicitly avoids teal/cyan so content never collides with chrome.

---

## UX conventions

- **Button ordering:** destructive far-left, Cancel and primary CTA right.
- **Destructive actions:** reversible ones (history navigation, trip switch) show a toast with Undo (5s); permanent ones (delete, revoke, sign out) gate with an AlertDialog that names the impact.
- **Errors:** surfaced via the shared `<ErrorMessage>` primitive with `tone="destructive|warning|info"`.
- **Motion:** respects `prefers-reduced-motion` globally and via the `useReducedMotion()` hook on JS-driven animations.

---

## Features

### Timeline

Horizontal scrollable Gantt (CSS Grid layout). Each **Stay** = colored block spanning days. Draggable, resizable from both ends. Overlap detection (visual warning only). Zoom slider. 3 slots/day (morning · afternoon · evening). **Blocked buffer days** shown before/after the trip range with diagonal stripe pattern — clicking them extends the trip by one day in that direction.

### Stays

City-level destinations. Create via geocoded search (Nominatim) + day-count stepper. If Nominatim can't find a place, a **"Pick on map"** button expands an inline Leaflet map (click to drop a pin) with editable lat/lng inputs. Map opens pre-fitted to existing stays so the user sees where the new destination fits. Edit name, color, default lodging. Delete with confirmation. Between stays: a **route chip** shows transport mode (train/flight/drive/ferry/bus/walk), duration, notes.

### Activities (Visits)

Each stay has a kanban board: one column per day, three buckets (morning/afternoon/evening). Cards show name, type badge, area, notes. Draggable between slots and to/from the **unplanned inbox** (left sidebar). Types: `landmark` · `museum` · `food` · `walk` · `shopping` (`area` / `hotel` kept for legacy data only). When adding or editing a visit, a **"Pick on map"** button expands an inline Leaflet map centered on the parent destination (zoom 14) to pin the exact location manually — useful when Nominatim can't find the place.

**Global itinerary view:** When no stay is selected, the day columns area shows a read-only overview of ALL stays' days at once. Each stay is separated by a vertical color-coded header with the stay name. Clicking a stay name or any day column header navigates to the detailed per-stay view. The global view displays period slots (morning/afternoon/evening) with visit cards but is non-interactive (no DnD or adding visits).

Each visit supports:

- **Checklist** — to-do items with done/undone toggle. Progress badge shown on card.
- **Links** — external URLs with optional label. Link count badge shown on card.

### Accommodations

Per-night hotel records (`NightAccommodation`) separate from the stay's default lodging. Geocoded, with cost/notes/link fields. Consecutive nights at the same hotel are collapsed into a grouped chip in the day column header. Night range is editable (select which nights within the stay the accommodation applies to). Removal correctly clears the `lodging` fallback field.

### Sidebar layout

On desktop, the sidebar is a **two-pane split**: stay details (or visit detail) on top, Inbox (unscheduled destinations / visits) pinned below. Panes are separated by a resizable horizontal splitter with keyboard support (`↑` / `↓` to resize, `Enter` to collapse). Ratio and collapsed state persist in localStorage. Mobile keeps the existing bottom-drawer pattern.

### Stay Overview Panel

Clicking a stay in the timeline opens its **Overview** in the top pane of the left sidebar (desktop) or bottom drawer (mobile):

- **Hero image** — destination photo (Unsplash) with color dot + name + date range overlay
- **Stats grid** — days / nights / places count
- **Sleeping** — accommodation group summary
- **Notes** — freeform textarea, auto-saved on blur
- **Links** — external URLs with optional labels
- **To-Do** — collapsible checklist for the whole stay (e.g. "Book Shinkansen pass")

### Destination Inbox

In trip overview mode (no stay selected), the sidebar inbox holds **candidate destinations** — stays saved without timeline dates. Users can save candidates when adding a new destination ("Save to inbox" path in `AddStayModal`), promote them onto the timeline with dates via a "Pick from inbox" chip in the Add Destination modal, and demote any scheduled stay back to the inbox from the stay editor ("Move to inbox" button in `StayEditorModal`). Visits travel with their stay on promote/demote; visits that had `dayOffset` values become unscheduled on demote. Candidate stays render as ghost markers on the overview map to show where potential destinations are without cluttering the placed-stay layer.

### Map

Two modes:

- **Overview** — all stays as labeled markers, connected by route lines with transport icons.
- **Detail** — visits for the selected stay, colored by type, optional clustering, accommodation pins, route arrows between visits.

Day-filter pills narrow markers to a single day. 4-option basemap picker: Voyager (Carto, default), OSM Classic, Satellite (Esri), Minimal (Carto Positron). Panel is resizable and collapsible.

### AI Planner

Gemini REST API (user-supplied key). Two modes: **From Scratch** (full trip generation) or **Refine Existing** (fills gaps around current stays). Output previewed before applying. Undo available immediately after apply.

### Auth & Cloud Sync

Firebase Auth (email/password + Google OAuth). On login, local and cloud trips are compared by ID. If both have unique trips → **MergeDialog** (Merge / Keep Local / Use Cloud / Decide Later). Auto-save debounced 2s after any change. Demo mode bypasses save.

### Import / Export

JSON (native `HybridTrip` format) and Markdown (human-readable, grouped by day). Import validates with Zod. Access via profile menu.

### Share via Code

Trip creators can generate a short **share code** (format: `TRIP-XXXXXX`) to share out-of-band (text, email, etc.). Anyone can import a shared trip by entering the code—no login required. Creator can **push updates** to propagate changes to all importers, **toggle read-only/writable mode**, or **revoke** the share. Importers can **pull latest updates** with an option to save a copy before updating. One active share code per trip. Writable mode (future: auth-optional pushes) currently requires creator login to enable/disable.

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

## Data Model (v3)

```
TripStore       { trips: Trip[], activeTripId: string }

Trip (HybridTrip) { id, name, startDate: "YYYY-MM-DD", totalDays,
                    version: 3, createdAt, updatedAt,
                    stays: Stay[], candidateStays: Stay[],
                    visits: VisitItem[], routes: Route[],
                    shareCode?, sourceShareCode?, importedAt? }
                  // candidateStays holds inbox destinations not yet placed on the timeline
                  // v2→v3 migration adds candidateStays: [] to existing trips

Stay            { id, name, color, startSlot, endSlot,
                  centerLat, centerLng, imageUrl?,
                  nightAccommodations?: Record<dayOffset, NightAccommodation>,
                  checklist?, notes?, links? }

VisitItem       { id, stayId, name, type: VisitType, lat, lng,
                  dayOffset: number|null,   // null = unscheduled inbox
                  dayPart: DayPart|null,
                  order, durationHint?, notes?, imageUrl?,
                  checklist?: ChecklistItem[],
                  links?: VisitLink[] }

Route           { fromStayId, toStayId, mode: TravelMode, duration?, notes? }

NightAccommodation  { name, lat?, lng?, cost?, notes?, link? }
ChecklistItem   { id, text, done: boolean }
VisitLink       { url, label?: string }

ShareCodeNode   { code: string, tripId: string, userId: string, writable: boolean,
                  createdAt: timestamp, updatedAt: timestamp, revokedAt?: timestamp }
```

**Key design:** Visits are flat at trip level (not nested in stays) with `stayId` reference. Routes are first-class entities between stays. This enables cross-stay visit moves (just change `stayId`), route data survives stay reordering, and future features like destination wishlist (`startSlot: -1`).

**Slot arithmetic:** 1 day = 3 slots. `startSlot = dayIndex * 3`. Stay night count = `ceil((endSlot - startSlot) / 3)`.

**Persistence:** Primary key `itinerary-store-v2` (native JSON). Legacy keys read on migration: `itinerary-trips-v1` → `itinerary-hybrid-trips-v2`. Cloud: `users/{uid}/tripStore`. Old v1 data is auto-migrated to v2 on load via `migrateV1toV2()`. v2→v3 adds `candidateStays: []`; `normalizeTrip` defends against Firebase stripping empty arrays.

---

## Feature Status

| Feature                     | Status | Notes                                                                                                                                                                                                                                                                  |
| --------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gantt timeline              | ✅     | Drag, resize, zoom, overlap detection, blocked buffer days, extend trip                                                                                                                                                                                                |
| Date range shrink/shift     | ✅     | Clamping, removal confirmation, visit unscheduling                                                                                                                                                                                                                     |
| Stay CRUD                   | ✅     | Geocoding, color, route chips, manual map picker fallback                                                                                                                                                                                                              |
| Destination Inbox           | ✅     | Candidate stays saved without dates, promote to timeline via "Pick from inbox", demote via "Move to inbox"; ghost markers on overview map; visits travel with stay on promote/demote                                                                                   |
| Activity kanban + inbox     | ✅     | DnD, search, type grid, global itinerary overview, manual map picker fallback                                                                                                                                                                                          |
| Accommodation per-night     | ✅     | Geocoding, cost, grouping, night-range editing                                                                                                                                                                                                                         |
| Stay overview panel         | ✅     | Hero, stats, notes, links, accommodation summary, to-do                                                                                                                                                                                                                |
| Visit checklist + links     | ✅     | Per-visit to-do items and external links                                                                                                                                                                                                                               |
| Stay notes + links + todo   | ✅     | Freeform notes, external links, collapsible checklist                                                                                                                                                                                                                  |
| Map — overview              | ✅     | Stay markers + route lines                                                                                                                                                                                                                                             |
| Map — detail                | ✅     | Visit/accommodation markers, clustering, arrows                                                                                                                                                                                                                        |
| Map resize + day filter     | ✅     | Collapsed/expanded/mini state persisted across refresh                                                                                                                                                                                                                 |
| AI planner (Gemini)         | ✅     | From scratch + refine                                                                                                                                                                                                                                                  |
| Firebase Auth + cloud sync  | ✅     | Email + Google OAuth, merge dialog                                                                                                                                                                                                                                     |
| JSON + Markdown export      | ✅     |                                                                                                                                                                                                                                                                        |
| JSON import                 | ✅     | Zod validation                                                                                                                                                                                                                                                         |
| Undo/redo + history browser | ✅     | 50-step, keyboard shortcuts                                                                                                                                                                                                                                            |
| Multi-trip + welcome screen | ✅     | Demo mode                                                                                                                                                                                                                                                              |
| Mobile layout               | ✅     | Adaptive layout: map hidden <768px, sidebar → Sheet bottom drawer via FAB, snap-scroll day columns (85vw), footer hidden (sync dot in header), touch DnD (long-press), responsive header; safe-area insets on FAB + drawer; conflict/demo banners visible on all sizes |
| Share via Code              | ✅     | Generate code, push/pull, toggle mode, revoke; importers don't need auth; writable mode (future: auth-optional)                                                                                                                                                        |
| Passcode sharing            | ⚠️     | Firebase functions exist; not exposed in UI                                                                                                                                                                                                                            |
| Cost/budget dashboard       | ❌     | `cost` field exists, no aggregate display                                                                                                                                                                                                                              |
| Markdown import             | ❌     |                                                                                                                                                                                                                                                                        |
| Trip duplication            | ❌     |                                                                                                                                                                                                                                                                        |

---

## Known Limitations

- **Overlap is visual-only** — overlapping stays persist without error.
- **Slot granularity is morning/afternoon/evening only** — no clock times.
- **Deleting a stay deletes all its visits** — no "move to another stay" option.
- **AI coords are Gemini-generated** — not verified against a map DB; can be inaccurate.
- **AI refine mode doesn't see existing visits** — may generate duplicates.
- **Merge is all-or-nothing** — same trip edited on two devices: last write wins.
- **History is in-memory** — page reload resets the undo stack.
- **Legacy app removed** — the old Mantine-based UI has been fully deleted. Only the CHRONOS app remains.
- **Dark mode not implemented** — light mode only for now.
- **Writable share mode requires creator login** — future improvement is to allow auth-optional pushes for writable shares.
- **One active share code per trip** — revoking and re-sharing generates a new code; old importers lose access.
