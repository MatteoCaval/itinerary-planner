# Itinerary Planner — Expert Planner IA and UI Specification

> Generated: 2026-03-06
> Perspective: Product strategy + interaction design
> Goal: Translate the "place-first, span-based" planning model into a designer-facing specification with detailed layout, interaction, component, and screen guidance.
> Note: good requirements, this is a redesign
> 

---

## 1. What This Document Is

This document defines a travel planner product for expert users planning long, multi-city trips.

It is intentionally opinionated about:
- information architecture
- interaction model
- view hierarchy
- component system
- visual priorities
- responsive behavior
- map behavior

It is intentionally centered on one core product thesis:

**The app should be place-first, not day-first.**

The planner should think in terms of:
- where they are staying
- how long they are staying there
- how they move between major destinations
- what they do inside each destination

The app should not force the planner to understand the trip by scanning a repetitive list like:

```text
Day 1 Tokyo
Day 2 Tokyo
Day 3 Hakone
Day 4 Osaka
Day 5 Osaka
```

Instead, the app should express the trip like this:

```text
[ TOKYO: May 3 E -> May 7 A ] -- train --> [ HAKONE: May 7 E -> May 9 M ] -- train --> [ OSAKA: May 9 A -> May 14 E ]
```

Only after entering `Tokyo` should the planner see the internal day-by-day structure.

---

## 2. The User Problem

The target user is not a casual traveler writing a light weekend plan.

The target user is an expert planner who:
- plans long trips
- plans across multiple cities or major stops
- cares about sequence and context more than exact times
- wants map awareness at all levels
- wants to move plans around fluidly
- may research heavily before scheduling everything
- often thinks in terms like:
  - "arrive Tokyo in the evening"
  - "leave Tokyo on the afternoon of the 7th"
  - "take the train to Hakone"
  - "stay in Hakone until the morning of the 9th"

Most itinerary tools fail because their main model is a daily list.

That creates 3 problems:

1. The global trip structure is hard to parse.
2. Long stays are visually fragmented into repeated days.
3. The relationship between geography and schedule is weak.

The product should solve those 3 issues directly.

---

## 3. Product Thesis

The product should be built around 3 planning levels:

1. `Global itinerary`
   The sequence of major destinations and the travel segments connecting them.
2. `Destination sub-itinerary`
   The internal plan for one major destination.
3. `Single-day execution`
   A simplified view for reviewing or using the plan during the trip.

Each level should have:
- its own layout
- its own density
- its own interaction model
- its own map behavior

The map must be synchronized across all levels, but the meaning of the map changes with the level.

---

## 4. Planning Philosophy

### 4.1 Main planning unit: the Stay

The core object at the top level is a `Stay`.

A stay represents:
- a major destination
- a base of operations
- typically where the traveler sleeps
- a span of time between arrival and departure

Examples:
- Tokyo
- Hakone
- Osaka
- Kyoto
- Lake Como

This is more useful than a day-first model because the stay is how travelers actually describe the trip.

### 4.2 Connector unit: the Travel Segment

Between stays there is a `Travel Segment`.

A travel segment represents:
- the move from one stay to the next
- the transport mode
- duration
- notes
- optionally departure / arrival station or airport

Examples:
- Shinkansen from Tokyo to Odawara
- Limited express train
- Ferry
- Flight
- Drive

### 4.3 Internal planning unit: the Visit Item

Inside a stay, the planner schedules `Visit Items`.

A visit item represents:
- a place
- an area
- an attraction
- a restaurant cluster
- a neighborhood walk
- a museum
- a viewpoint

Examples inside Tokyo:
- Meiji Jingu
- Harajuku
- Shibuya
- Shibuya Sky
- Shinjuku

### 4.4 Time model

The time model is intentionally coarse.

At the global stay level:
- arrival is assigned to a day part
- departure is assigned to a day part
- the span is resized directly on a timeline

At the sub-itinerary level:
- each day has `Morning`, `Afternoon`, `Evening`
- multiple visit items can exist in the same day part
- order matters inside a day part
- exact clock time is optional, not required

This makes the product match the user's actual planning style.

---

## 5. Core Information Model

### 5.1 Trip

The root container.

Fields:
- trip name
- date range
- notes
- travelers
- optional constraints
- collection of stays
- collection of shared place ideas

### 5.2 Stay

The main planning block at the global level.

Fields:
- stay id
- destination name
- coordinates
- arrival date
- arrival day part
- departure date
- departure day part
- lodging summary
- notes
- sub-itinerary status
- optional tags

Derived properties:
- duration in day parts
- number of nights
- internal itinerary completion
- warning states

### 5.3 Travel Segment

The connector between two stays.

Fields:
- origin stay
- destination stay
- mode
- duration estimate
- cost estimate
- notes
- optional booking metadata
- optional route polyline

