# Itinerary Planner — Product Brief

> A description of what this product does, the data it manages, and the interactions it supports.
> Contains no layout, component, or visual prescriptions — all design decisions are intentionally left open.
> Date: march 1st

---

## What This Product Is

A tool for planning multi-day trips. Users build a detailed itinerary by collecting destinations, scheduling them across a day-by-day structure, defining how they travel between places, tracking costs, and sharing the result.

The primary audience is independent travellers who want more control and structure than a notes app, but don't want the complexity of a project management tool. The product should feel like a natural extension of how people already plan trips — lists, maps, rough schedules — but with much more power and flexibility.

---

## Core Concepts

These are the objects the product works with. The designer should consider how to surface and relate them visually.

### Trip
A named, self-contained travel plan. Users can maintain multiple trips simultaneously and switch between them freely. A trip has a name, a start date, an end date, and contains everything below.

### Location
A place the user intends to visit. Each location carries:
- A name and geographic coordinates (resolved automatically from a search or by pointing on a map)
- A category: sightseeing, dining, hotel, transit, or other
- An estimated cost
- A target arrival time
- Free-form notes
- A representative photo (auto-fetched from a photo service by name)
- A checklist of tasks specific to that stop
- A list of relevant links (booking pages, reviews, etc.)
- A schedule position: which day and time period it belongs to (or unscheduled)
- A duration: how many time periods it spans

### Day
A single calendar date within the trip range, generated automatically from the trip dates. Each day is divided into three named periods: **Morning**, **Afternoon**, and **Evening**. A day can also carry an accommodation entry (name, cost, notes, and a booking link) for that night.

### Route
A defined connection between two sequentially-scheduled locations. A route captures:
- Transport type: walk, car, bus, train, flight, ferry, or other
- Estimated duration
- Estimated cost
- Notes

### Sub-itinerary
Any location can optionally have its own internal set of stops. This is useful for destinations that are themselves multi-stop (e.g., a city, a park, a theme). The user can focus into that location's sub-level and plan it as its own mini-itinerary, then return to the main trip view.

---

## Capabilities

### Managing trips
- Create a new trip with a name and date range
- Switch between multiple saved trips
- Rename or delete any trip
- Duplicate a trip

### Building an itinerary
- Search for a location by name and add it to the trip
- Add a location by selecting a point directly on the map
- Assign a location to a specific day and time period (morning, afternoon, evening)
- Leave locations unscheduled in a temporary holding area
- Reorder and reschedule locations freely, including across days
- Extend a location's duration so it spans multiple time periods or days
- Remove a location from the itinerary

### Editing location details
All location details are editable in place with no explicit save step:
- Name, category, cost, target arrival time, duration
- Notes (free text)
- Checklist items (add, tick off, remove)
- External links (add, remove)

### Connecting locations with routes
- Define how the user travels between any two consecutive locations
- Set transport type, estimated duration, cost, and notes for each connection
- View travel connections contextually alongside the location they relate to

### Viewing the itinerary
Three distinct views of the same data:

**Timeline** — the primary scheduling surface. Shows all days in sequence, each broken into its three time periods, with locations placed within them. The user can see the full trip at a glance and manipulate the schedule directly.

**Calendar** — a month-grid overview showing which days have activity and how locations are distributed. Useful for spotting gaps or dense clusters at a higher level.

**Budget summary** — an aggregated view of all costs across locations and routes, broken down by category, with totals and daily averages.

### Using the map
The map always reflects the current itinerary state:
- Every scheduled location appears as a marker, colour-coded by category and numbered in chronological order
- Routes between locations appear as lines, colour-coded by transport type
- Selecting a location on the map brings up its full details
- Hovering a location on the map highlights it in the itinerary view and vice versa
- Nearby markers cluster together at lower zoom levels and expand on zoom
- The user can filter the map to show only a specific day's locations
- The user can toggle route direction indicators and clustering on or off
- Two basemap styles are available: one with local-language labels, one with English labels

### Viewing location details
Selecting any location reveals its full detail view:
- A photo of the destination (auto-loaded, displayed prominently)
- Its scheduled position and duration in plain language
- A summary of travel connections — how the user arrives and how they depart
- Accommodation information for the nights covered by this location
- Navigation to the previous and next location in the itinerary
- A link to open the location in an external mapping service
- All editable fields (see above)
- If the location has sub-stops: the ability to enter and plan the sub-itinerary

