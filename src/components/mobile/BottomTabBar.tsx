import * as React from 'react';
import { Calendar, Map as MapIcon, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Tab } from '@/hooks/useMobileNav';

interface BottomTabBarProps {
  tab: Tab;
  onTabChange: (t: Tab) => void;
  inboxCount?: number;
}

const tabs: Array<{ key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }> =
  [
    { key: 'plan', label: 'Plan', icon: Calendar },
    { key: 'map', label: 'Map', icon: MapIcon },
    { key: 'more', label: 'More', icon: Menu },
  ];

export function BottomTabBar({ tab, onTabChange, inboxCount = 0 }: BottomTabBarProps) {
  return (
    <div
      role="tablist"
      aria-label="Mobile navigation"
      className="flex flex-shrink-0 bg-white border-t border-border pb-safe"
    >
      {tabs.map(({ key, label, icon: Icon }) => {
        const active = key === tab;
        const showBadge = key === 'more' && inboxCount > 0;
        return (
          <button
            key={key}
            role="tab"
            aria-selected={active}
            aria-label={label}
            onClick={() => onTabChange(key)}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-1 py-2 relative',
              'text-[10px] font-medium transition-colors',
              active ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            {active && (
              <span
                aria-hidden="true"
                className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-primary rounded-b"
              />
            )}
            <span className="relative">
              <Icon className="size-[18px]" />
              {showBadge && (
                <span className="absolute -top-1 -right-2 size-[14px] rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground flex items-center justify-center">
                  {inboxCount}
                </span>
              )}
            </span>
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
