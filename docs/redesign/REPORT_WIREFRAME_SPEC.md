# Itinerary Planner — Detailed Wireframe Specification

> Generated: 2026-03-06
> Depends on: [[REPORT_EXPERT_PLANNER_UI_SPEC_NO_TIMELINE]]
> Goal: Give a designer a screen-by-screen, region-by-region specification detailed enough to produce high-fidelity UI without having to infer the core structure.

---

## 1. Scope

This document defines:
- screen inventory
- layout anatomy
- region responsibilities
- responsive behavior
- component states
- interaction states
- wireframe-level content rules

This document does not define:
- final brand styling
- production CSS tokens
- engineering implementation details

It is a bridge between product strategy and high-fidelity interface design.

---

## 2. Screen Inventory

The minimum screen set to design in detail:

1. `Global Itinerary Desktop`
2. `Stay Detail Desktop`
3. `Single-Day Desktop`
4. `Places Library Desktop`
5. `Today Mobile`
6. `Trip Sequence Mobile`

Recommended additional state screens:

7. `Global Itinerary Empty State`
8. `Stay Detail With Drag State`
9. `Travel Segment Editing State`
10. `Place Search Modal`
11. `Map Fullscreen Mobile`
12. `Conflict / Suggestion Presentation`

---

## 3. Shared Layout Rules

### 3.1 Desktop Breakpoint Strategy

Recommended breakpoints:
- `xl`: 1440px and above
- `lg`: 1200px to 1439px
- `md`: 960px to 1199px
- `sm`: 768px to 959px
- `mobile`: 767px and below

### 3.2 Desktop Shell Regions

At `xl`:
- top app bar: 64px to 72px height
- left sidebar: 280px to 320px width
- right map or inspector: 420px to 520px width
- main workspace: flexible

At `lg`:
- sidebar can reduce to 256px
- right panel can reduce to 360px to 420px

At `md`:
- right panel may collapse into a toggleable drawer
- center workspace remains priority

### 3.3 Mobile Shell Regions

Recommended structure:
- top header: 56px to 64px
- local segmented control: 40px to 44px
- bottom nav: 56px to 64px
- bottom sheet: variable height, snap points

### 3.4 Shared Spacing Logic

This product should feel precise, not loose.

Recommended spacing rhythm:
- 4px for tight internal alignment
- 8px for compact group spacing
- 12px for normal component spacing
- 16px for card padding
- 24px for panel spacing

### 3.5 Shared Density Rules

Global rules:
- primary information should always be visible without opening a detail panel
- secondary information can appear as badges, sublines, or on selection
- tertiary information should live in drawers, inspectors, or popovers

---

## 4. Global Itinerary Desktop

### 4.1 Purpose

The planner should be able to understand the entire trip structure in one screen.

### 4.2 Primary Questions This Screen Must Answer

- Where am I staying?
- In what order?
- For how long?
- How do I move between those stays?
- What is under-planned?
- Where are those stays geographically?

