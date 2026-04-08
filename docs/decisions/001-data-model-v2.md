# 001: Data Model v2 — Flat Visits + Route Entities

**Date:** 2026-04-07
**Status:** Implemented

## Context

The v1 data model nested visits inside stays (`Stay.visits[]`) and stored travel info as fields on stays (`Stay.travelModeToNext`, etc.). This caused:

- **Cross-stay visit moves** required removing from one array and inserting into another
- **Route data corruption** when reordering or deleting stays (travel info lived on the "from" stay)
- **Redundant `lodging` field** alongside `nightAccommodations`
- **Vestigial fields** (`area` on visits, `'area'|'hotel'` visit types) from a legacy model

No production users existed, so this was a clean-break opportunity.

## Decision

Restructure to v2:

| Change | v1 | v2 |
|--------|----|----|
| Visits | `Stay.visits[]` (nested) | `Trip.visits[]` with `stayId` (flat) |
| Routes | `Stay.travelModeToNext/Duration/Notes` | `Trip.routes[]` with `fromStayId/toStayId` |
| Lodging | `Stay.lodging` + `Stay.nightAccommodations` | `Stay.nightAccommodations` only |
| Visit area | `VisitItem.area: string` | Removed |
| Visit types | Included `'area'` and `'hotel'` | Removed (mapped to `'landmark'` on migration) |
| Timestamps | None | `Trip.createdAt`, `Trip.updatedAt` |
| Version | None | `Trip.version: 2` |

## Migration

- `migrateV1toV2()` in `domain/migration.ts` handles v1 → v2 conversion
- `legacyTripToHybrid()` chains legacy → v1 → v2
- Persistence reads old keys (`itinerary-trips-v1`, `itinerary-hybrid-trips-v2`), migrates, saves to new key (`itinerary-store-v2`)
- Cloud data is auto-migrated on fetch and written back after successful render
- 10 unit tests cover the migration function

## Consequences

**Positive:**
- Cross-stay visit moves are now a single `stayId` field change
- Route data survives stay reordering/deletion
- Cleaner data model — no redundant fields, no vestigial legacy types
- Unblocks destination wishlist feature (`startSlot: -1` convention)
- `Trip.visits` enables trip-level search, count, and batch operations

**Negative:**
- Derived values that were `selectedStay.visits.filter(...)` now require `trip.visits.filter(v => v.stayId === ...)` — slightly more verbose
- Components that showed `stay.visits.length` now receive a `visitCount` prop

## Files changed

~25 files across domain logic, persistence, AI service, App.tsx (43 reference sites), all component files, and tests. Total: 63 tests passing (up from 52).
