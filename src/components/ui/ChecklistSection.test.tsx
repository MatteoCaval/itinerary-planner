import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChecklistSection } from './ChecklistSection';

describe('ChecklistSection', () => {
  it('renders existing items', () => {
    render(
      <ChecklistSection
        items={[{ id: '1', text: 'Buy tickets', done: false }]}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText('Buy tickets')).toBeInTheDocument();
  });

  it('adds a new item', async () => {
    const onChange = vi.fn();
    render(<ChecklistSection items={[]} onChange={onChange} />);
    await userEvent.type(screen.getByPlaceholderText(/add item/i), 'Pack');
    await userEvent.click(screen.getByRole('button', { name: /add/i }));
    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls.at(-1)?.[0];
    expect(next).toHaveLength(1);
    expect(next[0].text).toBe('Pack');
    expect(next[0].done).toBe(false);
  });

  it('flags duplicate entries', async () => {
    render(
      <ChecklistSection items={[{ id: '1', text: 'Pack', done: false }]} onChange={() => {}} />,
    );
    await userEvent.type(screen.getByPlaceholderText(/add item/i), 'pack');
    expect(screen.getByRole('alert')).toHaveTextContent(/already/i);
  });

  it('toggles done state', async () => {
    const onChange = vi.fn();
    render(
      <ChecklistSection items={[{ id: '1', text: 'Pack', done: false }]} onChange={onChange} />,
    );
    await userEvent.click(screen.getByRole('checkbox'));
    const next = onChange.mock.calls.at(-1)?.[0];
    expect(next[0].done).toBe(true);
  });
});
