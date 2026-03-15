# Itinerary Planner — Gantt and Kanban Hybrid Specification

> Generated: 2026-03-06
> Purpose: Detailed specification for a split-screen travel planning model combining a macro horizontal Gantt timeline, a micro destination Kanban board, and a picture-in-picture map.
> Audience: Product designer, interaction designer, design AI tool, or engineer translating the concept into interface structure.

---

## 1. Summary

This concept is a more explicitly professional and tool-like version of the travel planner.

It takes the original place-first idea and expresses it in a very strong two-layer layout:

- `Top half`: macro trip structure as a horizontal Gantt chart
- `Bottom half`: micro destination planning as a Kanban board
- `Floating corner`: picture-in-picture map that expands on demand

This approach is especially suited to:
- expert planners
- long multi-city trips
- users who want structural control
- users who think in spans and sequences
- users comfortable with professional software patterns

This approach should feel less like:
- a casual travel app
- a day-by-day diary
- a vacation calendar

And more like:
- an itinerary planning cockpit
- a route-aware scheduling workspace
- a specialized planning instrument

The product should still remain visually legible and elegant. It should not become generic project management software with city names pasted into it.

---

## 2. Core Thesis

The interface is split into two synchronized layers:

### 2.1 Macro Layer

The user plans the overall trip structure using destination bars on a horizontal timeline.

At this level, the user answers:
- Where am I staying?
- For how long?
- In what order?
- How do I move between those destinations?

### 2.2 Micro Layer

The user plans what happens inside the currently selected destination.

At this level, the user answers:
- What am I doing each day inside this destination?
- In which part of the day?
- In what order?
- Which saved places are still unscheduled?

### 2.3 Map Layer

The map acts as a context lens.

It should support:
- quick geographic confirmation without taking over the workspace
- immediate local map feedback for the current selection
- full expansion when the user wants a dedicated map mode

This creates a workflow like:

1. Shape the whole trip in the Gantt chart
2. Click one destination bar
3. Fill the bottom Kanban board with that destination's internal plan
4. Use the PiP map to verify spatial logic
5. Expand the map only when needed

---

## 3. Why This Model Is Strong

This model solves several common issues in itinerary tools.

### 3.1 Solves the repeated-day problem

Instead of:

```text
Day 1 Tokyo
Day 2 Tokyo
Day 3 Hakone
Day 4 Osaka
```

The top half shows:

```text
Tokyo  [======================]
Hakone                       [=======]
Osaka                                 [=============]
```

This makes the trip structure immediately understandable.

### 3.2 Preserves two levels of planning

The user can think globally and locally at the same time.

The top half answers:
- trip architecture

The bottom half answers:
- destination execution

This is a strong fit for advanced users who constantly move between:
- high-level structure
- fine-grained planning

### 3.3 Supports direct manipulation

This concept is very interaction-rich:
- draw stays
- drag bars
- resize bars
- swap bars
- drag places into day-part buckets

That makes the product feel like a planning tool rather than a form-heavy CRUD app.

### 3.4 Keeps the map useful without dominating

A full-time large map can crowd the workspace.

A PiP map:
- keeps geography available
- preserves screen space
- feels dynamic and tactical

This is especially good in a dense, professional layout.

---

## 4. Design Intent

### 4.1 Visual Personality

This interface should feel:
- professional
- high-control
- crisp
- structured
- route-aware
- analytical

It should not feel:
- playful
- social-first
- whimsical
- consumer itinerary lite
- overloaded with decorative travel imagery

### 4.2 Interface Character

The best character reference is not a calendar.

It is closer to:
- timeline software
- planning boards
- sequencing tools

But it must remain travel-native by emphasizing:
- destination names
- travel segments
- day-part semantics
- map relationships

### 4.3 Density Strategy

This layout can support high density because the horizontal split creates strong mental separation.

Recommended behavior:
- top half moderately dense
- bottom half richer in detail
- map kept compact unless expanded

---

## 5. High-Level Layout

The base desktop layout is:

