import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Sunrise, Sun, Moon, PlusCircle } from 'lucide-react';
import type { DayPart, VisitItem } from '@/domain/types';
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
}: {
  dayOffset: number;
  period: DayPart;
  visits: VisitItem[];
  selectedVisitId: string | null;
  onSelectVisit: (id: string) => void;
  onEditVisit: (v: VisitItem) => void;
  onAddVisit: (dayOffset: number, part: DayPart) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${dayOffset}-${period}` });
  const PeriodIcon = period === 'morning' ? Sunrise : period === 'afternoon' ? Sun : Moon;
  const label = period === 'morning' ? 'Morning' : period === 'afternoon' ? 'Afternoon' : 'Evening';

  return (
    <div
      ref={setNodeRef}
      aria-label={`${label} slot, day ${dayOffset + 1}`}
      className={`p-1.5 rounded-xl border transition-colors ${isOver ? 'bg-primary/5 border-primary/30' : 'bg-border/40 border-border/80'}`}
    >
      <div className="flex items-center gap-1.5 px-2 py-1.5 mb-1">
        <PeriodIcon className="w-3 h-3 text-muted-foreground" />
        <span className="text-[9px] font-extrabold uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="space-y-2">
        <SortableContext
          items={visits.map((v) => `visit-${v.id}`)}
          strategy={verticalListSortingStrategy}
        >
          {visits.map((v) => (
            <SortableVisitCard
              key={v.id}
              visit={v}
              isSelected={selectedVisitId === v.id}
              onSelect={() => onSelectVisit(v.id)}
              onEdit={() => onEditVisit(v)}
            />
          ))}
        </SortableContext>
        <Button
          variant="outline"
          onClick={() => onAddVisit(dayOffset, period)}
          className="w-full h-10 border-2 border-dashed border-border text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 gap-1.5 group"
        >
          <PlusCircle className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
          <span className="text-[11px] font-bold uppercase tracking-tight">Drop or add</span>
        </Button>
      </div>
    </div>
  );
}

export default DroppablePeriodSlot;
