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
- **UI & Styling:** Mantine UI 7 (React)
- **Icons:** Lucide React
- **Map Library:** Leaflet + React Leaflet (CartoDB Voyager Tiles)
- **Drag & Drop:** @dnd-kit (Core + Sortable)
- **Backend:** Firebase Realtime Database (for Cloud Sync)
- **Environment:** Docker & Docker Compose (Node 20-alpine)

## UI Architecture & Layout
*This section describes the structural integrity of the UI to prevent breakage during refactors.*

### 1. Root Layout (`App.tsx`)
- **Container:** Uses Mantine `AppShell` with a header and a navbar (sidebar).
- **Layout Structure:**
    - **Sidebar (`AppShell.Navbar`):** Width 500px on desktop. Collapsible on mobile. Contains controls, search, and the `DaySidebar`.
    - **Main Content (`AppShell.Main`):** Occupies remaining viewport. Contains the `MapDisplay`.
    - **Detail Panel Overlay:** Rendered within `AppShell.Main` as an absolute-positioned `Paper` component when a location is selected.
- **Z-Index Stacking:**
    - Sidebar (`Navbar`): `zIndex: 1000` (above Leaflet's default markers).
    - Detail Panel Overlay: `zIndex: 1100` (above sidebar and all map layers).
    - Map Layers: Leaflet default (Markers: 600, Popups: 700).

### 2. Timeline Grid (`DaySidebar.tsx`)
- **CSS Grid Container:** The main body uses `display: grid` with dynamic columns: `gridTemplateColumns: 80px 80px repeat(N, 1fr)`.
    - Col 1: Day Label (e.g., "Day 1").
    - Col 2: Slot Icons (Morning/Afternoon/Evening).
    - Col 3+: Lanes for destination blocks.
- **Row Height:** Controlled by `zoomLevel` state via `gridAutoRows: minmax(80px * zoomLevel, auto)`.
- **Item Positioning:** Items use `gridRow: StartRow / span Duration` and `gridColumn: Lane / span 1`.

### 3. Detail Panel (`LocationDetailPanel.tsx`)
- **Positioning:** Absolute-positioned within a wrapper in `App.tsx`.
- **Dimensions:** Fixed at `380px` width on desktop.
- **Interaction:** Triggered by clicking a map marker or a timeline item.

### 4. Mobile Logic
- **Sidebar Toggle:** Uses Mantine's `useDisclosure` and `Burger` button to toggle `opened` state. The `Navbar` is hidden on mobile when `!opened`.
- **Detail Panel:** Overlays the map when active.

## Comprehensive Feature List
*Ensure these functionalities remain intact during any refactor.*

### 1. Core Planning (Timeline & Grid)
- **Gantt Layout:** A CSS Grid-based timeline where days are divided into 3 slots (Morning, Afternoon, Evening).
- **Drag-to-Resize:** Destination blocks can be resized via a bottom handle. 1 slot = 1/3 day.
- **Drag-and-Drop:** Items can be reordered within a day, moved between days, or moved to the "Unassigned" staging area using `@dnd-kit`.
- **Visual Feedback:**
    - **Duration Badge:** Shows length (e.g., "3 slots") inside the block.
    - **Smart Preview:** Shows a preview of notes; expands lines based on block height.
    - **Zebra Striping:** Alternate days (even/odd) have subtle background shading.
- **View Modes:** Toggle between "Timeline" (List) and "Calendar" (Month Grid) via the sidebar header.
- **Zoom:** Slider to adjust the vertical height of timeline slots.

### 2. Map & Visualization
- **Interactive Map:** Leaflet map with CartoDB Voyager tiles.
- **Synchronization:** Map markers are numbered based on the chronological order of the timeline.
- **Routing:** Lines connect consecutive locations.
    - **Mid-point Badges:** Show transport type/duration.
    - **Directional Arrows:** Indicate flow of travel.
- **Interaction:** Hovering a timeline item highlights the map marker/route, and vice versa. Clicking either opens the Detail Panel.

### 3. Destination Details (Side Panel)
- **Schedule Recap:** Displays calculated start/end time.
- **Travel Connections:** Lists "Arrive from" and "Depart to" with transport details.
- **Image Preview:** Fetches and displays a destination image via Unsplash API.
- **Rich Content:** Notes, Checklists, and External Links.
- **Google Maps Integration:** "Maps" button searches for the location in Google Maps.

### 4. Data Management & Persistence
- **Local Storage:** `localStorage` automatically saves state.
- **Cloud Sync (Firebase):** Save/Load itinerary via Passcode.
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
│   │   ├── DateRangePicker.tsx     # Start/End date selection
│   │   ├── DayAssignmentModal.tsx  # Manual day selection modal
│   │   └── PrintableItinerary.tsx  # Hidden component for PDF generation
│   ├── App.tsx                     # Main layout & state orchestration
│   ├── firebase.ts                 # Firebase config
│   ├── unsplash.ts                 # Image API logic
│   ├── types.ts                    # TypeScript interfaces
│   ├── index.css                   # Layout overrides and custom Grid logic
│   └── main.tsx                    # Entry point
├── package.json                    # Dependencies and scripts
├── vite.config.ts                  # Vite config
└── GEMINI.md                       # THIS FILE
```