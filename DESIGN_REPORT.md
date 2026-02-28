# Itinerary Planner — Product Design Report

_Generated: 2026-02-28_

---

## 1. Executive Summary

The app has a solid design foundation: Mantine v7 with custom theming, a coherent color system (navy/blue palette, DM Sans + Manrope typography), thoughtful shadow depth, spring-like animations, and a well-structured three-pane layout. The bones are good.

The problems are almost entirely at the surface layer: **redundancy, missed hierarchy, and features that found a place to live before they found a reason**. Nothing here requires structural surgery — most of it is refining what already exists.

---

## 2. Information Architecture

### What works

The three-pane model (plan → map → detail) is correct for this product. The cognitive flow is sound: you see your itinerary on the left, spatial context in the middle, and deep detail on the right when you need it. The inspector opening on demand (not always visible) is the right call — it preserves map real estate.

### What doesn't

**The "Unassigned" zone is conceptually exposed at the wrong abstraction level.**
The zone exists as a staging area before assigning locations to days. Good concept. But surfacing it as a permanent section below the timeline — labeled "Unassigned" with "8 STOPS" and a "Clear" button — is exposing the data model, not the user's mental model. A traveler doesn't think "I have 8 unassigned stops." They think "I have places I haven't fit into the plan yet." The zone should be collapsible by default, styled as a soft staging area (which the dashed border starts to do), and "Clear" should either be removed or require confirmation.

**The footer of the left panel is a contradiction.**
History, AI Planner, and Cloud Sync appear in the top bar and again as footer buttons in the left panel. The three icon buttons below them (document, download, share) are export-related but have no labels. This creates:
- Redundancy with no added context
- An unlabeled action group that users will treat as decorative

If these footer buttons serve a sidebar-specific context, make that explicit. If not, remove them. The top bar owns global actions.

**The zoom slider has no home.**
It sits between the search bar and the timeline cards, sandwiched between unrelated elements. The label says "Zoom: 100%" which implies map zoom. It's actually timeline row density. This is a mislabeled feature in the wrong place. It belongs either as an icon toggle (compact / comfortable / spacious) inside the timeline section header, or as a collapsed control that only appears on hover.

**The accessibility keyboard shortcut** is rendered as floating small grey text below the zoom slider. This is design debris. It should live in a `?` help button or a keyboard shortcut modal — not hardcoded into the UI layout.

---

## 3. Visual Design System Analysis

### What's there (and is good)

- Custom shadow depth system (soft → sm → md → lg) — well thought out
- Category color coding: sightseeing blue, dining orange, hotel indigo, transit green — consistent and useful
- Transport type colors: walk green, train purple, flight red, ferry cyan — good for the route connectors
- Spring-like easing (`cubic-bezier(0.22, 1, 0.36, 1)`) — gives the app a premium feel
- Glass morphism header (`blur(18px)`, `rgba(250, 252, 255, 0.85)`) — works well
- Category gradient card backgrounds (e.g., sightseeing gets a subtle blue fade) — a nice touch that doesn't distract

### What's missing or broken

**Border radius is inconsistent without reason.**
The codebase has 10 different radii: `8px`, `10px`, `11px`, `12px`, `13px`, `14px`, `16px`, `21px`, `22px`, `999px`. Some 2px differences exist only because components were styled independently. Define 5 radius values and use only those:

| Token | Value | Usage |
|-------|-------|-------|
| `radius-xs` | `6px` | Inputs, small badges |
| `radius-sm` | `10px` | Cards, buttons |
| `radius-md` | `14px` | Panels, modals |
| `radius-lg` | `20px` | Panes |
| `radius-full` | `999px` | Pills, toggles |

**Typography hierarchy is effectively flat in practice.**
The type scale is defined (h1→h6, DM Sans + Manrope), but in the actual UI almost everything renders at a similar visual weight. Day labels compete with stop names compete with section headers. The `SCHEDULE RECAP` / `TRAVEL CONNECTIONS` all-caps treatment in the inspector panel feels bureaucratic — clinical separators instead of readable headings.

