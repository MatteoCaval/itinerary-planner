import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AddStayModal from '../AddStayModal';
import type { Stay } from '@/domain/types';

const kyoto: Stay = {
  id: 'c1',
  name: 'Kyoto',
  color: '#c15a2a',
  startSlot: 0,
  endSlot: 0,
  centerLat: 35.01,
  centerLng: 135.77,
};

describe('AddStayModal — pick from unplanned', () => {
  it('hides the chip row when candidates is empty', () => {
    render(<AddStayModal onClose={() => {}} onSave={() => {}} stayColor="#111" candidates={[]} />);
    expect(screen.queryByText(/From unplanned/i)).toBeNull();
  });

  it('shows candidate chips and pre-fills name on click', () => {
    render(
      <AddStayModal onClose={() => {}} onSave={() => {}} stayColor="#111" candidates={[kyoto]} />,
    );
    expect(screen.getByText(/From unplanned/i)).toBeInTheDocument();
    const chip = screen.getByRole('button', { name: /Kyoto/i });
    fireEvent.click(chip);
    const nameInput = screen.getByPlaceholderText(/Search a city or region/i) as HTMLInputElement;
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

  it('clears selection when the Clear button is pressed', () => {
    render(
      <AddStayModal onClose={() => {}} onSave={() => {}} stayColor="#111" candidates={[kyoto]} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Kyoto/i }));
    const nameInput = screen.getByPlaceholderText(/Search a city or region/i) as HTMLInputElement;
    expect(nameInput.value).toBe('Kyoto');

    fireEvent.click(screen.getByRole('button', { name: /Clear unplanned selection/i }));
    expect(nameInput.value).toBe('');
  });

  it('pre-fills the name field when initialCandidateId is set', () => {
    render(
      <AddStayModal
        onClose={() => {}}
        onSave={() => {}}
        stayColor="#111"
        candidates={[kyoto]}
        initialCandidateId="c1"
      />,
    );
    const nameInput = screen.getByPlaceholderText(/Search a city or region/i) as HTMLInputElement;
    expect(nameInput.value).toBe('Kyoto');
  });
});

describe('AddStayModal — candidate mode', () => {
  it('hides the date stepper when mode is candidate', () => {
    render(<AddStayModal onClose={() => {}} onSave={() => {}} stayColor="#111" mode="candidate" />);
    expect(screen.queryByText(/Duration/i)).toBeNull();
  });

  it('save button reads "Save to Unplanned" in candidate mode', () => {
    render(<AddStayModal onClose={() => {}} onSave={() => {}} stayColor="#111" mode="candidate" />);
    expect(screen.getByRole('button', { name: /Save to Unplanned/i })).toBeInTheDocument();
  });
});
