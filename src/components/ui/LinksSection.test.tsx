import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LinksSection } from './LinksSection';

describe('LinksSection', () => {
  it('normalizes a URL missing protocol', async () => {
    const onChange = vi.fn();
    render(<LinksSection items={[]} onChange={onChange} />);
    await userEvent.type(screen.getByPlaceholderText(/url/i), 'example.com');
    await userEvent.click(screen.getByRole('button', { name: /add/i }));
    const next = onChange.mock.calls.at(-1)?.[0];
    expect(next[0].url).toBe('https://example.com');
  });

  it('rejects an invalid URL', async () => {
    render(<LinksSection items={[]} onChange={() => {}} />);
    await userEvent.type(
      screen.getByPlaceholderText(/url/i),
      'not a url at all',
    );
    await userEvent.click(screen.getByRole('button', { name: /add/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/valid url/i);
  });

  it('removes an item when trash clicked', async () => {
    const onChange = vi.fn();
    render(
      <LinksSection
        items={[{ id: '1', label: 'Doc', url: 'https://x.com' }]}
        onChange={onChange}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /remove/i }));
    const next = onChange.mock.calls.at(-1)?.[0];
    expect(next).toHaveLength(0);
  });
});