### 4.3 Core Layout

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ A. TOP APP BAR                                                                                              │
├───────────────────────┬───────────────────────────────────────────────────────────────┬──────────────────────┤
│ B. LEFT SIDEBAR       │ C. MAIN TIMELINE CANVAS                                      │ D. RIGHT MAP PANEL   │
│                       │                                                               │                      │
│ E. OUTLINE LIST       │ F. DATE HEADER                                                │ G. MAP TOOLBAR       │
│ H. WARNINGS           │ I. DAY-PART GRID                                              │ H. ROUTE MAP         │
│ I. QUICK ACTIONS      │ J. STAY BLOCKS + CONNECTORS                                  │ I. FILTERS           │
│                       │ K. BOTTOM DRAWER / SELECTION DETAIL                           │                      │
└───────────────────────┴───────────────────────────────────────────────────────────────┴──────────────────────┘
```

### 4.4 Region-by-Region Specification

#### A. Top App Bar

Required content:
- trip name
- top-level navigation
- save/share entry
- search
- collaboration/account entry

Optional content:
- undo/redo
- quick-add
- AI or smart planning entry

Rules:
- trip title must remain visible on desktop
- navigation labels should be explicit
- avoid hiding core functions behind a generic menu

#### B. Left Sidebar

Purpose:
- maintain structural orientation
- show trip outline at all times
- show planning health

Required modules:
- destination sequence
- unscheduled counts
- warnings
- quick add

#### C. Main Timeline Canvas

Purpose:
- primary authoring surface

Required capabilities:
- horizontal scrolling
- day-part snapping
- drag reordering
- resize handles
- selection highlight

#### D. Right Map Panel

Purpose:
- global geographic structure

Required capabilities:
- numbered stay markers
- route polylines
- route mode differentiation
- fit actions
- selection sync

#### E. Outline List

Each row must include:
- stay order number
- destination name
- date span or nights summary
- completion summary
- warning badge if present

Optional row actions:
- open stay
- duplicate
- delete

#### F. Date Header

Must include:
- visible calendar date
- clear day-part subdivisions
- sticky behavior while canvas scrolls

#### G. Map Toolbar

Recommended controls:
- fit trip
- fit selected stay
- show/hide route
- show/hide unscheduled
- layer menu

#### H. Warnings

Warnings should be compact and actionable.

Recommended warning patterns:
- `Long transfer on May 7`
- `Osaka has 18 items but only 2 full days planned`
- `Hakone segment missing transport details`

#### I. Quick Actions

Minimum actions:
- `Add Stay`
- `Add Travel`

Optional actions:
- `Duplicate Stay`
- `Auto-distribute draft`

#### J. Stay Blocks and Connectors

Rules:
- a stay block must visually read as one continuous span
- travel connectors must visually read as distinct from the stay blocks
- arrival/departure edges must feel editable

#### K. Bottom Drawer / Selection Detail

Should appear when:
- a stay is selected
- a travel segment is selected
- a warning is clicked

Suggested content for selected stay:
- stay dates
- day-part arrival/departure
- lodging summary
- internal itinerary completion
- link to open stay detail

Suggested content for selected travel segment:
- mode
- duration
- notes
- stations/airports
- booking reference

### 4.5 Exact Information Hierarchy

The screen hierarchy should be:

1. major stays and duration
2. route order and transport
3. trip geography
4. warnings and incompleteness
5. actions and metadata

### 4.6 Stay Block Anatomy

```text
┌──────────────────────────────────────┐
│ TOKYO                                │
│ May 3 E -> May 7 A                   │
│ 4 nights                             │
│ Lodging: Shinjuku                    │
│ 23 items planned        70% complete │
└──────────────────────────────────────┘
```

Required hierarchy:
- line 1: destination name
- line 2: plain-language span
- line 3: stay summary
- line 4: secondary metadata or completion

### 4.7 Stay Block States

#### Default

- medium emphasis
- readable but calm

#### Hover

- stronger border
- route highlight on map

#### Selected

- strongest border or glow
- map pin enlarged
- bottom drawer opens

#### Dragging

- slight lift
- drop shadow
- ghost placeholder remains in original lane

#### Warning

- small warning badge
- not full red block fill

### 4.8 Travel Segment States

#### Default

- visible connector line
- icon centered

#### Hover

- line thickens or brightens
- route path on map highlights

#### Selected

- inspector opens
- mode and metadata shown in detail

#### Warning

- dashed or caution-highlighted

### 4.9 Empty-State Wireframe

```text
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ Japan Spring 2027                                                                    │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│                         Build your trip as stays, not repeated days                  │
│                                                                                      │
│        [ TOKYO ] ----> [ HAKONE ] ----> [ OSAKA ]                                    │
│                                                                                      │
│     Each stay becomes a span. Each span can contain its own local itinerary.         │
│                                                                                      │
│                               [+ Add first stay]                                     │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.10 Drag-State Wireframe

```text
|M|A|E|M|A|E|M|A|E|M|A|E|

[ TOKYO ───────────────────── ]
                  [ HAKONE ]  ← lifted block
                       ↑
                insertion preview

                      ── train ──>
```

Rules:
- destination order change must be obvious before drop
- connectors should preview new attachment points

---

## 5. Stay Detail Desktop

### 5.1 Purpose

Plan the internal structure of one stay in a way that balances:
- day structure
- route logic
- research flexibility

