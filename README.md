# Itinerary Planner

A travel itinerary planner with a synchronized timeline and interactive map. Build multi-day trips, organize activities into time slots, connect them with routes, and export the plan as JSON or Markdown.

## Stack

- React 18 + TypeScript
- Vite (build and dev server)
- Tailwind CSS v4 (via `@tailwindcss/vite` plugin)
- Leaflet + React-Leaflet (map rendering)
- @dnd-kit (drag and drop)
- react-day-picker + date-fns (date range selection)
- Firebase Auth + Realtime Database (cloud sync)

## Key Features

- Gantt-style timeline with morning/afternoon/evening slots
- Drag-and-drop scheduling with resizable stay durations
- Blocked buffer days before/after the trip with one-click extend
- Trip date range editing with stay clamping and confirmation when shrinking
- Interactive map with markers, routes, day filtering, and two modes (overview/detail)
- Per-night accommodation tracking with grouped display
- Visit checklists, links, and notes
- Local autosave with JSON/Markdown import/export
- Firebase cloud sync with merge conflict resolution
- AI itinerary generation via Google Gemini
- 50-step undo/redo with history browser
- Multi-trip support with demo mode

## Project Structure

```
src/
  domain/                  # Pure business logic (no React, no external services)
    types.ts               # All data model types (HybridTrip, Stay, VisitItem, etc.)
    constants.ts           # DAY_PARTS, STAY_COLORS, VISIT_TYPES, etc.
    dateUtils.ts           # Date helpers (addDaysTo, safeDate, fmt)
    geoUtils.ts            # Geo helpers (haversineKm, clamp, jitter)
    stayLogic.ts           # Stay calculations (deriveStayDays, overlaps, accommodations)
    visitLogic.ts          # Visit scheduling (sortVisits, normalizeVisitOrders)
    visitTypeDisplay.ts    # Visit type display mappings (colors, labels)
    migration.ts           # Legacy <-> Hybrid trip conversion, normalizeTrip
    tripMutations.ts       # Trip mutations (extend, drag, date range shrink)
    sampleData.ts          # Demo trip data
    __tests__/             # Unit tests for domain logic (36 tests)

  services/
    httpClient.ts          # HTTP client with retry/timeout
    telemetry.ts           # Error/event tracking

  firebase.ts              # Firebase config, cloud sync helpers
  aiService.ts             # Gemini AI integration (scratch + refine modes)
  markdownExporter.ts      # Markdown export
  unsplash.ts              # Unsplash photo search

  hooks/
    usePlaceSearch.ts      # Nominatim geocoding with debounce
    useRouteGeometry.ts    # OSRM route geometry fetching

  components/
    TripMap/               # Leaflet map (markers, routes, clustering, day filters)

  context/
    AuthContext.tsx         # Firebase auth provider

  App.tsx                  # CHRONOS app — main UI component
  main.tsx                 # Entry point (React root)
  index.css                # Tailwind theme, custom CSS, react-day-picker overrides
  utils/
    geocoding.ts           # Nominatim search wrapper
    routing.ts             # OSRM route geometry fetching
```

## Tools and Integrations

- **Geocoding/Search:** OpenStreetMap Nominatim
- **Routing:** OSRM public routing service (route geometry for map paths)
- **Images:** Unsplash API (destination photos)
- **Cloud Sync:** Firebase Auth + Realtime Database
- **AI Planning:** Google Gemini API (user-provided API key)
- **Date Picker:** react-day-picker v9 with date-fns

## Getting Started

```bash
npm install
npm run dev        # http://localhost:5173/itinerary-planner/
```

## Build

```bash
npm run build      # TypeScript check + production bundle
```

## Test

```bash
npm run test       # Run full Vitest suite
npx vitest run src/domain/   # Run domain logic tests only
```

## Optional Environment Variables

These are only required if you want to enable the related integrations:

- `VITE_UNSPLASH_ACCESS_KEY`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_DATABASE_URL`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
