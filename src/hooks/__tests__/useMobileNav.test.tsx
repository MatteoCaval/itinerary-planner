import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMobileNav } from '../useMobileNav';

describe('useMobileNav', () => {
  beforeEach(() => {
    window.history.replaceState(null, '');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with tab=plan and empty stack', () => {
    const { result } = renderHook(() => useMobileNav());
    expect(result.current.tab).toBe('plan');
    expect(result.current.stack).toEqual([]);
    expect(result.current.currentPage).toBeNull();
  });

  it('setTab changes active tab', () => {
    const { result } = renderHook(() => useMobileNav());
    act(() => result.current.setTab('map'));
    expect(result.current.tab).toBe('map');
  });

  it('push appends to stack and sets currentPage', () => {
    const { result } = renderHook(() => useMobileNav());
    act(() => result.current.push({ kind: 'visit', id: 'v1' }));
    expect(result.current.stack).toHaveLength(1);
    expect(result.current.currentPage).toEqual({ kind: 'visit', id: 'v1' });
  });

  it('pop removes the last stack entry', () => {
    const { result } = renderHook(() => useMobileNav());
    act(() => {
      result.current.push({ kind: 'stay', id: 's1' });
      result.current.push({ kind: 'visit', id: 'v1' });
    });
    act(() => result.current.pop());
    expect(result.current.stack).toEqual([{ kind: 'stay', id: 's1' }]);
  });

  it('setTab with non-empty stack clears the stack', () => {
    const { result } = renderHook(() => useMobileNav());
    act(() => {
      result.current.push({ kind: 'visit', id: 'v1' });
    });
    expect(result.current.stack).toHaveLength(1);
    act(() => result.current.setTab('more'));
    expect(result.current.tab).toBe('more');
    expect(result.current.stack).toEqual([]);
  });

  it('reset clears the stack without changing tab', () => {
    const { result } = renderHook(() => useMobileNav());
    act(() => {
      result.current.setTab('map');
      result.current.push({ kind: 'visit', id: 'v1' });
    });
    act(() => result.current.reset());
    expect(result.current.stack).toEqual([]);
    expect(result.current.tab).toBe('map');
  });

  it('push calls history.pushState', () => {
    const spy = vi.spyOn(window.history, 'pushState');
    const { result } = renderHook(() => useMobileNav());
    act(() => result.current.push({ kind: 'visit', id: 'v1' }));
    expect(spy).toHaveBeenCalled();
  });

  it('popstate pops the stack when non-empty', () => {
    const { result } = renderHook(() => useMobileNav());
    act(() => {
      result.current.push({ kind: 'visit', id: 'v1' });
    });
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(result.current.stack).toEqual([]);
  });
});
