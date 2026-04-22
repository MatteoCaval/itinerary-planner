import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MapTab } from './MapTab';

describe('MapTab', () => {
  it('renders the map region', () => {
    render(
      <MapTab
        renderMap={() => <div data-testid="trip-map">map</div>}
        peek={null}
        onOpenPeek={() => {}}
        onDismissPeek={() => {}}
      />,
    );
    expect(screen.getByTestId('trip-map')).toBeInTheDocument();
  });

  it('renders the peek drawer when peek prop is set', () => {
    render(
      <MapTab
        renderMap={() => <div />}
        peek={{ name: 'Fushimi', subtitle: 'Landmark', openLabel: 'Open' }}
        onOpenPeek={() => {}}
        onDismissPeek={() => {}}
      />,
    );
    expect(screen.getByText('Fushimi')).toBeInTheDocument();
  });

  it('does not render the peek drawer when peek is null', () => {
    render(
      <MapTab
        renderMap={() => <div />}
        peek={null}
        onOpenPeek={() => {}}
        onDismissPeek={() => {}}
      />,
    );
    // The dialog role is only mounted when peek is set
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
