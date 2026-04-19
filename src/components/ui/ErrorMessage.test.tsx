import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorMessage } from './ErrorMessage';

describe('ErrorMessage', () => {
  it('renders the message content', () => {
    render(<ErrorMessage>Name is required</ErrorMessage>);
    expect(screen.getByText('Name is required')).toBeInTheDocument();
  });

  it('uses role="alert" with assertive live region for destructive tone', () => {
    render(<ErrorMessage>boom</ErrorMessage>);
    const el = screen.getByRole('alert');
    expect(el).toHaveAttribute('aria-live', 'assertive');
  });

  it('uses polite live region and status role for warning tone', () => {
    render(<ErrorMessage tone="warning">careful</ErrorMessage>);
    const el = screen.getByRole('status');
    expect(el).toHaveAttribute('aria-live', 'polite');
  });

  it('applies the destructive color classes by default', () => {
    render(<ErrorMessage>err</ErrorMessage>);
    expect(screen.getByRole('alert').className).toContain('text-destructive');
  });

  it('merges a custom className', () => {
    render(<ErrorMessage className="extra">err</ErrorMessage>);
    expect(screen.getByRole('alert').className).toContain('extra');
  });

  it('renders a custom icon', () => {
    render(
      <ErrorMessage icon={<svg data-testid="ico" />}>err</ErrorMessage>,
    );
    expect(screen.getByTestId('ico')).toBeInTheDocument();
  });
});
