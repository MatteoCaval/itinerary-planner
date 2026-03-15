# Itinerary Planner — Design AI Input Specification

> Generated: 2026-03-06
> Purpose: A generalized, highly detailed specification intended to be pasted into design AI tools such as Figma AI or similar systems.
> Important: Any city names used inside examples are placeholders only. The product model is generic and must work for any trip, any geography, and any duration.
> Verdict: not needed, good global prompts to reuse ma UI is outdated

---

## 1. How To Use This Document

This document is written for two audiences:
- a human designer who wants explicit screen specifications
- a design AI tool that needs detailed prompt input

Each major screen includes:
- product intent
- information hierarchy
- exact layout guidance
- component inventory
- content rules
- interaction behavior
- state requirements
- responsive behavior
- AI prompt block

If you are using a design AI tool:
- copy one screen prompt block at a time
- generate each screen separately first
- only then try multi-screen flows
- do not ask the AI to invent the product structure from scratch

This document assumes the product model already defined in:
- `REPORT_EXPERT_PLANNER_UI_SPEC.md`
- `REPORT_WIREFRAME_SPEC.md`

---

## 2. Product Summary To Give Any Design AI

Use this short summary before any specific screen prompt.

```text
Design a web-first travel planner for expert trip planners organizing long, complex, multi-city trips. The product is place-first, not day-first.

At the top level, the user plans a trip as a sequence of major destination stays connected by travel segments. Each stay is a span with arrival and departure defined by day part: morning, afternoon, evening. The main itinerary should feel like a Gantt timeline, not a calendar.

Inside each major destination stay, the user plans a sub-itinerary. The sub-itinerary is organized by days, and each day has morning, afternoon, evening lanes. Multiple visit items can exist inside the same day part, and order matters more than exact clock time.

The product has 3 primary planning levels:
1. Global itinerary across major destinations
2. Destination sub-itinerary inside one stay
3. Single-day execution view for review and light use, especially on mobile

The map is always important and should stay synchronized with the current planning level.

This product is for advanced planners, so moderate information density is acceptable. The UI should feel precise, spatial, editorial, and intentional, not generic or toy-like. Avoid a basic day-by-day travel app layout.
```

---

## 3. Universal Product Constraints

These constraints should be applied to every generated screen.

### 3.1 Conceptual Constraints

- The app must be `place-first`
- The app must not visually default to a repeated day list at the top level
- The global view must show destination spans and travel connectors
- A stay must look different from a visit item
- The map must not feel like an optional extra tab on desktop
- Order matters more than exact clock times
- Day parts are coarse planning units
- Unscheduled places are normal and must not look like errors

### 3.2 UX Constraints

- Direct manipulation should be implied visually
- Draggable things should look draggable
- Resizable spans should look resizable
- Map and structure should cross-highlight conceptually
- The product should support high density without becoming visually muddy
- Warnings should be advisory, not punitive

### 3.3 Visual Constraints

- Do not use a generic calendar-first travel app pattern
- Avoid relying on a month-grid as the main planning metaphor
- Avoid default corporate dashboard styling
- Avoid overly playful, casual consumer-travel visuals
- Avoid flat white screens with weak hierarchy
- Use a precise, structured, spatial layout
- Prefer strong column architecture and crisp grouping

### 3.4 Responsive Constraints

- Desktop is the main authoring surface
- Mobile is primarily for review, navigation, and light editing
- Do not force desktop complexity into mobile

---

## 4. Design Direction

Use these directions consistently across screens.

### 4.1 Desired Product Character

The product should feel:
- expert
- deliberate
- spatial
- editorial
- route-aware
- structured

It should not feel:
- chatty
- casual
- glossy lifestyle-travel
- calendar-template driven
- project management software with a travel skin

### 4.2 Density Direction

Target density:
- richer than a mainstream consumer travel app
- less mechanical than enterprise operations software

The user should be able to see:
- structure first
- details second
- metadata third

### 4.3 Typography Direction

Recommended typography behavior:
- strong destination labels
- compact but legible metadata
- controlled use of uppercase for structural labels
- clear distinction between major labels and supporting details

### 4.4 Color Direction

Recommended:
- neutral structural base
- restrained accents
- semantic route colors for transport where useful
- subtle differentiated states for selected, warning, tentative, completed

Avoid:
- excessive bright travel colors
- warning yellow used for normal unscheduled content
- purple-heavy startup gradients

