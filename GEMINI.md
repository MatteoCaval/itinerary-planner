# Itinerary Planner - Project Context

> **CRITICAL RULES**
> 1. **NEVER REMOVE THIS FILE.** It must remain in the project root as a permanent reference.
> 2. **NEVER COMMIT WITHOUT EXPLICIT APPROVAL.** Do not perform `git commit` or `git push` unless the user specifically says "commit" or "ok to commit".
> 3. **LOCAL CONFIG PROTECTION.** NEVER remove, modify, or touch the `.env.local` file. Leave it exactly as it is in the local environment.

## Project Overview
A sophisticated travel itinerary planner featuring a synchronized **Gantt-style timeline view** (using CSS Grid) and an **interactive map**. The app supports multi-day planning, duration resizing, detailed destination notes, and cloud synchronization.

## Tech Stack
- **Framework:** React 18 (TypeScript)
- **Build Tool:** Vite
- **Styling:** Bootstrap 5 (React-Bootstrap)
- **Icons:** Lucide React
- **Map Library:** Leaflet + React Leaflet (OpenStreetMap)
- **Drag & Drop:** @dnd-kit (Core + Sortable)
- **Backend:** Firebase Realtime Database (for Cloud Sync)
- **Environment:** Docker & Docker Compose (Node 20-alpine)

## Architecture & Core Logic
- **Timeline Grid:** Implemented in `DaySidebar.tsx`. Uses a single CSS Grid container where rows represent time slots (Morning/Afternoon/Evening) across days. Items span multiple rows based on duration.
- **Concurrent Items:** Arranges overlapping activities into dynamic side-by-side lanes within the grid.
- **Cloud Sync:** Uses Firebase Realtime Database to save/load itineraries via passcodes. Persistence is managed via `localStorage` for the last used passcode.
- **Mobile Responsiveness:** Features a tabbed navigation (Timeline vs Map) on small screens to optimize screen real estate.
- **Data Model:** `Location` interface includes `startDayId`, `startSlot`, `duration` (in slots), `notes`, `checklist`, and `links`.
- **Map Synchronization:** Automatically sorts destinations chronologically to draw accurate route polylines with directional arrows.

## Folder Structure
```text
itinerary-planner/
├── src/
│   ├── components/
│   │   ├── DaySidebar.tsx          # Core Gantt timeline logic and grid rendering
│   │   ├── MapDisplay.tsx          # Leaflet map logic, markers, and chronological routes
│   │   ├── LocationDetailPanel.tsx # Slide-out drawer for rich destination planning
│   │   ├── CalendarView.tsx        # Month-grid overview of the itinerary
│   │   ├── CloudSyncModal.tsx      # Modal for Firebase save/load logic
│   │   ├── SortableItem.tsx        # Destination block with resize and preview logic
│   │   └── RouteEditor.tsx         # Modal for editing transport types between stops
│   ├── App.tsx                     # Main layout, view switching, and global state
│   ├── firebase.ts                 # Firebase SDK initialization and DB helpers
│   ├── types.ts                    # Shared TypeScript interfaces and constants
│   ├── index.css                   # Grid layouts, animations, and zebra-striping
│   └── main.tsx                    # Entry point
├── Dockerfile                      # Node 20-alpine based image
├── docker-compose.yaml             # Development service with full-root mounting
├── package.json                    # Dependencies and scripts
├── vite.config.ts                  # Vite configuration with subpath base and optimization
└── GEMINI.md                       # THIS FILE (DO NOT REMOVE)
```

## Usage Tips
- **Gantt Resize:** Drag the bottom handle of any destination block in the timeline to change its duration.
- **Smart Preview:** Timeline blocks show a preview of destination notes; extending the duration shows more lines.
- **Cloud Sync:** Use the "Cloud Sync" button in the footer to share itineraries using passcodes.
- **Zebra Striping:** Alternate days in the timeline have different background shades for better readability.