### 5.4 Visit Item

The internal sub-itinerary item inside a stay.

Fields:
- name
- place type
- coordinates
- neighborhood or district
- duration hint
- day assignment
- day part assignment
- order index
- notes
- reservation metadata
- tags
- status

Possible statuses:
- unscheduled
- scheduled
- tentative
- skipped
- archived

### 5.5 Shared Place / Candidate

This object supports research-heavy workflows.

It exists before the user decides where to place it.

Fields:
- name
- coordinates
- source
- tags
- maybe / must-see / rainy-day / food / evening / backup
- related stay
- scheduling status

---

## 6. Non-Negotiable Product Principles

These are the rules a designer should protect.

### 6.1 Place-first, not day-first

The global view must emphasize destinations and their spans.

### 6.2 Map is always first-class

The map should never feel like an optional secondary screen.

### 6.3 Direct manipulation over forms

The user should drag, resize, reorder, and reassign visually whenever possible.

### 6.4 Progressive detail

The planner must move cleanly between:
- trip
- stay
- day

### 6.5 Sequence matters more than exact times

The interface should emphasize order and grouping, not minute-level scheduling.

### 6.6 Expert density is acceptable

This product can be denser than mainstream consumer travel apps, but density must stay legible and structured.

### 6.7 Suggestions are advisory

The app should suggest geographic clustering, capacity, and backtracking issues, but should not aggressively block expert users.

---

## 7. Overall Application Structure

The app should have one global shell and three primary planning views.

### 7.1 Top-Level Navigation

Recommended top-level trip navigation:
- Overview
- Itinerary
- Places
- Bookings
- Notes

Recommended internal itinerary navigation:
- Global
- Stay
- Day

Recommended breadcrumb structure:

```text
Trips > Japan Spring 2027 > Itinerary > Tokyo > May 4
```

### 7.2 Desktop Shell

Recommended desktop shell zones:
- top app bar
- left trip sidebar
- central main workspace
- right contextual map or inspector
- optional bottom drawer

### 7.3 Mobile Shell

Recommended mobile shell zones:
- top context header
- content area
- tab switcher or segmented control
- bottom navigation
- bottom sheet for secondary details

---

## 8. Primary View System

The product should revolve around the following views:

1. `Global Itinerary`
2. `Destination Sub-Itinerary`
3. `Single-Day Execution`
4. `Places / Candidate Library`

The fourth view is technically supporting, but it is strategically important for advanced planners.

---

## 9. View 1: Global Itinerary

### 9.1 Purpose

This is the main planning surface for shaping the trip.

The user should be able to answer these questions immediately:
- Which major destinations are in the trip?
- In what order?
- How long am I staying in each one?
- When do I arrive and leave?
- How do I move between them?
- Where are they geographically?

### 9.2 Best Visual Metaphor

This view should feel like a `Gantt timeline`, not a calendar.

Why:
- stays are spans
- travel is a connector
- the main actions are move and resize
- the user needs temporal sequence, not a month-grid

### 9.3 Desktop Layout

Recommended 3-column layout:

- Left sidebar: 260px to 320px
- Center timeline canvas: flexible, primary area
- Right map panel: 32% to 40% width

Optional bottom drawer:
- segment details
- notes
- warnings
- transport editing

