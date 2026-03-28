import type { DragState, HybridTrip, Stay } from './types';
import { addDaysTo, safeDate } from './dateUtils';
import { clamp } from './geoUtils';

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

// ─── Timeline drag ───────────────────────────────────────────────────────────

/** Apply a slot delta to a stay during timeline drag (move/resize). Returns updated stays array. */
export function applyTimelineDrag(
  stays: Stay[], dragState: NonNullable<DragState>, delta: number, totalSlots: number,
): Stay[] {
  return stays.map((s) => {
    if (s.id !== dragState.stayId) return s;
    const len = dragState.originalEnd - dragState.originalStart;
    if (dragState.mode === 'move') {
      const next = clamp(dragState.originalStart + delta, 0, totalSlots - len);
      return { ...s, startSlot: next, endSlot: next + len };
    }
    if (dragState.mode === 'resize-start') {
      return { ...s, startSlot: clamp(dragState.originalStart + delta, 0, dragState.originalEnd - 1) };
    }
    return { ...s, endSlot: clamp(dragState.originalEnd + delta, dragState.originalStart + 1, totalSlots) };
  });
}

// ─── Date range shrink/shift ─────────────────────────────────────────────────

/**
 * Adjust stays after a date range change (start date shift and/or totalDays decrease).
 * - Shifts all stays by `-slotShift` to account for start date moving.
 * - Removes stays fully outside the new range.
 * - Clamps partially outside stays and unschedules overflowing visits.
 */
export function adjustStaysForDateChange(stays: Stay[], slotShift: number, newMaxSlot: number): Stay[] {
  return stays
    .map((s) => ({
      ...s,
      startSlot: s.startSlot - slotShift,
      endSlot: s.endSlot - slotShift,
    }))
    .filter((s) => s.endSlot > 0 && s.startSlot < newMaxSlot)
    .map((s) => {
      const clamped = { ...s, startSlot: Math.max(0, s.startSlot), endSlot: Math.min(newMaxSlot, s.endSlot) };
      if (clamped.startSlot === s.startSlot && clamped.endSlot === s.endSlot) return clamped;
      const newDayCount = Math.ceil((clamped.endSlot - clamped.startSlot) / 3);
      const dayShiftWithinStay = Math.max(0, Math.floor((clamped.startSlot - s.startSlot) / 3));
      return {
        ...clamped,
        visits: clamped.visits.map((v) => {
          if (v.dayOffset === null) return v;
          const adjusted = v.dayOffset - dayShiftWithinStay;
          return adjusted >= 0 && adjusted < newDayCount
            ? { ...v, dayOffset: adjusted }
            : { ...v, dayOffset: null, dayPart: null };
        }),
      };
    });
}