```text
+--------------------------------------------------------------------------------------+
| TOP APP BAR                                                                          |
+--------------------------------------------------------------------------------------+
| MACRO GANTT VIEW                                                                     |
| entire trip timeline, major destination bars, travel gaps, draw interactions         |
+--------------------------------------------------------------------------------------+
| MICRO KANBAN VIEW                                                                    |
| selected destination days, each day split into morning / afternoon / evening         |
| inbox of places on the side, map PiP floating in one corner                          |
+--------------------------------------------------------------------------------------+
```

More explicit version:

```text
+-------------------------------------------------------------------------------------------------------------+
| Trip Name                                  [Global] [Places] [Bookings] [Share] [Search]                  |
+-------------------------------------------------------------------------------------------------------------+
| MACRO GANTT                                                                                                 |
|         Oct 1 | Oct 2 | Oct 3 | Oct 4 | Oct 5 | Oct 6 | Oct 7 | Oct 8 | Oct 9 | Oct 10                   |
| Tokyo   [==========================]                                                                         |
| Travel                            (Train)                                                                    |
| Hakone                                   [==========]                                                        |
| Travel                                               (Train)                                                 |
| Osaka                                                   [=============================]                      |
+-------------------------------------------------------------------------------------------------------------+
| MICRO KANBAN: Tokyo                                                  [Map PiP]                             |
| [Inbox]   [Oct 1]           [Oct 2]           [Oct 3]           [Oct 4]                                    |
| Places    Morning           Morning           Morning           Morning                                     |
| Tower     Afternoon         Afternoon         Afternoon         Afternoon                                   |
| Shrine    Evening           Evening           Evening           Evening                                     |
+-------------------------------------------------------------------------------------------------------------+
```

---

## 6. Layout Anatomy

### 6.1 Global Shell

The shell should include:
- top app bar
- macro planning panel
- splitter
- micro planning panel
- floating PiP map

### 6.2 Vertical Proportions

On desktop:
- app bar: 64px to 72px
- macro Gantt: 34% to 42% of remaining height
- micro Kanban: 58% to 66% of remaining height

This should be adjustable with a draggable divider.

Recommended default:
- macro area slightly smaller than micro area
- enough height in top area for bars and travel lanes
- enough height in bottom area for multiple day columns and vertical buckets

### 6.3 Width Strategy

Inside the micro section:
- left inbox rail: 220px to 280px
- main Kanban area: flexible primary width
- PiP map floats above the lower right, not occupying fixed layout width by default

### 6.4 Splitter Behavior

The divider between macro and micro should:
- be draggable
- visually suggest that both areas are coordinated
- not feel like two unrelated apps stacked together

The splitter can include:
- grip handle
- selected destination summary
- quick toggle for collapsing one half

---

## 7. Macro Gantt View

### 7.1 Purpose

The top half is the trip structure editor.

It is where the user:
- adds major destinations
- controls duration
- manages order
- understands trip flow

### 7.2 Mental Model

Each major destination is represented as a horizontal bar.

Bars occupy spans of time.
Bars sit on rows.
Travel exists in the gaps between bars.

There are two different ways to represent travel:

1. `Implicit gap model`
   The visual gap between stays implies travel time.

2. `Dedicated travel row model`
   A travel marker or segment appears between bars or on its own row.

This concept should favor a hybrid:
- the gap carries visual meaning
- the transport marker clarifies what happens in that gap

### 7.3 Grid Structure

The macro grid should contain:
- date header row
- day-part subdivisions
- rows for destinations
- optional rows for travel segments

At minimum, each day should visually contain:
- Morning
- Afternoon
- Evening

These can be shown either:
- explicitly as sub-divisions within each day
- implicitly as snap markers

### 7.4 Macro Gantt Wireframe

```text
+-------------------------------------------------------------------------------------------------------------+
| MACRO GANTT VIEW                                                                                            |
|         Oct 1        Oct 2        Oct 3        Oct 4        Oct 5        Oct 6        Oct 7                |
|         M A E        M A E        M A E        M A E        M A E        M A E        M A E                |
| Row 1    [ Tokyo ============================ ]                                                             |
| Row 2                                          ( Train to Hakone )                                          |
| Row 3                                               [ Hakone ======= ]                                      |
| Row 4                                                               ( Train to Osaka )                     |
| Row 5                                                                    [ Osaka ======================= ]  |
| Row 6    [ Ghost Bar ................................................................. ]                    |
+-------------------------------------------------------------------------------------------------------------+
```