### 9.4 Screen Wireframe

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Trip: Japan Spring 2027                              [Overview] [Itinerary*] [Places] [Bookings] [Share]   │
├───────────────────────┬───────────────────────────────────────────────────────────────┬──────────────────────┤
│ TRIP SIDEBAR          │ GLOBAL ITINERARY TIMELINE                                    │ MAP                  │
│                       │                                                               │                      │
│ Destinations          │       May 3          May 4          May 5          May 6      │   (1) Tokyo          │
│ 1. Tokyo *            │      M  A  E       M  A  E       M  A  E       M  A  E       │      \               │
│    4 nights           │                                                               │       \              │
│ 2. Hakone             │ [ TOKYO ─────────────────────────────────────────────── ]      │        \             │
│    2 nights           │   arrive: May 3 E                      leave: May 7 A         │         \            │
│ 3. Osaka              │                     ── train ──>                              │        (2) Hakone    │
│    5 nights           │                                    [ HAKONE ───────── ]       │            \         │
│                       │                                      arr: May 7 E             │             \        │
│ Unscheduled           │                                      dep: May 9 M             │              \       │
│ 8 places in Tokyo     │                                                ── train ──>   │             (3) Osaka│
│ 3 places in Osaka     │                                                          [ OSAKA ─────────────── ] │
│                       │                                                               │                      │
│ Warnings              │ Trip row:                                                     │ Filters              │
│ ! Osaka too dense     │ ─────────────────────────────────────────────────────────────  │ [x] Route            │
│ ! 1 long transfer     │                                                               │ [x] Stays            │
│                       │ Day-part grid:                                                │ [ ] Unscheduled      │
│ Quick Add             │ |M|A|E|M|A|E|M|A|E|M|A|E|M|A|E|M|A|E|                         │ [ ] Bookings         │
│ [+ Add Stay]          │                                                               │                      │
│ [+ Add Travel]        │ Bottom drawer:                                                │ Actions              │
│                       │ Tokyo selected: lodging: Shinjuku | 23 items | completion 70% │ [Fit Trip]           │
│                       │                                                               │ [Zoom to Stay]       │
└───────────────────────┴───────────────────────────────────────────────────────────────┴──────────────────────┘
```

### 9.5 Layout Zones

#### Left Sidebar

Purpose:
- destination sequence
- unscheduled counts
- quick warnings
- add actions
- outline orientation

Contents:
- list of stays in order
- small date spans
- nights count
- internal itinerary completion state
- quick warning indicators
- unscheduled item counts by stay

#### Center Timeline

Purpose:
- drag and resize major trip structure
- visualize time spans
- edit sequence
- inspect duration and travel

Contents:
- date headers
- day-part subdivisions
- stay blocks
- travel connectors
- selection highlights
- optional capacity indicators

#### Right Map

Purpose:
- visualize route at trip scale
- reinforce geography
- show ordering
- show total distance flow

Contents:
- major destination pins
- connector paths
- selected segment highlight
- map filters
- fit controls

### 9.6 Key Components

#### Stay Block

Should display:
- destination name
- stay span in plain language
- arrival and departure day-part markers
- nights count
- lodging or base area summary
- internal completion summary
- warning state when applicable

Suggested visual treatment:
- rounded rectangle
- medium fill or tinted surface
- clear label hierarchy
- one color family per stay category or region
- stronger border when selected

States:
- default
- hover
- selected
- dragging
- warning
- collapsed

#### Travel Connector

Should display:
- transport icon
- transport label
- optional duration
- optional mode color

Should support:
- click to edit
- hover to highlight route on map
- warning state for long or unrealistic transfers

#### Day-Part Grid

The background grid should be subtle but visible.

Requirements:
- three subdivisions per day
- clear but low-noise separators
- useful snapping targets
- no heavy calendar feel

### 9.7 Primary Interactions

#### Create a Stay

Flow:
1. User clicks `Add Stay`.
2. Search modal or inline search opens.
3. User selects a city or destination.
4. A new stay block appears with default span.
5. User drags left and right edges to set duration.
6. User chooses or edits arrival and departure day parts.
7. The map updates.

#### Reorder Stays

Flow:
1. User drags a stay block horizontally.
2. The timeline shows insertion feedback.
3. Travel connectors animate into new sequence.
4. Map route updates instantly.
5. Conflicting transport assumptions are flagged, not destroyed.

#### Resize Stay Duration

Flow:
1. User drags left or right resize handle.
2. Block snaps by day part.
3. Stay summary updates live.
4. Travel segment positions update live.
5. Warnings appear if downstream structure becomes too tight.

#### Edit Travel Segment

Flow:
1. User clicks the connector.
2. Bottom drawer or side panel opens.
3. User selects transport mode.
4. Optional duration, notes, station, booking metadata appear.
5. Map route color or line style updates.

### 9.8 Warnings and Suggestions

This level should support soft planning warnings:
- very short stay between long travel segments
- long transfer likely consuming most of a day part
- major gap between selected transport mode and distance
- no sub-itinerary built yet for a long stay
- high density warning for a stay with too many internal visit items

These must be advisory, not blocking.

### 9.9 Empty and Transitional States

When no stays exist:
- show one dominant empty-state illustration or schematic
- explain the place-first planning model
- give one CTA: `Add first stay`

When one stay exists but no travel:
- show it as a valid trip in progress
- prompt with `Add next destination`

### 9.10 Mobile Adaptation

Mobile should not try to show the full timeline editor.

Instead, mobile should show a simplified trip sequence:
- stacked stay cards
- travel labels between them
- quick map access
- read-first behavior

Wireframe:

```text
┌──────────────────────────────┐
│ Japan Spring 2027            │
│ [Overview] [Itinerary*]      │
├──────────────────────────────┤
│ MAIN ITINERARY               │
│                              │
│ ┌──────────────────────────┐ │
│ │ TOKYO                    │ │
│ │ May 3 E -> May 7 A       │ │
│ │ 4 nights · 23 items      │ │
│ └──────────────────────────┘ │
│            │ train           │
│            ▼                 │
│ ┌──────────────────────────┐ │
│ │ HAKONE                   │ │
│ │ May 7 E -> May 9 M       │ │
│ │ 2 nights · 8 items       │ │
│ └──────────────────────────┘ │
│            │ train           │
│            ▼                 │
│ ┌──────────────────────────┐ │
│ │ OSAKA                    │ │
│ │ May 9 A -> May 14 E      │ │
│ │ 5 nights · 18 items      │ │
│ └──────────────────────────┘ │
│                              │
│ [Open Map]   [+ Add Stay]    │
├──────────────────────────────┤
│ [Today] [Trip*] [Map] [Places]│
└──────────────────────────────┘
```

---

## 10. View 2: Destination Sub-Itinerary

### 10.1 Purpose

This view exists to plan one stay internally.

The user should be able to answer:
- What am I doing inside this destination?
- On which day?
- In which part of the day?
- In what order?
- Does the route make geographic sense?

### 10.2 Best Visual Metaphor

This view should feel like a hybrid between:
- a day board
- a route planner
- an ordered itinerary editor

It should not feel like:
- a calendar app
- a spreadsheet
- a strict agenda

### 10.3 Desktop Layout

Recommended 3-column layout:
- left day navigator
- center planning board
- right stay map

Optional fourth region:
- unscheduled drawer
- candidate list

### 10.4 Screen Wireframe

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Trip > Tokyo                                      May 3 E -> May 7 A   4 nights   [Global] [Stay*] [Day]   │
├───────────────────────┬───────────────────────────────────────────────────────────────┬──────────────────────┤
│ DAY NAVIGATOR         │ TOKYO SUB-ITINERARY BOARD                                     │ TOKYO MAP            │
│                       │                                                               │                      │
│ * May 3               │ ┌───────────────────────────────────────────────────────────┐ │   (1) Shibuya        │
│   arrive evening      │ │ May 3                                                    │ │      •              │
│   1 item              │ │ M: ─────────────                                         │ │   (2) Shinjuku      │
│                       │ │ A: ─────────────                                         │ │      •              │
│   May 4               │ │ E: [ Arrive Tokyo ] [ Dinner near hotel ]               │ │   (3) Asakusa       │
│   5 items             │ └───────────────────────────────────────────────────────────┘ │      •              │
│                       │                                                               │                      │
│ * May 4               │ ┌───────────────────────────────────────────────────────────┐ │  Selected Day: May 4 │
│   selected            │ │ May 4                                                    │ │                      │
│   5 items             │ │ M: [ Meiji Jingu ] -> [ Harajuku ]                       │ │     (1)             │
│                       │ │ A: [ Shibuya ] -> [ Shibuya Sky ] -> [ Shinjuku ]        │ │      │              │
│   May 5               │ │ E: [ Omoide Yokocho ]                                    │ │     (2)──(3)        │
│   4 items             │ └───────────────────────────────────────────────────────────┘ │                      │
│                       │                                                               │ Notes                │
│   May 6               │ ┌───────────────────────────────────────────────────────────┐ │ • area grouping good │
│   6 items             │ │ May 5                                                    │ │ • 24 min between 2-3│
│                       │ │ M: [ Ueno Park ] -> [ Tokyo Nat. Museum ]                │ │                      │
│   May 7               │ │ A: [ Asakusa ] -> [ Senso-ji ]                           │ │ Filters              │
│   depart afternoon    │ │ E: [ Sumida walk ]                                       │ │ [x] selected day    │
│   2 items             │ └───────────────────────────────────────────────────────────┘ │ [ ] all days         │
│                       │                                                               │ [x] unscheduled      │
│ UNSCHEDULED           │ ┌───────────────────────────────────────────────────────────┐ │                      │
│ [ Tokyo Tower ]       │ │ May 6                                                    │ │                      │
│ [ TeamLab ]           │ │ M: [ Tsukiji ]                                           │ │                      │
│ [ Ginza ]             │ │ A: [ Tokyo Tower ] -> [ Roppongi Hills ]                 │ │                      │
│                       │ │ E: [ Ginza dinner ]                                      │ │                      │
│ [+ Search places]     │ └───────────────────────────────────────────────────────────┘ │                      │
└───────────────────────┴───────────────────────────────────────────────────────────────┴──────────────────────┘
```

