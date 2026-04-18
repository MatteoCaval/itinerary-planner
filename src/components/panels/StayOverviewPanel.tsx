import { useState, useEffect } from 'react';
import { MapPin, Hotel, ExternalLink, X, ChevronDown, Plus } from 'lucide-react';
import type { Stay, AccommodationGroup, ChecklistItem, VisitLink } from '@/domain/types';
import { fmt } from '@/domain/dateUtils';
import { deriveStayDays } from '@/domain/stayLogic';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

function StayOverviewPanel({
  stay,
  stayDays,
  accommodationGroups,
  onUpdate,
  visitCount,
}: {
  stay: Stay;
  stayDays: ReturnType<typeof deriveStayDays>;
  accommodationGroups: AccommodationGroup[];
  onUpdate: (updates: Partial<Stay>) => void;
  visitCount: number;
}) {
  const [notes, setNotes] = useState(stay.notes ?? '');
  const [links, setLinks] = useState<VisitLink[]>(stay.links ?? []);
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkLabel, setNewLinkLabel] = useState('');

  // Reset local state when switching to a different stay (not on every prop change — would clobber edits)
  useEffect(() => {
    setNotes(stay.notes ?? '');
    setLinks(stay.links ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stay.id]);

  const nights = stayDays.filter((d) => d.hasNight).length;
  const startDate = stayDays[0]?.date;
  const endDate = stayDays[stayDays.length - 1]?.date;

  const addLink = () => {
    const url = newLinkUrl.trim();
    if (!url) return;
    const normalized = url.startsWith('http') ? url : `https://${url}`;
    const next = [...links, { url: normalized, label: newLinkLabel.trim() || undefined }];
    setLinks(next);
    onUpdate({ links: next });
    setNewLinkUrl('');
    setNewLinkLabel('');
  };

  return (
    <div className="flex-1 overflow-y-auto scroll-hide">
      {/* Hero */}
      <div className="relative h-24 bg-muted flex-shrink-0">
        {stay.imageUrl ? (
          <img src={stay.imageUrl} alt={stay.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted">
            <MapPin className="w-7 h-7 text-muted-foreground/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute bottom-2.5 left-3.5 right-3.5">
          <div className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0 ring-1 ring-white/40"
              style={{ backgroundColor: stay.color }}
            />
            <h2 className="text-white font-bold text-sm leading-tight truncate" title={stay.name}>
              {stay.name}
            </h2>
          </div>
          {startDate && endDate && (
            <p className="font-num text-white/70 text-[11px] mt-0.5">
              {fmt(startDate, { month: 'short', day: 'numeric' })} →{' '}
              {fmt(endDate, { month: 'short', day: 'numeric' })}
            </p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 border-b border-border-neutral">
        {[
          { value: stayDays.length, label: 'Days' },
          { value: nights, label: 'Nights' },
          { value: visitCount, label: 'Places' },
        ].map(({ value, label }, i) => (
          <div
            key={label}
            className={`px-3 py-2 text-center ${i < 2 ? 'border-r border-border-neutral' : ''}`}
          >
            <p className="font-num text-base font-extrabold text-foreground">{value}</p>
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* Accommodation */}
      {accommodationGroups.length > 0 && (
        <div className="px-4 py-2 border-b border-border-neutral">
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground mb-1.5">
            Sleeping
          </p>
          <div className="space-y-1">
            {accommodationGroups.map((g, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-2.5 py-1.5 bg-primary/5 rounded-lg"
              >
                <Hotel className="w-3 h-3 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-foreground truncate">{g.name}</p>
                  <p className="text-[9px] text-muted-foreground">
                    {g.nights} {g.nights === 1 ? 'night' : 'nights'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="px-4 py-2 border-b border-border-neutral">
        <label className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground mb-1.5 block">
          Notes
        </label>
        <Textarea
          className="text-xs resize-none text-foreground placeholder:text-muted-foreground"
          rows={3}
          placeholder="Travel tips, booking info, things to know…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => onUpdate({ notes: notes.trim() || undefined })}
        />
      </div>

      {/* Links */}
      <div className="px-4 py-2 border-b border-border-neutral">
        <label className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground mb-1.5 block">
          Links
        </label>
        <div className="space-y-1.5">
          {links.map((link, i) => (
            <div key={i} className="flex items-center gap-2 group">
              <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-xs text-primary hover:underline truncate"
                onClick={(e) => e.stopPropagation()}
              >
                {link.label || link.url}
              </a>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  const next = links.filter((_, idx) => idx !== i);
                  setLinks(next);
                  onUpdate({ links: next.length > 0 ? next : undefined });
                }}
                className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive sm:max-md:opacity-100"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
          <div className="space-y-1.5 mt-1">
            <Input
              className="text-xs h-7"
              placeholder="https://…"
              value={newLinkUrl}
              onChange={(e) => setNewLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addLink();
                }
              }}
            />
            <div className="flex gap-1.5">
              <Input
                className="flex-1 text-xs h-7"
                placeholder="Label (optional)"
                value={newLinkLabel}
                onChange={(e) => setNewLinkLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addLink();
                  }
                }}
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={addLink}
                disabled={!newLinkUrl.trim()}
                className="text-xs font-bold"
              >
                Add
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* To-do */}
      <StayTodoSection
        key={stay.id}
        stay={stay}
        onUpdate={(cl) => onUpdate({ checklist: cl.length > 0 ? cl : undefined })}
      />
    </div>
  );
}

// ─── Stay to-do section ───────────────────────────────────────────────────────
export function StayTodoSection({
  stay,
  onUpdate,
}: {
  stay: Stay;
  onUpdate: (checklist: ChecklistItem[]) => void;
}) {
  const checklist = stay.checklist ?? [];
  const [open, setOpen] = useState(checklist.length > 0);
  const [inputText, setInputText] = useState('');
  const doneCount = checklist.filter((i) => i.done).length;

  const addItem = () => {
    const text = inputText.trim();
    if (!text) return;
    onUpdate([...checklist, { id: `cl-${Date.now()}`, text, done: false }]);
    setInputText('');
  };

  return (
    <div className="border-b border-border-neutral flex-shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-2 flex items-center justify-between hover:bg-muted transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">
            To-Do
          </span>
          {checklist.length > 0 && (
            <Badge
              variant="secondary"
              className={`font-num text-[9px] font-bold h-auto px-1.5 py-0.5 ${doneCount === checklist.length ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'}`}
            >
              {doneCount}/{checklist.length}
            </Badge>
          )}
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-muted-foreground transition-all duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="px-4 pb-3 space-y-1.5">
          <div className="max-h-48 overflow-y-auto space-y-1.5">
            {checklist.map((item) => (
              <div key={item.id} className="flex items-center gap-2 group">
                <Checkbox
                  checked={item.done}
                  onCheckedChange={() =>
                    onUpdate(checklist.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)))
                  }
                  className="size-3.5"
                />
                <span
                  className={`flex-1 text-xs ${item.done ? 'line-through text-muted-foreground' : 'text-foreground'}`}
                >
                  {item.text}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onUpdate(checklist.filter((i) => i.id !== item.id))}
                  className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive sm:max-md:opacity-100"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <Input
              className="flex-1 text-xs h-7"
              placeholder="Add to-do…"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addItem();
                }
              }}
            />
            <Button
              variant="secondary"
              size="icon-sm"
              onClick={addItem}
              disabled={!inputText.trim()}
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default StayOverviewPanel;
