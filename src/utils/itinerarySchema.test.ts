import { describe, expect, it } from 'vitest';
import { itineraryImportSchema } from './itinerarySchema';

describe('itineraryImportSchema', () => {
  it('accepts a valid itinerary payload', () => {
    const payload = {
      startDate: '2026-03-01',
      endDate: '2026-03-02',
      days: [
        { id: 'd1', date: '2026-03-01' },
        { id: 'd2', date: '2026-03-02' },
      ],
      locations: [
        {
          id: 'l1',
          name: 'Museum',
          lat: 45.1,
          lng: 7.6,
          startDayId: 'd1',
          startSlot: 'morning',
        },
      ],
      routes: [
        {
          id: 'r1',
          fromLocationId: 'l1',
          toLocationId: 'l1',
          transportType: 'walk',
        },
      ],
    };

    const parsed = itineraryImportSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  it('rejects invalid location coordinates', () => {
    const payload = {
      locations: [
        {
          id: 'l1',
          name: 'Bad location',
          lat: 'not-a-number',
          lng: 7.6,
        },
      ],
    };

    const parsed = itineraryImportSchema.safeParse(payload);
    expect(parsed.success).toBe(false);
  });
});
