import type { DragState, HybridTrip, Stay, VisitItem } from './types';
import { addDaysTo, safeDate } from './dateUtils';
import { clamp } from './geoUtils';
import {
  adjustAccommodationsForResize,
  type AccommodationRemoval,
} from './accommodationAdjust';

// ─── Trip extension ──────────────────────────────────────────────────────────

/** Extend the trip by one day before the current start date. Shifts all stay slots +3. */
export function extendTripBefore(trip: HybridTrip): HybridTrip {
  return {
    ...trip,
    startDate: addDaysTo(safeDate(trip.startDate), -1).toISOString().split('T')[0],
    totalDays: trip.totalDays + 1,
    stays: trip.stays.map((s) => ({ ...s, startSlot: s.startSlot + 3, endSlot: s.endSlot + 3 })),
  };
}

/** Extend the trip by one day after the current end date. */
export function extendTripAfter(trip: HybridTrip): HybridTrip {
  return { ...trip, totalDays: trip.totalDays + 1 };
}

// ─── Trip shrink (remove empty edge days) ────────────────────────────────────

/** Remove one day from the start of the trip. Shifts all stay slots -3. Only valid if day 0 has no stays. */
export function shrinkTripBefore(trip: HybridTrip): HybridTrip | null {
  if (trip.totalDays <= 1) return null;
  const hasStayOnFirstDay = trip.stays.some((s) => s.startSlot < 3);
  if (hasStayOnFirstDay) return null;
  return {
    ...trip,
    startDate: addDaysTo(safeDate(trip.startDate), 1).toISOString().split('T')[0],
    totalDays: trip.totalDays - 1,
    stays: trip.stays.map((s) => ({ ...s, startSlot: s.startSlot - 3, endSlot: s.endSlot - 3 })),
  };
}

/** Remove one day from the end of the trip. Only valid if the last day has no stays. */
export function shrinkTripAfter(trip: HybridTrip): HybridTrip | null {
  if (trip.totalDays <= 1) return null;
  const lastDayStart = (trip.totalDays - 1) * 3;
  const hasStayOnLastDay = trip.stays.some((s) => s.endSlot > lastDayStart);
  if (hasStayOnLastDay) return null;
  return { ...trip, totalDays: trip.totalDays - 1 };
}

// ─── Timeline drag ───────────────────────────────────────────────────────────

/** Apply a slot delta to a stay during timeline drag (move/resize). Returns updated stays and any removed singleton accommodations. */
export function applyTimelineDrag(
  stays: Stay[],
  dragState: NonNullable<DragState>,
  delta: number,
  totalSlots: number,
): { stays: Stay[]; removed: AccommodationRemoval[] } {
  const removed: AccommodationRemoval[] = [];
  const nextStays = stays.map((s) => {
    if (s.id !== dragState.stayId) return s;

    const len = dragState.originalEnd - dragState.originalStart;

    if (dragState.mode === 'move') {
      const next = clamp(dragState.originalStart + delta, 0, totalSlots - len);
      return { ...s, startSlot: next, endSlot: next + len };
    }

    let newStart = s.startSlot;
    let newEnd = s.endSlot;
    if (dragState.mode === 'resize-start') {
      newStart = clamp(dragState.originalStart + delta, 0, dragState.originalEnd - 1);
      newEnd = dragState.originalEnd;
    } else {
      newStart = dragState.originalStart;
      newEnd = clamp(dragState.originalEnd + delta, dragState.originalStart + 1, totalSlots);
    }

    const oldDayCount = Math.ceil((dragState.originalEnd - dragState.originalStart) / 3);
    const newDayCount = Math.ceil((newEnd - newStart) / 3);
    const startShift = Math.floor((newStart - dragState.originalStart) / 3);
    const endShift = Math.floor((dragState.originalEnd - newEnd) / 3);

    const accomResult = adjustAccommodationsForResize(
      dragState.originalNightAccommodations,
      oldDayCount,
      newDayCount,
      startShift,
      endShift,
      s.name,
    );
    removed.push(...accomResult.removed);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { nightAccommodations: _dropped, ...rest } = s;
    return {
      ...rest,
      startSlot: newStart,
      endSlot: newEnd,
      ...(accomResult.nightAccommodations !== undefined
        ? { nightAccommodations: accomResult.nightAccommodations }
        : {}),
    };
  });

  return { stays: nextStays, removed };
}

// ─── Date range shrink/shift ─────────────────────────────────────────────────