### Planning with AI
The user can describe a trip in plain language and have the AI generate a complete itinerary automatically. Two modes:
- **From scratch** — generates locations, routes, day assignments, and categories from a text prompt
- **Refine existing** — takes the current itinerary and a prompt describing changes, and updates it accordingly

The user provides their own AI API key, stored locally after first entry. The AI result is applied to the itinerary and can then be freely adjusted by hand.

### Saving and sharing
- The itinerary is saved to the device automatically at all times — no manual save needed
- The user can save a trip to the cloud and receive a short human-readable passcode
- Anyone with that passcode can load the trip on any device, with or without an account
- Signing in with an account (Google or email) enables automatic background sync — the itinerary is always up to date across the user's devices

### Undoing changes
- Every change is automatically snapshotted
- The user can step backward and forward through their edit history at any time
- A visual history view shows all snapshots with timestamps and lets the user jump to any point

### Import and export
- Export the full itinerary as a structured data file (JSON) for backup or sharing between users
- Import a previously exported file to restore or start from someone else's itinerary
- Export a human-readable summary of the trip as a Markdown document, suitable for printing or sharing as text

---

## Key User Flows

### Planning a trip from scratch
1. Create a new trip and set the travel dates — the day structure is generated automatically
2. Search for destinations and add them; they land in the unscheduled holding area
3. Assign each location to a day and time period by placing it in the timeline
4. Define the connection between each pair of consecutive locations — transport type, duration, cost
5. Fill in details for each location: notes, cost, links, checklist items
6. Set the accommodation for each night
7. Review the budget summary
8. Save to cloud or export

### Letting AI build the itinerary
1. Open the AI planner
2. Enter an API key (first use only)
3. Describe the trip: destination, duration, interests, constraints
4. The AI generates a complete itinerary in seconds
5. Review the result — adjust, remove, or add anything manually

### Sharing a trip with someone
1. Save the itinerary to cloud — a short passcode is generated
2. Share that passcode with the other person
3. They enter it in the app — the full itinerary loads on their device

### Planning a multi-stop destination
1. Add a destination that contains several internal stops (e.g., a city with multiple attractions)
2. Enter the sub-itinerary level for that location
3. Add and schedule internal stops within their own timeline
4. Return to the main itinerary — the parent location summarises the sub-level

---

## Features

| Capability | Included |
|---|---|
| Multiple simultaneous trips | ✅ |
| Trip date range with auto-generated days | ✅ |
| Three time periods per day (morning / afternoon / evening) | ✅ |
| Location scheduling and reordering | ✅ |
| Duration spanning (multiple time periods or days) | ✅ |
| Unscheduled holding area | ✅ |
| Location search by name | ✅ |
| Add location by map selection | ✅ |
| Auto-fetched destination photo | ✅ |
| Location category (5 types) | ✅ |
| Cost tracking per location | ✅ |
| Target arrival time | ✅ |
| Free-form notes | ✅ |
| Per-location checklist | ✅ |
| Per-location links | ✅ |
| Accommodation per day | ✅ |
| Route connections with transport type | ✅ |
| Route cost and duration | ✅ |
| Interactive map (always in sync) | ✅ |
| Map markers by category, numbered chronologically | ✅ |
| Route lines by transport type | ✅ |
| Marker clustering | ✅ |
| Day filter on map | ✅ |
| Basemap switcher (2 styles) | ✅ |
| Timeline view | ✅ |
| Calendar overview | ✅ |
| Budget summary by category | ✅ |
| Location detail view with full editing | ✅ |
| Cross-location navigation (prev / next) | ✅ |
| Sub-itinerary (nested destinations) | ✅ |
| Current-time position indicator (if trip is active today) | ✅ |
| AI-assisted generation (from scratch or refine) | ✅ |
| Automatic local save (offline-capable) | ✅ |
| Cloud save with shareable passcode | ✅ |
| Account-based auto-sync | ✅ |
| Google and email/password sign-in | ✅ |
| Full undo / redo | ✅ |
| Visual history with timestamps | ✅ |
| JSON export and import | ✅ |
| Markdown export | ✅ |
| Fully responsive (desktop and mobile) | ✅ |
