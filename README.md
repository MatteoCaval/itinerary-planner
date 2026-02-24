# Itinerary Planner

A travel itinerary planner with a synchronized timeline and interactive map. Build multi-day trips, organize activities into time slots, connect them with routes, and export the plan as JSON or Markdown.

**Stack**
- React 18 + TypeScript
- Vite (build and dev server)
- Mantine UI 7 + PostCSS
- Leaflet + React-Leaflet (map rendering)
- @dnd-kit (drag and drop timeline)
- Firebase Realtime Database (cloud sync)

**Key Features**
- Gantt-style timeline with morning/afternoon/evening slots
- Drag-and-drop scheduling with resizeable durations
- Nested sub-itineraries (destinations with day offsets)
- Interactive map with markers, routes, and route editor
- Local autosave with JSON import/export
- Markdown itinerary export
- Optional AI itinerary generation

**Tools and Integrations**
- **Geocoding/Search:** OpenStreetMap Nominatim
- **Routing:** OSRM public routing service (route geometry for map paths)
- **Images:** Unsplash API (destination photos)
- **Cloud Sync:** Firebase Realtime Database
- **AI Planning:** Google Gemini API (user-provided API key)

**Getting Started**
```bash
npm install
npm run dev
```

**Build**
```bash
npm run build
```

**Quick Demo Route**
- A preloaded demo trip is available at `/itinerary-planner/sample` (and `/sample` in local dev).
- The route autoloads `sample-trip.json` so reviewers can explore the app immediately.

**Optional Environment Variables**
These are only required if you want to enable the related integrations:
- `VITE_UNSPLASH_ACCESS_KEY`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_DATABASE_URL`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