### 7.5 What The User Must Perceive Immediately

At a glance, the user should understand:
- trip start and end
- which cities are long stays
- which are short transitions
- where travel happens
- where free space exists

### 7.6 Rows

Possible row logic:

#### Option A: One row per destination

Each destination gets its own row.

Advantages:
- easy separation
- low collision complexity

Disadvantages:
- sequence can feel less linear

#### Option B: Single master trip row

All stays exist on one main row in sequence.

Advantages:
- strongest sense of trip flow

Disadvantages:
- less room for new interactions like draw-on-canvas per row

#### Option C: Mixed lane system

The trip has a primary travel lane, but also allocates rows for destination blocks and travel annotations.

Recommended for this concept:
- mixed lane system

Why:
- it preserves clarity
- it supports ghost bars and painting
- it feels professional

### 7.7 Destination Bar Anatomy

Each destination bar should include:
- destination name
- date span
- arrival/departure cues
- optional nights count
- selection handle area
- left resize handle
- right resize handle

The center region of the bar is for:
- drag move
- open micro view

The edges of the bar are for:
- resize

Visual example:

```text
<| TOKYO                        May 1 E -> May 5 A                        |>
```

Where:
- `<|` is the left resize handle
- `|>` is the right resize handle

### 7.8 Bar States

The destination bar must support:
- default
- hover
- selected
- dragging
- resizing
- warning overlap
- locked or confirmed

### 7.9 Travel Representation

Travel can be displayed as:
- a labeled gap marker between bars
- a transport pill floating in the gap
- a dedicated travel annotation row

Recommended:
- a transport chip centered inside the gap

Example:

```text
[ TOKYO ========= ]   (Train 2h 20m)   [ HAKONE ===== ]
```

### 7.10 Macro View Controls

Recommended controls:
- zoom timeline
- fit entire trip
- collapse micro panel
- add stay
- add travel marker
- toggle day-part grid density

Optional controls:
- show nights
- show transport durations
- show overlap warnings

---

## 8. Macro Interactions

### 8.1 Add a Main Destination

This model supports several strong interactions.

#### Interaction A: Ghost Bar

At the end of the macro sequence there is always a semi-transparent ghost bar.

Behavior:
- user clicks it
- types a city or destination name
- confirms
- ghost becomes a real destination bar
- a new ghost appears after it

Benefits:
- low-friction addition
- discoverable
- keeps creation inside the canvas

#### Interaction B: Canvas Draw

The user clicks and drags on an empty row or grid region to paint a stay span.

Behavior:
- drag defines length
- modal or inline field asks for destination name
- bar is created with the selected duration

Benefits:
- highly tactile
- excellent fit for expert users
- immediately expresses the importance of duration

#### Interaction C: Add Button

For safety and discoverability there should still be:
- `+ Add Stay`

Recommended:
- support all 3, but make Ghost Bar and Canvas Draw the signature interactions

### 8.2 Move and Shift

The user drags the center of a destination bar to move it in time.

Expected behavior:
- the bar shifts across the grid
- it snaps by day part
- travel gaps update visually
- micro board keeps the destination selected

Potential outcomes:
- valid shift
- collision with another stay
- near collision warning

### 8.3 Swap Behavior

When one bar is dragged over another, two possible models exist.

#### Model A: Automatic Swap

Dragging Osaka over Tokyo causes the two bars to flip positions.

Pros:
- efficient
- smooth for advanced users

Cons:
- may be surprising if not visually clear

#### Model B: Overlap Warning

Dragging Osaka over Tokyo causes both bars to show overlap conflict.

Pros:
- predictable
- explicit

Cons:
- more steps to reorganize

#### Recommended Hybrid

Use overlap warning by default, but allow explicit swap on drop over a swap target.

This is safer and more professional.

### 8.4 Resize

Every destination bar should have left and right handles.

