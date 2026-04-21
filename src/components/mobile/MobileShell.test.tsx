import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MobileShell } from './MobileShell';
import type { HybridTrip, Stay } from '@/domain/types';

const mockStay: Stay = {
  id: 's1',
  name: 'Kyoto',
  color: '#b8304f',
  startSlot: 0,
  endSlot: 9,
  centerLat: 35.0,
  centerLng: 135.75,
};
const mockTrip: HybridTrip = {
  id: 't1',
  name: 'Japan',
  startDate: '2026-10-14',
  totalDays: 3,
  stays: [mockStay],
  visits: [],
  candidateStays: [],
  routes: [],
};

function mount() {
  return render(
    <MobileShell
      trip={mockTrip}
      sortedStays={[mockStay]}
      selectedStay={mockStay}
      stayDays={[]}
      accommodationGroups={[]}
      todayOffset={null}
      inboxCount={0}
      onSelectStay={() => {}}
      onOpenStay={() => {}}
      onOpenVisit={() => {}}
    />,
  );
}

describe('MobileShell', () => {
  it('renders the bottom tab bar', () => {
    mount();
    expect(screen.getByRole('tablist', { name: /mobile navigation/i })).toBeInTheDocument();
  });

  it('shows Plan content by default', () => {
    mount();
    expect(screen.getByTestId('plan-tab-content')).toBeInTheDocument();
  });

  it('switches to Map when Map tab is tapped', async () => {
    mount();
    await userEvent.click(screen.getByRole('tab', { name: /map/i }));
    expect(screen.getByTestId('map-tab-content')).toBeVisible();
  });

  it('keeps inactive tabs mounted', async () => {
    mount();
    await userEvent.click(screen.getByRole('tab', { name: /map/i }));
    expect(screen.queryByTestId('plan-tab-content')).toBeInTheDocument();
  });
});
