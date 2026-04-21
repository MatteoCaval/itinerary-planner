import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BottomTabBar } from './BottomTabBar';

function renderBar(overrides: Partial<React.ComponentProps<typeof BottomTabBar>> = {}) {
  return render(
    <BottomTabBar
      tab="plan"
      onTabChange={() => {}}
      inboxCount={0}
      {...overrides}
    />,
  );
}

describe('BottomTabBar', () => {
  it('renders three tabs', () => {
    renderBar();
    expect(screen.getByRole('tab', { name: /plan/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /map/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /more/i })).toBeInTheDocument();
  });

  it('marks the active tab with aria-selected=true', () => {
    renderBar({ tab: 'map' });
    expect(screen.getByRole('tab', { name: /map/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /plan/i })).toHaveAttribute('aria-selected', 'false');
  });

  it('calls onTabChange with the tapped tab', async () => {
    const onTabChange = vi.fn();
    renderBar({ onTabChange });
    await userEvent.click(screen.getByRole('tab', { name: /map/i }));
    expect(onTabChange).toHaveBeenCalledWith('map');
  });

  it('renders inbox badge on More when inboxCount > 0', () => {
    renderBar({ inboxCount: 3 });
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('does not render badge when inboxCount = 0', () => {
    renderBar({ inboxCount: 0 });
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });
});
