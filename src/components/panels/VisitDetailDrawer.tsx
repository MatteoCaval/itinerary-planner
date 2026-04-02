import { useState, useEffect } from 'react';
import {
  Calendar,
  Pencil,
  ArrowLeftRight,
  Trash2,
  ChevronDown,
  ExternalLink,
  X,
  Plus,
} from 'lucide-react';
import type { VisitItem, ChecklistItem } from '@/domain/types';
import { getVisitTypeBg, getVisitTypeColor, getVisitLabel } from '@/domain/visitTypeDisplay';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

function VisitDetailDrawer({
  visit,
  dayLabel,
  onClose,
  onEdit,
  onUnschedule,
  onDelete,
  onUpdateVisit,
}: {
  visit: VisitItem;
  dayLabel: string;
  onClose: () => void;
  onEdit: () => void;
  onUnschedule: () => void;
  onDelete: () => void;
  onUpdateVisit: (updates: Partial<VisitItem>) => void;
}) {
  const [notes, setNotes] = useState(visit.notes ?? '');
  const [checklist, setChecklist] = useState<ChecklistItem[]>(visit.checklist ?? []);
  const [newChecklistText, setNewChecklistText] = useState('');

  // Reset local state when switching visits (not on every prop change — would clobber edits)
  useEffect(() => {
    setNotes(visit.notes ?? '');
    setChecklist(visit.checklist ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visit.id]);

  const saveNotes = () => {
    const trimmed = notes.trim() || undefined;
    if (trimmed !== visit.notes) onUpdateVisit({ notes: trimmed });
  };

  const toggleChecklistItem = (itemId: string) => {
    const next = checklist.map((c) => (c.id === itemId ? { ...c, done: !c.done } : c));
    setChecklist(next);
    onUpdateVisit({ checklist: next.length > 0 ? next : undefined });
  };

  const addChecklistItem = () => {
    const text = newChecklistText.trim();
    if (!text) return;
    const next = [...checklist, { id: `cl-${Date.now()}`, text, done: false }];
    setChecklist(next);
    setNewChecklistText('');
    onUpdateVisit({ checklist: next });
  };

  const removeChecklistItem = (itemId: string) => {
    const next = checklist.filter((c) => c.id !== itemId);
    setChecklist(next);
    onUpdateVisit({ checklist: next.length > 0 ? next : undefined });
  };

  const doneCount = checklist.filter((c) => c.done).length;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Back to stay */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onClose}
        className="gap-1.5 justify-start rounded-none text-[11px] font-semibold text-slate-500 hover:text-primary border-b border-border-neutral flex-shrink-0"
      >
        <ChevronDown className="w-3.5 h-3.5 rotate-90" />
        Back to stay
      </Button>
      {/* Hero */}
      <div className="relative h-28 flex-shrink-0">
        {visit.imageUrl ? (
          <img src={visit.imageUrl} alt={visit.name} className="w-full h-full object-cover" />
        ) : (
          <div
            className={`w-full h-full flex items-center justify-center ${getVisitTypeBg(visit.type)} opacity-20`}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="absolute bottom-2.5 left-3.5 right-3.5">
          <Badge
            variant="outline"
            className={`text-[9px] font-bold uppercase tracking-tighter ${getVisitTypeColor(visit.type)} bg-white/90`}
          >
            {getVisitLabel(visit.type)}
          </Badge>
          <h3 className="text-white font-bold text-sm leading-tight mt-1 truncate">{visit.name}</h3>
          {visit.area && <p className="text-white/60 text-[11px] truncate">{visit.area}</p>}
        </div>
      </div>

      {/* Schedule + duration bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border-neutral bg-slate-50/50 text-[11px]">
        <div className="flex items-center gap-1.5 text-slate-600">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-semibold">{dayLabel}</span>
        </div>
        {visit.durationHint && (
          <>
            <span className="text-slate-300">·</span>
            <span className="font-medium text-slate-500">{visit.durationHint}</span>
          </>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto scroll-hide">
        {/* Notes */}
        <div className="px-4 py-3 border-b border-border-neutral">
          <label className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 mb-1.5 block">
            Notes
          </label>
          <Textarea
            className="text-xs text-slate-700 resize-none placeholder:text-slate-400"
            rows={3}
            placeholder="Add notes about this place..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveNotes}
          />
        </div>

        {/* Checklist */}
        <div className="px-4 py-3 border-b border-border-neutral">
          <details open={checklist.length > 0 || undefined}>
            <summary className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 mb-1.5 cursor-pointer select-none flex items-center gap-1.5 hover:text-slate-600 transition-colors">
              <ChevronDown className="w-3 h-3 transition-transform [details:not([open])_&]:-rotate-90" />
              Checklist
              {checklist.length > 0 && (
                <Badge
                  variant="secondary"
                  className="text-[9px] font-bold text-primary bg-primary/10 h-auto px-1.5"
                >
                  {doneCount}/{checklist.length}
                </Badge>
              )}
            </summary>
            <div className="space-y-1 mt-1">
              {checklist.map((item) => (
                <div key={item.id} className="flex items-center gap-2 group">
                  <Checkbox
                    checked={item.done}
                    onCheckedChange={() => toggleChecklistItem(item.id)}
                    className="size-3.5"
                  />
                  <span
                    className={`flex-1 text-xs ${item.done ? 'line-through text-slate-400' : 'text-slate-700'}`}
                  >
                    {item.text}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => removeChecklistItem(item.id)}
                    className="opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-400 hover:text-red-500"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
              <div className="flex items-center gap-1.5 mt-1">
                <Input
                  className="flex-1 text-xs h-7"
                  placeholder="Add item..."
                  value={newChecklistText}
                  onChange={(e) => setNewChecklistText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addChecklistItem();
                    }
                  }}
                />
                <Button
                  variant="secondary"
                  size="icon-sm"
                  onClick={addChecklistItem}
                  disabled={!newChecklistText.trim()}
                >
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </details>
        </div>

        {/* Links */}
        {visit.links && visit.links.length > 0 && (
          <div className="px-4 py-3 border-b border-border-neutral">
            <p className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 mb-1.5">
              Links
            </p>
            <div className="space-y-1.5">
              {visit.links.map((link, i) => (
                <a
                  key={i}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-primary hover:underline truncate"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-primary/50 flex-shrink-0" />
                  {link.label || link.url}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-border-neutral bg-white flex-shrink-0">
        <Button onClick={onEdit} size="sm" className="flex-1 text-xs font-bold gap-1.5">
          <Pencil className="w-3 h-3" /> Edit Details
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={onUnschedule}
          className="border-blue-200 text-blue-500 hover:bg-blue-50"
          title="Move to Inbox"
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="destructive"
          size="icon-sm"
          onClick={() => {
            onDelete();
            onClose();
          }}
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

export default VisitDetailDrawer;
