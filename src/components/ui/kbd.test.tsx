import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Kbd } from './kbd';

describe('Kbd', () => {
  it('renders the shortcut text', () => {
    render(<Kbd>⌘K</Kbd>);
    expect(screen.getByText('⌘K')).toBeInTheDocument();
  });

  it('uses a <kbd> element for semantics', () => {
    render(<Kbd>N</Kbd>);
    const el = screen.getByText('N');
    expect(el.tagName).toBe('KBD');
  });

  it('applies the mono font utility class', () => {
    render(<Kbd>⌘K</Kbd>);
    expect(screen.getByText('⌘K').className).toContain('font-mono');
  });

  it('merges custom className', () => {
    render(<Kbd className="extra">N</Kbd>);
    expect(screen.getByText('N').className).toContain('extra');
  });
});