### 4.5 Motion Direction

Recommended motion:
- drag lift and settle
- subtle route reflow
- map highlight transitions
- expand/collapse transitions for day cards

Avoid:
- decorative motion not tied to planning
- excessive microinteractions

---

## 5. Screen System

Design the following screens:

1. Global Itinerary Desktop
2. Global Itinerary Empty State
3. Global Itinerary With Selection / Edit State
4. Stay Detail Desktop
5. Stay Detail Drag State
6. Single-Day Desktop
7. Places Library Desktop
8. Today Mobile
9. Trip Sequence Mobile
10. Mobile Map View

Each screen spec appears below.

---

## 6. Screen 1: Global Itinerary Desktop

### 6.1 Screen Intent

This is the main planning screen.

The user should immediately understand:
- the sequence of major destination stays
- the duration of each stay
- the travel connections between them
- the geographic structure of the whole trip

### 6.2 Primary User Tasks

- add a new stay
- reorder stays
- resize a stay duration
- inspect or edit a travel segment
- understand how complete the trip is
- jump into a specific destination stay

### 6.3 Information Hierarchy

Priority 1:
- stay spans
- sequence
- travel connectors

Priority 2:
- arrival and departure day parts
- nights count
- completion status
- warnings

Priority 3:
- lodging summary
- unscheduled counts
- secondary actions

### 6.4 Layout Specification

Desktop layout should be a stable 3-column shell.

Recommended proportions on a 1440px canvas:
- left sidebar: 280px
- center timeline area: 700px to 780px
- right map panel: 380px to 460px

Recommended vertical zones:
- top app bar: 72px
- main content area below
- optional bottom drawer inside center panel when something is selected

### 6.5 Region Breakdown

#### Region A: Top App Bar

Must include:
- trip title
- top-level navigation tabs
- quick search
- share/export or collaboration entry

Optional:
- undo/redo
- smart planning assistant

#### Region B: Left Sidebar

Must include:
- ordered stay outline
- unscheduled counts by stay
- warnings summary
- quick add controls

Each stay row should include:
- sequence number
- destination name
- span summary or nights
- small completeness indicator

#### Region C: Timeline Header

Must include:
- dates in sequence
- visual subdivision into morning / afternoon / evening
- sticky behavior

#### Region D: Timeline Body

Must include:
- one continuous trip planning lane
- stay blocks spanning time
- travel connectors between blocks
- visible snap rhythm based on day parts

#### Region E: Map Panel

Must include:
- numbered stay markers
- route path between stays
- clear current selection
- fit actions
- view filters

### 6.6 Stay Block Specification

Each stay block must look like a major object, not a small card.

Every stay block should include:
- destination name
- span summary in plain language
- arrival and departure markers
- nights count
- internal itinerary summary
- optional lodging area

Suggested text content pattern:

```text
TOKYO
May 3 evening -> May 7 afternoon
4 nights
23 items planned · 70% complete
```

### 6.7 Travel Connector Specification

Each connector should visually sit between stays and communicate transport.

Must include:
- transport icon
- short label or icon-only mode

Optional:
- duration
- warning badge

Examples:
- train
- flight
- ferry
- drive

### 6.8 Interaction Requirements

The generated UI should imply the following interactions:
- drag a stay horizontally to reorder it
- resize left/right edge to change its duration
- click connector to edit travel details
- click a stay to open the stay detail screen
- hover or select a stay and highlight it on the map

### 6.9 Required States

The design must support:
- default state
- selected stay state
- selected connector state
- dragging stay state
- warning state
- empty state

### 6.10 Desktop Wireframe Reference

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Trip: Sample Multi-City Journey                   [Overview] [Itinerary*] [Places] [Bookings] [Share]     │
├───────────────────────┬───────────────────────────────────────────────────────────────┬──────────────────────┤
│ STAYS                 │ GLOBAL ITINERARY                                             │ MAP                  │
│ 1. Destination A      │ Date header with M / A / E subdivisions                      │ numbered markers     │
│ 2. Destination B      │                                                               │ route between stays  │
│ 3. Destination C      │ [ DESTINATION A ───────────────────── ] --train-->            │ filters              │
│                       │                            [ DESTINATION B ────── ] --flight->│                      │
│ Warnings              │                                             [ DESTINATION C ] │                      │
│ Quick add             │                                                               │                      │
└───────────────────────┴───────────────────────────────────────────────────────────────┴──────────────────────┘
```

### 6.11 Design AI Prompt Block

```text
Design a desktop web app screen for a place-first travel planner. This is the global itinerary view. The layout must be a 3-column desktop interface:

