import type { AccommodationGroup, HybridTrip, NightAccommodation, Stay } from './types';
import { DAY_PARTS } from './constants';
import { addDaysTo, safeDate } from './dateUtils';

/** Calculates the number of nights a stay covers. */
export function getStayNightCount(stay: Stay) {
  return Math.max(1, Math.ceil((stay.endSlot - stay.startSlot) / 3));
}

/** Detects overlapping stays and returns a Set of their IDs. */
export function getOverlapIds(stays: Stay[]) {
  const overlaps = new Set<string>();
  stays.forEach((a, i) =>
    stays.slice(i + 1).forEach((b) => {
      if (a.startSlot < b.endSlot && b.startSlot < a.endSlot) {
        overlaps.add(a.id);
        overlaps.add(b.id);
      }
    }),
  );
  return overlaps;
}

/** Derives a per-day breakdown for a stay (day parts, accommodation, dates). */
export function deriveStayDays(trip: HybridTrip, stay: Stay) {
  const firstDay = Math.floor(stay.startSlot / 3);
  const lastDay = Math.floor((stay.endSlot - 1) / 3);
  return Array.from({ length: lastDay - firstDay + 1 }, (_, i) => {
    const absoluteDay = firstDay + i;
    const enabledParts = DAY_PARTS.filter((p) => {
      const slot = absoluteDay * 3 + DAY_PARTS.indexOf(p);
      return slot >= stay.startSlot && slot < stay.endSlot;
    });
    const hasNight = enabledParts.includes('evening');
    const nightAccom = hasNight
      ? (stay.nightAccommodations?.[i] ?? (stay.lodging ? { name: stay.lodging } : undefined))
      : undefined;
    return {
      dayOffset: i,
      absoluteDay,
      date: addDaysTo(safeDate(trip.startDate), absoluteDay),
      enabledParts,
      hasNight,
      nightAccommodation: nightAccom as NightAccommodation | undefined,
    };
  });
}

/** Groups consecutive nights with the same accommodation into spans. */
export function deriveAccommodationGroups(
  stayDays: ReturnType<typeof deriveStayDays>,
): AccommodationGroup[] {
  const groups: AccommodationGroup[] = [];
  let current: AccommodationGroup | null = null;
  for (const day of stayDays) {
    if (!day.hasNight || !day.nightAccommodation) {
      if (current) {
        groups.push(current);
        current = null;
      }
      continue;
    }
    if (current && current.name === day.nightAccommodation.name) {
      current.nights++;
    } else {
      if (current) groups.push(current);
      current = {
        name: day.nightAccommodation.name,
        startDayOffset: day.dayOffset,
        nights: 1,
        accommodation: day.nightAccommodation,
      };
    }
  }
  if (current) groups.push(current);
  return groups;
}

/** Checks if a slot range is free of any stay. */
export function isSlotRangeEmpty(stays: Stay[], startSlot: number, endSlotExcl: number): boolean {
  return !stays.some((s) => s.startSlot < endSlotExcl && s.endSlot > startSlot);
}