/**
 * Adjust stays and visits after a date range change (start date shift and/or totalDays decrease).
 * - Shifts all stays by `-slotShift` to account for start date moving.
 * - Removes stays fully outside the new range.
 * - Clamps partially outside stays, rekeys their accommodations, and unschedules overflowing visits.
 */
export function adjustStaysForDateChange(
  stays: Stay[],
  visits: VisitItem[],
  slotShift: number,
  newMaxSlot: number,
): { stays: Stay[]; visits: VisitItem[]; removed: AccommodationRemoval[] } {
  const removed: AccommodationRemoval[] = [];

  const shifted = stays.map((s) => ({
    ...s,
    startSlot: s.startSlot - slotShift,
    endSlot: s.endSlot - slotShift,
  }));

  const removedStayIds = new Set(
    shifted.filter((s) => s.endSlot <= 0 || s.startSlot >= newMaxSlot).map((s) => s.id),
  );

  const clampedStays = shifted
    .filter((s) => !removedStayIds.has(s.id))
    .map((s) => {
      const clampedStart = Math.max(0, s.startSlot);
      const clampedEnd = Math.min(newMaxSlot, s.endSlot);

      if (clampedStart === s.startSlot && clampedEnd === s.endSlot) {
        return { ...s, startSlot: clampedStart, endSlot: clampedEnd };
      }

      const oldDayCount = Math.ceil((s.endSlot - s.startSlot) / 3);
      const newDayCount = Math.ceil((clampedEnd - clampedStart) / 3);
      const startShift = Math.floor((clampedStart - s.startSlot) / 3);
      const endShift = Math.floor((s.endSlot - clampedEnd) / 3);

      const accomResult = adjustAccommodationsForResize(
        s.nightAccommodations,
        oldDayCount,
        newDayCount,
        startShift,
        endShift,
        s.name,
      );
      removed.push(...accomResult.removed);

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { nightAccommodations: _dropped, ...rest } = s;
      return {
        ...rest,
        startSlot: clampedStart,
        endSlot: clampedEnd,
        ...(accomResult.nightAccommodations !== undefined
          ? { nightAccommodations: accomResult.nightAccommodations }
          : {}),
      };
    });

  const shiftedMap = new Map(shifted.map((s) => [s.id, s]));

  const adjustedVisits = visits.map((v) => {
    if (removedStayIds.has(v.stayId)) {
      return { ...v, dayOffset: null, dayPart: null };
    }
    if (v.dayOffset === null) return v;

    const clamped = clampedStays.find((s) => s.id === v.stayId);
    const original = shiftedMap.get(v.stayId);
    if (!clamped || !original) return v;

    if (clamped.startSlot === original.startSlot && clamped.endSlot === original.endSlot) return v;

    const newDayCount = Math.ceil((clamped.endSlot - clamped.startSlot) / 3);
    const dayShiftWithinStay = Math.max(
      0,
      Math.floor((clamped.startSlot - original.startSlot) / 3),
    );
    const adjusted = v.dayOffset - dayShiftWithinStay;
    return adjusted >= 0 && adjusted < newDayCount
      ? { ...v, dayOffset: adjusted }
      : { ...v, dayOffset: null, dayPart: null };
  });

  return { stays: clampedStays, visits: adjustedVisits, removed };
}

// ─── Candidate stay promotion / demotion ─────────────────────────────────────

/** Move a stay from `stays` to `candidateStays`, unschedule its visits, and drop its routes. */
export function demoteStay(trip: HybridTrip, stayId: string): HybridTrip {
  const stay = trip.stays.find((s) => s.id === stayId);
  if (!stay) return trip;

  return {
    ...trip,
    stays: trip.stays.filter((s) => s.id !== stayId),
    candidateStays: [...trip.candidateStays, stay],
    visits: trip.visits.map((v) =>
      v.stayId === stayId ? { ...v, dayOffset: null, dayPart: null } : v,
    ),
    routes: trip.routes.filter((r) => r.fromStayId !== stayId && r.toStayId !== stayId),
  };
}

/** Move a candidate stay into `stays` with the given slot range. */
export function promoteCandidateStay(
  trip: HybridTrip,
  candidateId: string,
  startSlot: number,
  endSlot: number,
): HybridTrip {
  const candidate = trip.candidateStays.find((s) => s.id === candidateId);
  if (!candidate) return trip;

  return {
    ...trip,
    candidateStays: trip.candidateStays.filter((s) => s.id !== candidateId),
    stays: [...trip.stays, { ...candidate, startSlot, endSlot }],
  };
}