- Left sidebar around 280px wide for trip structure
- Large central timeline area as the main authoring surface
- Right map panel around 400px wide

The center of the screen must show the trip as a sequence of major destination stays, each represented as a continuous span block on a horizontal timeline subdivided into morning, afternoon, evening. The timeline should feel closer to a Gantt chart than a calendar. Each stay block should be draggable and visually resizable from the edges. Between stays, show travel connectors with transport indicators like train or flight.

The left sidebar should show an ordered outline of stays, unscheduled place counts, warnings, and quick-add actions. The right side should show a synchronized map with numbered destination pins and route lines.

The UI should feel precise, editorial, structured, and spatial. It should not look like a generic day-by-day travel app or a standard calendar. The map must feel first-class, not decorative.

Use realistic interface density for expert users. Show one selected stay state and make the design imply drag-and-drop and resize interactions.
```

---

## 7. Screen 2: Global Itinerary Empty State

### 7.1 Screen Intent

Teach the user the product model before they add content.

### 7.2 Message To Communicate

The app is built around stays and travel segments, not repeated days.

### 7.3 Required Content

Must include:
- trip title
- central explanatory visual
- one primary CTA: `Add first stay`
- short supporting text explaining the place-first model

### 7.4 Empty-State Wireframe

```text
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ Sample Trip                                                                          │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│                       Plan by destination stays, not repeated days                   │
│                                                                                      │
│        [ DESTINATION A ] ----> [ DESTINATION B ] ----> [ DESTINATION C ]             │
│                                                                                      │
│   Each stay is a time span. Each stay can contain its own internal itinerary.        │
│                                                                                      │
│                              [+ Add first stay]                                      │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### 7.5 Design AI Prompt Block

```text
Design the empty state for a place-first travel planner. This is the global itinerary screen before any destinations have been added. The empty state should teach the product model: users plan major destination stays connected by travel segments, not a repeated list of days.

Use a centered explanatory illustration or schematic showing 3 destination blocks connected in sequence. Include a strong primary button labeled Add first stay. Keep the screen clean, structured, and elegant. Avoid generic empty dashboard styling.
```

---

## 8. Screen 3: Global Itinerary Selection / Edit State

### 8.1 Screen Intent

Show how editing works after the user selects a stay or connector.

### 8.2 Required Difference From Screen 1

This screen should clearly show:
- a selected stay or travel connector
- an inspector or bottom drawer with editable metadata
- stronger map highlight

### 8.3 If A Stay Is Selected

Show:
- date span
- arrival/departure day part
- lodging area
- completion summary
- button to open stay detail

### 8.4 If A Connector Is Selected

Show:
- transport mode
- duration
- notes
- station / airport metadata
- booking reference

### 8.5 Design AI Prompt Block

```text
Design a desktop global itinerary editing state for a place-first travel planner. Show the same 3-column layout as the main global itinerary view, but with one selected travel connector or selected stay. Include a contextual editor in a bottom drawer or right-side inspector. The edit panel should feel integrated into the planning workflow, not like a separate form page. The screen should make direct manipulation and map synchronization obvious.
```

---

## 9. Screen 4: Stay Detail Desktop

### 9.1 Screen Intent

This screen is used to plan one major destination internally.

The user should be able to:
- assign places to days
- assign them to morning, afternoon, evening
- order multiple places within a day part
- review the local route on the map
- keep unscheduled candidates visible

### 9.2 Primary User Tasks

- add a new place to the stay
- move a place from unscheduled into a day part
- reorder places in a lane
- move a place to another day or day part
- focus one day
- review route logic on the map

### 9.3 Information Hierarchy

Priority 1:
- day structure
- visit item order
- map route

Priority 2:
- unscheduled items
- district labels
- soft duration hints

Priority 3:
- notes
- reservations
- suggestions

### 9.4 Layout Specification

Desktop layout should also be 3 columns:
- left day navigation and unscheduled pool
- center day board
- right local map

Recommended proportions:
- left column: 260px to 300px
- center column: 640px to 760px
- right column: 360px to 440px

### 9.5 Region Breakdown

#### Region A: Stay Header

