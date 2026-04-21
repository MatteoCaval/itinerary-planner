import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocalStorage } from '@/hooks/useLocalStorage';

const RATIO_MIN = 0.15;
const RATIO_MAX = 0.85;
const KEYBOARD_STEP = 0.05;

interface SidebarSplitProps {
  top: React.ReactNode;
  bottom: React.ReactNode;
  bottomHeader?: React.ReactNode;
  defaultRatio?: number;
  storageKey?: string;
  collapseKey?: string;
  className?: string;
}

function clamp(n: number): number {
  return Math.max(RATIO_MIN, Math.min(RATIO_MAX, n));
}

export function SidebarSplit({
  top,
  bottom,
  bottomHeader,
  defaultRatio = 0.6,
  storageKey = 'sidebar-split-ratio',
  collapseKey = 'sidebar-inbox-collapsed',
  className,
}: SidebarSplitProps) {
  const [ratio, setRatio] = useLocalStorage<number>(storageKey, defaultRatio);
  const [collapsed, setCollapsed] = useLocalStorage<boolean>(collapseKey, false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = React.useState(false);

  const effectiveRatio = collapsed ? 1 : clamp(ratio);
  const percent = Math.round(effectiveRatio * 100);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setRatio(clamp(ratio - KEYBOARD_STEP));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setRatio(clamp(ratio + KEYBOARD_STEP));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setCollapsed(!collapsed);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (collapsed) return;
    e.preventDefault();
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    setDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || !rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    const next = (e.clientY - rect.top) / rect.height;
    setRatio(clamp(next));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    setDragging(false);
  };

  return (
    <div
      ref={rootRef}
      data-collapsed={collapsed ? 'true' : 'false'}
      className={cn('h-full flex flex-col', className)}
    >
      <div style={{ flex: effectiveRatio }} className="min-h-0 overflow-y-auto">
        {top}
      </div>

      <div
        role="separator"
        aria-orientation="horizontal"
        aria-valuemin={Math.round(RATIO_MIN * 100)}
        aria-valuemax={Math.round(RATIO_MAX * 100)}
        aria-valuenow={percent}
        aria-label="Resize inbox panel"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={cn(
          'relative h-[6px] flex-shrink-0 cursor-row-resize select-none',
          'bg-primary/15 hover:bg-primary/30 focus-visible:bg-primary/40',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
          dragging && 'bg-primary/40',
        )}
      >
        <button
          type="button"
          aria-label={collapsed ? 'Expand inbox' : 'Collapse inbox'}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setCollapsed(!collapsed);
          }}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-5 rounded-sm bg-card border border-border flex items-center justify-center hover:bg-muted cursor-pointer"
        >
          <ChevronDown
            className={cn('size-3 transition-transform', collapsed ? 'rotate-180' : 'rotate-0')}
          />
        </button>
      </div>

      {!collapsed && (
        <div style={{ flex: 1 - effectiveRatio }} className="min-h-0 flex flex-col">
          {bottomHeader && (
            <div className="flex-shrink-0 border-b border-border">{bottomHeader}</div>
          )}
          <div className="min-h-0 overflow-y-auto flex-1">{bottom}</div>
        </div>
      )}
    </div>
  );
}