### 10.5 Layout Zones

#### Stay Header

Should show:
- destination name
- full span
- nights count
- lodging area summary
- breadcrumb to return to global view
- view switcher

Optional secondary line:
- weather note
- reservation count
- density summary

#### Day Navigator

Purpose:
- jump quickly across the stay
- show which days are dense or empty
- show current selection

Each day row should include:
- date
- arrival/departure condition if relevant
- number of scheduled items
- warning or completion marker

#### Center Planning Board

Each day should appear as a large card or section.

Each day contains:
- `Morning`
- `Afternoon`
- `Evening`

Each day part should behave like an ordered lane.

Important rule:
- multiple visit items can exist in a single day part
- those items are ordered
- exact minute-based spacing is not required

#### Right Map

The map should focus on the current stay only.

It should support:
- selected day only
- all visible days
- unscheduled places
- route sequence
- travel-time hints

### 10.6 Key Components

#### Day Section

Contains:
- day title
- status summary
- 3 day-part lanes
- optional notes

States:
- expanded
- collapsed
- selected
- warning

#### Day-Part Lane

A lane is the key scheduling surface.

Should show:
- lane label
- drop target state
- sequence of visit items
- lane-level note or hint
- soft density warning when overloaded

Should support:
- drag in
- drag out
- reorder
- multi-select move
- paste or duplicate group

