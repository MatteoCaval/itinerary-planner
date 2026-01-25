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
- **Styling:** Tailwind CSS v4 + Shadcn/UI ("Zinc" Theme)
- **Icons:** Lucide React
- **Map Library:** Leaflet + React Leaflet (CartoDB Voyager Tiles)
- **Drag & Drop:** @dnd-kit (Core + Sortable)
- **Backend:** Firebase Realtime Database (for Cloud Sync)
- **Environment:** Docker & Docker Compose (Node 20-alpine)

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
- **Overlay:** Slides in from the right (absolute positioned, z-indexed high). Mobile-friendly (full width on small screens).
- **Schedule Recap:** Displays calculated start/end time (e.g., "Mon, Jan 1 (Morning) - Tue, Jan 2 (Afternoon)").
- **Travel Connections:** Explicitly lists "Arrive from [Prev]" and "Depart to [Next]" with transport details.
- **Image Preview:** Fetches and displays a destination image via Unsplash API. Persists the URL to avoid re-fetching. Shows a skeleton loader while loading.
- **Rich Content:**
    - Notes (Multi-line text area).
    - Checklist (Tasks with completion state).
    - Links (External URLs with labels).
- **Google Maps Integration:** "Maps" button searches for the location by name in a new tab.

### 4. Route Editing
- **Transport Logic:** Routes exist *between* two consecutive locations.
- **Structured Input:** Duration is entered via specific "Hours" and "Minutes" inputs, or Quick Preset buttons (15m, 1h, etc.).
- **Metadata:** Supports Transport Type (Car, Train, etc.), Cost, and Notes.

### 5. Data Management & Persistence
- **Local Storage:** `localStorage` automatically saves state (`itinerary-locations`, `itinerary-routes`, etc.).
- **Cloud Sync (Firebase):**
    - **Save:** Upload current state to Firebase Realtime Database with a generated or custom Passcode.
    - **Load:** Retrieve itinerary by Passcode. Warning prompt before overwriting.
    - **Persistence:** Remembers the last used passcode.
- **File Export:**
    - **JSON:** Download full state as `.json`.
    - **PDF/Print:** dedicated "Print" button reformats the view into a clean document layout, hiding the UI.
- **Clear All:** Reset functionality with confirmation.

### 6. Search & Geocoding
- **Autocomplete:** Debounced search against Nominatim (OpenStreetMap) API.
- **Results Dropdown:** Shows matching places; clicking adds them to the timeline immediately.
- **Auto-Geocoding:** Reverse geocoding used when adding points via map click.

### 7. Layout & Responsiveness
- **Desktop:** Split view (Sidebar + Map). Sidebar width is fixed/responsive (resize handle removed).
- **Mobile:**
    - **Tabbed Navigation:** Bottom bar switches between "Timeline" and "Map" views (mutually exclusive).
    - **Detail Panel:** Overlays the entire screen when active.

## Folder Structure
```text
itinerary-planner/
├── src/
│   ├── components/
│   │   ├── ui/                     # Shadcn/UI primitive components (Button, Dialog, etc.)
│   │   ├── DaySidebar.tsx          # Timeline logic & rendering
│   │   ├── MapDisplay.tsx          # Map rendering & routing logic
│   │   ├── LocationDetailPanel.tsx # Right-side drawer for editing
│   │   ├── CalendarView.tsx        # Alternative Month view
│   │   ├── CloudSyncModal.tsx      # Firebase interactions
│   │   ├── SortableItem.tsx        # Individual timeline block
│   │   ├── RouteEditor.tsx         # Transport details modal
│   │   └── PrintableItinerary.tsx  # Hidden component for PDF generation
│   ├── lib/
│   │   └── utils.ts                # Shadcn utility (cn)
│   ├── App.tsx                     # Main layout & state orchestration
│   ├── firebase.ts                 # Firebase config
│   ├── unsplash.ts                 # Image API logic
│   ├── types.ts                    # TypeScript interfaces
│   ├── index.css                   # Tailwind imports & custom overrides
│   └── main.tsx                    # Entry
├── Dockerfile                      # Node 20-alpine
├── docker-compose.yaml             # Dev environment
├── vite.config.ts                  # Vite config (Tailwind, Alias, Base path)
├── tailwind.config.js              # Tailwind theme config
├── postcss.config.js               # PostCSS config
└── GEMINI.md                       # THIS FILE
```
