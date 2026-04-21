import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VisitPage } from './VisitPage';
import type { VisitItem } from '@/domain/types';

const mockVisit: VisitItem = {
  id: 'v1',
  name: 'Fushimi Inari',
  stayId: 's1',
  dayOffset: 0,
  dayPart: 'morning',
  type: 'landmark',
  lat: 35.0116,
  lng: 135.7681,
  durationHint: '',
  notes: '',
  order: 0,
};

function mount(overrides: Partial<React.ComponentProps<typeof VisitPage>> = {}) {
  return render(
    <VisitPage
      visit={mockVisit}
      stayName="Kyoto"
      dayLabel="Day 1 · Morning"
      onBack={() => {}}
      onUpdateVisit={() => {}}
      onDelete={() => {}}
      {...overrides}
    />,
  );
}

describe('VisitPage', () => {
  it('renders the visit name in the header', () => {
    mount();
    // Visit name may appear multiple times (header + editable field); assert at least once
    expect(screen.getAllByText(/fushimi inari/i).length).toBeGreaterThan(0);
  });

  it('renders Navigate and Open-in-Maps links when coords are present', () => {
    mount();
    expect(screen.getByRole('link', { name: /navigate/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open in maps/i })).toBeInTheDocument();
  });

  it('calls onBack when the back button is tapped', async () => {
    const onBack = vi.fn();
    mount({ onBack });
    await userEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(onBack).toHaveBeenCalled();
  });

  it('does not render unschedule or move-to-stay buttons (structural)', () => {
    mount();
    expect(screen.queryByRole('button', { name: /unschedule/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /move to/i })).not.toBeInTheDocument();
  });

  it('allows editing notes (calls onUpdateVisit on blur with the edit)', async () => {
    const onUpdateVisit = vi.fn();
    mount({ onUpdateVisit });
    const notes = screen.getByPlaceholderText(/notes/i) as HTMLTextAreaElement;
    await userEvent.type(notes, 'Go early');
    notes.blur();
    expect(onUpdateVisit).toHaveBeenCalled();
    const lastCallArg = onUpdateVisit.mock.calls.at(-1)?.[0];
    expect(lastCallArg).toMatchObject({ notes: expect.stringContaining('Go early') });
  });
});
