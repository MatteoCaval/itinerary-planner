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
});