Must include:
- breadcrumb
- destination name
- stay span
- nights count
- view switcher

Optional:
- lodging summary
- notes shortcut
- reservation count

#### Region B: Day Navigator

Must include one row per day in the stay.

Each row should include:
- date
- edge-day note if arrival or departure changes usable time
- number of scheduled items
- selected state

#### Region C: Unscheduled Pool

Must include:
- small search field
- candidate places
- tag or district hints where useful

Important framing:
- unscheduled places are not a problem state
- they are a working research pool

#### Region D: Day Board

Must include one section per day.

Each day section contains:
- Morning lane
- Afternoon lane
- Evening lane

Important rule:
- each lane can contain multiple visit items
- order is required
- exact time slots are not required

#### Region E: Local Map

Must include:
- all scheduled places in the stay
- current selected day route emphasized
- unscheduled places as subdued markers
- filters for selected day vs all days

### 9.6 Day Card Specification

Each day card should include:
- date header
- item count or density summary
- 3 distinct lanes

Suggested pattern:

```text
May 4
Morning: [ Place A ] [ Place B ]
Afternoon: [ Place C ] [ Place D ] [ Place E ]
Evening: [ Place F ]
```

### 9.7 Visit Card Specification

Each visit card should include:
- place name
- type or category
- district / area
- optional soft duration
- note or booking badge if present

The visit card should be clearly smaller and lighter than a major stay block.

### 9.8 Interaction Requirements

The design must imply:
- drag from unscheduled into a lane
- reorder inside a lane
- move across lanes
- select a day and filter the map
- click a visit card and show details

### 9.9 Required States

The design must support:
- default stay view
- selected day view
- selected visit card view
- drag-over lane state
- suggestion state
- overloaded day state

### 9.10 Desktop Wireframe Reference

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Trip > Destination A                         May 3 evening -> May 7 afternoon   [Global] [Stay*] [Day]    │
├───────────────────────┬───────────────────────────────────────────────────────────────┬──────────────────────┤
│ DAYS                  │ SUB-ITINERARY BOARD                                          │ LOCAL MAP            │
│ May 3                 │ May 3                                                         │ selected day route   │
│ May 4 *               │ Morning: [ Place A ] [ Place B ]                             │ unscheduled pins     │
│ May 5                 │ Afternoon: [ Place C ] [ Place D ] [ Place E ]               │ filters              │
│ May 6                 │ Evening: [ Place F ]                                         │                      │
│ May 7                 │                                                               │                      │
│                       │ May 5                                                         │                      │
│ Unscheduled           │ Morning: [ Place G ]                                          │                      │
│ [ Place H ]           │ Afternoon: [ Place I ] [ Place J ]                           │                      │
│ [ Place I ]           │ Evening: [ Place K ]                                         │                      │
└───────────────────────┴───────────────────────────────────────────────────────────────┴──────────────────────┘
```

### 9.11 Design AI Prompt Block

```text
Design a desktop stay-detail screen for a place-first travel planner. The user has already selected one major destination stay and is now planning the internal itinerary inside it.

Use a 3-column layout:
- left column for day navigation and unscheduled candidate places
- large center board for the day-by-day itinerary
- right column for a synchronized local map

The central planning area must show one card or section per day. Each day must have 3 lanes: morning, afternoon, evening. Multiple place cards can exist within the same day part, and order matters. Do not use exact hourly scheduling.

The left side should also include an unscheduled pool of places that the user can drag into the itinerary. The right map should show scheduled places and highlight the selected day route.