#### Visit Card

Should show:
- place name
- type icon
- area or district
- optional duration hint
- note or booking badge
- travel relation to previous item when useful

Suggested sizes:
- compact for dense view
- expanded on selection

States:
- default
- hover
- selected
- dragging
- tentative
- warning
- booked

#### Unscheduled Pool

This is essential.

Expert planners do not immediately schedule every researched place.

The pool should support:
- drag into any day part
- filter by tag
- sort by district
- quick search
- bulk add

### 10.7 Primary Interactions

#### Add a Place

Flow:
1. User searches from the stay view.
2. Search results return places in or near the current stay.
3. User adds a place.
4. The place lands in `Unscheduled`.
5. User drags it into a day part.

Alternative:
- user drops pin from the map
- app creates a candidate place
- user names or confirms it

#### Reorder Within a Day Part

Flow:
1. User drags `Shibuya Sky` before `Shibuya`.
2. Cards animate.
3. Map route updates instantly.
4. Travel-time hint recomputes.

#### Move Between Day Parts

Flow:
1. User drags `Asakusa` from `May 5 Afternoon` to `May 6 Morning`.
2. The lane shows insertion bar.
3. Day summary counts update.
4. Map redraws.

#### Focus a Day

Flow:
1. User clicks `May 4` in day navigator.
2. Only that day expands.
3. Map emphasizes that day route.
4. Other days stay visible but subdued, or collapse.

### 10.8 Advisory Logic

The system should offer optional smart hints:
- nearby unscheduled places that fit the current day
- high travel spread between two consecutive items
- too many major attractions in one lane
- cluster suggestion by neighborhood
- rainy-day alternative suggestion

These should appear as lightweight hints, not modal interruptions.

### 10.9 Mobile Adaptation

Mobile should keep this view, but simplify it.

Recommended mobile structure:
- day carousel or stacked day list
- one selected day at a time
- map available as a tab
- light editing only

---

## 11. View 3: Single-Day Execution

### 11.1 Purpose

This is the low-friction review view.

It should answer:
- What am I doing today?
- In what order?
- Where are those places?
- What is next?

This view is especially important on mobile during the actual trip.

### 11.2 Design Intent

This screen should feel calmer than the planning views.

Less editing.
Less density.
Higher scannability.
Stronger emphasis on the current route.

