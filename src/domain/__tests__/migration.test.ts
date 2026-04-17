import { describe, it, expect } from 'vitest';
import { migrateV1toV2, normalizeTrip } from '../migration';
import type { HybridTrip, V1HybridTrip, VisitItem } from '../types';

const makeV1Trip = (): V1HybridTrip => ({
  id: 'trip-1',
  name: 'Japan',
  startDate: '2026-05-01',
  totalDays: 10,
  stays: [
    {
      id: 'stay-1',
      name: 'Tokyo',
      color: '#2167d7',
      startSlot: 0,
      endSlot: 9,
      centerLat: 35.68,
      centerLng: 139.77,
      lodging: 'Hotel Sunroute',
      travelModeToNext: 'train',
      travelDurationToNext: '2h 15m',
      travelNotesToNext: 'Shinkansen',
      visits: [
        {
          id: 'v1',
          name: 'Senso-ji',
          type: 'landmark',
          area: 'Asakusa',
          lat: 35.71,
          lng: 139.79,
          dayOffset: 0,
          dayPart: 'morning',
          order: 0,
        },
        {
          id: 'v2',
          name: 'Hotel Check',
          type: 'hotel',
          area: '',
          lat: 35.68,
          lng: 139.77,
          dayOffset: null,
          dayPart: null,
          order: 1,
        },
        {
          id: 'v3',
          name: 'Neighborhood',
          type: 'area',
          area: 'Shinjuku',
          lat: 35.69,
          lng: 139.7,
          dayOffset: 1,
          dayPart: 'afternoon',
          order: 0,
        },
      ],
      checklist: [{ id: 'cl1', text: 'Book JR Pass', done: false }],
    },
    {
      id: 'stay-2',
      name: 'Kyoto',
      color: '#615cf6',
      startSlot: 9,
      endSlot: 18,
      centerLat: 35.01,
      centerLng: 135.77,
      lodging: '',
      nightAccommodations: { 0: { name: 'Ryokan Zen', lat: 35.01, lng: 135.77 } },
      travelModeToNext: 'flight',
      visits: [
        {
          id: 'v4',
          name: 'Fushimi Inari',
          type: 'landmark',
          area: '',
          lat: 34.97,
          lng: 135.77,
          dayOffset: 0,
          dayPart: 'morning',
          order: 0,
        },
      ],
    },
  ],
});