Behavior:
- dragging a handle changes duration
- snapping occurs to Morning / Afternoon / Evening
- date label updates live
- bottom Kanban updates immediately

Critical behavior:
- if a stay gains time, new day columns appear in the Kanban
- if a stay loses time, day columns shrink or disappear
- removed day columns should trigger a confirmation if they contain scheduled items

### 8.5 Paint Interaction

This is one of the strongest ideas in the concept.

The user should be able to paint a stay directly on the timeline.

Recommended flow:
1. User drags across empty grid cells
2. A translucent bar appears during drag
3. On mouse up, inline prompt asks for destination name
4. User enters the name
5. Bar becomes real and selected
6. Micro view below loads an empty itinerary for that stay

This should feel like:
- booking space in the trip
- carving out a destination window

### 8.6 Selection and Micro Transition

Clicking a destination bar must do 3 things instantly:
- select the bar visually in the top half
- populate the bottom half with the selected destination's Kanban board
- update the PiP map to the selected destination context

This transition is the heart of the concept.

If it feels slow or disconnected, the whole model becomes weak.

---

## 9. Micro Kanban View

### 9.1 Purpose

The bottom half is the local itinerary planner for the selected destination.

This is where the user:
- plans each day
- places attractions and neighborhoods
- sequences items by day part
- works from a saved-place inbox

### 9.2 Mental Model

The Kanban board is organized by day columns.

Each day column contains 3 distinct stacked buckets:
- Morning
- Afternoon
- Evening

The user drags place cards from the inbox into those buckets.

Important:
- this is not a task board
- this is a destination itinerary board

The cards represent:
- attractions
- neighborhoods
- restaurants
- walks
- viewpoints

### 9.3 Micro Kanban Wireframe

```text
+-------------------------------------------------------------------------------------------------------------+
| MICRO KANBAN VIEW: Tokyo                                                                        +---------+ |
| [Inbox]                                                                                         |  Map    | |
| Tokyo Tower                                                                                     |  PiP    | |
| Meiji Shrine                                                                                    |         | |
| Shibuya                                                                                         +---------+ |
|                                                                                                               |
| [Day 1: Oct 1]          [Day 2: Oct 2]          [Day 3: Oct 3]          [Day 4: Oct 4]                      |
| Morning                 Morning                 Morning                 Morning                               |
| (empty)                 :: Meiji Shrine         :: Ueno Park            :: Tsukiji                           |
|                                                                                                               |
| Afternoon               Afternoon               Afternoon               Afternoon                             |
| :: Arrive / Hotel       :: Shibuya              :: Asakusa              :: Tokyo Tower                       |
|                                                                                                               |
| Evening                 Evening                 Evening                 Evening                               |
| :: Shinjuku             :: Roppongi             :: Sumida walk          :: Ginza dinner                      |
+-------------------------------------------------------------------------------------------------------------+
```

### 9.4 What The User Must Understand Immediately

At a glance, the user should understand:
- how many days exist in the selected destination
- which days are empty or overloaded
- which places are unscheduled
- the order inside each day part

### 9.5 Column Generation

This is a crucial behavior.

The day columns should be generated directly from the selected destination bar in the macro view.

If the selected stay spans:
- 4 days and 2 day-parts on edges

Then the micro board should create the correct number of columns and respect edge-day availability.

Example:

If the stay is:
- arrive Oct 1 afternoon
- leave Oct 4 morning

Then the board should show:
- Oct 1 with only Afternoon and Evening enabled
- Oct 2 full
- Oct 3 full
- Oct 4 Morning only

Disabled buckets should be visually present or intentionally suppressed, but never misleading.

### 9.6 Day Column Anatomy

Each day column should include:
- date label
- optional weekday
- summary count
- three stacked day-part sections

Visual example:

```text
[ Day 2: Oct 2 ]
Morning
  :: Meiji Shrine
Afternoon
  :: Shibuya
Evening
  :: Roppongi
```

### 9.7 Bucket Anatomy

Each day-part bucket should include:
- label
- drop zone
- ordered place cards
- empty state when applicable