### 11.3 Desktop Wireframe

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Trip > Tokyo > May 4                                            [Back to Stay] [Map*] [List] [Notes]       │
├───────────────────────────────────────────────────────────────┬──────────────────────────────────────────────┤
│ DAY MAP                                                       │ DAY PLAN                                     │
│                                                               │                                              │
│                   (1) Meiji Jingu                             │ TOKYO · May 4                                │
│                        │                                      │                                              │
│                        │                                      │ Morning                                      │
│                   (2) Harajuku                                │ 1. Meiji Jingu                              │
│                        │                                      │ 2. Harajuku                                 │
│                        │                                      │                                              │
│                   (3) Shibuya                                 │ Afternoon                                    │
│                        │                                      │ 3. Shibuya                                  │
│                        │                                      │ 4. Shibuya Sky                              │
│                   (4) Shibuya Sky                             │ 5. Shinjuku                                 │
│                        │                                      │                                              │
│                        │                                      │ Evening                                      │
│                   (5) Shinjuku                                │ 6. Omoide Yokocho                           │
│                                                               │                                              │
│                                                               │ Quick Info                                   │
│                                                               │ • broad route, west Tokyo cluster            │
│                                                               │ • light transfer load                        │
│                                                               │ • dinner reservation 19:30 note only         │
│                                                               │                                              │
│                                                               │ Actions                                      │
│                                                               │ [Show only Afternoon] [Reorder] [Open Notes] │
└───────────────────────────────────────────────────────────────┴──────────────────────────────────────────────┘
```

### 11.4 Mobile Wireframe

```text
┌──────────────────────────────┐
│ Tokyo            Tue May 4   │
│ [Plan*] [Map] [Notes]        │
├──────────────────────────────┤
│ TODAY                        │
│                              │
│ Morning                      │
│ 1. Meiji Jingu               │
│ 2. Harajuku                  │
│                              │
│ Afternoon                    │
│ 3. Shibuya                   │
│ 4. Shibuya Sky               │
│ 5. Shinjuku                  │
│                              │
│ Evening                      │
│ 6. Omoide Yokocho            │
│                              │
│ Quick Note                   │
│ Dinner area flexible         │
│                              │
│ Next                         │
│ -> Shibuya                   │
│ 24 min from current stop     │
├──────────────────────────────┤
│ [Today*] [Trip] [Map] [Places]│
└──────────────────────────────┘
```

### 11.5 Mobile Map Tab

```text
┌──────────────────────────────┐
│ Tokyo            Tue May 4   │
│ [Plan] [Map*] [Notes]        │
├──────────────────────────────┤
│            (1)               │
│             │                │
│            (2)               │
│             │                │
│            (3)──(4)          │
│                 │            │
│                (5)           │
│                              │
│ ┌──────────────────────────┐ │
│ │ Afternoon                │ │
│ │ 3. Shibuya               │ │
│ │ 4. Shibuya Sky           │ │
│ │ 5. Shinjuku              │ │
│ └──────────────────────────┘ │
├──────────────────────────────┤
│ [Today] [Trip] [Map*] [Places]│
└──────────────────────────────┘
```

### 11.6 Interaction Rules

This view should support:
- mark item as done or skipped
- move item to later today
- move item to another day part
- open notes
- open reservation reference
- isolate one day part on the map

This view should avoid:
- dense structural editing
- heavy multi-day manipulation
- timeline resizing

---

## 12. View 4: Places / Candidate Library

### 12.1 Purpose

This supports research-first planning.

It lets the planner keep track of places before or outside scheduling.

### 12.2 Why It Matters

Expert planners often:
- collect more places than they will actually visit
- maintain backup options
- keep rainy-day alternatives
- hold restaurant clusters for flexible use
- research by neighborhood before scheduling

Without a candidate library, users are forced to abuse the itinerary as storage.

### 12.3 Wireframe

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Trip > Places Library                                                    [Search] [Filter] [Import Map]     │
├───────────────────────┬───────────────────────────────────────────────────────────────┬──────────────────────┤
│ FILTERS               │ CANDIDATE PLACES                                              │ PLACE DETAIL         │
│                       │                                                               │                      │
│ Status                │ [ Tokyo Tower ]        unscheduled   tag: skyline             │ Tokyo Tower          │
│ [x] Unscheduled       │ [ TeamLab Planets ]   maybe         tag: rainy day           │ museum / landmark    │
│ [x] Scheduled         │ [ Ginza ]             scheduled     tag: evening             │ best: afternoon      │
│ [ ] Discarded         │ [ Senso-ji ]          scheduled     tag: temple              │ est. 1-2h            │
│                       │                                                               │                      │
│ Tags                  │ Selected: TeamLab Planets                                     │ actions              │
│ [x] rainy day         │ notes: tickets needed                                         │ [Add to May 5 A]     │
│ [x] evening           │ nearby: Ginza / Toyosu                                        │ [Keep Unscheduled]   │
│ [ ] food              │                                                               │ [Add Tag]            │
│                       │                                                               │                      │
│ Scope                 │                                                               │ map mini-preview     │
│ [x] Tokyo only        │                                                               │                      │
│ [ ] whole trip        │                                                               │                      │
└───────────────────────┴───────────────────────────────────────────────────────────────┴──────────────────────┘
```

### 12.4 Critical Behaviors

The library should support:
- whole-trip scope
- per-stay scope
- tags
- scheduling status
- quick-add to a specific day part
- map preview
- search and filtering

---

## 13. Detailed Component Inventory

This section is intended for a designer building a component map.

### 13.1 Top App Bar

Contains:
- trip name
- primary navigation
- share/export
- search
- account or collaboration entry point

States:
- desktop expanded
- mobile compact
- sticky

### 13.2 Breadcrumb Header

Contains:
- hierarchical navigation
- current destination or day
- adjacent context

### 13.3 View Switcher

Options:
- Global
- Stay
- Day

Requirements:
- obvious current state
- keyboard accessible
- touch friendly

### 13.4 Timeline Grid

Requirements:
- day headers
- day-part subdivisions
- snap targets
- horizontal scroll support
- zoom support

### 13.5 Stay Block

Content:
- destination name
- span
- arrival/departure markers
- count of nights
- completion strip
- warning badge

States:
- idle
- hover
- active
- selected
- dragging
- invalid drop

### 13.6 Travel Segment Chip

