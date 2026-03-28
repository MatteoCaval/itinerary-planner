import type {
  DayPart, HybridTrip, LegacyAccommodation, LegacyDay, LegacyDaySection,
  LegacyLocation, LegacyLocationCategory, LegacyRoute, LegacyStoredTrip,
  LegacyTransportType, NightAccommodation, Stay, TravelMode, VisitItem, VisitType,
} from './types';
import { STAY_COLORS, VISIT_TYPES } from './constants';
import { addDaysTo } from './dateUtils';

// ─── Slot/type adapters ──────────────────────────────────────────────────────

export function legacySlotToIndex(slot?: LegacyDaySection): number {
  if (slot === 'afternoon') return 1;
  if (slot === 'evening') return 2;
  return 0;
}

export function indexToLegacySlot(idx: number): LegacyDaySection {
  const r = idx % 3;
  if (r === 1) return 'afternoon';
  if (r === 2) return 'evening';
  return 'morning';
}

export function legacyTransportToMode(t?: LegacyTransportType): TravelMode {
  if (t === 'car') return 'drive';
  if (t === 'other' || !t) return 'train';
  return t as TravelMode;
}

export function modeToLegacyTransport(m: TravelMode): LegacyTransportType {
  if (m === 'drive') return 'car';
  return m as LegacyTransportType;
}

export function legacyCategoryToVisitType(cat?: LegacyLocationCategory, hint?: string): VisitType {
  if (hint && (VISIT_TYPES as string[]).includes(hint)) return hint as VisitType;
  if (hint === 'area' || hint === 'hotel') return 'landmark';
  if (cat === 'dining') return 'food';
  if (cat === 'hotel') return 'landmark';
  if (cat === 'sightseeing') return 'landmark';
  if (cat === 'transit') return 'walk';
  return 'landmark';
}

export function visitTypeToLegacyCategory(type: VisitType): LegacyLocationCategory {
  if (type === 'food') return 'dining';
  if (type === 'landmark' || type === 'museum') return 'sightseeing';
  if (type === 'walk') return 'transit';
  return 'other';
}

// ─── Full trip conversions ───────────────────────────────────────────────────

export function legacyTripToHybrid(leg: LegacyStoredTrip, colorOffset = 0): HybridTrip {
  const startDate = leg.startDate ?? '2025-01-01';
  const s = new Date(startDate);
  const e = new Date(leg.endDate ?? startDate);
  const rawDays = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
  const totalDays = Number.isFinite(rawDays) && rawDays >= 1 ? rawDays : 1;
  const days = leg.days ?? [];
  const routes = leg.routes ?? [];

  const dayIdxById: Record<string, number> = {};
  days.forEach((d, i) => { dayIdxById[d.id] = i; });

  const stays: Stay[] = (leg.locations ?? []).map((loc, locIdx) => {
    const startDayIdx = loc.startDayId ? (dayIdxById[loc.startDayId] ?? 0) : 0;
    const startSlot = startDayIdx * 3 + legacySlotToIndex(loc.startSlot);
    const duration = loc.duration ?? 3;
    const endSlot = Math.min(startSlot + duration, totalDays * 3);

    const nextLoc = leg.locations?.[locIdx + 1];
    const routeToNext = nextLoc
      ? routes.find((r) =>
          (r.fromLocationId === loc.id && r.toLocationId === nextLoc.id) ||
          (r.fromLocationId === nextLoc.id && r.toLocationId === loc.id),
        )
      : undefined;

    const lodging = loc._lodging ?? days[startDayIdx]?.accommodation?.name ?? '';
    const color = loc._color ?? STAY_COLORS[(colorOffset + locIdx) % STAY_COLORS.length];

    const lastDay = Math.floor((endSlot - 1) / 3);
    const nightAccommodations: Record<number, NightAccommodation> = {};
    for (let absDay = startDayIdx; absDay <= lastDay; absDay++) {
      const eveningSlot = absDay * 3 + 2;
      if (eveningSlot >= startSlot && eveningSlot < endSlot) {
        const legDay = days[absDay];
        if (legDay?.accommodation?.name) {
          const a = legDay.accommodation;
          nightAccommodations[absDay - startDayIdx] = {
            name: a.name, lat: a.lat, lng: a.lng, cost: a.cost, notes: a.notes, link: a.link,
          };
        }
      }
    }

    const visits: VisitItem[] = (loc.subLocations ?? []).map((sub) => {
      const dayOffset = sub.dayOffset ?? null;
      const dayPart = sub.startSlot ? (sub.startSlot as DayPart) : null;
      const isScheduled = dayOffset !== null && dayPart !== null;
      return {
        id: sub.id,
        name: sub.name,
        type: legacyCategoryToVisitType(sub.category, sub._visitType),
        area: sub._area ?? sub.name,
        lat: sub.lat,
        lng: sub.lng,
        durationHint: sub.duration != null ? `${sub.duration}h` : undefined,
        dayOffset: isScheduled ? dayOffset : null,
        dayPart: isScheduled ? dayPart : null,
        order: sub.order ?? 0,
        notes: sub.notes,
      };
    });

    return {
      id: loc.id, name: loc.name, color,
      startSlot, endSlot,
      centerLat: loc.lat, centerLng: loc.lng,
      lodging,
      nightAccommodations: Object.keys(nightAccommodations).length > 0 ? nightAccommodations : undefined,
      travelModeToNext: legacyTransportToMode(routeToNext?.transportType),
      travelDurationToNext: routeToNext?.duration,
      travelNotesToNext: routeToNext?.notes,
      visits,
    };
  });

  return { id: leg.id, name: leg.name, startDate, totalDays, stays };
}

