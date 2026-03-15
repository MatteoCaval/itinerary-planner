# Itinerary Planner — Tokyo / Hakone / Osaka Storyboard

> Generated: 2026-03-06
> Depends on: [[REPORT_EXPERT_PLANNER_UI_SPEC_NO_TIMELINE]] and [[REPORT_WIREFRAME_SPEC]]
> Goal: Show how the product behaves across a concrete trip, from empty state through planning, refinement, and day-of execution.

---

## 1. Scenario

Trip:
- Tokyo: arrive May 3 evening, leave May 7 afternoon
- Hakone: arrive May 7 evening, leave May 9 morning
- Osaka: arrive May 9 afternoon, leave May 14 evening

Assumption:
- the user is an experienced planner
- they do not want exact hour scheduling
- they want order, context, geography, and flexibility

---

## 2. Storyboard Structure

This storyboard is divided into 12 moments:

1. Empty trip
2. First stay added
3. Main trip structure built
4. Travel segments defined
5. Tokyo stay opened
6. Tokyo places collected as unscheduled
7. Tokyo days structured
8. Tokyo refined with map-aware adjustments
9. Hakone structured
10. Osaka added and balanced
11. Mobile trip review
12. Day-of use on May 4

Each moment includes:
- the user's goal
- what the screen should show
- what interaction matters most

---

## 3. Moment 1: Empty Trip

### User Goal

Start planning without being forced into a day-by-day grid.

### Screen

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

### Key Product Message

The empty state itself teaches the product model.

It should not say:
- "Add your first day"
- "Create itinerary item"

It should say:
- "Add first stay"

---

## 4. Moment 2: First Stay Added

### User Goal

Add Tokyo and establish the first major trip block.

### Screen

```text
┌───────────────────────┬───────────────────────────────────────────────────────────────┬──────────────────────┐
│ Destinations          │ May 3     May 4     May 5     May 6     May 7                │ Map                  │
│ 1. Tokyo *            │ M A E     M A E     M A E     M A E     M A E                │                      │
│                       │                                                               │      (1) Tokyo       │
│ [+ Add next stay]     │ [ TOKYO ─────────────────────────────────────────────── ]      │                      │
│                       │   arrive: May 3 E                leave: May 7 A              │                      │
└───────────────────────┴───────────────────────────────────────────────────────────────┴──────────────────────┘
```

### Important Interaction

The user sets:
- arrival = evening
- departure = afternoon

This immediately makes the stay span more semantically accurate than a day-row list.

---

## 5. Moment 3: Main Trip Structure Built

### User Goal

Add Hakone and Osaka and shape the whole trip.

### Screen

```text
┌───────────────────────┬───────────────────────────────────────────────────────────────┬──────────────────────┐
│ Destinations          │ May 3 ... May 14                                              │ Map                  │
│ 1. Tokyo              │                                                               │                      │
│ 2. Hakone             │ [ TOKYO ───────────────────────────── ]                        │  (1) Tokyo           │
│ 3. Osaka              │                             [ HAKONE ─────── ]                 │      \               │
│                       │                                        [ OSAKA ─────────── ]   │       \              │
│ Warnings              │                                                               │      (2) Hakone      │
│ ! Travel not defined  │                                                               │           \          │
│                       │                                                               │          (3) Osaka   │
└───────────────────────┴───────────────────────────────────────────────────────────────┴──────────────────────┘
```

### Important Interaction

The user drags and resizes until the sequence feels right.

The screen should support this without opening forms.

---

## 6. Moment 4: Travel Segments Defined

### User Goal

Define how the major moves happen.

### Screen

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ TOKYO                         -- train -->                         HAKONE                 -- train --> OSAKA │
│ May 3 E -> May 7 A                                             May 7 E -> May 9 M                          │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Selected segment: Tokyo -> Hakone                                                                        │
│ Mode: Train     Duration: 2h 20m     Notes: Shinkansen to Odawara, then local connection               │
│ Station: Tokyo Station -> Odawara                                                                       │
│ Booking: optional                                                                                        │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Important Interaction

Clicking a connector should feel as natural as clicking a card.

The planner should not have to hunt for where travel information lives.

---

## 7. Moment 5: Tokyo Stay Opened

### User Goal

Enter the Tokyo stay and start planning the internal visit structure.

### Screen