### 5.2 Core Layout

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ A. STAY HEADER                                                                                               │
├───────────────────────┬───────────────────────────────────────────────────────────────┬──────────────────────┤
│ B. DAY NAVIGATOR      │ C. DAY BOARD                                                  │ D. STAY MAP PANEL    │
│ E. UNSCHEDULED POOL   │ F. DAY CARDS                                                   │ E. MAP FILTERS       │
│                       │ G. DAY-PART LANES                                              │ F. ROUTE PREVIEW     │
└───────────────────────┴───────────────────────────────────────────────────────────────┴──────────────────────┘
```

### 5.3 Region-by-Region Specification

#### A. Stay Header

Required content:
- breadcrumb
- destination name
- stay span
- nights count
- lodging summary
- view switcher

Optional content:
- reservation count
- density summary
- notes shortcut

#### B. Day Navigator

Each day row should include:
- date label
- arrival/departure note if edge day
- number of items
- warning or completion dot

Rules:
- current day must be obvious
- day count must be scannable
- navigator should remain visible while scrolling

#### C. Day Board

The day board is the primary editing surface.

Each day is represented as a `Day Card`.
Each day card contains 3 `Day-Part Lanes`.

#### D. Stay Map Panel

Required behaviors:
- focus only on current stay geography
- show selected day by default
- allow all-days toggle
- show unscheduled places in muted style

#### E. Unscheduled Pool

Rules:
- must be accessible without leaving the stay
- must support search
- must support drag into any lane
- should show tags and districts

#### F. Day Cards

Rules:
- each day card should feel like a clear bounded planning unit
- cards should be collapsible
- current day or selected day should be visually prominent

#### G. Day-Part Lanes

Rules:
- lanes must look droppable
- order must be explicit
- multiple cards per lane are expected
- cards should wrap or scroll gracefully depending on density choice

### 5.4 Recommended Day Card Anatomy

```text
┌───────────────────────────────────────────────────────────┐
│ May 4                                     5 items         │
│ Morning   [ Meiji Jingu ] -> [ Harajuku ]                │
│ Afternoon [ Shibuya ] -> [ Shibuya Sky ] -> [ Shinjuku ] │
│ Evening   [ Omoide Yokocho ]                             │
└───────────────────────────────────────────────────────────┘
```

### 5.5 Expanded Day Card

```text
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ May 4                                                     west Tokyo cluster        │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ Morning                                                                           + │
│ [ Meiji Jingu ]  [ Harajuku ]                                                       │
│                                                                                      │
│ Afternoon                                                                         + │
│ [ Shibuya ]  [ Shibuya Sky ]  [ Shinjuku ]                                          │
│                                                                                      │
│ Evening                                                                           + │
│ [ Omoide Yokocho ]                                                                  │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### 5.6 Visit Card Anatomy

```text
┌──────────────────────────────┐
│ Shibuya                      │
│ Area · west Tokyo            │
│ 1-2h                         │
│ [notes] [saved]              │
└──────────────────────────────┘
```

Required fields:
- name
- type or category
- district or area

Optional fields:
- soft duration
- reservation badge
- note badge
- image thumbnail in expanded mode only

### 5.7 Visit Card States

#### Default

- compact and readable

#### Hover

- stronger border
- corresponding pin highlights

#### Selected

- card expands or inspector opens

#### Dragging

- elevated, semi-transparent placeholder remains

#### Warning

- subtle badge like `long transfer after this`

### 5.8 Unscheduled Pool Anatomy

```text
┌──────────────────────────────┐
│ Unscheduled                  │
│ [search Tokyo places____]    │
│ [ Tokyo Tower ]              │
│ [ TeamLab Planets ]          │
│ [ Ginza ]                    │
│ [ Imperial Palace ]          │
└──────────────────────────────┘
```

Rules:
- unscheduled items should not look like errors
- they are a normal part of expert planning

### 5.9 Screen States to Design

The designer should create separate mockups for:
- normal loaded state
- drag from unscheduled into lane
- selected visit card with inspector
- collapsed day state
- warning state with cluster suggestion

### 5.10 Drag-State Wireframe

```text
UNSCHEDULED                    MAY 5 AFTERNOON

[ TeamLab ]  ───────────────►  [ Asakusa ] [ Senso-ji ] [ insertion ]
```

