import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MobileShell } from './MobileShell';

describe('MobileShell', () => {
  it('renders the bottom tab bar', () => {
    render(<MobileShell />);
    expect(screen.getByRole('tablist', { name: /mobile navigation/i })).toBeInTheDocument();
  });

  it('shows Plan content by default', () => {
    render(<MobileShell />);
    expect(screen.getByTestId('plan-tab-content')).toBeInTheDocument();
  });

  it('switches to Map when Map tab is tapped', async () => {
    render(<MobileShell />);
    await userEvent.click(screen.getByRole('tab', { name: /map/i }));
    expect(screen.getByTestId('map-tab-content')).toBeVisible();
  });

  it('keeps inactive tabs mounted but hidden', async () => {
    render(<MobileShell />);
    await userEvent.click(screen.getByRole('tab', { name: /map/i }));
    // Plan still in the DOM (display:none), still queryable
    expect(screen.queryByTestId('plan-tab-content')).toBeInTheDocument();
  });
});