When empty:
- bucket should remain clearly usable
- not collapse into invisibility

### 9.8 Place Card Anatomy

Each place card should include:
- place name
- type or area label
- optional note badge
- optional duration hint

Suggested compact style:

```text
:: Meiji Shrine
```

Expanded style:

```text
+--------------------+
| Meiji Shrine       |
| Shrine · West Side |
| 1-2h               |
+--------------------+
```

### 9.9 Inbox Anatomy

The inbox is a left-side rail inside the micro area.

It should include:
- search field
- saved places list
- filters or tags
- unscheduled candidate count

The inbox should behave like:
- a staging area
- a place research shelf

Not:
- a warning list
- an error state

---

## 10. Micro Interactions

### 10.1 Populate by Selection

When the user selects `Tokyo` in the macro Gantt:
- micro board title updates to `Tokyo`
- day columns appear based on the selected stay span
- inbox filters to Tokyo-relevant places or all unassigned places for that stay
- PiP map focuses on Tokyo

### 10.2 Drag from Inbox

The primary micro interaction:
- drag place from inbox
- drop into day-part bucket

Expected behavior:
- bucket highlights
- insertion line or placeholder appears
- map updates or previews route

### 10.3 Reorder Inside Bucket

Within a bucket:
- cards can be dragged vertically
- order matters
- numbering or route sequence should update

### 10.4 Move Across Buckets

The user can move:
- from Morning to Afternoon
- from one day to another day
- from scheduled back to Inbox

This should be frictionless.

### 10.5 Multi-Card Selection

Optional but strong for expert planners:
- select multiple place cards
- move them together

Useful for:
- shifting a whole neighborhood plan to another day

### 10.6 Resize Propagation

If the macro bar is resized:
- day columns update
- added day creates new empty day column
- removed day triggers migration or warning

This macro-to-micro propagation is one of the most important mechanics in the concept.

### 10.7 Overload Indication

If too many items exist in one bucket:
- bucket gets a soft overload badge
- user is warned, not blocked

Example:

```text
Afternoon  ! Dense
```

### 10.8 Disabled Bucket Logic

Arrival and departure edge cases matter.

If a city starts in the evening:
- Morning bucket for that first day should be disabled or clearly unavailable

If a city ends in the morning:
- Afternoon and Evening buckets for that last day should be disabled

This adds realism and aligns the micro board with macro span logic.

---

## 11. Map PiP System

### 11.1 Concept

The map should behave as a floating picture-in-picture window inside the micro area.

This is not just a decorative mini-map.

It should behave like:
- a tactical geographic preview
- a contextual route lens
- a compact spatial companion

### 11.2 Position

Recommended default:
- bottom right corner of the micro area

Alternative:
- upper right corner of the micro area

Recommended:
- bottom right, because it feels like a tactical utility layer

### 11.3 Default Size

Recommended desktop size:
- 240px to 320px wide
- 160px to 220px tall

It should be large enough to:
- show route shape
- show selection context

But small enough not to kill the Kanban board width.

### 11.4 PiP Contents

Must show:
- current selected destination context
- currently highlighted day column or bucket route
- place markers
- sequence line

Optional:
- current selection details
- fit selected day
- expand button

### 11.5 Expansion

When the user expands the PiP:
- map opens to full-size overlay or dedicated panel mode
- micro board remains visible behind dimmed layer or shifts aside

Expansion options:

#### Option A: Fullscreen overlay

Pros:
- immersive
- strongest map focus

Cons:
- disconnects from Kanban slightly

#### Option B: Split expansion

PiP expands into a full right-side panel while the Kanban remains visible.

Pros:
- preserves workflow continuity

Cons:
- less dramatic

Recommended:
- split expansion on desktop
- fullscreen expansion on mobile or narrow widths

### 11.6 Highlight Logic

The PiP should map:
- the currently selected day column
- or the currently selected bucket
- or the currently selected place card

Recommended hierarchy:
- selected place card overrides day
- selected day overrides whole destination

### 11.7 PiP States

The PiP should support:
- default mini state
- hover / focused
- expanded
- selected-day mode
- selected-place mode

---

## 12. Full Interaction Model

