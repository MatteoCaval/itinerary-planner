import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Pencil, GripVertical, Check, Link2, Eye } from 'lucide-react';
import { getVisitTypeBg, getVisitTypeColor, getVisitLabel } from '@/domain/visitTypeDisplay';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { VisitItem } from '@/domain/types';

function SortableVisitCard({
  visit,
  isSelected,
  isHighlighted,
  onSelect,
  onEdit,
  onHover,
  onHoverEnd,
}: {
  visit: VisitItem;
  isSelected: boolean;
  isHighlighted?: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onHover?: () => void;
  onHoverEnd?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } =
    useSortable({
      id: `visit-${visit.id}`,
      data: { type: 'visit', visit },
    });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
      }}
      onMouseEnter={onHover}
      onMouseLeave={onHoverEnd}
      className={`relative pl-[18px] pr-3.5 py-3.5 bg-white rounded-lg border transition-all group select-none touch-none cursor-grab active:cursor-grabbing ${
        isOver
          ? 'border-primary shadow-md ring-2 ring-primary/25 bg-primary/[0.02]'
          : isHighlighted
            ? 'border-primary/40 shadow-md ring-2 ring-primary/20 bg-primary/[0.03]'
            : isSelected
              ? 'border-primary/30 shadow-[0_4px_12px_rgba(15,118,110,0.1)] ring-1 ring-primary/10'
              : 'border-border hover:border-border hover:shadow-md'
      }`}
    >
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg ${getVisitTypeBg(visit.type)}`}
      />
      {isOver && (
        <div className="absolute -top-1 left-2 right-2 h-0.5 bg-primary rounded-full z-10" />
      )}
      <div className="flex items-start justify-between mb-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant="outline"
            className={`text-[11px] font-bold uppercase tracking-tighter ${getVisitTypeColor(visit.type)}`}
          >
            {getVisitLabel(visit.type)}
          </Badge>
          {visit.durationHint && (
            <span className="text-[11px] text-muted-foreground font-medium">{visit.durationHint}</span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 ml-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="opacity-60 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground touch-auto"
            aria-label={`Edit ${visit.name}`}
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <div className="p-2.5" aria-hidden="true">
            <GripVertical className="w-4 h-4 text-muted-foreground/40" />
          </div>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p
            onClick={onSelect}
            className="text-xs font-bold leading-tight text-foreground cursor-pointer hover:text-primary transition-colors flex items-center gap-1"
          >
            <span className="truncate">{visit.name}</span>
            <Eye className="w-3 h-3 flex-shrink-0 opacity-0 group-hover:opacity-40 transition-opacity" />
          </p>
          {visit.notes && (
            <p className="text-[11px] text-muted-foreground mt-1 italic leading-snug line-clamp-2">{visit.notes}</p>
          )}
          {visit.checklist?.length || visit.links?.length ? (
            <div className="flex items-center gap-1.5 mt-1.5">
              {visit.checklist?.length ? (
                <Badge variant="secondary" className="font-num text-[9px] font-bold text-muted-foreground gap-1.5">
                  <Check className="w-2.5 h-2.5" />
                  {visit.checklist.filter((i) => i.done).length}/{visit.checklist.length}
                </Badge>
              ) : null}
              {visit.links?.length ? (
                <Badge variant="secondary" className="font-num text-[9px] font-bold text-muted-foreground gap-1.5">
                  <Link2 className="w-2.5 h-2.5" />
                  {visit.links.length}
                </Badge>
              ) : null}
            </div>
          ) : null}
        </div>
        {visit.imageUrl && (
          <div className="size-9 rounded-md overflow-hidden flex-shrink-0 border border-border shadow-sm">
            <img
              src={visit.imageUrl}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default SortableVisitCard;