Expected feedback:
- source card lifts
- target lane glows
- insertion indicator appears
- map preview updates

---

## 6. Single-Day Desktop

### 6.1 Purpose

This is the review-first view for a single date.

### 6.2 Core Layout

```text
┌───────────────────────────────────────────────────────────────┬──────────────────────────────────────────────┐
│ A. DAY MAP                                                    │ B. DAY PLAN                                   │
│ C. ROUTE                                                      │ C. DAY-PART LISTS                             │
│ D. MAP CONTROLS                                               │ D. QUICK INFO                                 │
│                                                               │ E. LIGHT ACTIONS                              │
└───────────────────────────────────────────────────────────────┴──────────────────────────────────────────────┘
```

### 6.3 Required Content

Map side:
- numbered ordered stops
- route line
- fit day button
- isolate day-part toggle

Plan side:
- day title
- grouped morning / afternoon / evening
- notes
- reservation references
- next-stop context

### 6.4 Day View Wireframe

```text
┌───────────────────────────────────────────────────────────────┬──────────────────────────────────────────────┐
│ (1)──(2)──(3)──(4)──(5)                                      │ Tokyo · Tue May 4                            │
│                                                               │                                              │
│ [Fit Day] [Afternoon only] [Notes]                           │ Morning                                      │
│                                                               │ 1. Meiji Jingu                              │
│                                                               │ 2. Harajuku                                 │
│                                                               │                                              │
│                                                               │ Afternoon                                    │
│                                                               │ 3. Shibuya                                  │
│                                                               │ 4. Shibuya Sky                              │
│                                                               │ 5. Shinjuku                                 │
│                                                               │                                              │
│                                                               │ Evening                                      │
│                                                               │ 6. Omoide Yokocho                           │
└───────────────────────────────────────────────────────────────┴──────────────────────────────────────────────┘
```

### 6.5 State Variants

Design variants needed:
- default
- afternoon filtered
- one item selected
- map fullscreen
- day completed / check-off state

---

## 7. Places Library Desktop

### 7.1 Purpose

Preserve research and alternatives without forcing immediate scheduling.

### 7.2 Core Layout

```text
┌───────────────────────┬───────────────────────────────────────────────────────────────┬──────────────────────┐
│ A. FILTERS            │ B. PLACE LIST                                                 │ C. DETAIL PANEL      │
│ D. TAGS               │ E. STATUS TABS                                                │ D. QUICK ACTIONS     │
│                       │ F. SEARCH RESULTS / SAVED CANDIDATES                          │ E. MINI MAP          │
└───────────────────────┴───────────────────────────────────────────────────────────────┴──────────────────────┘
```

### 7.3 Required Behaviors

- filter by stay
- filter by status
- filter by tag
- quick add to a day part
- quick add to unscheduled
- open place detail

### 7.4 Detail Panel Requirements

Must include:
- name
- type
- tags
- notes
- suggested best time
- quick scheduling actions
- mini map preview

---

## 8. Today Mobile

### 8.1 Purpose

The mobile landing experience during an active trip.

### 8.2 Core Layout

```text
┌──────────────────────────────┐
│ A. CONTEXT HEADER            │
│ B. LOCAL TABS                │
│ C. DAY CONTENT               │
│ D. NEXT STOP MODULE          │
│ E. BOTTOM NAV                │
└──────────────────────────────┘
```

### 8.3 Required Content

Header:
- destination name
- date

Local tabs:
- Plan
- Map
- Notes

Day content:
- morning list
- afternoon list
- evening list

Next stop module:
- next location
- basic transfer estimate

Bottom nav:
- Today
- Trip
- Map
- Places

### 8.4 Wireframe

```text
┌──────────────────────────────┐
│ Tokyo            Tue May 4   │
│ [Plan*] [Map] [Notes]        │
├──────────────────────────────┤
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
│ Next                         │
│ -> Shibuya                   │
│ 24 min from current stop     │
├──────────────────────────────┤
│ [Today*] [Trip] [Map] [Places]│
└──────────────────────────────┘
```

### 8.5 Design Rules

- large tap targets
- no cramped metadata
- strong current-context clarity
- route access in one tap

---

## 9. Trip Sequence Mobile

### 9.1 Purpose

