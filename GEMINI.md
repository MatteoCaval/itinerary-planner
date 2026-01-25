# Itinerary Planner - Project Context

> **CRITICAL RULES**
> 1. **NEVER REMOVE THIS FILE.** It must remain in the project root as a permanent reference.
> 2. **NEVER COMMIT WITHOUT EXPLICIT APPROVAL.** Do not perform `git commit` or `git push` unless the user specifically says "commit" or "ok to commit".
> 3. **LOCAL CONFIG PROTECTION.** NEVER remove, modify, or touch the `.env.local` file. Leave it exactly as it is in the local environment.

## Project Overview
A sophisticated travel itinerary planner featuring a synchronized **Gantt-style timeline view** and an **interactive map**. The app supports multi-day planning, duration resizing, detailed destination notes, and cloud synchronization.

## Tech Stack
- **Framework:** React 18 (TypeScript)
- **Build Tool:** Vite
- **Styling:** Bootstrap 5 (React-Bootstrap)
- **Icons:** Lucide React
- **Map Library:** Leaflet + React Leaflet (CartoDB Voyager Tiles)
- **Drag & Drop:** @dnd-kit (Core + Sortable)
- **Backend:** Firebase Realtime Database (for Cloud Sync)
- **Environment:** Docker & Docker Compose (Node 20-alpine)

## UI Architecture & Layout
*This section describes the structural integrity of the UI to prevent breakage during refactors.*

### 1. Root Layout (`App.tsx`)
- **Container:** Uses Bootstrap `container-fluid` with `p-0`, `h-100`, and `overflow-hidden` to fill the entire viewport.
- **Grid System:** A single `Row` with `g-0` (no gutters) and `h-100`.
    - **Sidebar Column (`Col md={5} lg={4}`):** Fixed width on desktop, full width on mobile (when active). Contains header, scrollable body, and fixed footer.
    - **Map Column (`Col md={7} lg={8}`):** Occupies remaining space. Contains the Leaflet map and the absolute-positioned `LocationDetailPanel`.
- **Z-Index Stacking:**
    - Sidebar: `zIndex: 100` (above map).
    - Detail Panel Overlay: `zIndex: 1060` (above everything).
    - Mobile Bottom Nav: `zIndex: 1050`.

### 2. Timeline Grid (`DaySidebar.tsx`)
- **CSS Grid Container:** The main body uses `display: grid` with dynamic columns: `gridTemplateColumns: 80px 80px repeat(N, 1fr)`.
    - Col 1: Day Label (e.g., "Day 1").
    - Col 2: Slot Icons (Morning/Afternoon/Evening).
    - Col 3+: Lanes for destination blocks.
- **Row Height:** Controlled by `zoomLevel` state via `gridAutoRows: minmax(80px * zoomLevel, auto)`.
- **Item Positioning:** Items use `gridRow: StartRow / span Duration` and `gridColumn: Lane / span 1`.

### 3. Detail Panel (`LocationDetailPanel.tsx`)
- **Positioning:** Rendered as a direct child of the Map Column or root layout.
- **CSS Class:** `.location-detail-panel` uses `position: absolute`, `top: 0`, `right: 0`, `height: 100%`.
- **Responsiveness:** Width is fixed at `350px` on desktop but defaults to `100%` width on mobile to act as a full-screen overlay.
- **Animation:** Uses `@keyframes slideIn` to enter from the right.

### 4. Mobile Logic
- **Conditional Visibility:** Uses Bootstrap responsive display classes (`d-none d-md-flex`) combined with React state (`mobileView === 'map'`).
- **Tab Switching:** A fixed bottom navbar toggles the visibility of the Sidebar vs the Map.
- **Overlay Preservation:** The `LocationDetailPanel` must be rendered outside the conditional columns to remain visible even when the Map column is hidden.

## Comprehensive Feature List
*Ensure these functionalities remain intact during any refactor.*

### 1. Core Planning (Timeline & Grid)
- **Gantt Layout:** A CSS Grid-based timeline where days are divided into 3 slots (Morning, Afternoon, Evening).
- **Drag-to-Resize:** Destination blocks can be resized via a bottom handle. 1 slot = 1/3 day. Default duration for new items is 3 slots (1 day).
- **Drag-and-Drop:** Items can be reordered within a day, moved between days, or moved to the "Unassigned" staging area.
- **Visual Feedback:**
    - **Duration Badge:** Shows length (e.g., "1.3d") inside the block.
    - **Smart Preview:** Shows a preview of notes; expands lines based on block height.
    - **Zebra Striping:** Alternate days have subtle background shading.
- **View Modes:** Toggle between "Timeline" (List) and "Calendar" (Month Grid) via the sidebar header.
- **Zoom:** Slider to adjust the vertical height of timeline slots.

### 2. Map & Visualization
- **Interactive Map:** Leaflet map with CartoDB Voyager (Light, English-friendly) tiles.
- **Synchronization:** Map markers are numbered based on the chronological order of the timeline.
- **Routing:** Dashed lines connect consecutive locations.
    - **Mid-point Badges:** Show transport type and duration/distance on the connection line.
    - **Directional Arrows:** Indicate flow of travel.
- **Interaction:** Hovering a timeline item highlights the map marker/route, and vice versa. Clicking either opens the Detail Panel.

### 3. Destination Details (Side Panel)
- **Schedule Recap:** Displays calculated start/end time.
- **Travel Connections:** Explicitly lists "Arrive from [Prev]" and "Depart to [Next]" with transport details.
- **Image Preview:** Fetches and displays a destination image via Unsplash API. Persists the URL to avoid re-fetching. Shows a skeleton loader while loading.
- **Rich Content:** Notes, Checklists, and External Links.
- **Google Maps Integration:** "Maps" button searches for the location by name in a new tab.

### 4. Data Management & Persistence
- **Local Storage:** `localStorage` automatically saves state.
- **Cloud Sync (Firebase):** Save/Load itinerary via Passcode. Remembers last used code.
- **File Export:** JSON download and dedicated PDF/Print document view.

## Folder Structure
```text
itinerary-planner/
├── src/
│   ├── components/
│   │   ├── DaySidebar.tsx          # Timeline logic & grid rendering
│   │   ├── MapDisplay.tsx          # Map rendering & routing logic
│   │   ├── LocationDetailPanel.tsx # Right-side drawer for editing
│   │   ├── CalendarView.tsx        # Alternative Month view
│   │   ├── CloudSyncModal.tsx      # Firebase interactions
│   │   ├── SortableItem.tsx        # Individual timeline block
│   │   ├── RouteEditor.tsx         # Transport details modal
│   │   └── PrintableItinerary.tsx  # Hidden component for PDF generation
│   ├── App.tsx                     # Main layout & state orchestration
│   ├── firebase.ts                 # Firebase config
│   ├── unsplash.ts                 # Image API logic
│   ├── types.ts                    # TypeScript interfaces
│   ├── index.css                   # Layout overrides and custom Grid logic
│   └── main.tsx                    # Entry point
├── Dockerfile                      # Node 20-alpine
├── docker-compose.yaml             # Dev environment
├── package.json                    # Dependencies and scripts
├── vite.config.ts                  # Vite config
└── GEMINI.md                       # THIS FILE
```