**The left pane background gradient is nearly invisible.**
`linear-gradient(180deg, #ffffff 0%, #f6fafe 58%, #f2f7fd 100%)` adds build complexity without visible payoff. Either commit to it (make the endpoint more distinct, like `#eaf2fa`) or drop it and use solid white.

---

## 4. Component-by-Component Critique

### 4.1 Top Bar

**Problems:**
- 7 actions at equal visual weight: History, AI Planner, Export Markdown, Import JSON, Export JSON, Cloud Sync, account
- Export Markdown and Export JSON should not be two separate top-level items
- AI Planner is the most powerful and differentiating feature, yet styled identically to "Export Markdown"

**Suggested grouping:**
```
[Logo · Trip name]  |  [AI Planner ★]  |  [History · ↓Export▾ · ↑Import · ☁ Sync]  [Account]
```
Give AI Planner a filled/accent style so it reads as the primary action. Everything else is secondary.

---

### 4.2 Left Sidebar — Top Section

**Problems:**
- "EDIT" as a plain text link is weak affordance for editing the date range
- Timeline / Calendar / Budget tabs sit at the same visual level as the date range above — no visual separation

**Fixes:**
- Add `12px` vertical padding between the date range row and the view tabs
- Replace "EDIT" text link with a pencil icon button

---

### 4.3 Left Sidebar — Timeline

**Problems:**
- Day headers use `#374151` dark gray with `border-radius: 12px 0 0 12px` — this partial rounding looks clipped on the right side
- Morning/afternoon/evening slot borders (subtle orange and indigo tints) are too quiet to create usable visual rhythm
- The zoom slider interrupts the flow between search and timeline

**Fixes:**
- Day headers should span the full width with consistent corner rounding or be redesigned as full-width dividers (thin line + label)
- Slot time-of-day labels need slightly more contrast to work as navigation anchors
- Move density control to a small icon button in the top-right of the timeline section header

---

### 4.4 Unassigned Zone

**Problems:**
- "8 STOPS" + "Clear" reads as a status bar, not an action surface
- The dashed border for the drop zone is correct UX but needs more affordance text when empty
- "Clear" with no confirmation is a destructive action with no safety net

**Fixes:**
- Rename: "Unplaced" or "Staging"
- Replace "Clear" with a trash icon that opens a confirmation dialog
- When collapsed, show count as a badge on the chevron icon
- Empty state text: "Drag places here, or tap + to add"

---

### 4.5 Map Area

**Problems:**
- "Map options" button floats on the map with no visual container — looks like it's sitting on the tiles
- The Leaflet container uses `border-radius: 21px` while the surrounding pane is `22px` — invisible in practice but an inconsistency worth fixing

**Fixes:**
- Give "Map options" a consistent button treatment matching the header actions (bordered, `10px` radius, same height `34px`)
- Standardize pane-level border-radius to `20px` across the board

---

### 4.6 Right Inspector Panel

**Problems:**
- Section headers (SCHEDULE RECAP, TRAVEL CONNECTIONS, SUB-DESTINATIONS) are all-caps, small, muted — they function as dividers but not as readable headings
- The 4 navigation icons (sub-itinerary toggle ↓, prev ←, next →, Google Maps) have no visible labels and are only discoverable via hover tooltip
- Coordinates (`35.6895, 139.6917`) are shown prominently below the location name — developer-useful, user-ignored
- The `160px` image header uses a fixed radial gradient overlay that'll look wrong on most images
- Rating format `3.3D` on timeline cards is cryptic — what does D mean?

**Fixes:**
- Replace all-caps section headers with sentence-case at `13-14px` with a small left-bar accent (colored vertical line)
- Add a one-line icon+label strip or persistent subtitle below the nav icons
- Move coordinates to a small copyable badge or collapse them into a "Details" section
- Replace the fixed radial gradient with a bottom-to-transparent gradient so titles remain readable regardless of image content
- Clarify or remove the rating format — if it stays, it needs a legend

