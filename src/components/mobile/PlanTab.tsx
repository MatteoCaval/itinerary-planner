import * as React from 'react';
import type { AccommodationGroup, HybridTrip, Stay, VisitItem } from '@/domain/types';
import type { deriveStayDays } from '@/domain/stayLogic';
import { fmt, safeDate, addDaysTo } from '@/domain/dateUtils';
import { DAY_PARTS } from '@/domain/constants';
import { getVisitTypeBg } from '@/domain/visitTypeDisplay';
import { StayChip } from './StayChip';
import { cn } from '@/lib/utils';

type StayDay = ReturnType<typeof deriveStayDays>[number];

interface PlanTabProps {
  trip: HybridTrip;
  sortedStays: Stay[];
  selectedStay: Stay | null;
  stayDays: StayDay[];
  accommodationGroups: AccommodationGroup[];
  todayOffset: number | null;
  onSelectStay: (id: string) => void;
  onOpenStay: () => void;
  onOpenVisit: (id: string) => void;
}

export function PlanTab({
  trip,
  sortedStays,
  selectedStay,
  stayDays,
  accommodationGroups,
  todayOffset,
  onSelectStay,
  onOpenStay,
  onOpenVisit,
}: PlanTabProps) {
  const todayRef = React.useRef<HTMLDivElement>(null);
  const didAutoScroll = React.useRef(false);

  React.useEffect(() => {
    if (didAutoScroll.current) return;
    if (todayOffset === null) return;
    if (todayRef.current) {
      todayRef.current.scrollIntoView({ block: 'start', behavior: 'auto' });
      didAutoScroll.current = true;
    }
  }, [todayOffset]);

  const stayStartDay = selectedStay ? Math.floor(selectedStay.startSlot / 3) : 0;
  const stayTotalDays = selectedStay
    ? Math.ceil((selectedStay.endSlot - selectedStay.startSlot) / 3)
    : 0;
  const dayOfStayForToday =
    selectedStay && todayOffset !== null
      ? Math.max(0, Math.min(stayTotalDays - 1, todayOffset - stayStartDay)) + 1
      : 1;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {selectedStay && (
        <StayChip
          name={selectedStay.name}
          color={selectedStay.color}
          dayOfStay={dayOfStayForToday}
          totalDays={stayTotalDays}
          onClick={onOpenStay}
        />
      )}

      <div className="flex-shrink-0 border-b border-border px-2 py-2 overflow-x-auto scroll-hide">
        <div className="flex items-center gap-1.5">
          {sortedStays.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelectStay(s.id)}
              className={cn(
                'flex-shrink-0 px-3 h-7 rounded-md text-xs font-semibold text-white',
                s.id === selectedStay?.id ? 'ring-2 ring-primary/40' : '',
              )}
              style={{ background: s.color }}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 pb-safe">
        {stayDays.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
            <p className="text-sm font-semibold text-foreground">
              {selectedStay ? 'No days yet' : 'Pick a destination above'}
            </p>
            <p className="text-xs text-muted-foreground max-w-[240px]">
              {selectedStay
                ? 'Open on desktop to add activities for this stay.'
                : 'Tap a destination in the timeline to see its days.'}
            </p>
          </div>
        )}

        {stayDays.map((day) => {
          const dayDate = addDaysTo(safeDate(trip.startDate), day.absoluteDay);
          const isToday = day.absoluteDay === todayOffset;
          const dayVisits = trip.visits.filter(
            (v) => v.stayId === selectedStay?.id && v.dayOffset === day.dayOffset,
          );
          const dayAccom = accommodationGroups.find((g) => g.startDayOffset === day.dayOffset);

          return (
            <div
              key={day.dayOffset}
              ref={isToday ? todayRef : undefined}
              className={cn(
                'bg-card border border-border rounded-lg p-3',
                isToday && 'ring-1 ring-primary/40',
              )}
            >
              <div className="flex items-baseline justify-between pb-2 border-b border-border mb-2">
                <span className="font-num text-sm font-semibold">Day {day.dayOffset + 1}</span>
                <span className="font-num text-xs text-muted-foreground">
                  {fmt(dayDate, { month: 'short', day: 'numeric' })}
                </span>
              </div>

              {dayAccom && (
                <div className="flex items-center gap-2 text-xs bg-muted/50 rounded-md px-2 py-1.5 mb-2">
                  <span className="shrink-0">🛏</span>
                  <span className="font-medium truncate">{dayAccom.name}</span>
                </div>
              )}

              {DAY_PARTS.map((period) => {
                const periodVisits = dayVisits.filter((v) => v.dayPart === period);
                if (periodVisits.length === 0) return null;
                return (
                  <React.Fragment key={period}>
                    <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold pt-2 pb-1">
                      {period}
                    </div>
                    {periodVisits.map((visit) => (
                      <VisitRow key={visit.id} visit={visit} onOpen={() => onOpenVisit(visit.id)} />
                    ))}
                  </React.Fragment>
                );
              })}

              {dayVisits.length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-4">No activities</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VisitRow({ visit, onOpen }: { visit: VisitItem; onOpen: () => void }) {
  const bg = getVisitTypeBg(visit.type);
  const checkDone = visit.checklist?.filter((c) => c.done).length ?? 0;
  const checkTotal = visit.checklist?.length ?? 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/50 hover:bg-muted active:bg-muted/70 text-left"
    >
      <span aria-hidden="true" className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', bg)} />
      <span className="text-xs font-medium flex-1 truncate">{visit.name}</span>
      {checkTotal > 0 && (
        <span className="font-num text-[10px] text-muted-foreground flex-shrink-0">
          ✓ {checkDone}/{checkTotal}
        </span>
      )}
    </button>
  );
}
