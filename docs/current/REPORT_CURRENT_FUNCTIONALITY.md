# Itinerary Planner — Functionality & Structure Report

> Generated: 2026-03-01
> Notes: great overview of the old version

---

## Overview

**Itinerary Planner** is a single-page web application for multi-day trip planning. It combines an interactive Leaflet map, a drag-and-drop timeline sidebar, a detail inspector panel, AI-powered generation (Gemini), Firebase cloud sync, and full import/export. Built with React 18 + TypeScript, Mantine v7, and Vite.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| UI Library | Mantine v7 |
| Build Tool | Vite |
| Maps | Leaflet + React-Leaflet |
| Drag & Drop | @dnd-kit |
| State | Context API (ItineraryContext) |
| Auth | Firebase Auth (Google OAuth + email/password) |
| Storage | Firebase Firestore + localStorage |
| AI | Google Gemini API |
| Photos | Unsplash API |
| Geocoding | OSM Nominatim |
| Fonts | DM Sans (body), Manrope (headings) |

---

## Shell Layout

### Desktop (≥ 768px)

```
┌─────────────────────────────────────────────────────────────────────┐
│  AppHeader (60px) — frosted glass, backdrop-filter: blur(14px)      │
├────────────────────────┬────────────────────────────────────────────┤
│  PlannerPane           │  MapPane (center, full-width flex)         │
│  33vw (≥1600px)        │                                            │
│  36vw (≤1200px)        │  ┌──────────────────────────────────────┐  │
│                        │  │  InspectorPane (overlay, right side) │  │
│  Frosted glass         │  │  25vw (≥1600px) / 30vw (≤1200px)    │  │
│  rgba(255,255,255,.72) │  │  Collapsible → 56px strip            │  │
│  backdrop-blur(14px)   │  └──────────────────────────────────────┘  │
└────────────────────────┴────────────────────────────────────────────┘
```


---

## Header (AppHeader.tsx)

**Left region:**
- Burger menu (mobile only, brand-blue)
- Brand logo: `MapIcon` + "Itinerary Planner" (DM Sans 800, letter-spacing −0.02em)
- Trip pill dropdown: switch / create / rename / delete trips

**Right region (desktop ≥ 1200px):**
- Undo / Redo icon buttons (disabled until history exists)
- "AI Planner" button (Sparkles icon, opens Gemini modal)
- "Tools" dropdown: History, Cloud Sync, Export Markdown, Export JSON, Import JSON, Account

**Right region (mobile < 1200px):**
- Single `MoreHorizontal` icon → collapsed menu with all the same items

---

## PlannerPane / SidebarContent

### Top panel (sticky)

- Search bar (Nominatim autocomplete, 500ms debounce)
- Date range picker (opens DateRangePicker modal)
- Trip duration display (e.g., "7 days")
- View toggle: **Timeline** | **Calendar** | **Dashboard**

### Timeline View (DaySidebar)

- Vertical scroll list of days
- Each day: sticky `DayLabel` (date + weekday + accommodation indicator) + 3 droppable slots (Morning / Afternoon / Evening)
- `SortableItem` cards: gradient top by category (sightseeing=blue, dining=orange, hotel=indigo, transit=green, other=gray)
- `RouteConnector` pill between items: empty (dashed blue) or filled (white with transport badge)
- Resize handle at card bottom to expand duration
- `CurrentTimeLine` (red, pulsing dot) if today is within the trip range
- `UnassignedZone` at bottom: warning panel for undated locations

### Calendar View (CalendarView)

- Month grid; each day cell shows location name badges colored by category
- Prev / Next month navigation

### Dashboard View (TripDashboard)

- Total cost, average daily spend
- Pie chart for spending by category
- Location count stats

### Sidebar Footer (always visible)

- "Add location" button
- Action icon row: History, Cloud, AI Planner, Import/Export

---

## MapPane / MapDisplay

**Tile layers:** OpenStreetMap (local labels) or Carto (English labels) — toggle via map controls

**Overlays:**
- `ClusteredLocationMarkers`: colored circle markers (26px), numbered badge top-right, hotel star icon variant
- `RouteSegment`: animated polylines, colored by transport type, with midpoint emoji badge (clickable to edit route)
- Hover: marker scales 1.15×, offset shadow

**Map controls (top-left floating pill):**
- Toggle: arrows on routes, cluster markers
- Basemap selector (pill `<select>`)
- Legend toggle → shows transport color dots
- Day highlight indicator if a day is selected

**InspectorPane overlay (top-right of map):**
- `location-detail-expand-handle`: 44×44px blue gradient circle, expands/collapses inspector
- Collapsed state: 56px strip with just the expand button
- Expanded: `LocationDetailPanel` with scroll area

---

## LocationDetailPanel / Inspector