Show the structure of the full trip on mobile without forcing the full desktop editing model.

### 9.2 Required Content

- stacked stays
- date spans
- transport labels between stays
- current stay emphasis if trip is active

### 9.3 Wireframe

```text
┌──────────────────────────────┐
│ Japan Spring 2027            │
│ [Trip*] [Map]                │
├──────────────────────────────┤
│ ┌──────────────────────────┐ │
│ │ TOKYO                    │ │
│ │ May 3 E -> May 7 A       │ │
│ │ 4 nights                 │ │
│ └──────────────────────────┘ │
│            │ train           │
│            ▼                 │
│ ┌──────────────────────────┐ │
│ │ HAKONE                   │ │
│ │ May 7 E -> May 9 M       │ │
│ │ 2 nights                 │ │
│ └──────────────────────────┘ │
│            │ train           │
│            ▼                 │
│ ┌──────────────────────────┐ │
│ │ OSAKA                    │ │
│ │ May 9 A -> May 14 E      │ │
│ │ 5 nights                 │ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

### 9.4 Design Rules

- sequence must remain clear at a glance
- cards should read as spans, not isolated unrelated items
- avoid overloading mobile with internal itinerary details here

---

## 10. State Matrix

The designer should explicitly design the following states for key components.

### 10.1 Stay Block

- default
- hover
- selected
- dragging
- warning
- completed

### 10.2 Travel Segment

- default
- hover
- selected
- warning
- missing-details

### 10.3 Day Card

- default
- expanded
- collapsed
- selected
- overloaded

### 10.4 Day-Part Lane

- empty
- filled
- drag-over
- overloaded
- suggested-cluster

### 10.5 Visit Card

- default
- selected
- dragging
- tentative
- booked
- warning
- completed

### 10.6 Map Marker

- default stay
- default visit
- unscheduled visit
- selected
- hovered
- hidden by filter

---

## 11. Interaction Patterns to Prototype

These should be prototyped early, because they define the product experience.

### 11.1 Resize a Stay

Prototype requirements:
- drag handle visible on hover or selection
- snap to day parts
- live date summary update
- connector reflow

### 11.2 Reorder Stays

Prototype requirements:
- lifted block
- destination insertion preview
- map route preview

### 11.3 Move Visit Item Into Day Part

Prototype requirements:
- unscheduled pool source
- lane drop target
- insertion marker
- route preview

### 11.4 Reorder Within Day Part

Prototype requirements:
- numbered order cue
- easy understanding of where the item will land

### 11.5 Select Day and Filter Map

Prototype requirements:
- day list click
- other days subdued
- map isolates selected day route

---

## 12. Edge Cases to Design

These cases should be drawn explicitly.

### 12.1 Arrival-Day Edge Case

A stay that begins in the evening should show:
- empty morning
- empty afternoon
- evening-focused plan

### 12.2 Departure-Day Edge Case

A stay that ends in the morning should not misleadingly display a full usable day.

### 12.3 Heavy-Density Day

A day with many small items should still be legible.

Potential UI choices:
- horizontal scroll within lane
- wrapping chips
- condensed list mode

### 12.4 Missing Route Data

Travel segment with unknown duration or mode should still be representable.

### 12.5 Unscheduled-Heavy Stay

A stay with many candidate places but little scheduling should not feel broken.

---

## 13. Handoff Checklist for Design

Before moving into high fidelity, the designer should be able to answer:

1. Is the difference between `Stay` and `Visit Item` visually obvious?
2. Does the global view clearly communicate spans rather than repeated days?
3. Can a user understand trip order in less than 3 seconds?
4. Does the stay detail view make multiple places in one day part feel natural?
5. Is the map behavior consistent and context-aware at each level?
6. Is mobile clearly review-first rather than a cramped version of desktop?
7. Are unscheduled items framed as a normal planning state, not an error?
8. Are warning states informative without becoming punitive?

---

## 14. Final Recommendation

The first high-fidelity design effort should focus on:
- `Global Itinerary Desktop`
- `Stay Detail Desktop`
- `Today Mobile`

Those three screens capture the full product philosophy:
- trip structure
- internal destination planning
- day-of usage

If those screens work, the rest of the product will inherit a coherent model.
