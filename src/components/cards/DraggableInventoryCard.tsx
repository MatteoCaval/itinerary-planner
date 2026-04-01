import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Pencil, GripVertical, Check, Link2 } from 'lucide-react';
import { getVisitTypeColor, getVisitLabel } from '@/domain/visitTypeDisplay';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { VisitItem } from '@/domain/types';

function DraggableInventoryCard({ visit, onEdit }: { visit: VisitItem; onEdit: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `inbox-${visit.id}`,
    data: { type: 'inbox', visit },
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 }}
      className="p-3 bg-white rounded-lg border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all group select-none touch-none cursor-grab active:cursor-grabbing"
      aria-label={`Drag ${visit.name} to schedule`}
    >
      <div className="flex justify-between items-start mb-1.5">
        <Badge
          variant="outline"
          className={`text-[11px] font-bold uppercase tracking-tighter ${getVisitTypeColor(visit.type)}`}
        >
          {getVisitLabel(visit.type)}
        </Badge>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="opacity-60 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-slate-600 touch-auto"
            aria-label={`Edit ${visit.name}`}
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <div className="p-2.5 text-slate-300" aria-hidden="true">
            <GripVertical className="w-4 h-4" />
          </div>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-slate-800">{visit.name}</p>
          {visit.durationHint && (
            <p className="text-[11px] text-slate-400 mt-0.5">{visit.durationHint}</p>
          )}
          {visit.checklist?.length || visit.links?.length ? (
            <div className="flex items-center gap-1.5 mt-1.5">
              {visit.checklist?.length ? (
                <Badge variant="secondary" className="text-[9px] font-bold text-slate-500 gap-1.5">
                  <Check className="w-2.5 h-2.5" />
                  {visit.checklist.filter((i) => i.done).length}/{visit.checklist.length}
                </Badge>
              ) : null}
              {visit.links?.length ? (
                <Badge variant="secondary" className="text-[9px] font-bold text-slate-500 gap-1.5">
                  <Link2 className="w-2.5 h-2.5" />
                  {visit.links.length}
                </Badge>
              ) : null}
            </div>
          ) : null}
        </div>
        {visit.imageUrl && (
          <div className="size-9 rounded-md overflow-hidden flex-shrink-0 border border-slate-100 shadow-sm">
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

export default DraggableInventoryCard;
