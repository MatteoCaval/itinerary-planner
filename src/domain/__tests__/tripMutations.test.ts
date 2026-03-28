import { describe, expect, it } from 'vitest';
import { adjustStaysForDateChange, applyTimelineDrag, extendTripAfter, extendTripBefore } from '../tripMutations';
import type { DragState, HybridTrip, Stay } from '../types';

function makeStay(overrides: Partial<Stay> = {}): Stay {
  return {
    id: 's1', name: 'Test', color: '#000', startSlot: 0, endSlot: 9,
    centerLat: 0, centerLng: 0, lodging: 'Hotel', travelModeToNext: 'train',
    visits: [], ...overrides,
  };
}

function makeTrip(overrides: Partial<HybridTrip> = {}): HybridTrip {
  return { id: 't1', name: 'Trip', startDate: '2026-03-27', totalDays: 5, stays: [], ...overrides };
}

describe('extendTripBefore', () => {
  it('shifts start date back by 1 day and increases totalDays', () => {
    const trip = makeTrip({ startDate: '2026-03-27', totalDays: 3 });
    const result = extendTripBefore(trip);
    expect(result.startDate).toBe('2026-03-26');
    expect(result.totalDays).toBe(4);
  });

  it('shifts all stay slots by +3', () => {
    const trip = makeTrip({
      stays: [makeStay({ startSlot: 0, endSlot: 6 }), makeStay({ id: 's2', startSlot: 6, endSlot: 9 })],
    });
    const result = extendTripBefore(trip);
    expect(result.stays[0].startSlot).toBe(3);
    expect(result.stays[0].endSlot).toBe(9);
    expect(result.stays[1].startSlot).toBe(9);
    expect(result.stays[1].endSlot).toBe(12);
  });
});

describe('extendTripAfter', () => {
  it('increases totalDays by 1 without changing stays', () => {
    const trip = makeTrip({ totalDays: 5, stays: [makeStay({ startSlot: 0, endSlot: 9 })] });
    const result = extendTripAfter(trip);
    expect(result.totalDays).toBe(6);
    expect(result.stays[0].startSlot).toBe(0);
    expect(result.stays[0].endSlot).toBe(9);
  });
});

describe('applyTimelineDrag', () => {
  const drag: NonNullable<DragState> = {
    stayId: 's1', mode: 'move', originX: 0, originalStart: 0, originalEnd: 6,
  };

  it('moves a stay by delta slots', () => {
    const stays = [makeStay({ startSlot: 0, endSlot: 6 })];
    const result = applyTimelineDrag(stays, drag, 3, 15);
    expect(result[0].startSlot).toBe(3);
    expect(result[0].endSlot).toBe(9);
  });

  it('clamps move to not exceed total slots', () => {
    const stays = [makeStay({ startSlot: 0, endSlot: 6 })];
    const result = applyTimelineDrag(stays, drag, 100, 15);
    expect(result[0].startSlot).toBe(9); // 15 - 6 = 9
    expect(result[0].endSlot).toBe(15);
  });

  it('resizes end by delta', () => {
    const resizeDrag: NonNullable<DragState> = { ...drag, mode: 'resize-end' };
    const stays = [makeStay({ startSlot: 0, endSlot: 6 })];
    const result = applyTimelineDrag(stays, resizeDrag, 3, 15);
    expect(result[0].startSlot).toBe(0);
    expect(result[0].endSlot).toBe(9);
  });

  it('resizes start by delta', () => {
    const resizeDrag: NonNullable<DragState> = { ...drag, mode: 'resize-start' };
    const stays = [makeStay({ startSlot: 0, endSlot: 6 })];
    const result = applyTimelineDrag(stays, resizeDrag, 2, 15);
    expect(result[0].startSlot).toBe(2);
    expect(result[0].endSlot).toBe(6);
  });
});

describe('adjustStaysForDateChange', () => {
  it('removes stays fully outside after start shift', () => {
    const stays = [
      makeStay({ id: 'a', startSlot: 0, endSlot: 3 }),
      makeStay({ id: 'b', startSlot: 3, endSlot: 9 }),
    ];
    // Shift start forward by 1 day (slotShift=3), new range = 4 days * 3 = 12 slots
    const result = adjustStaysForDateChange(stays, 3, 12);
    // Stay 'a' was at 0-3, after shift becomes -3 to 0 → endSlot=0, filtered out
    expect(result.find((s) => s.id === 'a')).toBeUndefined();
    // Stay 'b' was at 3-9, after shift becomes 0-6 → within range
    expect(result.find((s) => s.id === 'b')).toBeDefined();
    expect(result.find((s) => s.id === 'b')!.startSlot).toBe(0);
  });

  it('clamps stays partially outside at the end', () => {
    const stays = [makeStay({ id: 'a', startSlot: 3, endSlot: 12 })];
    // No shift, but shrink to 3 days (9 slots)
    const result = adjustStaysForDateChange(stays, 0, 9);
    expect(result[0].endSlot).toBe(9);
    expect(result[0].startSlot).toBe(3);
  });

  it('unschedules visits that overflow after clamping', () => {
    const stays = [makeStay({
      id: 'a', startSlot: 0, endSlot: 9,
      visits: [
        { id: 'v1', name: 'V1', type: 'landmark', area: '', lat: 0, lng: 0, dayOffset: 0, dayPart: 'morning', order: 0 },
        { id: 'v2', name: 'V2', type: 'landmark', area: '', lat: 0, lng: 0, dayOffset: 2, dayPart: 'morning', order: 0 },
      ],
    })];
    // Shrink to 2 days (6 slots)
    const result = adjustStaysForDateChange(stays, 0, 6);
    const v1 = result[0].visits.find((v) => v.id === 'v1')!;
    const v2 = result[0].visits.find((v) => v.id === 'v2')!;
    expect(v1.dayOffset).toBe(0); // still fits
    expect(v2.dayOffset).toBeNull(); // day 2 is gone → unscheduled
  });

  it('handles combined start shift + end shrink', () => {
    const stays = [
      makeStay({ id: 'a', startSlot: 0, endSlot: 3 }),
      makeStay({ id: 'b', startSlot: 6, endSlot: 12 }),
    ];
    // Shift start by 1 day, new range = 3 days (9 slots)
    const result = adjustStaysForDateChange(stays, 3, 9);
    // 'a': shifted to -3..0 → filtered out
    expect(result.find((s) => s.id === 'a')).toBeUndefined();
    // 'b': shifted to 3..9 → fits
    expect(result.find((s) => s.id === 'b')!.startSlot).toBe(3);
    expect(result.find((s) => s.id === 'b')!.endSlot).toBe(9);
  });
});
