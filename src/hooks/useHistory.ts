import { useCallback, useRef, useState } from 'react';
import type { HybridTrip } from '@/domain/types';

export type HistorySnapshot = { trip: HybridTrip; timestamp: number };

export function useHistory(initial: HybridTrip) {
  const stateRef = useRef({
    snapshots: [{ trip: initial, timestamp: Date.now() }] as HistorySnapshot[],
    idx: 0,
  });
  const [, forceRender] = useState(0);
  const rerender = useCallback(() => forceRender((n) => n + 1), []);

  const push = useCallback(
    (next: HybridTrip) => {
      const s = stateRef.current;
      const sliced = [
        ...s.snapshots.slice(0, s.idx + 1),
        { trip: next, timestamp: Date.now() },
      ].slice(-50);
      stateRef.current = { snapshots: sliced, idx: Math.min(s.idx + 1, 49) };
      rerender();
    },
    [rerender],
  );

  const undo = useCallback(() => {
    const s = stateRef.current;
    if (s.idx > 0) {
      stateRef.current = { ...s, idx: s.idx - 1 };
      rerender();
      return s.snapshots[s.idx - 1].trip;
    }
    return null;
  }, [rerender]);

  const redo = useCallback(() => {
    const s = stateRef.current;
    if (s.idx < s.snapshots.length - 1) {
      stateRef.current = { ...s, idx: s.idx + 1 };
      rerender();
      return s.snapshots[s.idx + 1].trip;
    }
    return null;
  }, [rerender]);

  const { idx, snapshots } = stateRef.current;
  return {
    push,
    undo,
    redo,
    canUndo: idx > 0,
    canRedo: idx < snapshots.length - 1,
    history: snapshots,
    historyIndex: idx,
  };
}
