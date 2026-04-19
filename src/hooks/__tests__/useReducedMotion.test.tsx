import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReducedMotion } from '../useReducedMotion';

type MqlListener = (event: MediaQueryListEvent) => void;

function stubMatchMedia(matches: boolean) {
  let listener: MqlListener | null = null;
  const mql = {
    matches,
    addEventListener: (_: string, l: MqlListener) => {
      listener = l;
    },
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal('matchMedia', () => mql);
  return {
    fire: (next: boolean) => listener?.({ matches: next } as MediaQueryListEvent),
  };
}

describe('useReducedMotion', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns initial matchMedia value', () => {
    stubMatchMedia(true);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });

  it('updates when the media query changes', () => {
    const { fire } = stubMatchMedia(false);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
    act(() => fire(true));
    expect(result.current).toBe(true);
  });
});
