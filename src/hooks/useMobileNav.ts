import { useCallback, useEffect, useRef, useState } from 'react';

export type Tab = 'plan' | 'map' | 'more';

export type MobilePage =
  | { kind: 'visit'; id: string }
  | { kind: 'stay'; id: string };

export interface MobileNavApi {
  tab: Tab;
  setTab: (t: Tab) => void;
  stack: MobilePage[];
  currentPage: MobilePage | null;
  push: (page: MobilePage) => void;
  pop: () => void;
  reset: () => void;
}

export function useMobileNav(): MobileNavApi {
  const [tab, setTabState] = useState<Tab>('plan');
  const [stack, setStack] = useState<MobilePage[]>([]);

  const stackRef = useRef(stack);
  useEffect(() => {
    stackRef.current = stack;
  }, [stack]);

  const push = useCallback((page: MobilePage) => {
    setStack((prev) => [...prev, page]);
    if (typeof window !== 'undefined') {
      try {
        window.history.pushState(null, '');
      } catch {
        // pushState can throw in some sandboxed contexts — ignore
      }
    }
  }, []);

  const pop = useCallback(() => {
    setStack((prev) => (prev.length > 0 ? prev.slice(0, -1) : prev));
  }, []);

  const reset = useCallback(() => {
    setStack([]);
  }, []);

  const setTab = useCallback((next: Tab) => {
    setStack([]);
    setTabState(next);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPopState = () => {
      if (stackRef.current.length > 0) {
        setStack((prev) => prev.slice(0, -1));
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const currentPage = stack.length > 0 ? stack[stack.length - 1] : null;

  return { tab, setTab, stack, currentPage, push, pop, reset };
}