```text
┌───────────────────────┬───────────────────────────────────────────────────────────────┬──────────────────────┐
│ May 3                 │ May 3                                                         │ Tokyo Map            │
│ May 4 *               │ M: ───────                                                    │                      │
│ May 5                 │ A: ───────                                                    │   unscheduled pins   │
│ May 6                 │ E: [ Arrive Tokyo ] [ Dinner near hotel ]                    │   lightly shown      │
│ May 7                 │                                                               │                      │
│                       │ May 4                                                         │                      │
│ Unscheduled           │ M: ───────                                                    │                      │
│ [ Shibuya ]           │ A: ───────                                                    │                      │
│ [ Shinjuku ]          │ E: ───────                                                    │                      │
│ [ Asakusa ]           │                                                               │                      │
│ [ Harajuku ]          │                                                               │                      │
└───────────────────────┴───────────────────────────────────────────────────────────────┴──────────────────────┘
```

### Product Meaning

The empty internal structure should still acknowledge the stay span:
- arrival day has only evening available
- departure day has limited availability

---

## 8. Moment 6: Tokyo Places Collected as Unscheduled

### User Goal

Research first, schedule later.

### Screen

```text
┌──────────────────────────────┐
│ Unscheduled                  │
│ [search Tokyo places____]    │
│ [ Meiji Jingu ]              │
│ [ Harajuku ]                 │
│ [ Shibuya ]                  │
│ [ Shibuya Sky ]              │
│ [ Shinjuku ]                 │
│ [ Omoide Yokocho ]           │
│ [ Ueno Park ]                │
│ [ Tokyo Nat. Museum ]        │
│ [ Asakusa ]                  │
│ [ Senso-ji ]                 │
│ [ Sumida walk ]              │
└──────────────────────────────┘
```

### Important Product Behavior

This list must not look like failure.

It is a normal staging area for expert planning.

---

## 9. Moment 7: Tokyo Days Structured

### User Goal

Turn the Tokyo place list into a coherent internal itinerary.

### Screen

```text
┌───────────────────────┬───────────────────────────────────────────────────────────────┬──────────────────────┐
│ May 3                 │ May 3                                                         │ Selected Day Map     │
│ May 4 *               │ M: ───────                                                    │                      │
│ May 5                 │ A: ───────                                                    │                      │
│ May 6                 │ E: [ Arrive Tokyo ] [ Dinner near hotel ]                    │                      │
│ May 7                 │                                                               │                      │
│                       │ May 4                                                         │   (1) Meiji Jingu    │
│ Unscheduled           │ M: [ Meiji Jingu ] [ Harajuku ]                              │      │               │
│ [ Tokyo Tower ]       │ A: [ Shibuya ] [ Shibuya Sky ] [ Shinjuku ]                  │   (2) Harajuku       │
│ [ TeamLab ]           │ E: [ Omoide Yokocho ]                                        │      │               │
│ [ Ginza ]             │                                                               │   (3) Shibuya──(4)   │
│                       │ May 5                                                         │              │       │
│                       │ M: [ Ueno Park ] [ Tokyo Nat. Museum ]                       │             (5)      │
│                       │ A: [ Asakusa ] [ Senso-ji ]                                  │                      │
│                       │ E: [ Sumida walk ]                                           │                      │
└───────────────────────┴───────────────────────────────────────────────────────────────┴──────────────────────┘
```

### Important Interaction

The user is doing editorial sequencing:
- grouping nearby places
- balancing density
- controlling order

This should feel fast and tactile.

---

## 10. Moment 8: Tokyo Refined With Map-Aware Adjustments

### User Goal

Improve the itinerary based on route logic.