This section defines the most important user actions end to end.

### 12.1 Add a Destination with Ghost Bar

Flow:
1. User sees a ghost bar at the end of the macro view
2. User clicks it
3. Inline city input appears
4. User enters a destination
5. Default duration appears or user paints duration immediately
6. Bar becomes real
7. Micro board loads empty columns for that destination

### 12.2 Add a Destination by Painting

Flow:
1. User clicks and drags across empty timeline cells
2. A translucent bar preview appears
3. On release, destination entry appears inline
4. User confirms
5. Bar is created and selected
6. Micro board opens

### 12.3 Move a Destination

Flow:
1. User grabs center of destination bar
2. Bar lifts and follows cursor
3. Snap guides appear
4. Travel chips reposition
5. On drop, bar settles
6. If collision happens, warning or swap logic appears

### 12.4 Resize a Destination

Flow:
1. User grabs left or right handle
2. Bar edge drags with day-part snap
3. Label updates live
4. Micro board columns update
5. If a day would be removed and contains items, confirmation appears

### 12.5 Select a Destination

Flow:
1. User clicks destination bar
2. Bar becomes selected
3. Micro board title updates
4. Day columns render
5. Inbox filters
6. PiP map focuses

### 12.6 Add a Place into a Bucket

Flow:
1. User drags `Tokyo Tower` from inbox
2. User hovers `Day 4 Afternoon`
3. Bucket highlights
4. Drop placeholder appears
5. User drops
6. Card is inserted
7. PiP map route updates

### 12.7 Move a Scheduled Place

Flow:
1. User drags place from one bucket to another
2. Source bucket compresses
3. Target bucket opens insertion position
4. Route updates

### 12.8 Expand the Map

Flow:
1. User clicks PiP expand
2. Map grows into expanded mode
3. Selected day route is emphasized
4. User can inspect the area
5. User collapses back to PiP

---

## 13. Data Synchronization Rules

This concept only works if macro and micro remain tightly synchronized.

### 13.1 Macro -> Micro

Changing the macro bar changes:
- number of day columns
- availability of edge-day buckets
- selected destination scope

### 13.2 Micro -> Macro

Changing the micro board changes:
- planned-item counts on the destination bar
- density or overload summary on the bar
- completeness indicator

### 13.3 Micro -> Map

Changing the micro board changes:
- displayed route
- selected markers
- highlighted day geometry

### 13.4 Macro -> Map

Changing the macro selection changes:
- destination focus
- travel sequence emphasis

---

## 14. Recommended Component Set

This concept needs a specific component inventory.

### 14.1 Macro Components

- `Trip Timeline Header`
- `Day-Part Grid`
- `Destination Bar`
- `Ghost Bar`
- `Travel Gap Chip`
- `Macro Selection Drawer`
- `Timeline Zoom Control`
- `Overlap Warning Badge`

### 14.2 Micro Components

- `Micro Section Header`
- `Inbox Rail`
- `Inbox Search`
- `Place Card`
- `Day Column`
- `Day-Part Bucket`
- `Bucket Empty State`
- `Overload Indicator`
- `Column Summary Badge`

### 14.3 Map Components

- `PiP Map Window`
- `PiP Expand Toggle`
- `Map Marker`
- `Route Path`
- `Selected Route Highlight`
- `Map Filter Chip`

---

## 15. State Matrix

### 15.1 Destination Bar States

- default
- hover
- selected
- dragging
- resizing
- overlap warning
- locked

### 15.2 Day Column States

- default
- selected
- filtered
- newly added via resize
- edge-day restricted

### 15.3 Bucket States

- empty
- drag-over
- filled
- overloaded
- disabled

### 15.4 Place Card States

- in inbox
- scheduled
- selected
- dragging
- tentative
- booked

### 15.5 PiP Map States

- default
- selected-day
- selected-place
- expanded
- collapsed

---

## 16. Visual Design Guidelines

### 16.1 The Gantt Should Feel Stronger Than Generic PM Software

The top half must not read as:
- a generic resource chart
- a sprint planner

Travel-specific cues should keep it grounded:
- city names
- transport chips
- arrival/departure semantics
- day-part snapping