The interface must feel like a route-aware itinerary editor, not a calendar and not a kanban board for tasks. The user is sequencing attractions and neighborhoods inside a city-scale stay.
```

---

## 10. Screen 5: Stay Detail Drag State

### 10.1 Screen Intent

Show the direct-manipulation behavior during scheduling.

### 10.2 Required Visual Signals

Must show:
- dragged visit card lifted
- target lane highlighted
- insertion indicator visible
- map preview conceptually updated

### 10.3 Design AI Prompt Block

```text
Design the drag-and-drop state of a stay-detail itinerary screen in a place-first travel planner. Show one place card being dragged from an unscheduled pool into an afternoon lane for a selected day. The UI must clearly communicate the drop target, insertion point, and updated route logic. Make the interaction feel precise, high-confidence, and spatial.
```

---

## 11. Screen 6: Single-Day Desktop

### 11.1 Screen Intent

This is the focused review view for one day.

It is not the main planning surface. It is a clean, readable day slice.

### 11.2 Primary User Tasks

- understand today's order
- isolate one day on the map
- review notes or reservations
- perform light edits only

### 11.3 Layout Specification

Two-column layout:
- large day map
- right-side day plan list

Recommended proportions:
- map: 58% to 65%
- list: 35% to 42%

### 11.4 Required Content

Map column:
- ordered route
- stop numbers
- map controls

Plan column:
- day title
- morning group
- afternoon group
- evening group
- quick notes
- next action area

### 11.5 Interaction Requirements

The design should imply:
- filter by one day part
- open notes
- reorder lightly if necessary
- switch back to stay view

### 11.6 Design AI Prompt Block

```text
Design a desktop single-day itinerary view for a place-first travel planner. Use a 2-column layout with a large map on the left and a grouped plan list on the right. The right side should group places by morning, afternoon, and evening. The map should show the day's route in order with numbered stops.

This screen should feel calmer and more readable than the main planning views. It is for reviewing one specific day, not building the full trip structure. Maintain the same visual language as the other screens, but reduce density slightly and prioritize clarity.
```

---

## 12. Screen 7: Places Library Desktop

### 12.1 Screen Intent

Hold researched places before or beyond scheduling.

### 12.2 Primary User Tasks

- browse researched places
- filter by status, tag, or stay
- add a place to a specific stay or day part
- keep alternatives without cluttering the active itinerary

### 12.3 Layout Specification

3-column layout:
- left filters
- central place list
- right detail panel

### 12.4 Required Content

Left:
- status filters
- tag filters
- scope filters

Center:
- searchable list of places
- status chips
- tags

Right:
- place detail
- quick schedule action
- mini map

### 12.5 Design AI Prompt Block

```text
Design a desktop places-library screen for a place-first travel planner used by expert trip planners. The screen should help users manage researched places that may be scheduled later. Use a 3-column layout: filters on the left, place list in the center, place details on the right.

The interface should support statuses like unscheduled, scheduled, maybe, and discarded. It should also support tags such as rainy day, evening, food, scenic, reservation needed. The design must feel like a structured planning library, not a generic bookmarks page.
```

---

## 13. Screen 8: Today Mobile

### 13.1 Screen Intent

This is the day-of-use mobile landing screen.

### 13.2 Primary User Tasks

- understand today's plan instantly
- see what comes next
- switch to map
- read notes

### 13.3 Layout Specification

Vertical mobile layout:
- top context header
- local tabs: plan / map / notes
- grouped day content
- next-stop module
- bottom navigation

### 13.4 Required Content

Header:
- destination name
- date

Grouped plan:
- morning
- afternoon
- evening

Next-stop module:
- next place
- basic route context

Bottom nav:
- Today
- Trip
- Map
- Places

### 13.5 Design AI Prompt Block

```text
Design a mobile Today screen for a place-first travel planner. This is the main day-of-use mobile screen. It should show the current destination, the current date, and the day's plan grouped into morning, afternoon, and evening. Include a small next-stop module and bottom navigation with Today, Trip, Map, and Places.

This screen should be optimized for reading and quick reference, not complex editing. Use large tap targets, strong grouping, and a calm, structured layout.
```

---

## 14. Screen 9: Trip Sequence Mobile

### 14.1 Screen Intent

Show the whole trip structure on mobile in a compact, readable way.

### 14.2 Primary User Tasks

- review the sequence of stays
- see where the current day sits in the larger trip
- jump to a stay

### 14.3 Layout Specification

Vertical stacked-card layout.

Each stay card should include:
- destination name
- date span
- nights count

Between cards show:
- travel mode label

### 14.4 Design AI Prompt Block

```text
Design a mobile trip-overview screen for a place-first travel planner. Show the trip as a vertical sequence of major destination stay cards connected by travel labels like train or flight. Each stay card should display a destination name, date span, and number of nights.

The screen must clearly communicate sequence and duration without trying to reproduce the full desktop timeline editor. Keep it clean, compact, and highly legible.
```

---

## 15. Screen 10: Mobile Map View

### 15.1 Screen Intent

Provide the mobile route view for today or the selected stay.

### 15.2 Primary User Tasks

- view route order visually
- inspect next destination
- switch between all-day and current-day-part filters

### 15.3 Required Content

Must include:
- full-screen map
- numbered route stops
- bottom sheet with current filtered list
- simple filter controls

### 15.4 Design AI Prompt Block

```text
Design a mobile full-screen map view for a place-first travel planner. The map should show the current day's route as numbered stops connected in order. Include a bottom sheet listing the currently visible places, and simple controls to switch between full day and a specific day part such as afternoon.

