import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MoreTab } from './MoreTab';

function mount(overrides: Partial<React.ComponentProps<typeof MoreTab>> = {}) {
  return render(
    <MoreTab
      activeTripName="Test Trip"
      activeTripDates="Oct 14 → Oct 28 · 14 days"
      inboxCount={0}
      onSwitchTrip={() => {}}
      onEditTrip={() => {}}
      onOpenHistory={() => {}}
      onOpenAIPlanner={() => {}}
      onOpenShare={() => {}}
      onImportCode={() => {}}
      onExportMarkdown={() => {}}
      onExportJson={() => {}}
      onImportJson={() => {}}
      onOpenAuth={() => {}}
      isAuthenticated={false}
      authEmail={null}
      syncStatus="saved"
      version="v1.2.0"
      renderInbox={() => <div data-testid="inbox-content">inbox items</div>}
      {...overrides}
    />,
  );
}

describe('MoreTab', () => {
  it('renders the main action groups', () => {
    mount();
    expect(screen.getByText(/^trip$/i)).toBeInTheDocument();
    expect(screen.getByText(/destinations/i)).toBeInTheDocument();
    expect(screen.getByText(/^data$/i)).toBeInTheDocument();
    expect(screen.getByText(/power/i)).toBeInTheDocument();
    expect(screen.getByText(/^account$/i)).toBeInTheDocument();
  });

  it('shows inbox count when > 0', () => {
    mount({ inboxCount: 5 });
    const inboxRow = screen.getByRole('button', { name: /inbox/i });
    expect(inboxRow).toHaveTextContent('5');
  });

  it('fires onSwitchTrip when Switch trip is tapped', async () => {
    const onSwitchTrip = vi.fn();
    mount({ onSwitchTrip });
    await userEvent.click(screen.getByRole('button', { name: /switch trip/i }));
    expect(onSwitchTrip).toHaveBeenCalled();
  });

  it('shows "Sign in" when not authenticated', () => {
    mount({ isAuthenticated: false });
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows email when authenticated', () => {
    mount({ isAuthenticated: true, authEmail: 'x@y.com' });
    expect(screen.getByText('x@y.com')).toBeInTheDocument();
  });

  it('expands inline inbox when Inbox row is tapped', async () => {
    mount({ inboxCount: 2 });
    // Initially inbox content is in the DOM but aria-hidden (CSS accordion)
    const wrapper = () =>
      screen.getByTestId('inbox-content').closest('[aria-hidden]') as HTMLElement | null;
    expect(wrapper()?.getAttribute('aria-hidden')).toBe('true');
    await userEvent.click(screen.getByRole('button', { name: /inbox/i }));
    expect(wrapper()?.getAttribute('aria-hidden')).toBe('false');
  });
});
