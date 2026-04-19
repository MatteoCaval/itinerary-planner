import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlaceSearchField } from './PlaceSearchField';

describe('PlaceSearchField', () => {
  it('renders the provided placeholder', () => {
    render(
      <PlaceSearchField
        value=""
        onValueChange={() => {}}
        onPick={() => {}}
        placeholder="Search a city"
      />,
    );
    expect(screen.getByPlaceholderText('Search a city')).toBeInTheDocument();
  });

  it('calls onValueChange when the user types', async () => {
    const onValueChange = vi.fn();
    render(
      <PlaceSearchField
        value=""
        onValueChange={onValueChange}
        onPick={() => {}}
      />,
    );
    await userEvent.type(screen.getByRole('textbox'), 'Kyoto');
    expect(onValueChange).toHaveBeenCalled();
  });

  it('invokes onPick when a result is clicked', async () => {
    const onPick = vi.fn();
    render(
      <PlaceSearchField
        value="k"
        onValueChange={() => {}}
        onPick={onPick}
        results={[{ id: 'r1', label: 'Kyoto', lat: 35, lng: 135 }]}
      />,
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Kyoto/ })).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole('button', { name: /Kyoto/ }));
    expect(onPick).toHaveBeenCalledWith({
      id: 'r1',
      label: 'Kyoto',
      lat: 35,
      lng: 135,
    });
  });

  it('announces loading state via aria-live', () => {
    render(
      <PlaceSearchField
        value="k"
        onValueChange={() => {}}
        onPick={() => {}}
        loading
      />,
    );
    const liveEls = screen.getAllByText(/searching/i);
    const live = liveEls.find(el =>
      el.closest('[aria-live]') !== null,
    );
    expect(live?.closest('[aria-live]')?.getAttribute('aria-live')).toBe('polite');
  });
});
