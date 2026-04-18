# UI modernization — design spec

**Date:** 2026-04-18
**Status:** Design approved, plan pending
**Branch target:** one PR, full switch, light-first (dark mode deferred)

---

## Goal

Give CHRONOS a coherent visual identity. Today the UI reads as "default shadcn with orange primary" — it works, but nothing tells you _which_ app you're in. This rewrite installs a complete design system (tokens, typography, chrome, stay palette, controls) that is modern, minimal, travel-native, and unambiguous about the product.

**Non-goals**

- No layout or information-architecture changes. Same sidebar, same timeline, same day columns, same modals.
- No new features.
- No dark mode migration in this PR. Dark mode token variables get laid down but components are not audited or verified in dark.
- Not a refactor. Existing components keep their structure; only their styling and tokens change.

---

## Decisions

All previously in the brainstorm stream, consolidated here for implementers.

### 1. Primary color — **Petrol Teal `#0f766e`**

Replaces `#ec5b13`. Reserved for **chrome only**: brand mark, primary CTA, active/selected state, focus ring, keyboard-shortcut chips, link hover. **Never used on content** (destinations, visits, markers).

Scale (drop-in values for Tailwind's emerald/teal 50–900):

| Token         | Hex       | Use                             |
| ------------- | --------- | ------------------------------- |
| `primary-50`  | `#f0fdfa` | Subtle backgrounds, hover tints |
| `primary-100` | `#ccfbf1` | Selected rows, pill chips       |
| `primary-200` | `#99f6e4` | Borders on tinted surfaces      |
| `primary-500` | `#14b8a6` | Bright variant, rare            |
| `primary-600` | `#0d9488` | Hover on fill                   |
| `primary-700` | `#0f766e` | **Default primary**             |
| `primary-800` | `#115e59` | Active/pressed                  |
| `primary-900` | `#134e4a` | Dark surface (top bar)          |

### 2. Stay palette — **P1 Jewel Tones**

Replaces current `STAY_COLORS` array. These colors are **content identity** for destinations. Chosen so stays never collide with teal chrome.

```ts
export const STAY_COLORS = [
  '#b8304f', // Claret
  '#c15a2a', // Rust
  '#2e3f8a', // Indigo
  '#6b7a3a', // Olive
  '#7b3b6b', // Plum
  '#3a4a5a', // Slate
  '#a7772b', // Ochre
  '#3d6b4a', // Moss
];
```

**Migration concern.** Existing user trips stored in localStorage use old colors (e.g. `#2167d7`, `#615cf6`, `#d78035`, `#2db6ab`, `#20b5a8`, `#3b6dd8`, `#c45c99`, `#4c9463`). We will _not_ auto-remap stored stay colors — users who already assigned colors keep them. New stays pick from the new palette. Color pickers in `StayEditorModal` show the new palette going forward. This is a minor cosmetic inconsistency for existing trips, acceptable.

### 3. Canvas — **Neutral shell, teal on accents only**

| Surface       | Token                | Hex       | Use                                  |
| ------------- | -------------------- | --------- | ------------------------------------ |
| App canvas    | `--background`       | `#fafaf9` | Main app background, sidebar, inbox  |
| Card / panel  | `--card`             | `#ffffff` | Cards, modals, popovers, right panel |
| Chrome bar    | `--chrome`           | `#ffffff` | Top bar background                   |
| Divider       | `--border`           | `#ececec` | Hairlines between zones              |
| Muted surface | `--muted`            | `#f4f4f5` | Disabled inputs, inactive tabs       |
| Muted fg      | `--muted-foreground` | `#71717a` | Secondary text                       |
| Foreground    | `--foreground`       | `#18181b` | Body text                            |

Teal leaks into: brand dot, active sidebar item background (`primary-100`), focus ring, primary button, keyboard chip, selected timeline block accent stroke.

### 4. Typography

Keep **Inter** for all UI text. Add **Geist Mono** for numerals, dates, coordinates, and kbd chips.

Dependency changes:

- Add `@fontsource-variable/geist-mono` to `package.json`.
- Keep `@fontsource-variable/geist` imported for now (used for mono sibling) — _or_ drop it if unused elsewhere. Verify no component references Geist Sans before removing.
- Today's `@theme inline { --font-sans: 'Geist Variable', sans-serif; }` line in `src/index.css` silently overrides Inter. Delete that line; let the earlier `@theme { --font-sans: 'Inter', ... }` win.

Tokens (under `@theme`):

```css
--font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
--font-mono: 'Geist Mono Variable', ui-monospace, SFMono-Regular, monospace;
```

Scale (applied via utility classes, documented in `src/index.css`):

| Name      | Size         | Weight | Letter-spacing   | Use                               |
| --------- | ------------ | ------ | ---------------- | --------------------------------- |
| `display` | 28/32        | 650    | -0.025em         | Stay titles in overview hero      |
| `h1`      | 22/27        | 650    | -0.02em          | Panel titles, modal titles        |
| `h2`      | 17/24        | 650    | -0.015em         | Section headings inside panels    |
| `body`    | 14/21        | 400    | 0                | Default text                      |
| `small`   | 12/18        | 400    | 0                | Metadata, hints                   |
| `micro`   | 10/14        | 600    | 0.1em upper      | Labels ("DESTINATION · 02")       |
| `num`     | (contextual) | 600    | -0.02em, tabular | Geist Mono — stat numerals, dates |

**Rule:** anything purely numeric (stat counts, ISO/formatted dates, coordinates, version strings) uses `font-mono` with `tabular-nums`. Destination names and free text stay Inter.

### 5. Corner radius

Replace current single `--radius: 0.625rem` with a scale. Keep the CSS variable name the project already has, redefine the scale around 10px as `lg`.

| Token           | Px  | Use                                   |
| --------------- | --- | ------------------------------------- |
| `--radius-sm`   | 5   | Inputs, outline chips, tight controls |
| `--radius-md`   | 7   | Buttons, kbd, stat tiles              |
| `--radius-lg`   | 10  | Cards, panels, day columns            |
| `--radius-xl`   | 14  | Stay overview hero, map card          |
| `--radius-2xl`  | 18  | Modals, full-screen drawers           |
| `--radius-full` | 999 | Pill chips (visit type tags)          |

### 6. Elevation

Shift from shadcn's default gray drop shadows to a two-tone scale where interactive lift gets a subtle teal glow. Reads warmer without being loud.

```css
--shadow-xs: 0 1px 2px rgba(15, 23, 42, 0.04);
--shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.04), 0 2px 4px -2px rgba(15, 23, 42, 0.04);
--shadow-md: 0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 16px -6px rgba(15, 118, 110, 0.1);
--shadow-lg: 0 1px 2px rgba(15, 23, 42, 0.05), 0 20px 40px -12px rgba(15, 118, 110, 0.18);
```

- `xs` — card rest state
- `sm` — hover on interactive card
- `md` — active drag, dropdown, popover
- `lg` — modal, full-screen overlay

### 7. Semantic colors

Separate scale from brand so alerts never fight chrome teal.

| Role        | Fg        | Bg        | Border    |
| ----------- | --------- | --------- | --------- |
| Success     | `#065f46` | `#ecfdf5` | `#a7f3d0` |
| Warning     | `#78350f` | `#fffbeb` | `#fde68a` |
| Info        | `#1e40af` | `#eff6ff` | `#bfdbfe` |
| Destructive | `#991b1b` | `#fef2f2` | `#fecaca` |

Solid fills (for badges, buttons): success `#059669`, warning `#d97706`, info `#2563eb`, destructive `#dc2626`.

### 8. Controls

**Buttons.** Four variants, all 32px default height:

- `fill` — teal background, white text, `--shadow-xs` at rest. Primary CTA.
- `outline` — white bg, teal border (`primary-100`), teal text. Secondary.
- `ghost` — transparent, neutral-700 text, hover adds `--muted` bg.
- `destructive` — red fill.

Primary buttons may embed an inline `kbd` hint (e.g. `Add stay [N]`) using `primary-800` background.

**Inputs.** 32px default, 8px radius, 1px border `--border`, focus gets `primary-700` border + 3px `primary-100` ring. Inter body text.

**Kbd chips.** Mono, 10px, `muted` background, 1px `border`, 4px radius.

**Focus ring.** Replace current `rgba(236, 91, 19, 0.5)` with `rgba(15, 118, 110, 0.45)`. Keep 2px width / 2px offset.

### 9. Motion

Keep existing motion scale (`cubic-bezier(0.16, 1, 0.3, 1)`, ~150–300ms). Add a standard hover/press pattern on interactive cards:

- Rest: `--shadow-xs`
- Hover: translateY(-1px) + `--shadow-sm`, 150ms
- Press: translateY(0) + `--shadow-xs`, 80ms

`prefers-reduced-motion` already suppresses animations — no change needed.

---

## Architecture — what changes, where

### Token layer (`src/index.css`)

Rewrite the `:root` block and `@theme` block:

- Replace `--color-primary: #ec5b13` with teal token set (8 steps).
- Keep existing `--background`, `--foreground`, `--card` structure but swap values to the neutral shell.
- Introduce `--color-primary-{50,100,200,500,600,700,800,900}` so components can reach secondary shades.
- Introduce `--font-mono` token.
- Introduce `--radius-{sm,md,lg,xl,2xl,full}` scale. Delete the old `calc()` dependent radii.
- Introduce `--shadow-{xs,sm,md,lg}` tokens.
- Update focus-visible outline rule to teal.
- Update `.rdp-inline .rdp-root` overrides (calendar popover): swap orange `#ec5b13` / `#fef3ee` / `#9a3412` / `#fde1c9` for teal equivalents. Lock those values next to the rest of the calendar CSS.
- Dark-mode `:root.dark` block: add new token values (teal tuned for dark, neutral shell inverted). **No component-level verification in this PR.**

### Domain constants (`src/domain/constants.ts`)

- Replace `STAY_COLORS` array with the 8 jewel-tone hexes.

### Hardcoded color sites

The grep shows three non-CSS files with `#ec5b13` literals:

- `src/components/ui/LocationPicker.tsx`
- `src/components/modals/AuthModalSimple.tsx`
- `src/components/TripMap/markerFactories.tsx`

Replace with `var(--color-primary)` where CSS is inline, or with the appropriate Tailwind utility (`text-primary`, `bg-primary`) elsewhere. Leaflet marker factories that build HTML strings can read the CSS variable via `getComputedStyle(document.documentElement).getPropertyValue('--color-primary')` at marker-build time, or just hardcode the new hex `#0f766e` — marker factories are already re-built on color changes, so a literal is acceptable.

### Orphan file cleanup

`src/theme.ts` and `src/components/AppHeader.tsx` both import `@mantine/core`, but Mantine is not a project dependency (package.json has no mantine entries). These are untracked exploratory files and must be deleted as part of this PR so they don't drift into a half-built parallel system.

### Typography application

Add `font-mono tabular-nums` (or a `.num` utility in `src/index.css`) to every numeric display site:

- Stay date ranges (`panels/StayOverviewPanel.tsx`, stay chips in `App.tsx`)
- Day column headers (day number + date) in `App.tsx`
- Stat tiles (places / days / hotels) in overview panel
- Visit order numbers in inbox and sortable cards
- Timeline slot time labels
- ISO dates in accommodation rows (`AccommodationEditorModal.tsx`)
- Version strings (profile/history panel)

Define one utility `.font-num` in `src/index.css` under `@layer utilities` so we don't sprinkle the full declaration.

### Component restyling (no structural change)

Touch every file in `src/components/` that uses orange literals or primary tokens to verify the new values render correctly. Priority components (visible in main flow):

- `AppHeader`-equivalent bar (currently rendered inline in `App.tsx`) — brand mark with teal 20px squircle + "CHRONOS" wordmark in Inter 650 `-0.01em`
- `panels/StayOverviewPanel.tsx` — hero, stat tiles, notes block — adopt display/h1 sizes, mono stat numerals, `xs` shadow, `xl` radius
- `cards/SortableVisitCard.tsx` and `DraggableInventoryCard.tsx` — type-dot on left, mono for order number, `md` radius, `xs` → `sm` shadow on hover
- `timeline/DroppablePeriodSlot.tsx` — small hover teal tint, focus ring recolor
- `WelcomeScreen.tsx` — brand hero swap: teal gradient instead of orange, new stat tiles
- `modals/*.tsx` — swap orange buttons to teal, confirm radii (`2xl` modal corner)
- `TripMap/DayFilterPills.tsx` + `MapControlsPanel.tsx` — teal active state
- `TripMap/markerFactories.tsx` — cluster marker uses new teal; stay markers read from the new `STAY_COLORS` scale

No component file ownership moves, no new components introduced (exception: a `Kbd` primitive under `src/components/ui/kbd.tsx` — one ~10-line component — because kbd chips appear in 4+ places).

### What doesn't change

- shadcn/ui component source files — they already consume CSS variables. Changing tokens in `src/index.css` flows through without editing shadcn-generated files.
- App layout, grid math (`--day-col-width`, `--day-col-gap`), map animation keyframes.
- Any domain logic, tests, or data types.

---

## Rollout

**One PR. No feature flag.** Migration is pure styling; a partial token rewrite would look half-broken in dev. Steps inside the single branch:

1. Token rewrite in `src/index.css`.
2. Delete `src/theme.ts` and `src/components/AppHeader.tsx`.
3. Replace `STAY_COLORS` in `src/domain/constants.ts`.
4. Sweep the three hardcoded-orange files.
5. Add `.font-num` utility and apply at numeric display sites.
6. Build `Kbd` primitive and wire into the 4 existing ad-hoc kbd sites.
7. Component-by-component visual pass, working top → bottom of the screen priority list above.
8. Dark-mode token block written but not verified.
9. Manual QA pass: open each modal, hover each button, drag a visit, open the calendar, walk through Welcome → Add stay → Map. Verify no orange is left.
10. Update `docs/PRD.md` "Stack" bullet to mention the identity system; update `CLAUDE.md` Design tokens bullet to the new values.

Estimated surface: ~25 files touched. PR diff dominated by `src/index.css` rewrite plus small styling edits across components.

---

## Risks

- **Storybook drift.** Project has no Storybook; visual verification is manual. Mitigation: the QA pass in step 9 above.
- **Leaflet marker style.** Markers are built from HTML strings in `markerFactories.tsx` and cached; changing hex at build is fine, but the pulse/hover styles in `src/index.css` use `rgba(13, 110, 253, ...)` (a leftover) and `rgba(236, 91, 19, ...)`. Sweep those during the CSS rewrite.
- **Calendar regressions.** react-day-picker's `rdp-inline` overrides are long and fragile. Keep the exact class surface, only swap hex values.
- **Existing trip color drift.** Users who created stays before this PR still show old colors. Documented above; acceptable.

---

## Out of scope

- Full dark-mode verification (tokens landed, components not audited).
- Layout changes of any kind.
- New features (Kbd primitive is the one extraction allowed, only because it's used 4+ times).
- Touching `@mantine/core` — not a dependency; the two orphan files that reference it are deleted.
- Icon system swap (Lucide stays).
- Storybook introduction.
- Migration of existing stays to the new palette.
