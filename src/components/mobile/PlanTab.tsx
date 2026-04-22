import * as React from 'react';
import { Sunrise, Sun, Moon } from 'lucide-react';
import type { AccommodationGroup, HybridTrip, Stay, VisitItem } from '@/domain/types';
import type { deriveStayDays } from '@/domain/stayLogic';
import { fmt, safeDate, addDaysTo } from '@/domain/dateUtils';
import { DAY_PARTS } from '@/domain/constants';
import { getVisitTypeBg, getVisitTypeColor, getVisitTypeIcon } from '@/domain/visitTypeDisplay';
import { StayChip } from './StayChip';
import { cn } from '@/lib/utils';

type StayDay = ReturnType<typeof deriveStayDays>[number];

interface PlanTabProps {
  trip: HybridTrip;
  tripName: string;
  tripDateRange: string;
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
  tripName,
  tripDateRange,
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
      {/* Trip header */}
      <div className="flex-shrink-0 bg-background px-4 py-3 border-b border-border pt-safe">
        <h1 className="font-serif italic text-lg text-foreground leading-tight truncate">
          {tripName}
        </h1>
        <div className="font-num text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">
          {tripDateRange}
        </div>
      </div>

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
          <button
            type="button"
            onClick={() => onSelectStay('')}
            className={cn(
              'flex-shrink-0 px-3 h-7 rounded-md text-xs font-semibold border',
              selectedStay
                ? 'border-border bg-background text-muted-foreground hover:bg-muted'
                : 'border-primary bg-primary/10 text-primary',
            )}
            aria-pressed={!selectedStay}
          >
            All
          </button>
          {sortedStays.map((s) => {
            const isSelected = s.id === selectedStay?.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onSelectStay(isSelected ? '' : s.id)}
                className={cn(
                  'flex-shrink-0 px-3 h-7 rounded-md text-xs font-semibold text-white',
                  isSelected ? 'ring-2 ring-primary/40' : '',
                )}
                style={{ background: s.color }}
                aria-pressed={isSelected}
              >
                {s.name}
              </button>
            );
          })}
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
              <div className="flex items-center pb-2 border-b border-border mb-2 gap-3">
                {/* Left gutter: big serif date */}
                <div className="flex flex-col items-center leading-none">
                  <span
                    className={cn(
                      'text-[10px] uppercase tracking-widest font-semibold',
                      isToday ? 'text-primary' : 'text-muted-foreground',
                    )}
                  >
                    {fmt(dayDate, { month: 'short' })}
                  </span>
                  <span
                    className={cn(
                      'text-3xl font-serif italic leading-none mt-0.5',
                      isToday ? 'text-primary' : 'text-foreground',
                    )}
                  >
                    {dayDate.getDate()}
                  </span>
                </div>

                {/* Right column: Day number + weekday */}
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                  <span className="font-num text-sm font-semibold text-foreground">
                    Day {day.dayOffset + 1}
                  </span>
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                    {fmt(dayDate, { weekday: 'long' })}
                  </span>
                </div>

                {isToday && (
                  <span className="flex-shrink-0 text-[9px] uppercase tracking-widest font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                    Today
                  </span>
                )}
              </div>

              {dayAccom && (
                <div className="flex items-center gap-2 text-xs bg-muted/50 rounded-md px-2 py-1.5 mb-2">
                  <span className="shrink-0">🛏</span>
                  <span className="font-medium truncate">{dayAccom.name}</span>
                </div>
              )}

              {DAY_PARTS.map((period) => {
                const periodVisits = dayVisits.filter((v) => v.dayPart === period);
                return (
                  <React.Fragment key={period}>
                    <div className="flex items-center gap-2 pt-3 pb-1.5">
                      {period === 'morning' && <Sunrise className="size-3 text-amber-500/70" aria-hidden="true" />}
                      {period === 'afternoon' && <Sun className="size-3 text-amber-500/70" aria-hidden="true" />}
                      {period === 'evening' && <Moon className="size-3 text-indigo-400/70" aria-hidden="true" />}
                      <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">
                        {period}
                      </span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                    {periodVisits.length === 0 ? (
                      <div className="text-[10px] text-muted-foreground/60 italic px-2 py-1">
                        —
                      </div>
                    ) : (
                      periodVisits.map((visit) => (
                        <VisitRow
                          key={visit.id}
                          visit={visit}
                          onOpen={() => onOpenVisit(visit.id)}
                        />
                      ))
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VisitRow({ visit, onOpen }: { visit: VisitItem; onOpen: () => void }) {
  const Icon = getVisitTypeIcon(visit.type);
  const colorClass = getVisitTypeColor(visit.type); // for the icon
  const checkDone = visit.checklist?.filter((c) => c.done).length ?? 0;
  const checkTotal = visit.checklist?.length ?? 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'w-full relative flex items-center gap-2.5 pl-3 pr-2 py-2 rounded-md',
        'bg-muted/40 hover:bg-muted active:bg-muted/70 text-left overflow-hidden',
      )}
    >
      {/* Type-colored left stripe */}
      <span
        aria-hidden="true"
        className={cn(
          'absolute left-0 top-0 bottom-0 w-[3px] rounded-l-md',
          getVisitTypeBg(visit.type),
        )}
      />
      <Icon aria-hidden="true" className={cn('size-3.5 flex-shrink-0', colorClass)} />
      <span className="text-xs font-medium flex-1 truncate">{visit.name}</span>
      {checkTotal > 0 && (
        <span className="font-num text-[10px] text-muted-foreground flex-shrink-0">
          ✓ {checkDone}/{checkTotal}
        </span>
      )}
    </button>
  );
}
