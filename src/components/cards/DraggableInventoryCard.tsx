import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Pencil, GripVertical, Check, Link2 } from 'lucide-react';
import { getVisitTypeColor, getVisitLabel } from '@/domain/visitTypeDisplay';
import type { VisitItem } from '@/domain/types';

function DraggableInventoryCard({ visit, onEdit }: { visit: VisitItem; onEdit: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `inbox-${visit.id}`, data: { type: 'inbox', visit },
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
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter border ${getVisitTypeColor(visit.type)}`}>
          {getVisitLabel(visit.type)}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="opacity-60 group-hover:opacity-100 transition-opacity p-2.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-primary/50 touch-auto"
            aria-label={`Edit ${visit.name}`}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <div className="p-2.5 text-slate-300" aria-hidden="true">
            <GripVertical className="w-4 h-4" />
          </div>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-slate-800">{visit.name}</p>
          {visit.durationHint && <p className="text-[11px] text-slate-400 mt-0.5">{visit.durationHint}</p>}
          {(visit.checklist?.length || visit.links?.length) ? (
            <div className="flex items-center gap-1.5 mt-1.5">
              {visit.checklist?.length ? (
                <span className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500 bg-slate-100 rounded-full px-2 py-1">
                  <Check className="w-2.5 h-2.5" />
                  {visit.checklist.filter(i => i.done).length}/{visit.checklist.length}
                </span>
              ) : null}
              {visit.links?.length ? (
                <span className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500 bg-slate-100 rounded-full px-2 py-1">
                  <Link2 className="w-2.5 h-2.5" />
                  {visit.links.length}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        {visit.imageUrl && (
          <div className="size-9 rounded-md overflow-hidden flex-shrink-0 border border-slate-100 shadow-sm">
            <img src={visit.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
          </div>
        )}
      </div>
    </div>
  );
}

export default DraggableInventoryCard;