**Image area (160px desktop / 120px mobile):**
- Unsplash photo auto-fetched on first open, covers full width
- Gradient scrim at bottom (for text contrast)
- "Destination Preview" badge (top-left)
- Collapse + Close buttons (top-right, blue/gray `ActionIcon`)
- Dark gradient placeholder with `LocationThumbnail` icon if no image yet

**Header:**
- Location name (fw 700, size lg)
- Coordinates (10px, clickable to copy to clipboard)
- Compact buttons: Stops | Prev | Next | Maps (Google Maps link)

**Schedule recap card (Paper):**
- Calendar icon + "From:" / "To:" dates with slot names
- "Staying at:" accommodation name
- Travel connections: arrival from prev + departure to next (with transport type)

**Editable fields (inline, live update — no save button):**
- Category: icon button row (5 categories)
- Cost: Euro prefix NumberInput
- Target time: text input (HH:MM format)
- Duration: NumberInput (slots, 1 = one time-of-day period)

**Notes:** Textarea, autosize 4–12 rows

**Stay overview:** Card per accommodation group with nights count badge

**Checklist:** Add / complete / delete items per location

**Links:** URL list with external-link icons

---

## Modals

| Modal | Trigger | Content |
|---|---|---|
| AIPlannerModal | AI Planner button | Mode toggle (From Scratch / Refactor), text prompt, Gemini API key input, loading state, result preview |
| AuthModal | Sign in menu item | Email/password tabs + Google OAuth button |
| CloudSyncModal | Cloud Sync | Save tab (generate passcode) / Load tab (enter passcode) |
| HistoryModal | History menu item | Timestamped snapshot list + slider, "Apply" to jump to any state |
| RouteEditor | Route connector pill | Transport type grid, duration, cost, notes |
| DayAssignmentModal | Internal | Day/slot grid picker for batch assignment |
| DateRangePicker | Date display | Start/end date inputs |

---

## Data Model

```typescript
Location {
  id, name, lat, lng
  notes, category, imageUrl
  startDayId, startSlot, duration, order
  checklist[], links[], cost, targetTime
  subLocations[]
}

Day {
  id, date, label
  accommodation { name, lat, lng, cost, notes, link }
}

Route {
  id, fromLocationId, toLocationId
  transportType, duration, cost, notes
}

TripSummary {
  id, name, createdAt, updatedAt
}

AISettings {
  apiKey, model
}
```

**Transport types:** walk, car, bus, train, flight, ferry, other

**Location categories:** sightseeing, dining, hotel, transit, other

---

## State Management

Single `ItineraryContext` (Context API) holding:

- `tripStore` — multi-trip container with active trip ID
- `locations[]`, `days[]`, `routes[]` — core itinerary data
- `selectedLocationId`, `hoveredLocationId` — UI selection state
- `history[]` + `historyIndex` — snapshot-based undo/redo (debounced 1s)
- `aiSettings` — Gemini API key and model name

---

## Persistence Strategy

| Mechanism | Key | Contents |
|---|---|---|
| localStorage | `itinerary-trips-v1` | Full multi-trip store |
| localStorage | `itinerary-ai-settings` | AI key/model config |
| localStorage | `last-trip-passcode` | Last cloud sync code |
| localStorage | `itinerary-map-basemap` | Basemap preference |
| Firebase Firestore | per-user doc | Full trip store, synced when authenticated (600ms debounce) |

---

## Component Hierarchy

```
App
├── AuthProvider
└── ItineraryProvider
    └── AppContent
        ├── AppHeader
        ├── AppShell.Main
        │   ├── PlannerPane
        │   │   └── SidebarContent
        │   │       ├── Search bar
        │   │       ├── DateRangePicker trigger
        │   │       ├── View toggle (Timeline / Calendar / Dashboard)
        │   │       ├── DaySidebar (Timeline)
        │   │       │   ├── DayLabel
        │   │       │   ├── DroppableCell (×3 per day)
        │   │       │   │   └── SortableItem
        │   │       │   │       └── RouteConnector
        │   │       │   └── UnassignedZone
        │   │       ├── CalendarView
        │   │       └── TripDashboard
        │   └── MapPane
        │       ├── MapDisplay
        │       │   ├── ClusteredLocationMarkers
        │       │   └── RouteSegment
        │       └── DesktopInspectorPane
        │           └── LocationDetailPanel
        │               ├── SubDestinationsPanel
        │               ├── ChecklistSection
        │               └── LinksSection
        ├── MobileBottomSheet (mobile only)
        │   └── MobilePlannerSheet
        └── Modals (portal-rendered)
            ├── AIPlannerModal
            ├── AuthModal
            ├── CloudSyncModal
            ├── HistoryModal
            ├── RouteEditor
            ├── DayAssignmentModal
            └── TripActionDialogs
```

---

## Key User Flows