### Screen

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Suggestion: "Tokyo Tower" fits geographically with "Roppongi Hills" on May 6 Afternoon. [Add] [Dismiss]   │
├───────────────────────┬───────────────────────────────────────────────────────────────┬──────────────────────┤
│ Unscheduled           │ May 6                                                         │ Map                  │
│ [ Tokyo Tower ]       │ M: [ Tsukiji ]                                                │                      │
│ [ TeamLab ]           │ A: [ Tokyo Tower ] [ Roppongi Hills ]                         │   (1) Tsukiji        │
│ [ Ginza ]             │ E: [ Ginza dinner ]                                           │      │               │
│                       │                                                               │   (2) Tokyo Tower    │
│                       │                                                               │      │               │
│                       │                                                               │   (3) Roppongi       │
└───────────────────────┴───────────────────────────────────────────────────────────────┴──────────────────────┘
```

### Important Product Behavior

Suggestions should appear as assistance, not interruption.

The user stays in control.

---

## 11. Moment 9: Hakone Structured

### User Goal

Plan a smaller stay with different density and different geography.

### Screen

```text
┌───────────────────────┬───────────────────────────────────────────────────────────────┬──────────────────────┐
│ Hakone Days           │ Hakone                                                        │ Hakone Map           │
│ May 7                 │ M: unavailable                                                │                      │
│ May 8 *               │ A: unavailable                                                │   (1) Ryokan         │
│ May 9                 │ E: [ Arrive Hakone ] [ Ryokan check-in ]                     │      │               │
│                       │                                                               │   (2) Open-Air Museum│
│ Unscheduled           │ May 8                                                         │      │               │
│ [ Ropeway ]           │ M: [ Open-Air Museum ]                                        │   (3) Ropeway        │
│ [ Lake Ashi ]         │ A: [ Ropeway ] [ Owakudani ] [ Lake Ashi ]                   │      │               │
│ [ Owakudani ]         │ E: [ Onsen / Ryokan evening ]                                │   (4) Lake Ashi      │
│                       │                                                               │                      │
│                       │ May 9                                                         │                      │
│                       │ M: [ Breakfast ] [ Depart for Osaka ]                         │                      │
└───────────────────────┴───────────────────────────────────────────────────────────────┴──────────────────────┘
```

### Important Product Meaning

Different stays can have different rhythms.

Tokyo is dense and urban.
Hakone is slower, more scenic, more linear.

The same model should support both.

---

## 12. Moment 10: Osaka Added and Balanced

### User Goal

Avoid overloading Osaka just because it has a longer stay.

### Screen

```text
┌───────────────────────┬───────────────────────────────────────────────────────────────┬──────────────────────┐
│ Destinations          │ Global Timeline                                               │ Map                  │
│ Tokyo                 │ [ TOKYO ───────────────────────────── ]                        │                      │
│ Hakone                │                             [ HAKONE ─────── ]                 │ route visible        │
│ Osaka *               │                                        [ OSAKA ─────────── ]   │                      │
│                       │                                                               │                      │
│ Warnings              │ Selected stay: OSAKA                                          │                      │
│ ! Osaka too dense     │ 18 internal items over 5 nights                               │                      │
│                       │ Suggestion: split north / south Osaka days                    │                      │
└───────────────────────┴───────────────────────────────────────────────────────────────┴──────────────────────┘
```

### Important Product Behavior

The top-level screen should summarize internal planning pressure without forcing the user to open every stay.

---

## 13. Moment 11: Mobile Trip Review

### User Goal

Review the full trip sequence from the phone.

### Screen

```text
┌──────────────────────────────┐
│ Japan Spring 2027            │
│ [Today] [Trip*] [Map] [Places]│
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

### Important Product Behavior

The mobile trip review screen should communicate:
- sequence
- duration
- current position in the overall trip

It should not attempt to expose the full editing model.

---

## 14. Moment 12: Day-Of Use on May 4

### User Goal

Wake up, check today quickly, and use the plan without friction.

### Screen

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

### What Success Looks Like

The user can understand the day in under 10 seconds.

They do not need to decode:
- repeated day labels
- nested menus
- hidden map context
- excessive metadata

---

## 15. Storyboard-Specific Product Lessons

### 15.1 The Top-Level Model Works Because It Preserves Stays

The user never loses the sense that they are:
- in Tokyo for a span
- then in Hakone for a span
- then in Osaka for a span

That is the core advantage over day-first tools.

### 15.2 The Internal Model Works Because It Preserves Flexibility

Inside a stay, the user can:
- sequence items
- move items between day parts
- keep backup places unscheduled

This is much closer to expert behavior than exact-time planning.

### 15.3 The Mobile Model Works Because It Is Purpose-Built

The product does not try to compress the full authoring UI into mobile.

Instead it focuses on:
- review
- route use
- current day clarity

---

## 16. Additional Storyboard Screens Worth Designing

To make the storyboard fully designer-ready, the next screens to draw would be:

1. `Tokyo stay with drag-in-progress from unscheduled`
2. `Tokyo map focused on May 5 only`
3. `Hakone with departure-day constraints emphasized`
4. `Osaka warning state with overloaded days`
5. `Travel segment edit drawer for Tokyo -> Hakone`
6. `Today mobile map tab for May 4`

---

## 17. Final Recommendation

This storyboard shows why the product should be framed as:

**a span-based trip planner with nested local itineraries**

Not:
- a calendar app
- a checklist app
- a time-slot scheduler

If the designer keeps that framing intact, the product will feel structurally different from typical itinerary tools.
