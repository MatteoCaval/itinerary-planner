import { describe, expect, it } from 'vitest';
import {
  deriveAccommodationGroups,
  deriveStayDays,
  getOverlapIds,
  getStayNightCount,
  isSlotRangeEmpty,
} from '../stayLogic';
import type { HybridTrip, Stay } from '../types';

function makeStay(overrides: Partial<Stay> = {}): Stay {
  return {
    id: 's1',
    name: 'Test',
    color: '#000',
    startSlot: 0,
    endSlot: 9,
    centerLat: 0,
    centerLng: 0,
    lodging: 'Hotel',
    travelModeToNext: 'train',
    visits: [],
    ...overrides,
  };
}

function makeTrip(overrides: Partial<HybridTrip> = {}): HybridTrip {
  return { id: 't1', name: 'Trip', startDate: '2026-03-27', totalDays: 5, stays: [], ...overrides };
}

describe('getStayNightCount', () => {
  it('returns 1 for a single-slot stay', () => {
    expect(getStayNightCount(makeStay({ startSlot: 0, endSlot: 1 }))).toBe(1);
  });
  it('returns 3 for a 3-day stay', () => {
    expect(getStayNightCount(makeStay({ startSlot: 0, endSlot: 9 }))).toBe(3);
  });
  it('returns 2 for a partial stay spanning 2 days', () => {
    expect(getStayNightCount(makeStay({ startSlot: 1, endSlot: 5 }))).toBe(2);
  });
});

describe('getOverlapIds', () => {
  it('returns empty set when no overlaps', () => {
    const stays = [
      makeStay({ id: 'a', startSlot: 0, endSlot: 3 }),
      makeStay({ id: 'b', startSlot: 3, endSlot: 6 }),
    ];
    expect(getOverlapIds(stays).size).toBe(0);
  });
  it('detects overlapping stays', () => {
    const stays = [
      makeStay({ id: 'a', startSlot: 0, endSlot: 5 }),
      makeStay({ id: 'b', startSlot: 3, endSlot: 9 }),
    ];
    const overlaps = getOverlapIds(stays);
    expect(overlaps.has('a')).toBe(true);
    expect(overlaps.has('b')).toBe(true);
  });
  it('handles three stays with partial overlap', () => {
    const stays = [
      makeStay({ id: 'a', startSlot: 0, endSlot: 3 }),
      makeStay({ id: 'b', startSlot: 2, endSlot: 6 }),
      makeStay({ id: 'c', startSlot: 6, endSlot: 9 }),
    ];
    const overlaps = getOverlapIds(stays);
    expect(overlaps.has('a')).toBe(true);
    expect(overlaps.has('b')).toBe(true);
    expect(overlaps.has('c')).toBe(false);
  });
});

describe('isSlotRangeEmpty', () => {
  const stays = [makeStay({ startSlot: 3, endSlot: 6 })];
  it('returns true for empty range', () => {
    expect(isSlotRangeEmpty(stays, 0, 3)).toBe(true);
  });
  it('returns false for overlapping range', () => {
    expect(isSlotRangeEmpty(stays, 2, 4)).toBe(false);
  });
  it('returns true when stays array is empty', () => {
    expect(isSlotRangeEmpty([], 0, 9)).toBe(true);
  });
});

describe('deriveStayDays', () => {
  it('produces correct number of days for a 3-day stay', () => {
    const trip = makeTrip();
    const stay = makeStay({ startSlot: 0, endSlot: 9 });
    const days = deriveStayDays(trip, stay);
    expect(days).toHaveLength(3);
    expect(days[0].dayOffset).toBe(0);
    expect(days[2].dayOffset).toBe(2);
  });

  it('calculates correct absolute days when stay starts mid-trip', () => {
    const trip = makeTrip();
    const stay = makeStay({ startSlot: 6, endSlot: 12 });
    const days = deriveStayDays(trip, stay);
    expect(days[0].absoluteDay).toBe(2);
    expect(days[1].absoluteDay).toBe(3);
  });

  it('uses lodging fallback when no nightAccommodations set', () => {
    const trip = makeTrip();
    const stay = makeStay({ startSlot: 0, endSlot: 9, lodging: 'Grand Hotel' });
    const days = deriveStayDays(trip, stay);
    const nightDays = days.filter((d) => d.hasNight);
    expect(nightDays.length).toBeGreaterThan(0);
    expect(nightDays[0].nightAccommodation?.name).toBe('Grand Hotel');
  });

  it('uses explicit nightAccommodations when set', () => {
    const trip = makeTrip();
    const stay = makeStay({
      startSlot: 0,
      endSlot: 9,
      lodging: 'Default',
      nightAccommodations: { 0: { name: 'Night 1 Hotel' }, 1: { name: 'Night 2 Hotel' } },
    });
    const days = deriveStayDays(trip, stay);
    expect(days[0].nightAccommodation?.name).toBe('Night 1 Hotel');
    expect(days[1].nightAccommodation?.name).toBe('Night 2 Hotel');
  });
});

describe('deriveAccommodationGroups', () => {
  it('groups consecutive nights with same accommodation', () => {
    const trip = makeTrip();
    const stay = makeStay({ startSlot: 0, endSlot: 9, lodging: 'Same Hotel' });
    const days = deriveStayDays(trip, stay);
    const groups = deriveAccommodationGroups(days);
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe('Same Hotel');
    expect(groups[0].nights).toBe(3); // 3-day stay (slots 0-9) has evening on all 3 days
  });

  it('splits into multiple groups for different accommodations', () => {
    const trip = makeTrip();
    const stay = makeStay({
      startSlot: 0,
      endSlot: 9,
      nightAccommodations: { 0: { name: 'Hotel A' }, 1: { name: 'Hotel B' } },
    });
    const days = deriveStayDays(trip, stay);
    const groups = deriveAccommodationGroups(days);
    // 3 days = 3 evenings; day 0 has Hotel A, day 1 has Hotel B, day 2 falls back to lodging
    expect(groups).toHaveLength(3);
    expect(groups[0].name).toBe('Hotel A');
    expect(groups[1].name).toBe('Hotel B');
  });
});
