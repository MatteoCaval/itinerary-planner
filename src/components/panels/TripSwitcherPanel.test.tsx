import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TripSwitcherPanel from './TripSwitcherPanel';
import type { TripStore } from '@/domain/types';

const store: TripStore = {
  activeTripId: 'trip-1',
  trips: [
    {
      id: 'trip-1',
      name: 'Lisbon',
      startDate: '2026-05-10',
      totalDays: 4,
      stays: [],
      candidateStays: [],
      visits: [],
      routes: [],
    },
    {
      id: 'trip-2',
      name: 'Rome',
      startDate: '2026-06-02',
      totalDays: 6,
      stays: [
        {
          id: 'stay-1',
          name: 'Centro',
          color: '#f97316',
          startSlot: 0,
          endSlot: 18,
          centerLat: 41.9028,
          centerLng: 12.4964,
        },
      ],
      candidateStays: [],
      visits: [
        {
          id: 'visit-1',
          stayId: 'stay-1',
          name: 'Pantheon',
          type: 'landmark',
          lat: 41.8986,
          lng: 12.4769,
          dayOffset: 0,
          dayPart: 'morning',
          order: 0,
        },
      ],
      routes: [],
    },
  ],
};

function mount(overrides: Partial<React.ComponentProps<typeof TripSwitcherPanel>> = {}) {
  return render(
    <TripSwitcherPanel
      store={store}
      onSwitch={() => {}}
      onDeleteTrip={() => {}}
      onNew={() => {}}
      onClose={() => {}}
      notifyReversible={() => {}}
      {...overrides}
    />,
  );
}

describe('TripSwitcherPanel', () => {
  it('deletes a trip from the row actions menu after confirmation', async () => {
    const user = userEvent.setup();
    const onDeleteTrip = vi.fn();

    mount({ onDeleteTrip });

    await user.click(screen.getByRole('button', { name: /open actions for rome/i }));
    await user.click(screen.getByRole('menuitem', { name: /delete trip/i }));

    expect(screen.getByText(/this will remove 1 stay and 1 place/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /delete trip/i }));

    expect(onDeleteTrip).toHaveBeenCalledWith('trip-2');
  });
});