Content:
- icon
- label
- duration
- warning marker if needed

States:
- idle
- hover
- selected
- edited
- warning

### 13.7 Day Card

Content:
- date
- summary
- 3 day-part lanes
- optional notes

### 13.8 Day-Part Lane

Content:
- label
- visit cards
- insertion indicator
- capacity badge or warning

### 13.9 Visit Card

Content:
- name
- icon
- area
- optional duration
- note badge
- reservation badge
- transport relation preview

### 13.10 Map Panel

Controls:
- fit
- filter
- layer options
- day selection
- unscheduled visibility

### 13.11 Inspector Panel

Used for:
- editing travel segments
- editing stay properties
- editing place details

### 13.12 Suggestion Card

Used for:
- nearby candidate suggestion
- route simplification suggestion
- density warning
- rainy-day alternative

### 13.13 Status Badges

Suggested semantic badge set:
- booked
- tentative
- unscheduled
- warning
- complete
- skipped

---

## 14. Interaction Design Rules

### 14.1 Core Rule: Direct Manipulation First

Whenever possible:
- dragging should replace form-based reassignment
- resizing should replace date-edit dialogs
- visual reordering should replace list index editing

### 14.2 Selection Model

Recommended behavior:
- single click selects
- second click opens details
- shift-click or long press enables multi-select

### 14.3 Drag Feedback

During drag:
- source item lifts visually
- target lane or slot highlights
- map preview updates if safe and performant
- insertion marker is obvious

### 14.4 Resize Feedback

During stay resize:
- day parts highlight as snap targets
- live textual summary updates
- travel connectors animate

### 14.5 Cross-Highlighting

This is highly valuable.

When a user:
- hovers a stay, highlight the route and map pin
- hovers a visit card, highlight the corresponding pin
- selects a map pin, reveal and scroll to the relevant card or lane

---

## 15. Map System Specification

The map must be behaviorally different by view level.

### 15.1 Global Map Mode

Should show:
- only major stays
- route between stays
- order numbers
- route mode styling

Should support:
- fit entire trip
- zoom to selected stay
- select travel segment

### 15.2 Stay Map Mode

Should show:
- all visit items in the destination
- selected day route
- unscheduled places in subdued style
- optional heat of density or neighborhood grouping

Should support:
- filter by day
- filter by day part
- show all visible days
- travel-time hint overlays

### 15.3 Day Map Mode

Should show:
- only the selected day
- ordered numbered stops
- route line in exact planned order
- current day-part emphasis if filtered

Should support:
- plan/list toggle
- follow selected item
- quick open in external map service

### 15.4 Map Controls

Recommended controls:
- Fit Trip
- Fit Stay
- Fit Day
- Show Unscheduled
- Show Travel Times
- Show Reservations
- Show Route Labels
- Show All / By Day / By Day Part

### 15.5 Route Styling

Possible visual encodings:
- line color by transport mode
- line weight by hierarchy
- line opacity by selection
- dashed line for tentative or unknown route

### 15.6 Marker Styling

Suggested hierarchy:
- major stay marker: large numbered pin
- visit item marker: medium point with number
- unscheduled place: light outline marker
- selected marker: larger halo and bolder label

---

## 16. Desktop vs Mobile Strategy

The product should not aim for parity in editing complexity.

### 16.1 Desktop Is the Authoring Surface

Desktop should support:
- complex drag and drop
- timeline resizing
- side-by-side map and structure
- deeper density
- large-scale trip manipulation

### 16.2 Mobile Is the Review and Light-Edit Surface

Mobile should support:
- reviewing today
- checking the trip sequence
- seeing the map
- opening notes and bookings
- moving a place lightly if necessary

### 16.3 Mobile Navigation

Recommended bottom tabs:
- Today
- Trip
- Map
- Places

### 16.4 Mobile View Priorities

Priority order:
1. today
2. current stay
3. route map
4. notes and bookings
5. trip sequence
6. light editing

---

## 17. Density and Visual Language

This section gives the designer directional guidance rather than pixel-final prescriptions.

### 17.1 Desired Feel

The product should feel:
- deliberate
- spatial
- editorial
- precise
- high-information

It should not feel:
- toy-like
- generic consumer calendar
- airline-booking sterile
- project-management heavy

### 17.2 Layout Character

Recommended character:
- strong column structure
- visible hierarchy
- compact but breathable cards
- map always integrated
- stable headers

### 17.3 Typography

Recommended hierarchy:
- destination names strong and clear
- dates compact but legible
- labels minimal and disciplined
- small metadata visible but de-emphasized

### 17.4 Color Direction

Recommended color behavior:
- neutral base UI
- controlled accent colors for selected states and transport modes
- avoid oversaturated travel-app colors
- use warning colors sparingly and only for real planning problems

