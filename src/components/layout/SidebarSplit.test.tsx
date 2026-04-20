import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SidebarSplit } from './SidebarSplit';

function renderSplit(overrides: Partial<React.ComponentProps<typeof SidebarSplit>> = {}) {
  return render(
    <SidebarSplit
      top={<div data-testid="top">top content</div>}
      bottomHeader={<div data-testid="bottom-header">Inbox</div>}
      bottom={<div data-testid="bottom">bottom content</div>}
      {...overrides}
    />,
  );
}

describe('SidebarSplit', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders both panes and header', () => {
    renderSplit();
    expect(screen.getByTestId('top')).toBeInTheDocument();
    expect(screen.getByTestId('bottom-header')).toBeInTheDocument();
    expect(screen.getByTestId('bottom')).toBeInTheDocument();
  });

  it('exposes the splitter as role=separator with horizontal orientation', () => {
    renderSplit();
    const sep = screen.getByRole('separator');
    expect(sep).toHaveAttribute('aria-orientation', 'horizontal');
  });

  it('reflects ratio in aria-valuenow', () => {
    renderSplit({ defaultRatio: 0.4 });
    const sep = screen.getByRole('separator');
    expect(sep).toHaveAttribute('aria-valuenow', '40');
  });

  it('decreases ratio by 5% on ArrowUp', async () => {
    renderSplit({ defaultRatio: 0.5 });
    const sep = screen.getByRole('separator');
    sep.focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(sep).toHaveAttribute('aria-valuenow', '45');
  });

  it('increases ratio by 5% on ArrowDown', async () => {
    renderSplit({ defaultRatio: 0.5 });
    const sep = screen.getByRole('separator');
    sep.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(sep).toHaveAttribute('aria-valuenow', '55');
  });

  it('toggles inbox-collapsed on Enter', async () => {
    renderSplit({ defaultRatio: 0.6 });
    const sep = screen.getByRole('separator');
    sep.focus();
    await userEvent.keyboard('{Enter}');
    const root = sep.parentElement;
    expect(root).toHaveAttribute('data-collapsed', 'true');
  });

  it('clamps ratio to [0.15, 0.85]', async () => {
    renderSplit({ defaultRatio: 0.15 });
    const sep = screen.getByRole('separator');
    sep.focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(sep).toHaveAttribute('aria-valuenow', '15');
  });

  it('persists ratio to localStorage', async () => {
    renderSplit({ defaultRatio: 0.5, storageKey: 'test-split-ratio' });
    const sep = screen.getByRole('separator');
    sep.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(JSON.parse(localStorage.getItem('test-split-ratio')!)).toBe(0.55);
  });
});
