import { describe, expect, it } from 'vitest';
import { createVisit, normalizeVisitOrders, sortVisits } from '../visitLogic';
import type { VisitItem } from '../types';

function makeVisit(overrides: Partial<VisitItem> = {}): VisitItem {
  return {
    id: 'v1',
    name: 'Test',
    type: 'landmark',
    area: '',
    lat: 0,
    lng: 0,
    dayOffset: null,
    dayPart: null,
    order: 0,
    ...overrides,
  };
}

describe('createVisit', () => {
  it('creates a visit with all fields', () => {
    const v = createVisit(
      'id1',
      'Colosseum',
      'landmark',
      'Rome',
      41.89,
      12.49,
      0,
      'morning',
      0,
      '2h',
    );
    expect(v.id).toBe('id1');
    expect(v.name).toBe('Colosseum');
    expect(v.durationHint).toBe('2h');
    expect(v.dayOffset).toBe(0);
  });
});

describe('sortVisits', () => {
  it('puts unscheduled visits first', () => {
    const visits = [
      makeVisit({ id: 'a', dayOffset: 0, dayPart: 'morning', order: 0 }),
      makeVisit({ id: 'b', dayOffset: null, dayPart: null, order: 0 }),
    ];
    const sorted = sortVisits(visits);
    expect(sorted[0].id).toBe('b');
    expect(sorted[1].id).toBe('a');
  });

  it('sorts by dayOffset then dayPart then order', () => {
    const visits = [
      makeVisit({ id: 'a', dayOffset: 1, dayPart: 'morning', order: 0 }),
      makeVisit({ id: 'b', dayOffset: 0, dayPart: 'evening', order: 0 }),
      makeVisit({ id: 'c', dayOffset: 0, dayPart: 'morning', order: 1 }),
      makeVisit({ id: 'd', dayOffset: 0, dayPart: 'morning', order: 0 }),
    ];
    const sorted = sortVisits(visits);
    expect(sorted.map((v) => v.id)).toEqual(['d', 'c', 'b', 'a']);
  });
});

describe('normalizeVisitOrders', () => {
  it('re-indexes orders within each slot bucket', () => {
    const visits = [
      makeVisit({ id: 'a', dayOffset: 0, dayPart: 'morning', order: 5 }),
      makeVisit({ id: 'b', dayOffset: 0, dayPart: 'morning', order: 10 }),
      makeVisit({ id: 'c', dayOffset: 0, dayPart: 'afternoon', order: 3 }),
    ];
    const normalized = normalizeVisitOrders(visits);
    const mornings = normalized.filter((v) => v.dayPart === 'morning');
    expect(mornings[0].order).toBe(0);
    expect(mornings[1].order).toBe(1);
    const afternoons = normalized.filter((v) => v.dayPart === 'afternoon');
    expect(afternoons[0].order).toBe(0);
  });

  it('puts unscheduled visits in inbox bucket', () => {
    const visits = [
      makeVisit({ id: 'a', dayOffset: null, dayPart: null, order: 5 }),
      makeVisit({ id: 'b', dayOffset: null, dayPart: null, order: 2 }),
    ];
    const normalized = normalizeVisitOrders(visits);
    expect(normalized[0].order).toBe(0);
    expect(normalized[1].order).toBe(1);
  });
});
