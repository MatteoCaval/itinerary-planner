import { useMobileNav } from '@/hooks/useMobileNav';
import { BottomTabBar } from './BottomTabBar';

interface MobileShellProps {
  inboxCount?: number;
}

export function MobileShell({ inboxCount = 0 }: MobileShellProps) {
  const nav = useMobileNav();

  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      <div className="flex-1 min-h-0 relative">
        <div
          data-testid="plan-tab-content"
          style={{ display: nav.tab === 'plan' ? 'flex' : 'none' }}
          className="absolute inset-0 flex-col"
        >
          <div className="p-4 text-sm text-muted-foreground">Plan tab — skeleton</div>
        </div>
        <div
          data-testid="map-tab-content"
          style={{ display: nav.tab === 'map' ? 'flex' : 'none' }}
          className="absolute inset-0 flex-col"
        >
          <div className="p-4 text-sm text-muted-foreground">Map tab — skeleton</div>
        </div>
        <div
          data-testid="more-tab-content"
          style={{ display: nav.tab === 'more' ? 'flex' : 'none' }}
          className="absolute inset-0 flex-col"
        >
          <div className="p-4 text-sm text-muted-foreground">More tab — skeleton</div>
        </div>
      </div>
      <BottomTabBar tab={nav.tab} onTabChange={nav.setTab} inboxCount={inboxCount} />
    </div>
  );
}
