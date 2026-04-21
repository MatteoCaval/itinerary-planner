import { useMobileNav } from '@/hooks/useMobileNav';
import { BottomTabBar } from './BottomTabBar';
import { PlanTab } from './PlanTab';
import type { AccommodationGroup, HybridTrip, Stay } from '@/domain/types';
import type { deriveStayDays } from '@/domain/stayLogic';

type StayDay = ReturnType<typeof deriveStayDays>[number];

interface MobileShellProps {
  trip: HybridTrip;
  sortedStays: Stay[];
  selectedStay: Stay | null;
  stayDays: StayDay[];
  accommodationGroups: AccommodationGroup[];
  todayOffset: number | null;
  inboxCount: number;
  onSelectStay: (id: string) => void;
  onOpenStay: () => void;
  onOpenVisit: (id: string) => void;
}

export function MobileShell(props: MobileShellProps) {
  const nav = useMobileNav();

  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      <div className="flex-1 min-h-0 relative">
        <div
          data-testid="plan-tab-content"
          style={{ display: nav.tab === 'plan' ? 'flex' : 'none' }}
          className="absolute inset-0 flex-col"
        >
          <PlanTab
            trip={props.trip}
            sortedStays={props.sortedStays}
            selectedStay={props.selectedStay}
            stayDays={props.stayDays}
            accommodationGroups={props.accommodationGroups}
            todayOffset={props.todayOffset}
            onSelectStay={props.onSelectStay}
            onOpenStay={props.onOpenStay}
            onOpenVisit={props.onOpenVisit}
          />
        </div>
        <div
          data-testid="map-tab-content"
          style={{ display: nav.tab === 'map' ? 'flex' : 'none' }}
          className="absolute inset-0 flex-col"
        >
          <div className="p-4 text-sm text-muted-foreground">Map tab — coming</div>
        </div>
        <div
          data-testid="more-tab-content"
          style={{ display: nav.tab === 'more' ? 'flex' : 'none' }}
          className="absolute inset-0 flex-col"
        >
          <div className="p-4 text-sm text-muted-foreground">More tab — coming</div>
        </div>
      </div>
      <BottomTabBar tab={nav.tab} onTabChange={nav.setTab} inboxCount={props.inboxCount} />
    </div>
  );
}