---

## 5. Specific Visual Improvements

These are concrete, targeted changes:

| # | Change | Where |
|---|--------|--------|
| 1 | Consolidate border-radius to 5 values | Global |
| 2 | Left pane gradient: commit to visible endpoint (`#eaf2fa`) or drop to solid white | Left pane |
| 3 | Day header partial rounding → full rounding or full-width divider | Timeline |
| 4 | Search bar: add subtle background (`#f1f7ff`) or soft shadow to distinguish from form inputs | Left pane |
| 5 | Inspector image: bottom-to-transparent gradient overlay instead of radial | Inspector |
| 6 | Transport pills: smaller, right-aligned between cards (not centered interruptions) | Timeline |
| 7 | Timeline card tags: consistent filled badge style, clarify `3.3D` format | Timeline cards |
| 8 | Footer icon buttons: add labels or remove | Sidebar footer |
| 9 | Sub-destination indicator on cards that have depth (nested icon or stop count badge) | Timeline cards |
| 10 | "Map options" button: match header button style | Map |

---

## 6. Product Strategy Observations

### Dual audience tension

Personal traveler features (AI Planner, day-by-day timeline, sub-destinations) and creator features (Export Markdown, Import/Export JSON, Cloud Sync) are competing for the same toolbar space. This is manageable now, but will compound. Consider a mode toggle as features grow:

- **Planning mode** — traveler-focused, AI prominent, export hidden
- **Publishing mode** — creator-focused, export/share prominent, AI secondary

This also makes the toolbar radically cleaner in each mode.

### AI Planner is under-positioned

It's the most differentiating feature in the app and it's styled identically to "Export Markdown." If the AI can generate or edit itineraries, it deserves more than a toolbar button. Consider:
- A persistent floating action in the timeline
- Contextual "suggest stops for Day 3" prompts inside the timeline
- An inline chat-like entry point for incremental edits

### Sub-destination system is powerful but invisible

Drilling into a location to see sub-destinations is a genuinely useful feature for complex trips. But nothing in the timeline card communicates "this location has depth." Add a visual indicator on cards that have sub-destinations: a small nested icon or stop count badge.

### "History" label tells users nothing

Is it edit history? Previous AI generations? Version history? Past trips? Clarify the label based on what it actually shows. If it's undo/redo, it belongs near the undo/redo buttons already in the toolbar.

---

## 7. Priority Matrix

| Priority | Issue | Effort | Status |
|----------|-------|--------|--------|
| 🔴 High | Top bar grouping — consolidate exports, elevate AI Planner | Low | ✅ Done |
| 🔴 High | Unassigned zone — rename, redesign, add confirmation on Clear | Low | ✅ Done |
| 🔴 High | Zoom slider — replace with density toggle, move to timeline body | Low | ✅ Done |
| 🔴 High | Inspector section headers — all-caps → readable hierarchy | Low | ✅ Done |
| 🔴 High | Remove floating accessibility shortcut hint | Trivial | ✅ Done |
| 🟡 Medium | Inspector nav icons — add labels or persistent hints | Low | ✅ Done |
| 🟡 Medium | Day header — left accent bar, no border-width jump on select | Low | ✅ Done |
| 🟡 Medium | Coordinates deprioritized in inspector | Low | ✅ Done |
| 🟡 Medium | Sidebar footer buttons — remove unlabeled export icons | Trivial | ✅ Done |
| 🟡 Medium | Sub-destination count badge on timeline cards | Low | ✅ Done |
| 🟢 Low | Left pane gradient — committed with visible endpoint | Trivial | ✅ Done |
| 🟢 Low | Border radius — 5 CSS tokens defined, main panes unified to 20px | Medium | ✅ Done |
| 🟢 Low | Inspector image — bottom-to-transparent gradient overlay | Low | ✅ Done |
| 🟢 Low | Transport pills — smaller (3×8px), right-aligned | Low | ✅ Done |