This screen should feel like a travel-use tool, not a generic map app. It should clearly belong to the same product as the itinerary planning screens.
```

---

## 16. Global Component Specs For Design AI

Use these component definitions across all screen prompts.

### 16.1 Stay Block

Major top-level object.

Include:
- destination name
- date span
- nights count
- completion or density summary

Looks like:
- wide span block
- stronger presence than normal cards
- editable edges implied

### 16.2 Travel Connector

Top-level linking object.

Include:
- mode icon
- optional duration

Looks like:
- connector between stay spans
- distinct from both stay blocks and map route

### 16.3 Visit Card

Internal stay object.

Include:
- place name
- type
- district
- optional duration hint

Looks like:
- compact card or pill-card
- clearly smaller than a stay block

### 16.4 Day Card

Contains:
- date
- 3 day-part lanes
- item count

### 16.5 Day-Part Lane

Contains:
- label
- ordered visit cards
- droppable empty state

### 16.6 Map Marker Types

Use distinct marker types for:
- major stay
- scheduled visit item
- unscheduled candidate place
- selected item

---

## 17. Required State Set

Any serious design generation should account for these states.

### 17.1 Object States

Stay block:
- default
- hover
- selected
- dragging
- warning

Visit card:
- default
- hover
- selected
- dragging
- tentative
- booked
- warning

Travel connector:
- default
- selected
- warning
- missing-data

### 17.2 Screen States

Global itinerary:
- normal
- empty
- selected stay
- selected connector
- drag in progress

Stay detail:
- normal
- selected day
- selected visit item
- drag in progress
- suggestion visible
- overloaded lane

Day view:
- full day
- filtered day part
- note expanded

Mobile:
- today plan tab
- map tab
- trip overview

---

## 18. Prompting Advice For Better AI Output

When prompting a design AI:

Do:
- specify the exact screen
- specify that the product is place-first
- specify that the top level is a span-based timeline
- specify the map is first-class
- specify expert-user density
- mention what should not be used

Do not:
- ask for "a travel planner dashboard" without structure
- ask for "an itinerary app" with no constraints
- ask for multiple screens in one prompt initially
- leave the planning model vague

Better:

```text
Design the desktop global itinerary screen for a place-first, span-based multi-city trip planner used by expert users.
```

Worse:

```text
Design a modern travel planner app.
```

---

## 19. Suggested Prompt Sequence

Use this order:

1. Global Itinerary Desktop
2. Stay Detail Desktop
3. Today Mobile
4. Trip Sequence Mobile
5. Places Library Desktop
6. Editing and drag states

Why:
- it establishes the core model first
- it prevents the AI from defaulting to a day-first interpretation

---

## 20. Master Prompt For The Whole Product

Use this only after generating individual screens first.

```text
Design a coherent interface system for a web-first travel planner used by expert planners organizing long and complex multi-city trips. The product is place-first and span-based, not day-first.

The top-level planning view must show the trip as a sequence of major destination stays on a horizontal timeline subdivided into morning, afternoon, evening. Each stay is a continuous span block with arrival and departure defined by day part. Travel segments connect stays and should be editable. A synchronized map must always be visible on desktop.

Each stay has a nested sub-itinerary view. Inside a stay, the planner organizes many visit items by day, and each day has morning, afternoon, and evening lanes. Multiple visit items can exist inside the same lane, and their order matters more than exact time.

The product also has a single-day review view and mobile review screens. Mobile is optimized more for reviewing and using the plan than creating it.

Design the product with a precise, structured, editorial feel. It should support advanced users and moderate information density. Avoid generic calendar layouts, generic consumer travel app patterns, and basic dashboard styling.
```

---

## 21. Final Clarification

The `Tokyo / Hakone / Osaka` material in the storyboard file is only an example used to illustrate behavior.

The actual product specification is generic and should support:
- any country
- any city
- any trip length
- any transport mix
- any combination of dense urban stays and slower scenic stays

The designer or design AI should treat destination names as interchangeable content placed into a fixed planning model.
