# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Keeping docs up to date

After adding or changing any feature, update `docs/PRD.md` — specifically the **Features** section, the **Feature Status** table, and **Known Limitations** if relevant. The PRD is the canonical source of truth for what the app does.

## Commands

```bash
npm run dev          # Start Vite dev server (http://localhost:5173, base path /itinerary-planner/)
npm run build        # TypeScript check + production bundle
npm run lint         # ESLint with zero warnings allowed
npm run test         # Run Vitest suite once
npm run test:watch   # Run Vitest in watch mode
npm run format       # Prettier write
npm run format:check # Prettier check
```

To run a single test file:
```bash
npx vitest run src/hooks/useImportExport.test.ts
```

Tests use jsdom + Testing Library. Setup file: `src/test/setup.ts`.

## Architecture

There are **two parallel app instances** in this codebase:

### 1. CHRONOS app (`src/App.tsx`) — the active UI
~900-line self-contained component. Defines its own local types (`HybridTrip`, `Stay`, `VisitItem`) inline rather than importing from `src/types.ts`. Persists to localStorage key `itinerary-hybrid-v3`. Has legacy data migration logic at the top of the file for importing from old storage formats.

**Data model:**
- `HybridTrip` → `Stay[]` → `VisitItem[]`
- Stays = timeline blocks (colored, cover a span of `startSlot`–`endSlot` on the timeline)
- Visits with `dayOffset !== null` = scheduled activities rendered in day columns
- Visits with `dayOffset === null` = inbox/unscheduled (left sidebar)

### Domain layer (`src/domain/`) — pure business logic
```
types.ts              # All data model types (HybridTrip, Stay, VisitItem, legacy types)
constants.ts          # DAY_PARTS, STAY_COLORS, VISIT_TYPES, etc.
dateUtils.ts          # addDaysTo, safeDate, fmt, formatRelativeTime
geoUtils.ts           # haversineKm, clamp, jitter
stayLogic.ts          # deriveStayDays, getOverlapIds, deriveAccommodationGroups, isSlotRangeEmpty
visitLogic.ts         # createVisit, sortVisits, normalizeVisitOrders
visitTypeDisplay.ts   # getVisitTypeBg, getVisitTypeColor, getVisitLabel
migration.ts          # legacyTripToHybrid, hybridTripToLegacy, normalizeTrip
tripMutations.ts      # extendTripBefore/After, applyTimelineDrag, adjustStaysForDateChange
sampleData.ts         # createSampleTrip (Japan demo)
__tests__/            # 31 unit tests
```
Zero React dependencies. All functions are pure and unit-testable. App.tsx imports from this layer.

### 2. Legacy app (`src/features/legacy/LegacyApp.tsx`) — kept for reference only
Uses `ItineraryContext` and the full feature pane architecture. Not rendered in production. The view switcher key `itinerary-app-view-v1` in localStorage controls which app loads.

### Feature pane architecture (used by legacy app)
```
src/features/
  shell/          # AppShell layout (shell.css)
  hybrid/         # Timeline/kanban CSS (hybrid.css)
  planner/        # PlannerPane, MobilePlannerSheet, TripActionDialogs
  map/            # MapPane
  inspector/      # InspectorPane
  controllers/    # useSelectionFlow, useSubItineraryActions, useTripActions
  ui/primitives/  # AppButton, AppIconButton, AppModal, AppTextInput
  legacy/         # LegacyApp.tsx (reference only)
  trips/          # TripActionDialogs (shared)
src/context/
  ItineraryContext.tsx  # All itinerary state + mutations + undo/redo history
  AuthContext.tsx       # Firebase auth
src/hooks/
  useImportExport.ts    # JSON/Markdown import-export
  useItineraryDrillDown.ts
  usePlaceSearch.ts     # Nominatim geocoding wrapper
  useRouteGeometry.ts   # OSRM route geometry
  useSidebarResize.ts
src/services/
  httpClient.ts
  telemetry.ts
src/components/
  DaySidebar/           # Timeline CSS-grid rendering
  MapDisplay/           # Leaflet map + routing
  LocationDetailPanel/  # Right-side detail drawer
  TripMap/              # Map component used by CHRONOS app
  CalendarView.tsx      # Month grid alternative view
  DaySidebar.tsx        # (older version, may coexist)
src/utils/
  geocoding.ts          # searchPlace (Nominatim)
  itinerarySchema.ts    # Zod validation for imports
src/aiService.ts        # Gemini AI integration
src/markdownExporter.ts
src/firebase.ts         # Firebase config + cloud sync helpers
src/types.ts            # Shared types for legacy app
src/theme.ts
```

## Key Conventions

- **Tailwind v4** via `@tailwindcss/vite` plugin — no `tailwind.config.js`. CSS variables and theme tokens go in `src/index.css`.
- **Design tokens:** Primary orange `#ec5b13`, font Inter.
- **Formatting:** 2-space indent, single quotes, semicolons, trailing commas, 100-char line width (Prettier-enforced).
- **Naming:** PascalCase components, `use` prefix hooks, camelCase utilities.
- **`src/types.ts`** is for the legacy/context-based app. The CHRONOS app uses types from `src/domain/types.ts`.
- **Never touch `.env.local`.**

## Optional Integrations (env vars)

All optional — app works without them:
- `VITE_UNSPLASH_ACCESS_KEY` — destination photos
- `VITE_FIREBASE_*` — cloud sync (API key, auth domain, database URL, project ID, storage bucket, messaging sender ID, app ID)
