# Potential Improvements

## Code-Related Improvements

- [x] Break `src/App.tsx` into feature-focused hooks/components (`useSearch`, `useSidebarResize`, `useImportExport`) to reduce complexity and improve testability.
- [x] Replace `any` usage in props and helpers (for example in `SidebarContent` and migration utilities) with explicit interfaces and shared DTO types.
- [x] Introduce a small API layer for geocoding/routing/AI calls with consistent loading, retries, abort handling, and typed error responses.
- [x] Replace browser `alert`/`confirm` flows with Mantine `Modal`/`Notifications` for non-blocking UX and better state control.
- [x] Add data validation (e.g., Zod) for imported JSON and cloud-loaded payloads before mutating app state.
- [x] Make context state updates more robust by preferring functional updates where stale closure bugs are possible (`removeLocation`, `updateLocation`, `updateDay`).
- [x] Add a formal testing setup (Vitest + React Testing Library) for itinerary assignment rules, drag-and-drop behavior, and import/export migration.
- [x] Add ESLint + Prettier scripts and CI checks to enforce style, dead-code detection, and predictable formatting.
- [x] Remove debug logging from production paths (for example day-path logs in `MapDisplay`) and gate diagnostics behind a dev flag.
- [x] Add rate limiting + local cache policy for Nominatim requests and include a proper user-agent strategy to reduce request failures.
- [x] Introduce error boundaries for map and AI modal areas so partial failures do not break the full planner UI.
- [x] Add lightweight telemetry hooks (only if desired) for failed API calls and heavy interactions to guide future optimization.

## Graphic and UI Improvements

- [x] Define a stronger visual system (spacing scale, typography hierarchy, semantic colors) and move repeated styles from `index.css` into reusable theme tokens.
- [x] Improve map readability with marker clustering at low zoom and better collision handling for dense locations.
- [x] Add clearer route visualization controls (toggle arrows, route type legend, highlight current day path).
- [x] Improve mobile ergonomics for the bottom sheet: snap points, drag handle affordance, and larger touch targets.
- [x] Introduce skeleton/loading states for search results, AI generation, and cloud sync actions instead of abrupt content swaps.
- [x] Improve empty states for first-time users (no dates, no locations, no routes) with quick-start prompts and action buttons.
- [x] Increase accessibility coverage: keyboard navigation for timeline operations, better focus styles, and verified contrast for status colors.
- [x] Refine timeline cards with stronger visual grouping by day section and clearer distinction between parent locations and sub-locations.
- [x] Add subtle motion for key transitions (sidebar collapse, day selection, route edit) to improve orientation.
- [x] Create consistent icon and label patterns for actions (export/import/history/AI/cloud) to reduce cognitive load.
- [x] Add richer destination visuals (thumbnail/photo preview) in cards and detail panel for faster scanning.
- [ ] Improve budget dashboard visuals with trend bars per day and clearer category labeling for quick interpretation.

## New Possible Features

- [ ] Smart auto-scheduling assistant that proposes slot assignments based on opening hours, travel time, and user pace preferences.
- [ ] Real-time collaboration mode with presence indicators and conflict-safe shared editing.
- [ ] Weather-aware planning: suggest indoor/outdoor swaps and rain fallback activities by day.
- [ ] Route optimization mode to reorder stops for minimal travel time/cost.
- [ ] Multi-itinerary scenario comparison (e.g., budget-first vs culture-first plan variants).
- [ ] Reservation tracker for flights/hotels/restaurants with status and confirmation links.
- [ ] Calendar sync/export (Google Calendar + `.ics`) for day and slot-level activities.
- [ ] Budget forecasting with category limits, overspend alerts, and per-day burn-down chart.
- [ ] Packing and prep checklist tied to destination weather and trip type.
- [ ] Offline/PWA support so users can view/edit plans without a network.
- [ ] Travel document vault (passport/visa/reminders metadata, no sensitive file uploads unless encrypted).
- [ ] AI follow-up chat that edits existing plans incrementally instead of regenerating from scratch.
- [ ] Local discovery mode that recommends nearby stops around selected map points.
- [ ] Post-trip mode to convert itinerary into a travel journal with photos and notes.