describe('migrateV1toV2', () => {
  it('sets version to 2 and adds timestamps', () => {
    const result = migrateV1toV2(makeV1Trip());
    expect(result.version).toBe(2);
    expect(result.createdAt).toBeTypeOf('number');
    expect(result.updatedAt).toBeTypeOf('number');
  });

  it('extracts visits to trip level with stayId', () => {
    const result = migrateV1toV2(makeV1Trip());
    expect(result.visits).toHaveLength(4);
    expect(result.visits.filter((v) => v.stayId === 'stay-1')).toHaveLength(3);
    expect(result.visits.filter((v) => v.stayId === 'stay-2')).toHaveLength(1);
  });

  it('remaps area and hotel visit types to landmark', () => {
    const result = migrateV1toV2(makeV1Trip());
    const types = result.visits.map((v) => v.type);
    expect(types).not.toContain('hotel');
    expect(types).not.toContain('area');
    expect(result.visits.find((v) => v.id === 'v2')!.type).toBe('landmark');
    expect(result.visits.find((v) => v.id === 'v3')!.type).toBe('landmark');
  });

  it('removes area field from visits', () => {
    const result = migrateV1toV2(makeV1Trip());
    result.visits.forEach((v) => {
      expect(v).not.toHaveProperty('area');
    });
  });

  it('builds routes from consecutive stays', () => {
    const result = migrateV1toV2(makeV1Trip());
    expect(result.routes).toHaveLength(1);
    expect(result.routes[0]).toEqual({
      fromStayId: 'stay-1',
      toStayId: 'stay-2',
      mode: 'train',
      duration: '2h 15m',
      notes: 'Shinkansen',
    });
  });

  it('removes visits, lodging, and travel fields from stays', () => {
    const result = migrateV1toV2(makeV1Trip());
    result.stays.forEach((s) => {
      expect(s).not.toHaveProperty('visits');
      expect(s).not.toHaveProperty('lodging');
      expect(s).not.toHaveProperty('travelModeToNext');
      expect(s).not.toHaveProperty('travelDurationToNext');
      expect(s).not.toHaveProperty('travelNotesToNext');
    });
  });

  it('migrates lodging to nightAccommodations when absent', () => {
    const result = migrateV1toV2(makeV1Trip());
    const tokyo = result.stays.find((s) => s.id === 'stay-1')!;
    // Tokyo had lodging='Hotel Sunroute' but no nightAccommodations
    // Should have 3 nights (9 slots / 3 = 3 days, so 3 nights)
    expect(tokyo.nightAccommodations).toBeDefined();
    expect(Object.keys(tokyo.nightAccommodations!)).toHaveLength(3);
    expect(tokyo.nightAccommodations![0].name).toBe('Hotel Sunroute');
  });

  it('preserves existing nightAccommodations', () => {
    const result = migrateV1toV2(makeV1Trip());
    const kyoto = result.stays.find((s) => s.id === 'stay-2')!;
    // Kyoto had nightAccommodations already, lodging was empty
    expect(kyoto.nightAccommodations![0].name).toBe('Ryokan Zen');
  });

  it('preserves stay checklist and notes', () => {
    const result = migrateV1toV2(makeV1Trip());
    const tokyo = result.stays.find((s) => s.id === 'stay-1')!;
    expect(tokyo.checklist).toHaveLength(1);
    expect(tokyo.checklist![0].text).toBe('Book JR Pass');
  });

  it('preserves visit scheduling (dayOffset/dayPart)', () => {
    const result = migrateV1toV2(makeV1Trip());
    const sensoji = result.visits.find((v) => v.id === 'v1')!;
    expect(sensoji.dayOffset).toBe(0);
    expect(sensoji.dayPart).toBe('morning');
    const hotelCheck = result.visits.find((v) => v.id === 'v2')!;
    expect(hotelCheck.dayOffset).toBeNull();
    expect(hotelCheck.dayPart).toBeNull();
  });
});

describe('normalizeTrip', () => {
  // Firebase RTDB drops null values on write. Inbox visits saved with
  // {dayOffset: null, dayPart: null} come back without those keys (undefined).
  // normalizeTrip must coerce undefined → null so inbox filters (=== null) keep matching.
  it('coerces missing dayOffset/dayPart on visits back to null (Firebase null-strip)', () => {
    const firebaseStrippedTrip = {
      id: 'trip-1',
      name: 'Japan',
      startDate: '2026-05-01',
      totalDays: 10,
      version: 2,
      stays: [],
      routes: [],
      visits: [
        {
          id: 'inbox-1',
          stayId: 'stay-1',
          name: 'Unscheduled place',
          type: 'landmark',
          lat: 35.68,
          lng: 139.77,
          order: 0,
          // dayOffset and dayPart keys stripped by Firebase
        } as unknown as VisitItem,
      ],
    } as HybridTrip;

    const result = normalizeTrip(firebaseStrippedTrip);
    const inbox = result.visits[0];
    expect(inbox.dayOffset).toBeNull();
    expect(inbox.dayPart).toBeNull();
  });

  it('preserves scheduled visits unchanged', () => {
    const trip = {
      id: 'trip-1',
      name: 'Japan',
      startDate: '2026-05-01',
      totalDays: 10,
      version: 2,
      stays: [],
      routes: [],
      visits: [
        {
          id: 'v1',
          stayId: 'stay-1',
          name: 'Senso-ji',
          type: 'landmark',
          lat: 35.71,
          lng: 139.79,
          dayOffset: 0,
          dayPart: 'morning',
          order: 0,
        } as VisitItem,
      ],
    } as HybridTrip;

    const result = normalizeTrip(trip);
    expect(result.visits[0].dayOffset).toBe(0);
    expect(result.visits[0].dayPart).toBe('morning');
  });
});