### 16.2 The Kanban Should Not Look Like Task Management

The bottom half must not read like:
- Trello
- Jira
- generic task columns

Why:
- columns are days, not workflow states
- sections are day parts, not task status
- cards are places, not tasks

### 16.3 The Map Should Feel Instrumental

The PiP map should feel:
- useful
- precise
- quickly accessible

Not:
- ornamental
- too small to matter
- competing with the rest of the layout

### 16.4 Background and Visual Structure

Recommended:
- strong grid structure
- subtle tonal layering between macro and micro sections
- clear divider between planning scales

Avoid:
- flat, blank white screen
- excessive shadows
- excessive card chrome

---

## 17. Responsive Strategy

This concept is strongly desktop-first.

### 17.1 Desktop

The full concept works best on large screens.

Desktop should support:
- simultaneous macro and micro visibility
- PiP map
- drag-rich interactions

### 17.2 Tablet

Tablet can support:
- reduced-height macro area
- horizontally scrollable Kanban
- slightly larger PiP map

### 17.3 Mobile

This exact hybrid does not translate directly to mobile.

On mobile, the split should become mode-based:
- `Trip Timeline`
- `Destination Board`
- `Map`

The desktop split becomes a segmented navigation model on mobile.

Important:
- do not try to cram the whole split-screen concept into one phone screen

---

## 18. Design AI Input Guidance

This section is meant to be directly useful for Figma AI or similar tools.

### 18.1 Global Prompt Summary

Use this before any screen-specific prompt:

```text
Design a web desktop-first travel planner for expert users. The interface combines a macro horizontal Gantt chart on the top half with a micro destination Kanban board on the bottom half. The macro area shows major destination stays as resizable horizontal bars spanning across a trip timeline. The micro area shows the selected destination's internal itinerary as day columns, each split into Morning, Afternoon, Evening buckets. A small floating picture-in-picture map sits in the bottom corner and expands on demand.

The product should feel specialized, professional, spatial, and precise. It should not look like a generic project management app or a generic calendar-based travel app.
```

### 18.2 Prompt: Main Hybrid Desktop Screen

```text
Design a desktop interface for an expert travel planning app using a split-screen hybrid model.

Top half:
- a horizontal macro Gantt chart spanning the whole trip
- destination stays shown as horizontal bars across dates
- day-part snap grid with morning, afternoon, evening
- travel gaps between bars with transport chips
- bars must look draggable and resizable

Bottom half:
- a micro Kanban board for the selected destination
- one column per day inside the selected stay
- each day column contains Morning, Afternoon, Evening sections
- a left-side Inbox rail contains saved places to drag into the board

Map:
- a floating picture-in-picture map in the lower right corner of the micro section
- the map shows the currently selected destination or highlighted day
- it has an expand toggle

The UI should feel highly structured, professional, route-aware, and editor-like. Avoid generic task-board styling and avoid generic calendar styling.
```

### 18.3 Prompt: Destination Bar Interaction State

```text
Design the macro Gantt portion of a travel planner while one destination bar is selected and being resized. Show left and right resize handles, visible day-part snapping, updated dates, and a subtle indication that the micro board below will add or remove day columns as the duration changes.
```

### 18.4 Prompt: Canvas Draw Creation State

```text
Design the state of a travel planner where the user is creating a new major destination by clicking and dragging directly on an empty horizontal timeline grid. Show a translucent painted preview bar, day-part snapping, and an inline destination naming interaction. This should feel tactile, precise, and professional.
```

### 18.5 Prompt: Micro Kanban Drag State

```text
Design the lower half of a travel planner where the user is dragging a saved place card from an Inbox rail into a specific day-part bucket inside a destination Kanban board. The board has day columns and Morning, Afternoon, Evening sections inside each column. Show clear drop feedback, insertion logic, and a small floating map preview in the corner.
```

### 18.6 Prompt: PiP Map Expanded State

```text
Design the expanded map mode of a split-screen travel planning app. The base interface combines a macro Gantt chart on top and a micro destination Kanban board below. A picture-in-picture map from the lower corner has expanded into a larger contextual map panel, highlighting the currently selected day route. Keep the rest of the interface visible enough to preserve context.
```

