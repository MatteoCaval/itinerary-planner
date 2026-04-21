import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlanTab } from './PlanTab';
import type { HybridTrip, Stay } from '@/domain/types';

const mockStay: Stay = {
  id: 'stay-1',
  name: 'Kyoto',
  color: '#b8304f',
  startSlot: 0,
  endSlot: 12,
  centerLat: 35.0,
  centerLng: 135.75,
};

const mockTrip: HybridTrip = {
  id: 'trip-1',
  name: 'Japan 2026',
  startDate: '2026-10-14',
  totalDays: 4,
  stays: [mockStay],
  visits: [],
  candidateStays: [],
  routes: [],
};

function renderTab(overrides: Partial<React.ComponentProps<typeof PlanTab>> = {}) {
  const scrollSpy = vi.fn();
  Element.prototype.scrollIntoView = scrollSpy;
  return {
    scrollSpy,
    ...render(
      <PlanTab
        trip={mockTrip}
        sortedStays={[mockStay]}
        selectedStay={mockStay}
        stayDays={[]}
        accommodationGroups={[]}
        todayOffset={null}
        onSelectStay={() => {}}
        onOpenStay={() => {}}
        onOpenVisit={() => {}}
        {...overrides}
      />,
    ),
  };
}

describe('PlanTab', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the stay chip when a stay is selected', () => {
    renderTab();
    expect(screen.getByRole('button', { name: /view kyoto stay details/i })).toBeInTheDocument();
  });

  it('calls onOpenStay when the stay chip is tapped', async () => {
    const onOpenStay = vi.fn();
    renderTab({ onOpenStay });
    await userEvent.click(screen.getByRole('button', { name: /view kyoto stay details/i }));
    expect(onOpenStay).toHaveBeenCalled();
  });

  it('renders timeline stay pills for each stay', () => {
    renderTab();
    const pills = screen.getAllByText('Kyoto');
    expect(pills.length).toBeGreaterThan(0);
  });

  it('auto-scrolls to today on first mount when todayOffset is provided', () => {
    const { scrollSpy } = renderTab({
      todayOffset: 2,
      stayDays: [
        { absoluteDay: 0, dayOffset: 0 } as any,
        { absoluteDay: 1, dayOffset: 1 } as any,
        { absoluteDay: 2, dayOffset: 2 } as any,
      ],
    });
    expect(scrollSpy).toHaveBeenCalled();
  });

  it('does not auto-scroll when todayOffset is null', () => {
    const { scrollSpy } = renderTab({ todayOffset: null });
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it('hides the stay chip when no stay is selected', () => {
    renderTab({ selectedStay: null });
    expect(screen.queryByText(/view stay/i)).not.toBeInTheDocument();
  });
});
