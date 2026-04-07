# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Keeping docs up to date

After adding or changing any feature, update these docs **in the same session** — don't wait to be asked:

- **`docs/PRD.md`** — the canonical source of truth for what the app does. Update the **Features** section, **Feature Status** table, and **Known Limitations** whenever behavior changes.
- **`docs/IMPROVEMENTS.md`** — the backlog and audit checklist. Tick items as done (`- [x]`) immediately after implementing them. Add new findings if discovered during work.

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

The main orchestration component (~2900 lines). State management, callbacks, and layout composition. UI components are extracted into `src/components/`.

**Data model:**

- `HybridTrip` → `Stay[]` → `VisitItem[]`
- Stays = timeline blocks (colored, cover a span of `startSlot`–`endSlot` on the timeline)
- Visits with `dayOffset !== null` = scheduled activities rendered in day columns
- Visits with `dayOffset === null` = inbox/unscheduled (left sidebar)

### UI layer (`src/components/`)

```
ui/                    # shadcn/ui components (Button, Dialog, Input, etc.) + ModalBase, TransportIcon
modals/                # 10 modal dialogs (AccommodationEditor, AIPlannerModal, AuthSimple, etc.)
panels/                # Sidebar panels (StayOverview, VisitDetail, ProfileMenu, History, TripSwitcher)
cards/                 # DraggableInventoryCard, SortableVisitCard
timeline/              # DroppablePeriodSlot
TripMap/               # Leaflet map (markers, routes, clustering, day filters, basemap picker)
WelcomeScreen.tsx      # Landing page for new users
ChronosErrorBoundary.tsx
InlineDateRangePicker.tsx
```

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
__tests__/            # Unit tests
```

Zero React dependencies. All functions are pure and unit-testable.

### Supporting files

```
src/hooks/
  useHistory.ts        # Undo/redo history (50-step)
  usePlaceSearch.ts    # Nominatim geocoding with debounce
  useRouteGeometry.ts  # OSRM route geometry
src/lib/
  persistence.ts       # loadStore, saveStore (localStorage)
  utils.ts             # shadcn cn() utility
src/context/
  AuthContext.tsx       # Firebase auth provider
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
- **shadcn/ui** (nova preset, Radix-based). Components in `src/components/ui/`. Use semantic tokens (`text-foreground`, `bg-muted`, `border-border`, `text-destructive`, `text-success`, etc.) — not hardcoded Tailwind colors.
- **Design tokens:** Primary orange `#ec5b13`, font Inter. Semantic colors: success (green), warning (amber), info (blue), destructive (red).
- **Formatting:** 2-space indent, single quotes, semicolons, trailing commas, 100-char line width (Prettier-enforced).
- **Naming:** PascalCase components, `use` prefix hooks, camelCase utilities.
- **Types** live in `src/domain/types.ts`. No separate `src/types.ts`.
- **Never touch `.env.local`.**
- **Never mention Claude Code** as author, helper, or generator — not in commits, PRs, code comments, or anywhere in the repo.
- **Never commit without explicit permission** — present changes and wait for the user to say "commit".

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