### 17.5 Motion

Motion should support structure:
- drag lift and settle
- timeline connector reflow
- map cross-highlight
- day collapse and expand

Avoid decorative motion unrelated to planning.

---

## 18. Advisory Intelligence

This product can be significantly improved by lightweight planning intelligence.

### 18.1 Good Suggestions

Useful:
- nearby unscheduled places for the current neighborhood
- backtracking warning
- overloaded afternoon warning
- very early departure after a late evening warning
- rain-friendly alternatives
- long transfer consuming half-day warning

### 18.2 Bad Suggestions

Avoid:
- forcing the user into exact hourly scheduling
- auto-rearranging the plan without clear consent
- overconfident travel-time claims
- modal interruptions for minor issues

### 18.3 Suggested Presentation

Suggestion format should be:
- inline
- dismissible
- contextual
- phrased as recommendation, not error

Example:

```text
Suggestion: "Asakusa" and "Ueno Park" fit well together geographically. Add Ueno to May 5 Morning?
```

---

## 19. Example End-to-End Scenario

This section illustrates the intended user experience with the exact planning model discussed.

### 19.1 Global Trip

The planner creates:
- Tokyo: May 3 evening to May 7 afternoon
- Hakone: May 7 evening to May 9 morning
- Osaka: May 9 afternoon to May 14 evening

The global view should make that readable instantly.

### 19.2 Tokyo Internal Plan

Inside Tokyo:
- May 3 evening: arrival and dinner near hotel
- May 4 morning: Meiji Jingu, Harajuku
- May 4 afternoon: Shibuya, Shibuya Sky, Shinjuku
- May 4 evening: Omoide Yokocho

The planner can drag `Shinjuku` to another day if the day feels too dense.

### 19.3 Day-of Use

On the morning of May 4:
- the user opens mobile
- lands on `Today`
- sees Morning / Afternoon / Evening
- sees the route on the map
- checks the next place

That is the ideal handoff from planning to execution.

---

## 20. Designer Deliverables

If a designer were taking this forward, the first deliverables should be:

1. `Global Itinerary Desktop`
2. `Destination Sub-Itinerary Desktop`
3. `Single-Day Desktop`
4. `Today Mobile`
5. `Trip Sequence Mobile`
6. `Places Library Desktop`

Each should be designed in:
- default state
- selected state
- drag state
- empty state
- warning state where relevant

---

## 21. The Central Signature Interaction

If the product has one defining interaction, it should be this:

**A span-based trip timeline with draggable stay blocks and transport connectors.**

This is the clearest expression of the product strategy and the strongest point of differentiation from day-first itinerary tools.

If this interaction is designed well, the rest of the product will feel coherent.

If this interaction is designed poorly, the app will collapse back into being another list-based trip planner.

---

## 22. Final Recommendations

### 22.1 Strong Product Recommendation

Do not compromise the top-level model into a repeated day list.

The global itinerary must remain:
- destination-based
- span-based
- route-aware

### 22.2 Strong UX Recommendation

Keep the separation between:
- `main itinerary`
- `destination sub-itinerary`
- `single day execution`

That separation maps directly to how the user thinks.

### 22.3 Strong Mobile Recommendation

Treat mobile primarily as:
- review
- route use
- plan reference
- light adjustment

Not as the full authoring surface.

---

## 23. Open Product Questions

These should be resolved before high-fidelity design:

1. Should a `Stay` always imply an overnight base, or can it represent a same-day major stop?
2. Should visit items support optional soft durations like `30m`, `1h`, `2h`, or should the model stay purely order-based?
3. Should the product support alternate versions of the same day, such as `sunny` and `rainy` variants?
4. Should bookings live directly inside stays and visit items, or in a separate bookings layer with references?
5. Should travel segments support rich metadata such as station, train number, seat, baggage, and boarding notes?
6. Should collaboration be multi-user live editing, or mostly share-and-review?

---

## 24. Appendix: Condensed Screen Summary

### 24.1 Global Itinerary

Best for:
- shaping the whole trip
- adjusting destination order
- resizing stays
- editing transport between major stops

Primary UI concept:
- Gantt-like stay timeline + synchronized route map

### 24.2 Destination Sub-Itinerary

Best for:
- structuring days inside a city or major stay
- sequencing attractions
- moving items across day parts
- balancing route logic and density

Primary UI concept:
- ordered day-part board + focused local map

### 24.3 Single-Day Execution

Best for:
- checking the current day
- seeing next stops
- reading notes during travel
- light changes on the move

Primary UI concept:
- clean route map + grouped day-part list

### 24.4 Places Library

Best for:
- research-heavy workflows
- backup options
- tags and candidate management
- unscheduled place storage

Primary UI concept:
- filtered library + quick scheduling controls