### Adding a Location
1. User types in search bar → Nominatim returns suggestions (500ms debounce)
2. User selects suggestion → Location added with defaults (category: other, unassigned)
3. Card appears in UnassignedZone
4. User drags card to a day/slot → Location assigned
5. RouteConnector appears between sequential cards
6. User clicks connector → RouteEditor modal → configures transport

### AI-Assisted Planning
1. Open AI Planner modal
2. Choose mode: "From Scratch" or "Refactor existing"
3. Enter Gemini API key (stored in localStorage)
4. Describe the trip in natural language
5. Gemini returns a structured JSON → app imports locations, routes, days
6. User reviews and adjusts

### Cloud Sync
1. Open Cloud Sync modal → Save tab
2. App generates passcode (e.g., `TRIP-ABC1`)
3. Data saved to Firebase with that key
4. On another device: Cloud Sync → Load tab → enter passcode → trip loaded

### Sub-Itinerary Drill-Down
1. Location has `subLocations[]`
2. Inspector shows "Stops" button
3. Click → sidebar and map switch to sub-itinerary context
4. "Main" button or breadcrumb returns to parent
5. Sub-locations have their own timeline (day offsets from parent)

### Undo/Redo
1. Every state change debounces a snapshot into `history[]`
2. Undo/Redo buttons in header step through `historyIndex`
3. History modal shows named snapshots with timestamp slider

---

## Custom Hooks

| Hook | Purpose |
|---|---|
| `useAppModals` | Modal open/close state for all 7 modals |
| `useSelectionFlow` | Location selection and sub-itinerary navigation |
| `useTripActions` | Trip CRUD with notifications |
| `useItineraryDrillDown` | Computes sub-itinerary display context |
| `usePlaceSearch` | Debounced Nominatim autocomplete |
| `useImportExport` | JSON/Markdown file I/O |
| `useRouteGeometry` | Route polyline path calculations |
| `useSidebarResize` | Left pane drag-to-resize |

---

## Design System

### Color Tokens

| Token | Value | Usage |
|---|---|---|
| `--app-accent` | `#1d64d8` | Primary interactive elements |
| `--app-accent-soft` | `#e8f1ff` | Selected states, soft backgrounds |
| `--app-ink` | `#0f2236` | Primary text |
| `--app-ink-muted` | `#5e7389` | Secondary text, labels |
| `--app-border` | `#d3dde8` | Dividers, card borders |
| `--app-bg-base` | `#eff3f8` | App background |
| `--app-surface` | `#ffffff` | Card surfaces |

### Typography

| Role | Font | Weight | Size |
|---|---|---|---|
| Brand / Headings | Manrope | 700–800 | 14–36px scale |
| Body / UI | DM Sans | 400–700 | 10–16px |

### Radius Scale

| Token | Value |
|---|---|
| `--app-radius-xs` | 6px |
| `--app-radius-sm` | 10px |
| `--app-radius-md` | 14px |
| `--app-radius-lg` | 20px |
| `--app-radius-full` | 999px |

### Motion

| Token | Value |
|---|---|
| `--app-motion-fast` | 170ms |
| `--app-motion-med` | 250ms |
| `--app-easing` | cubic-bezier(0.22, 1, 0.36, 1) |

### Transport Type Colors

| Type | Color |
|---|---|
| Walk | `#22c55e` (green) |
| Car | `#3b82f6` (blue) |
| Bus | `#f97316` (orange) |
| Train | `#a855f7` (purple) |
| Flight | `#ef4444` (red) |
| Ferry | `#06b6d4` (cyan) |
| Other | `#6b7280` (gray) |

---

## Responsive Breakpoints

| Breakpoint | Behavior |
|---|---|
| `< 768px` | Mobile: hide left pane, show bottom sheet |
| `768px–1200px` | Sidebar 36vw, inspector 30vw |
| `1200px–1600px` | Sidebar 36vw, inspector 30vw, header actions visible |
| `≥ 1600px` | Sidebar 33vw, inspector 25vw |
| `≥ 1921px` | Floating panel widths expand (460→520–580px) |
| `≥ 2560px` | Floating panel widths expand further |

---

## Error Handling

- `AppErrorBoundary` wraps each major pane — shows retry UI on crash
- Schema-based validation on JSON imports (`itinerarySchema.ts`)
- Firebase auth errors handled with user notifications
- Graceful fallbacks when Unsplash / Nominatim are unavailable
- Telemetry service (`services/telemetry.ts`) for error tracking

---

## Performance

- `React.memo()` on: `SortableItem`, `RouteConnector`, `DroppableCell`
- `useMemo()` for: location sorting, schedule calculations, day filtering
- Debounced: place search (500ms), history snapshots (1000ms), Firebase sync (600ms)
- Leaflet handles map marker clustering natively (`MarkerClusterGroup`)
- Unsplash images lazy-fetched only on inspector open, cached in location state
