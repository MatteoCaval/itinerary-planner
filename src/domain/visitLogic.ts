import type { DayPart, VisitItem, VisitType } from './types';
import { DAY_PARTS } from './constants';

/** Factory for creating a VisitItem with defaults. */
export function createVisit(
  id: string,
  name: string,
  type: VisitType,
  stayId: string,
  lat: number,
  lng: number,
  dayOffset: number | null,
  dayPart: DayPart | null,
  order: number,
  durationHint?: string,
): VisitItem {
  return { id, name, type, stayId, lat, lng, dayOffset, dayPart, order, durationHint };
}

/** Sorts visits: unscheduled first, then by dayOffset → dayPart → order. */
export function sortVisits(visits: VisitItem[]) {
  return [...visits].sort((a, b) => {
    if (a.dayOffset === null && b.dayOffset === null) return a.order - b.order;
    if (a.dayOffset === null) return -1;
    if (b.dayOffset === null) return 1;
    if (a.dayOffset !== b.dayOffset) return a.dayOffset - b.dayOffset;
    if (a.dayPart !== b.dayPart)
      return DAY_PARTS.indexOf(a.dayPart as DayPart) - DAY_PARTS.indexOf(b.dayPart as DayPart);
    return a.order - b.order;
  });
}

/** Re-indexes order numbers per slot bucket. */
export function normalizeVisitOrders(visits: VisitItem[]) {
  const buckets = new Map<string, VisitItem[]>();
  sortVisits(visits).forEach((v) => {
    const key =
      v.dayOffset === null || v.dayPart === null ? 'inbox' : `${v.dayOffset}-${v.dayPart}`;
    buckets.set(key, [...(buckets.get(key) ?? []), v]);
  });
  return Array.from(buckets.values()).flatMap((b) => b.map((v, i) => ({ ...v, order: i })));
}