---

## 19. Detailed AI Constraints

If the design AI tends to drift toward generic software patterns, add these explicit constraints:

```text
Do not design this like Trello.
Do not design this like Jira.
Do not design this like Asana.
Do not design this like a month calendar.
Do not design this like a travel booking site.
Do not make the map decorative.
Do not hide the distinction between major destinations and local places.
Do make the top and bottom halves feel synchronized.
Do make duration editing visually obvious.
Do make drag-and-drop feel central to the concept.
```

---

## 20. Edge Cases to Design

The designer should explicitly consider these cases.

### 20.1 Arrival Mid-Day

If a stay begins in the afternoon:
- first day Morning is disabled
- Afternoon and Evening remain available

### 20.2 Departure Mid-Day

If a stay ends in the morning:
- last day Afternoon and Evening are disabled

### 20.3 Bar Overlap

If one destination bar overlaps another:
- show conflict state
- do not silently destroy data

### 20.4 Kanban With No Planned Places

A selected destination with no scheduled places should still show:
- day columns
- empty buckets
- inbox
- map context

### 20.5 Very Short Stay

A one-evening stay should still render meaningfully.

### 20.6 Long Stay

A 10-day stay should keep the bottom board usable with:
- horizontal scroll
- sticky day headers
- compact bucket spacing

---

## 21. Implementation-Level Logic For Design

This section is not code, but it helps a designer understand how the UI should behave.

### 21.1 Day Column Count

Micro day columns are derived from:
- macro bar start date + day part
- macro bar end date + day part

### 21.2 Bucket Availability

Each day column computes available buckets based on whether it is:
- first day
- middle day
- last day

### 21.3 Conflict Logic

Macro bars can enter one of:
- valid
- near conflict
- direct overlap

### 21.4 Micro Preservation Logic

When resizing removes days:
- preserve planned content where possible
- otherwise prompt to migrate or unschedule affected cards

---

## 22. Best Use Cases

This concept is strongest when:
- the trip is multi-city
- each destination has meaningful internal planning
- the planner wants full structural awareness
- the planner is comfortable with rich direct manipulation

This concept is weaker for:
- extremely casual travelers
- tiny weekend trips
- users wanting only a simple checklist

---

## 23. Final Recommendation

This concept is strong and distinct because it does not merely "add a Kanban under a timeline."

It creates a full planning grammar:
- the macro Gantt defines time and structure
- the micro Kanban defines internal composition
- the PiP map defines spatial feedback

The defining behavior is this:

**selecting, moving, or resizing a destination bar in the top half must immediately and visibly reconfigure the destination planning board in the bottom half.**

That is the core mechanic that makes this feel like a true expert planning tool rather than a collection of separate widgets.

---

## 24. Appendix: Condensed One-Page Prompt

Use this if you want one compact design AI prompt for the whole concept.

```text
Design a web desktop-first travel planning interface for expert users using a Gantt and Kanban hybrid layout.

Top half: a macro horizontal Gantt chart for the entire trip. Major destination stays are shown as horizontal bars spanning dates. Bars can be dragged to move, resized from left and right edges, and snapped to Morning, Afternoon, Evening markers. Gaps between bars represent travel time and contain transport chips like Train or Flight. There is a ghost bar at the end for quickly adding a new destination, and users can also draw a new stay directly on the canvas by dragging across empty timeline cells.

Bottom half: a micro Kanban board for the selected destination. The selected destination from the Gantt populates the lower board with day columns. Each day column contains 3 stacked sections: Morning, Afternoon, Evening. A left sidebar Inbox contains saved places that can be dragged into the day-part buckets. Multiple place cards can exist in the same bucket and their order matters.

Map: a small floating picture-in-picture map sits in the lower right of the micro section. It maps the currently selected day, bucket, or place card. It can expand into a larger contextual map mode.

The interface should feel highly structured, professional, route-aware, precise, and specialized. It should not look like generic project management software, generic Kanban software, or a calendar-based travel app.
```
