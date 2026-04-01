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

### CHRONOS app (`src/App.tsx`)

The main UI component (~4800 lines). Types and business logic are imported from the domain layer.

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
__tests__/            # 36 unit tests
```

Zero React dependencies. All functions are pure and unit-testable. App.tsx imports from this layer.

### Supporting files

```
src/context/
  AuthContext.tsx       # Firebase auth provider
src/hooks/
  usePlaceSearch.ts    # Nominatim geocoding with debounce
  useRouteGeometry.ts  # OSRM route geometry
src/components/
  TripMap/             # Leaflet map (markers, routes, clustering, day filters)
src/services/
  httpClient.ts        # HTTP client with retry/timeout
  telemetry.ts         # Error/event tracking
src/utils/
  geocoding.ts         # Nominatim search wrapper
  routing.ts           # OSRM route geometry fetching
src/aiService.ts       # Gemini AI integration
src/markdownExporter.ts
src/firebase.ts        # Firebase config + cloud sync helpers
src/unsplash.ts        # Unsplash photo search
```

## Key Conventions

- **Tailwind v4** via `@tailwindcss/vite` plugin — no `tailwind.config.js`. CSS variables and theme tokens go in `src/index.css`.
- **Design tokens:** Primary orange `#ec5b13`, font Inter.
- **Formatting:** 2-space indent, single quotes, semicolons, trailing commas, 100-char line width (Prettier-enforced).
- **Naming:** PascalCase components, `use` prefix hooks, camelCase utilities.
- **Types** live in `src/domain/types.ts`. No separate `src/types.ts`.
- **Never touch `.env.local`.**

## Working on UI Features

When implementing or modifying any UI feature, don't just code what's literally asked — think like a product designer:

- **Before building:** Consider how the feature interacts with existing UI. Will it conflict with other panels? Is the placement intuitive? Are there better patterns? Flag concerns and propose alternatives before writing code.
- **During building:** Handle edge cases proactively — empty states, mobile layout, very long text, many items, narrow containers. Don't wait for these to be reported.
- **After building:** Self-review the result before presenting it. Would a first-time user understand this? Is the affordance clear (hover states, icons, cursors)? Does it look polished and consistent with the rest of the app? Fix issues before saying "done."
- **Challenge the approach:** If an idea has a UX problem, say so and propose the better alternative. Don't implement something that clearly conflicts with the existing layout just because it was asked.
- **Extend ideas:** Fill in the details with good judgment — discoverability cues, transitions, confirmation dialogs for destructive actions, mobile behavior.

## Optional Integrations (env vars)

All optional — app works without them:

- `VITE_UNSPLASH_ACCESS_KEY` — destination photos
- `VITE_FIREBASE_*` — cloud sync (API key, auth domain, database URL, project ID, storage bucket, messaging sender ID, app ID)
