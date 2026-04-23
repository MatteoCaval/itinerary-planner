import { describe, expect, it } from 'vitest';
import {
  adjustStaysForDateChange,
  applyTimelineDrag,
  demoteStay,
  extendTripAfter,
  extendTripBefore,
  promoteCandidateStay,
  shrinkTripAfter,
  shrinkTripBefore,
} from '../tripMutations';
import type { DragState, HybridTrip, Stay, VisitItem } from '../types';

function makeStay(overrides: Partial<Stay> = {}): Stay {
  return {
    id: 's1',
    name: 'Test',
    color: '#000',
    startSlot: 0,
    endSlot: 9,
    centerLat: 0,
    centerLng: 0,
    ...overrides,
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
      stays: [
        makeStay({ startSlot: 0, endSlot: 6 }),
        makeStay({ id: 's2', startSlot: 6, endSlot: 9 }),
      ],
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

describe('shrinkTripBefore', () => {
  it('removes first day and shifts stays back by 3 slots', () => {
    const trip = makeTrip({
      startDate: '2026-03-27',
      totalDays: 3,
      stays: [makeStay({ startSlot: 3, endSlot: 9 })],
    });
    const result = shrinkTripBefore(trip);
    expect(result).not.toBeNull();
    expect(result!.startDate).toBe('2026-03-28');
    expect(result!.totalDays).toBe(2);
    expect(result!.stays[0].startSlot).toBe(0);
    expect(result!.stays[0].endSlot).toBe(6);
  });

  it('returns null if first day has a stay', () => {
    const trip = makeTrip({
      stays: [makeStay({ startSlot: 0, endSlot: 6 })],
    });
    expect(shrinkTripBefore(trip)).toBeNull();
  });

  it('returns null for 1-day trip', () => {
    const trip = makeTrip({ totalDays: 1 });
    expect(shrinkTripBefore(trip)).toBeNull();
  });
});

describe('shrinkTripAfter', () => {
  it('removes last day when empty', () => {
    const trip = makeTrip({
      totalDays: 3,
      stays: [makeStay({ startSlot: 0, endSlot: 6 })], // covers days 0-1, day 2 empty
    });
    const result = shrinkTripAfter(trip);
    expect(result).not.toBeNull();
    expect(result!.totalDays).toBe(2);
    expect(result!.stays[0].startSlot).toBe(0); // unchanged
  });

  it('returns null if last day has a stay', () => {
    const trip = makeTrip({
      totalDays: 3,
      stays: [makeStay({ startSlot: 0, endSlot: 9 })], // covers all 3 days
    });
    expect(shrinkTripAfter(trip)).toBeNull();
  });
});

describe('applyTimelineDrag', () => {
  const drag: NonNullable<DragState> = {
    stayId: 's1',
    mode: 'move',
    originX: 0,
    originalStart: 0,
    originalEnd: 6,
  };

  it('moves a stay by delta slots', () => {
    const stays = [makeStay({ startSlot: 0, endSlot: 6 })];
    const result = applyTimelineDrag(stays, drag, 3, 15);
    expect(result.stays[0].startSlot).toBe(3);
    expect(result.stays[0].endSlot).toBe(9);
    expect(result.removed).toEqual([]);
  });

  it('clamps move to not exceed total slots', () => {
    const stays = [makeStay({ startSlot: 0, endSlot: 6 })];
    const result = applyTimelineDrag(stays, drag, 100, 15);
    expect(result.stays[0].startSlot).toBe(9); // 15 - 6 = 9
    expect(result.stays[0].endSlot).toBe(15);
    expect(result.removed).toEqual([]);
  });

  it('resizes end by delta', () => {
    const resizeDrag: NonNullable<DragState> = { ...drag, mode: 'resize-end' };
    const stays = [makeStay({ startSlot: 0, endSlot: 6 })];
    const result = applyTimelineDrag(stays, resizeDrag, 3, 15);
    expect(result.stays[0].startSlot).toBe(0);
    expect(result.stays[0].endSlot).toBe(9);
    expect(result.removed).toEqual([]);
  });

  it('resizes start by delta', () => {
    const resizeDrag: NonNullable<DragState> = { ...drag, mode: 'resize-start' };
    const stays = [makeStay({ startSlot: 0, endSlot: 6 })];
    const result = applyTimelineDrag(stays, resizeDrag, 2, 15);
    expect(result.stays[0].startSlot).toBe(2);
    expect(result.stays[0].endSlot).toBe(6);
    expect(result.removed).toEqual([]);
  });

  it('reports singleton accommodations removed on resize-end shrink', () => {
    const stays: Stay[] = [
      {
        id: 's1',
        name: 'Tokyo',
        color: '#000',
        startSlot: 0,
        endSlot: 9,
        centerLat: 0,
        centerLng: 0,
        nightAccommodations: {
          0: { name: 'Hotel A' },
          1: { name: 'Hotel A' },
          2: { name: 'Hotel B' },
        },
      },
    ];
    const drag: DragState = {
      stayId: 's1',
      mode: 'resize-end',
      originX: 0,
      originalStart: 0,
      originalEnd: 9,
      originalNightAccommodations: {
        0: { name: 'Hotel A' },
        1: { name: 'Hotel A' },
        2: { name: 'Hotel B' },
      },
    };
    const result = applyTimelineDrag(stays, drag, -3, 15);
    expect(result.stays[0].endSlot).toBe(6);
    expect(result.stays[0].nightAccommodations).toEqual({
      0: { name: 'Hotel A' },
      1: { name: 'Hotel A' },
    });
    expect(result.removed).toEqual([{ name: 'Hotel B', stayLabel: 'Tokyo' }]);
  });

  it('extends last accommodation group on resize-end grow', () => {
    const stays: Stay[] = [
      {
        id: 's1',
        name: 'Tokyo',
        color: '#000',
        startSlot: 0,
        endSlot: 6,
        centerLat: 0,
        centerLng: 0,
        nightAccommodations: {
          0: { name: 'Hotel A' },
          1: { name: 'Hotel A' },
        },
      },
    ];
    const drag: DragState = {
      stayId: 's1',
      mode: 'resize-end',
      originX: 0,
      originalStart: 0,
      originalEnd: 6,
      originalNightAccommodations: {
        0: { name: 'Hotel A' },
        1: { name: 'Hotel A' },
      },
    };
    const result = applyTimelineDrag(stays, drag, 3, 15);
    expect(result.stays[0].endSlot).toBe(9);
    expect(result.stays[0].nightAccommodations).toEqual({
      0: { name: 'Hotel A' },
      1: { name: 'Hotel A' },
      2: { name: 'Hotel A' },
    });
    expect(result.removed).toEqual([]);
  });
});

describe('adjustStaysForDateChange', () => {
  it('removes stays fully outside after start shift', () => {
    const stays = [
      makeStay({ id: 'a', startSlot: 0, endSlot: 3 }),
      makeStay({ id: 'b', startSlot: 3, endSlot: 9 }),
    ];
    const visits: VisitItem[] = [];
    // Shift start forward by 1 day (slotShift=3), new range = 4 days * 3 = 12 slots
    const result = adjustStaysForDateChange(stays, visits, 3, 12);
    // Stay 'a' was at 0-3, after shift becomes -3 to 0 → endSlot=0, filtered out
    expect(result.stays.find((s) => s.id === 'a')).toBeUndefined();
    // Stay 'b' was at 3-9, after shift becomes 0-6 → within range
    expect(result.stays.find((s) => s.id === 'b')).toBeDefined();
    expect(result.stays.find((s) => s.id === 'b')!.startSlot).toBe(0);
  });

  it('clamps stays partially outside at the end', () => {
    const stays = [makeStay({ id: 'a', startSlot: 3, endSlot: 12 })];
    const visits: VisitItem[] = [];
    // No shift, but shrink to 3 days (9 slots)
    const result = adjustStaysForDateChange(stays, visits, 0, 9);
    expect(result.stays[0].endSlot).toBe(9);
    expect(result.stays[0].startSlot).toBe(3);
  });

  it('unschedules visits that overflow after clamping', () => {
    const stays = [makeStay({ id: 'a', startSlot: 0, endSlot: 9 })];
    const visits: VisitItem[] = [
      {
        id: 'v1',
        name: 'V1',
        type: 'landmark',
        stayId: 'a',
        lat: 0,
        lng: 0,
        dayOffset: 0,
        dayPart: 'morning',
        order: 0,
      },
      {
        id: 'v2',
        name: 'V2',
        type: 'landmark',
        stayId: 'a',
        lat: 0,
        lng: 0,
        dayOffset: 2,
        dayPart: 'morning',
        order: 0,
      },
    ];
    // Shrink to 2 days (6 slots)
    const result = adjustStaysForDateChange(stays, visits, 0, 6);
    const v1 = result.visits.find((v) => v.id === 'v1')!;
    const v2 = result.visits.find((v) => v.id === 'v2')!;
    expect(v1.dayOffset).toBe(0); // still fits
    expect(v2.dayOffset).toBeNull(); // day 2 is gone → unscheduled
  });

  it('unschedules visits belonging to removed stays', () => {
    const stays = [
      makeStay({ id: 'a', startSlot: 0, endSlot: 3 }),
      makeStay({ id: 'b', startSlot: 3, endSlot: 9 }),
    ];
    const visits: VisitItem[] = [
      {
        id: 'v1',
        name: 'V1',
        type: 'landmark',
        stayId: 'a',
        lat: 0,
        lng: 0,
        dayOffset: 0,
        dayPart: 'morning',
        order: 0,
      },
      {
        id: 'v2',
        name: 'V2',
        type: 'landmark',
        stayId: 'b',
        lat: 0,
        lng: 0,
        dayOffset: 0,
        dayPart: 'morning',
        order: 0,
      },
    ];
    // Shift start by 1 day — stay 'a' gets removed
    const result = adjustStaysForDateChange(stays, visits, 3, 12);
    const v1 = result.visits.find((v) => v.id === 'v1')!;
    const v2 = result.visits.find((v) => v.id === 'v2')!;
    expect(v1.dayOffset).toBeNull(); // stay 'a' removed → unscheduled
    expect(v2.dayOffset).toBe(0); // stay 'b' survived
  });

  it('handles combined start shift + end shrink', () => {
    const stays = [
      makeStay({ id: 'a', startSlot: 0, endSlot: 3 }),
      makeStay({ id: 'b', startSlot: 6, endSlot: 12 }),
    ];
    const visits: VisitItem[] = [];
    // Shift start by 1 day, new range = 3 days (9 slots)
    const result = adjustStaysForDateChange(stays, visits, 3, 9);
    // 'a': shifted to -3..0 → filtered out
    expect(result.stays.find((s) => s.id === 'a')).toBeUndefined();
    // 'b': shifted to 3..9 → fits
    expect(result.stays.find((s) => s.id === 'b')!.startSlot).toBe(3);
    expect(result.stays.find((s) => s.id === 'b')!.endSlot).toBe(9);
  });
});

describe('demoteStay', () => {
  const baseTrip: HybridTrip = {
    id: 'trip',
    name: 'Trip',
    startDate: '2026-05-01',
    totalDays: 10,
    version: 3,
    stays: [
      {
        id: 's1',
        name: 'Tokyo',
        color: '#111',
        startSlot: 0,
        endSlot: 9,
        centerLat: 35.68,
        centerLng: 139.77,
      },
      {
        id: 's2',
        name: 'Kyoto',
        color: '#222',
        startSlot: 9,
        endSlot: 18,
        centerLat: 35.01,
        centerLng: 135.77,
      },
    ],
    candidateStays: [],
    visits: [
      {
        id: 'v1',
        stayId: 's1',
        name: 'Sensoji',
        type: 'landmark',
        lat: 35.71,
        lng: 139.79,
        dayOffset: 0,
        dayPart: 'morning',
        order: 0,
      },
      {
        id: 'v2',
        stayId: 's1',
        name: 'Wishlist',
        type: 'food',
        lat: 35.69,
        lng: 139.7,
        dayOffset: null,
        dayPart: null,
        order: 0,
      },
      {
        id: 'v3',
        stayId: 's2',
        name: 'Fushimi Inari',
        type: 'landmark',
        lat: 34.97,
        lng: 135.77,
        dayOffset: 0,
        dayPart: 'morning',
        order: 0,
      },
    ],
    routes: [{ fromStayId: 's1', toStayId: 's2', mode: 'train' }],
  };

  it('moves the stay from stays to candidateStays', () => {
    const result = demoteStay(baseTrip, 's1');
    expect(result.stays.map((s) => s.id)).toEqual(['s2']);
    expect(result.candidateStays.map((s) => s.id)).toEqual(['s1']);
  });

  it('unschedules all visits belonging to the demoted stay', () => {
    const result = demoteStay(baseTrip, 's1');
    const s1Visits = result.visits.filter((v) => v.stayId === 's1');
    expect(s1Visits).toHaveLength(2);
    s1Visits.forEach((v) => {
      expect(v.dayOffset).toBeNull();
      expect(v.dayPart).toBeNull();
    });
    const s2Visit = result.visits.find((v) => v.id === 'v3')!;
    expect(s2Visit.dayOffset).toBe(0);
    expect(s2Visit.dayPart).toBe('morning');
  });

  it('drops routes referencing the demoted stay', () => {
    const result = demoteStay(baseTrip, 's1');
    expect(result.routes).toEqual([]);
  });

  it('returns trip unchanged when stayId not found', () => {
    const result = demoteStay(baseTrip, 'nope');
    expect(result).toEqual(baseTrip);
  });
});

describe('promoteCandidateStay', () => {
  const tripWithCandidate: HybridTrip = {
    id: 'trip',
    name: 'Trip',
    startDate: '2026-05-01',
    totalDays: 10,
    version: 3,
    stays: [
      {
        id: 's1',
        name: 'Tokyo',
        color: '#111',
        startSlot: 0,
        endSlot: 9,
        centerLat: 35.68,
        centerLng: 139.77,
      },
    ],
    candidateStays: [
      {
        id: 'c1',
        name: 'Kyoto',
        color: '#222',
        startSlot: 0,
        endSlot: 0,
        centerLat: 35.01,
        centerLng: 135.77,
      },
    ],
    visits: [
      {
        id: 'v-attached',
        stayId: 'c1',
        name: 'Fushimi Inari',
        type: 'landmark',
        lat: 34.97,
        lng: 135.77,
        dayOffset: null,
        dayPart: null,
        order: 0,
      },
    ],
    routes: [],
  };

  it('moves the candidate from candidateStays to stays with new startSlot/endSlot', () => {
    const result = promoteCandidateStay(tripWithCandidate, 'c1', 9, 18);
    expect(result.candidateStays).toEqual([]);
    expect(result.stays.map((s) => s.id)).toEqual(['s1', 'c1']);
    const promoted = result.stays.find((s) => s.id === 'c1')!;
    expect(promoted.startSlot).toBe(9);
    expect(promoted.endSlot).toBe(18);
  });

  it('preserves attached visits (stayId unchanged)', () => {
    const result = promoteCandidateStay(tripWithCandidate, 'c1', 9, 18);
    const attached = result.visits.find((v) => v.id === 'v-attached')!;
    expect(attached.stayId).toBe('c1');
  });

  it('returns trip unchanged when candidateId not found', () => {
    const result = promoteCandidateStay(tripWithCandidate, 'nope', 0, 3);
    expect(result).toEqual(tripWithCandidate);
  });
});
