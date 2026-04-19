import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Pencil, GripVertical, Check, Link2, MapPin } from 'lucide-react';
import { getVisitTypeColor, getVisitLabel } from '@/domain/visitTypeDisplay';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { VisitItem } from '@/domain/types';

const DraggableInventoryCard = React.memo(function DraggableInventoryCard({
  visit,
  onEdit,
  onLocate,
}: {
  visit: VisitItem;
  onEdit: () => void;
  onLocate?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `inbox-${visit.id}`,
    data: { type: 'inbox', visit },
  });
  const reduce = useReducedMotion();

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? (reduce ? 1 : 0.4) : 1,
      }}
      className="p-3 bg-white rounded-lg border border-border hover:border-border hover:shadow-md transition-all group select-none touch-none cursor-grab active:cursor-grabbing"
      aria-label={`Drag ${visit.name} to schedule`}
    >
      <div className="flex justify-between items-start mb-1.5">
        <Badge
          variant="outline"
          className={`text-[11px] font-bold uppercase tracking-tighter ${getVisitTypeColor(visit.type)}`}
        >
          {getVisitLabel(visit.type)}
        </Badge>
        <div className="flex items-center gap-1 px-1">
          {onLocate && (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onLocate();
              }}
              className="opacity-60 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary touch-auto"
              aria-label="Locate on map"
            >
              <MapPin className="size-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="opacity-60 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground touch-auto"
            aria-label="Edit"
          >
            <Pencil className="size-3.5" />
          </Button>
          <div
            className="p-2.5 text-muted-foreground/50 group-hover:text-muted-foreground/80 transition-colors"
            aria-hidden="true"
          >
            <GripVertical className="w-4 h-4" />
          </div>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-foreground">{visit.name}</p>
          {visit.durationHint && (
            <p className="text-[11px] text-muted-foreground mt-0.5">{visit.durationHint}</p>
          )}
          {visit.checklist?.length || visit.links?.length ? (
            <div className="flex items-center gap-1.5 mt-1.5">
              {visit.checklist?.length ? (
                <Badge
                  variant="secondary"
                  className="font-num text-[9px] font-bold text-muted-foreground gap-1.5"
                >
                  <Check className="w-2.5 h-2.5" />
                  {visit.checklist.filter((i) => i.done).length}/{visit.checklist.length}
                </Badge>
              ) : null}
              {visit.links?.length ? (
                <Badge
                  variant="secondary"
                  className="font-num text-[9px] font-bold text-muted-foreground gap-1.5"
                >
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
});

export default DraggableInventoryCard;
