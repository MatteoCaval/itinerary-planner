import { act, render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { describe, expect, it } from 'vitest';
import { ItineraryProvider, useItinerary } from './ItineraryContext';

const Harness = ({ onReady }: { onReady: (value: ReturnType<typeof useItinerary>) => void }) => {
  const itinerary = useItinerary();

  useEffect(() => {
    onReady(itinerary);
  }, [itinerary, onReady]);

  return null;
};

describe('ItineraryContext', () => {
  it('updates date range and builds day list', async () => {
    localStorage.clear();
    let ctx: ReturnType<typeof useItinerary> | null = null;

    render(
      <ItineraryProvider>
        <Harness onReady={value => { ctx = value; }} />
      </ItineraryProvider>
    );

    expect(ctx).not.toBeNull();

    act(() => {
      ctx?.updateDateRange('2026-04-10', '2026-04-12');
    });

    await waitFor(() => {
      expect(ctx?.days).toHaveLength(3);
      expect(ctx?.days[0].date).toBe('2026-04-10');
      expect(ctx?.days[2].date).toBe('2026-04-12');
    });
  });

  it('validates import and normalizes route cost values', async () => {
    localStorage.clear();
    let ctx: ReturnType<typeof useItinerary> | null = null;

    render(
      <ItineraryProvider>
        <Harness onReady={value => { ctx = value; }} />
      </ItineraryProvider>
    );

    let invalidResult: { success: boolean; error?: string } | undefined;
    act(() => {
      invalidResult = ctx?.loadFromData({
        locations: [{ id: 'x', name: 'Broken', lat: 'oops', lng: 10 }],
      });
    });
    expect(invalidResult?.success).toBe(false);

    act(() => {
      const result = ctx?.loadFromData({
        routes: [
          {
            id: 'r1',
            fromLocationId: 'a',
            toLocationId: 'b',
            cost: '$15.50',
          },
        ],
      });
      expect(result?.success).toBe(true);
    });

    await waitFor(() => {
      expect(ctx?.routes).toHaveLength(1);
      expect(ctx?.routes[0].cost).toBe(15.5);
    });
  });

  it('updates nested sub-locations by id', async () => {
    localStorage.clear();
    let ctx: ReturnType<typeof useItinerary> | null = null;

    render(
      <ItineraryProvider>
        <Harness onReady={value => { ctx = value; }} />
      </ItineraryProvider>
    );

    act(() => {
      const result = ctx?.loadFromData({
        locations: [
          {
            id: 'parent-1',
            name: 'Rome',
            lat: 41.9028,
            lng: 12.4964,
            subLocations: [
              {
                id: 'sub-1',
                name: 'Colosseum',
                lat: 41.8902,
                lng: 12.4922,
                dayOffset: 0,
              },
            ],
          },
        ],
      });
      expect(result?.success).toBe(true);
    });

    act(() => {
      ctx?.updateLocation('sub-1', {
        notes: 'Book skip-the-line tickets',
        targetTime: '09:00',
        duration: 2,
      });
    });

    await waitFor(() => {
      const sub = ctx?.locations[0]?.subLocations?.[0];
      expect(sub?.notes).toBe('Book skip-the-line tickets');
      expect(sub?.targetTime).toBe('09:00');
      expect(sub?.duration).toBe(2);
    });
  });
});
