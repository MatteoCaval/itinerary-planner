import type { NightAccommodation } from './types';

export type AccommodationRemoval = { name: string; stayLabel: string };

export type AdjustAccommodationsResult = {
  nightAccommodations: Record<number, NightAccommodation> | undefined;
  removed: AccommodationRemoval[];
};

/**
 * Recomputes `nightAccommodations` after a stay's day range changes.
 *
 * `startShift` > 0 means the stay lost that many days at the start (shrink-start).
 * `startShift` < 0 means the stay gained that many days at the start (grow-start).
 * `endShift`   > 0 means the stay lost that many days at the end (shrink-end).
 * `endShift`   < 0 means the stay gained that many days at the end (grow-end).
 *
 * Rules (see docs/superpowers/specs/2026-04-23-accommodation-resize-design.md):
 * - On grow, the adjacent accommodation group extends into the new nights (if any).
 * - On shrink, dropped nights either shrink their group silently (multi-night) or
 *   emit a removal entry (singleton) for toast surfacing.
 */
export function adjustAccommodationsForResize(
  oldAccoms: Record<number, NightAccommodation> | undefined,
  oldDayCount: number,
  newDayCount: number,
  startShift: number,
  endShift: number,
  stayLabel: string,
): AdjustAccommodationsResult {
  if (!oldAccoms || Object.keys(oldAccoms).length === 0) {
    return { nightAccommodations: undefined, removed: [] };
  }

  const removed: AccommodationRemoval[] = [];

  // Group identity is name-only, matching deriveAccommodationGroups in stayLogic.ts.
  // If that ever changes, update both together.
  const isSingleton = (day: number): boolean => {
    const target = oldAccoms[day];
    if (!target) return false;
    const prev = oldAccoms[day - 1];
    const next = oldAccoms[day + 1];
    const prevMatches = prev && prev.name === target.name;
    const nextMatches = next && next.name === target.name;
    return !prevMatches && !nextMatches;
  };

  if (startShift > 0) {
    for (let d = 0; d < startShift; d++) {
      const accom = oldAccoms[d];
      if (accom && isSingleton(d)) {
        removed.push({ name: accom.name, stayLabel });
      }
    }
  }

  if (endShift > 0) {
    for (let d = oldDayCount - endShift; d < oldDayCount; d++) {
      const accom = oldAccoms[d];
      if (accom && isSingleton(d)) {
        removed.push({ name: accom.name, stayLabel });
      }
    }
  }

  const next: Record<number, NightAccommodation> = {};
  const firstKeptDay = Math.max(0, startShift);
  const lastKeptDay = oldDayCount - Math.max(0, endShift) - 1;
  for (let d = firstKeptDay; d <= lastKeptDay; d++) {
    const accom = oldAccoms[d];
    if (accom) {
      next[d - startShift] = accom;
    }
  }

  if (startShift < 0) {
    const firstSurvivingDay = -startShift;
    const seedAccom = oldAccoms[0];
    if (seedAccom) {
      for (let d = 0; d < firstSurvivingDay; d++) {
        next[d] = seedAccom;
      }
    }
  }

  if (endShift < 0) {
    const lastOldDay = oldDayCount - 1;
    const seedAccom = oldAccoms[lastOldDay];
    if (seedAccom) {
      // firstNewDay accounts for the -startShift reindex already applied to surviving keys.
      const firstNewDay = lastOldDay - startShift + 1;
      const lastNewDay = newDayCount - 1;
      for (let d = firstNewDay; d <= lastNewDay; d++) {
        next[d] = seedAccom;
      }
    }
  }

  if (Object.keys(next).length === 0) {
    return { nightAccommodations: undefined, removed };
  }
  return { nightAccommodations: next, removed };
}
