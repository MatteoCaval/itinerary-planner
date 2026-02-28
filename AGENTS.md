# Repository Guidelines

## Project Structure & Module Organization
Application code lives in `src/`. Use `src/components/` for shared UI, `src/features/` for feature-scoped panes and controllers, `src/hooks/` for reusable stateful logic, and `src/context/` for app-wide providers. Put API and platform integrations in `src/services/` or `src/utils/`, and keep shared constants in `src/constants/`. Tests are colocated with source files as `*.test.ts` or `*.test.tsx`. Static files and demo content live in `public/`; build and tooling config stays at the repo root (`vite.config.ts`, `vitest.config.ts`, `eslint.config.js`).

## Build, Test, and Development Commands
Run `npm install` once to install dependencies. Use `npm run dev` to start the Vite dev server and `npm run preview` to inspect a production build locally. `npm run build` runs TypeScript compilation and creates the production bundle. `npm run lint` enforces ESLint rules with zero warnings allowed. `npm run test` runs the full Vitest suite once, and `npm run test:watch` keeps tests running during development. Use `npm run format` or `npm run format:check` for Prettier formatting.

## Coding Style & Naming Conventions
This is a React 18 + TypeScript project. Follow the existing 2-space indentation and keep files formatted by Prettier: single quotes, semicolons, trailing commas, and a 100-character line width. Name React components in `PascalCase` (`TripDashboard.tsx`), hooks with the `use` prefix (`useTripActions.ts`), and utilities in `camelCase` (`markdownExporter.ts`). Prefer colocating feature code under the relevant `src/features/<area>/` folder rather than expanding shared folders prematurely.

## Testing Guidelines
Vitest runs in `jsdom` with Testing Library and setup from `src/test/setup.ts`. Add tests beside the code they cover, using the `*.test.ts(x)` pattern already used across `src/hooks/`, `src/utils/`, `src/context/`, and service modules. Cover user-visible behavior and state transitions, especially around itinerary editing, imports/exports, and API adapters.

## Commit & Pull Request Guidelines
Recent commits use short, imperative subjects such as `Adjust cloud sync button style` and `Refactor app into panes and extract controllers`. Keep commit titles concise, action-oriented, and focused on one change. Pull requests should include a clear summary, note any config or environment variable changes, link the related issue when available, and include screenshots or short recordings for UI changes.

## Configuration Tips
Optional integrations depend on `VITE_` environment variables for Unsplash, Firebase, and Gemini. Do not hardcode API keys or checked-in secrets; keep local values in an untracked env file.
