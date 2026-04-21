import * as React from 'react';
import { useMobileNav, type MobileNavApi } from '@/hooks/useMobileNav';
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
  onOpenStay: (nav: MobileNavApi) => void;
  onOpenVisit: (id: string, nav: MobileNavApi) => void;
  /** Render the currently-pushed page (Visit or Stay). Return null when stack is empty. */
  renderCurrentPage: (nav: MobileNavApi) => React.ReactNode;
  /** Render the map tab content. Receives the current nav instance. */
  renderMapTab: (nav: MobileNavApi) => React.ReactNode;
  /** Render the more tab content. Receives the current nav instance. */
  renderMoreTab: (nav: MobileNavApi) => React.ReactNode;
}

export function MobileShell(props: MobileShellProps) {
  const nav = useMobileNav();
  const currentPageNode = nav.currentPage ? props.renderCurrentPage(nav) : null;

  // Auto-select the first stay on first mount if none is selected — without
  // a selection the stay chip is hidden and the user has no entry point to
  // the stay overview page.
  const { selectedStay, sortedStays, onSelectStay } = props;
  const didAutoSelect = React.useRef(false);
  React.useEffect(() => {
    if (didAutoSelect.current) return;
    if (!selectedStay && sortedStays.length > 0) {
      onSelectStay(sortedStays[0].id);
      didAutoSelect.current = true;
    }
  }, [selectedStay, sortedStays, onSelectStay]);

  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      <div className="flex-1 min-h-0 relative">
        <div
          data-testid="plan-tab-content"
          style={{ display: nav.tab === 'plan' && !currentPageNode ? 'flex' : 'none' }}
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
            onOpenStay={() => props.onOpenStay(nav)}
            onOpenVisit={(id) => props.onOpenVisit(id, nav)}
          />
        </div>
        <div
          data-testid="map-tab-content"
          style={{ display: nav.tab === 'map' && !currentPageNode ? 'flex' : 'none' }}
          className="absolute inset-0 flex-col"
        >
          {props.renderMapTab(nav)}
        </div>
        <div
          data-testid="more-tab-content"
          style={{ display: nav.tab === 'more' && !currentPageNode ? 'flex' : 'none' }}
          className="absolute inset-0 flex-col"
        >
          {props.renderMoreTab(nav)}
        </div>

        {/* Push page overlay */}
        {currentPageNode && (
          <div className="absolute inset-0 flex flex-col bg-background">{currentPageNode}</div>
        )}
      </div>
      <BottomTabBar tab={nav.tab} onTabChange={nav.setTab} inboxCount={props.inboxCount} />
    </div>
  );
}
