import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AddStayModal from '../AddStayModal';
import type { Stay } from '@/domain/types';

const kyoto: Stay = {
  id: 'c1',
  name: 'Kyoto',
  color: '#615cf6',
  startSlot: 0,
  endSlot: 0,
  centerLat: 35.01,
  centerLng: 135.77,
};

describe('AddStayModal — pick from inbox', () => {
  it('hides the chip row when candidates is empty', () => {
    render(
      <AddStayModal
        onClose={() => {}}
        onSave={() => {}}
        stayColor="#111"
        candidates={[]}
      />,
    );
    expect(screen.queryByText(/From inbox/i)).toBeNull();
  });

  it('shows candidate chips and pre-fills name on click', () => {
    render(
      <AddStayModal
        onClose={() => {}}
        onSave={() => {}}
        stayColor="#111"
        candidates={[kyoto]}
      />,
    );
    expect(screen.getByText(/From inbox/i)).toBeInTheDocument();
    const chip = screen.getByRole('button', { name: /Kyoto/i });
    fireEvent.click(chip);
    const nameInput = screen.getByPlaceholderText(/Tokyo, Kyoto, Paris/i) as HTMLInputElement;
    expect(nameInput.value).toBe('Kyoto');
  });

  it('calls onSavePromote with candidateId when a chip is selected and saved', () => {
    const onSavePromote = vi.fn();
    render(
      <AddStayModal
        onClose={() => {}}
        onSave={() => {}}
        onSavePromote={onSavePromote}
        stayColor="#111"
        candidates={[kyoto]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Kyoto/i }));
    fireEvent.click(screen.getByRole('button', { name: /Add to Timeline/i }));
    expect(onSavePromote).toHaveBeenCalledTimes(1);
    expect(onSavePromote.mock.calls[0][0]).toMatchObject({ candidateId: 'c1' });
  });
});

describe('AddStayModal — candidate mode', () => {
  it('hides the date stepper when mode is candidate', () => {
    render(
      <AddStayModal
        onClose={() => {}}
        onSave={() => {}}
        stayColor="#111"
        mode="candidate"
      />,
    );
    expect(screen.queryByText(/Duration/i)).toBeNull();
  });

  it('save button reads "Save to Inbox" in candidate mode', () => {
    render(
      <AddStayModal
        onClose={() => {}}
        onSave={() => {}}
        stayColor="#111"
        mode="candidate"
      />,
    );
    expect(screen.getByRole('button', { name: /Save to Inbox/i })).toBeInTheDocument();
  });
});