export function hybridTripToLegacy(trip: HybridTrip): LegacyStoredTrip {
  const startDate = trip.startDate || '2025-01-01';
  const totalDays = Number.isFinite(trip.totalDays) && trip.totalDays >= 1 ? trip.totalDays : 1;
  const endDate = addDaysTo(new Date(startDate), totalDays - 1).toISOString().split('T')[0];

  const days: LegacyDay[] = Array.from({ length: totalDays }, (_, i) => {
    const date = addDaysTo(new Date(startDate), i).toISOString().split('T')[0];
    const coveringStay = trip.stays.find((s) => {
      const sStart = Math.floor(s.startSlot / 3);
      const sEnd = Math.ceil(s.endSlot / 3);
      return i >= sStart && i < sEnd;
    });
    let accommodation: LegacyAccommodation | undefined;
    if (coveringStay) {
      const dayOffset = i - Math.floor(coveringStay.startSlot / 3);
      const nightAccom = coveringStay.nightAccommodations?.[dayOffset];
      if (nightAccom) {
        accommodation = { ...nightAccom };
      } else if (coveringStay.lodging) {
        accommodation = { name: coveringStay.lodging };
      }
    }
    return { id: `day-${i}-${trip.id}`, date, accommodation };
  });

  const dayIdByIdx: Record<number, string> = {};
  days.forEach((d, i) => { dayIdByIdx[i] = d.id; });

  const routes: LegacyRoute[] = [];
  const sortedStays = [...trip.stays].sort((a, b) => a.startSlot - b.startSlot);

  const locations: LegacyLocation[] = sortedStays.map((stay, stayIdx) => {
    const startDayIdx = Math.floor(stay.startSlot / 3);
    const startDayId = dayIdByIdx[startDayIdx];
    const duration = stay.endSlot - stay.startSlot;

    const nextStay = sortedStays[stayIdx + 1];
    if (nextStay) {
      routes.push({
        id: `route-${stay.id}-${nextStay.id}`,
        fromLocationId: stay.id,
        toLocationId: nextStay.id,
        transportType: modeToLegacyTransport(stay.travelModeToNext),
        duration: stay.travelDurationToNext,
        notes: stay.travelNotesToNext,
      });
    }

    const subLocations: LegacyLocation[] = stay.visits.map((v) => {
      const absDayIdx = v.dayOffset !== null ? startDayIdx + v.dayOffset : startDayIdx;
      const subDayId = v.dayOffset !== null ? (dayIdByIdx[absDayIdx] ?? startDayId) : undefined;
      let durationNum: number | undefined;
      if (v.durationHint) {
        const m = v.durationHint.match(/(\d+(?:\.\d+)?)/);
        if (m) durationNum = parseFloat(m[1]);
      }
      return {
        id: v.id, name: v.name,
        lat: v.lat, lng: v.lng,
        notes: v.notes,
        category: visitTypeToLegacyCategory(v.type),
        dayIds: subDayId ? [subDayId] : [],
        startDayId: subDayId,
        startSlot: v.dayPart as LegacyDaySection | undefined,
        dayOffset: v.dayOffset ?? undefined,
        duration: durationNum,
        order: v.order,
        checklist: [], links: [],
        _area: v.area,
        _visitType: v.type,
      };
    });

    return {
      id: stay.id, name: stay.name,
      lat: stay.centerLat, lng: stay.centerLng,
      notes: '', category: 'hotel' as const,
      dayIds: [],
      startDayId,
      startSlot: indexToLegacySlot(stay.startSlot),
      duration,
      order: stayIdx,
      subLocations,
      checklist: [], links: [],
      _color: stay.color,
      _lodging: stay.lodging,
    };
  });

  return {
    id: trip.id, name: trip.name,
    createdAt: Date.now(), updatedAt: Date.now(),
    startDate, endDate,
    days, locations, routes,
    version: '2.0',
  };
}

/** Ensure all array fields on a HybridTrip are actual arrays (Firebase may return objects with numeric keys). */
export function normalizeTrip(t: HybridTrip): HybridTrip {
  const toArr = <T,>(v: T[] | Record<string, T> | undefined): T[] => {
    if (Array.isArray(v)) return v;
    if (v && typeof v === 'object') return Object.values(v);
    return [];
  };
  return {
    ...t,
    stays: toArr(t.stays).map((s) => ({
      ...s,
      visits: toArr(s.visits),
    })),
  };
}
