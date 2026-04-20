import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaQuery } from '../useMediaQuery';

type MqlListener = (event: MediaQueryListEvent) => void;

function stub(matches: boolean) {
  let listener: MqlListener | null = null;
  const mql = {
    matches,
    addEventListener: (_: string, l: MqlListener) => {
      listener = l;
    },
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal('matchMedia', () => mql);
  return { fire: (next: boolean) => listener?.({ matches: next } as MediaQueryListEvent) };
}

describe('useMediaQuery', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('returns the initial match value', () => {
    stub(true);
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(true);
  });

  it('updates on change', () => {
    const { fire } = stub(false);
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(false);
    act(() => fire(true));
    expect(result.current).toBe(true);
  });
});
