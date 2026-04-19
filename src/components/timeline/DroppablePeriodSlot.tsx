import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { PlusCircle } from 'lucide-react';
import type { DayPart, VisitItem } from '@/domain/types';
import { getPeriodIcon, getPeriodLabel } from '@/domain/periodDisplay';
import SortableVisitCard from '@/components/cards/SortableVisitCard';
import { Button } from '@/components/ui/button';

function DroppablePeriodSlot({
  dayOffset,
  period,
  visits,
  selectedVisitId,
  onSelectVisit,
  onEditVisit,
  onAddVisit,
  onHoverVisit,
  onHoverVisitEnd,
  highlightedVisitId,
}: {
  dayOffset: number;
  period: DayPart;
  visits: VisitItem[];
  selectedVisitId: string | null;
  onSelectVisit: (id: string) => void;
  onEditVisit: (v: VisitItem) => void;
  onAddVisit: (dayOffset: number, part: DayPart) => void;
  onHoverVisit?: (id: string) => void;
  onHoverVisitEnd?: () => void;
  highlightedVisitId?: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${dayOffset}-${period}` });

  const PeriodIcon = getPeriodIcon(period);
  const label = getPeriodLabel(period);
  const labelId = `${period}-${dayOffset}-label`;

  const sortableIds = React.useMemo(() => visits.map((v) => `visit-${v.id}`), [visits]);

  return (
    <div
      ref={setNodeRef}
      aria-label={`${label} slot, day ${dayOffset + 1}`}
      className={`p-1.5 rounded-xl border transition-colors ${isOver ? 'bg-primary/5 border-primary/30' : 'bg-border/40 border-border/80'}`}
    >
      <div className="flex items-center gap-1.5 px-2 py-1.5 mb-1">
        <PeriodIcon className="w-4 h-4 text-muted-foreground" />
        <span
          id={labelId}
          className="text-[9px] font-extrabold uppercase tracking-widest text-muted-foreground"
        >
          {label}
        </span>
      </div>
      <div className="space-y-2">
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          {visits.map((v) => (
            <SortableVisitCard
              key={v.id}
              visit={v}
              isSelected={selectedVisitId === v.id}
              isHighlighted={highlightedVisitId === v.id}
              onSelect={() => onSelectVisit(v.id)}
              onEdit={() => onEditVisit(v)}
              onHover={() => onHoverVisit?.(v.id)}
              onHoverEnd={onHoverVisitEnd}
            />
          ))}
        </SortableContext>
        <Button
          variant="outline"
          aria-describedby={labelId}
          onClick={() => onAddVisit(dayOffset, period)}
          className={`w-full h-10 border-2 border-dashed gap-1.5 group transition-colors ${
            isOver
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-muted/70'
          }`}
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span className="text-[11px] font-bold uppercase tracking-tight">
            {isOver ? 'Drop here' : 'Drop or add'}
          </span>
        </Button>
      </div>
    </div>
  );
}

export default DroppablePeriodSlot;
