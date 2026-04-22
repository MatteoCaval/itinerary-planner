import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StayPage } from './StayPage';
import type { Stay } from '@/domain/types';

const mockStay: Stay = {
  id: 's1',
  name: 'Kyoto',
  color: '#b8304f',
  startSlot: 0,
  endSlot: 12,
  centerLat: 35.0116,
  centerLng: 135.7681,
};

function mount(overrides: Partial<React.ComponentProps<typeof StayPage>> = {}) {
  return render(
    <StayPage
      stay={mockStay}
      visitCount={5}
      totalDays={4}
      totalNights={3}
      accommodationGroups={[]}
      onBack={() => {}}
      onUpdateStay={() => {}}
      {...overrides}
    />,
  );
}

describe('StayPage', () => {
  it('renders the stay name', () => {
    mount();
    expect(screen.getAllByText(/kyoto/i).length).toBeGreaterThan(0);
  });

  it('renders stats (days, nights, places)', () => {
    mount();
    expect(screen.getByText('4')).toBeInTheDocument(); // days
    expect(screen.getByText('5')).toBeInTheDocument(); // places
  });

  it('calls onBack when the back button is tapped', async () => {
    const onBack = vi.fn();
    mount({ onBack });
    await userEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(onBack).toHaveBeenCalled();
  });

  it('does not render rename, delete, or color buttons (structural)', () => {
    mount();
    expect(screen.queryByRole('button', { name: /rename/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete stay/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /change color/i })).not.toBeInTheDocument();
  });

  it('allows editing stay notes', async () => {
    const onUpdateStay = vi.fn();
    mount({ onUpdateStay });
    const notes = screen.getByPlaceholderText(/notes/i) as HTMLTextAreaElement;
    await userEvent.type(notes, 'Great city');
    notes.blur();
    expect(onUpdateStay).toHaveBeenCalled();
    const lastCallArg = onUpdateStay.mock.calls.at(-1)?.[0];
    expect(lastCallArg).toMatchObject({ notes: expect.stringContaining('Great city') });
  });
});
