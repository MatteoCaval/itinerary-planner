import { useState, useEffect } from 'react';
import {
  Search,
  MapPin,
  Check,
  ChevronDown,
  ExternalLink,
  X,
  Plus,
  Trash2,
  ArrowLeftRight,
} from 'lucide-react';
import ModalBase from '@/components/ui/ModalBase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { getVisitTypeIcon } from '@/components/ui/TransportIcon';
import { ChecklistItem, VisitItem, VisitLink, VisitType } from '@/domain/types';
import { VISIT_TYPES } from '@/domain/constants';
import { getVisitTypeColor, getVisitLabel } from '@/domain/visitTypeDisplay';
import { Checkbox } from '@/components/ui/checkbox';
import { searchPlace, PlaceSearchResult } from '@/utils/geocoding';

function VisitFormModal({
  initial,
  title,
  onClose,
  onSave,
  onDelete,
  onUnschedule,
  onMoveToStay,
  availableStays,
  currentStayId,
}: {
  initial?: Partial<VisitItem>;
  title: string;
  onClose: () => void;
  onSave: (data: {
    name: string;
    type: VisitType;
    durationHint: string;
    notes: string;
    lat?: number;
    lng?: number;
    checklist: ChecklistItem[];
    links: VisitLink[];
  }) => void;
  onDelete?: () => void;
  onUnschedule?: () => void;
  onMoveToStay?: (targetStayId: string) => void;
  availableStays?: { id: string; name: string; color: string }[];
  currentStayId?: string;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<VisitType>(
    initial?.type && VISIT_TYPES.includes(initial.type) ? initial.type : 'landmark',
  );
  const [duration, setDuration] = useState(initial?.durationHint ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [searchResults, setSearchResults] = useState<PlaceSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [pickedCoords, setPickedCoords] = useState<{ lat: number; lng: number } | null>(
    initial?.lat != null ? { lat: initial.lat, lng: initial.lng! } : null,
  );
  const [showResults, setShowResults] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const isEditing = !!initial?.id;

  // Checklist
  const [checklist, setChecklist] = useState<ChecklistItem[]>(initial?.checklist ?? []);
  const [newChecklistText, setNewChecklistText] = useState('');
  const [checklistDupe, setChecklistDupe] = useState(false);
  const addChecklistItem = () => {
    const text = newChecklistText.trim();
    if (!text) return;
    if (checklist.some((c) => c.text.toLowerCase() === text.toLowerCase())) {
      setChecklistDupe(true);
      return;
    }
    setChecklistDupe(false);
    setChecklist((c) => [...c, { id: `cl-${Date.now()}`, text, done: false }]);
    setNewChecklistText('');
  };
  const toggleChecklistItem = (id: string) =>
    setChecklist((c) => c.map((item) => (item.id === id ? { ...item, done: !item.done } : item)));
  const removeChecklistItem = (id: string) =>
    setChecklist((c) => c.filter((item) => item.id !== id));

  // Links
  const [links, setLinks] = useState<VisitLink[]>(initial?.links ?? []);
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const addLink = () => {
    const url = newLinkUrl.trim();
    if (!url) return;
    const normalized = url.startsWith('http') ? url : `https://${url}`;
    setLinks((l) => [...l, { url: normalized, label: newLinkLabel.trim() || undefined }]);
    setNewLinkUrl('');
    setNewLinkLabel('');
  };

  // Debounced Nominatim search (only fires when user is actively typing a name without geocode yet)
  useEffect(() => {
    if (!name.trim() || name.trim().length < 3 || pickedCoords) {
      setSearchResults([]);
      setSearchError(false);
      return;
    }
    const controller = new AbortController();
    const tid = window.setTimeout(async () => {
      setIsSearching(true);
      setSearchError(false);
      try {
        const results = await searchPlace(name.trim(), { signal: controller.signal });
        setSearchResults(results.slice(0, 6));
        setShowResults(true);
      } catch {
        if (!controller.signal.aborted) setSearchError(true);
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 500);
    return () => {
      clearTimeout(tid);
      controller.abort();
    };
  }, [name, pickedCoords]);

  const pickResult = (r: PlaceSearchResult) => {
    const parts = r.display_name.split(',');
    setName(parts[0].trim());
    setPickedCoords({ lat: parseFloat(r.lat), lng: parseFloat(r.lon) });
    setSearchResults([]);
    setShowResults(false);
  };

  return (
    <ModalBase title={title} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) {
            onSave({
              name: name.trim(),
              type,
              durationHint: duration,
              notes,
              lat: pickedCoords?.lat,
              lng: pickedCoords?.lng,
              checklist,
              links,
            });
            onClose();
          }
        }}
      >
      <div className="space-y-4">
        {/* Place search */}
        <div className="relative">
          <label className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground mb-2 block">
            Place name
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-9 pr-9 text-xs font-semibold placeholder:font-normal"
              placeholder="e.g. Senso-ji Temple, Nishiki Market…"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setPickedCoords(null);
              }}
              onFocus={() => searchResults.length > 0 && setShowResults(true)}
              autoFocus
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            )}
            {pickedCoords && !isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-success">
                <Check className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
          {showResults && searchResults.length > 0 && (
            <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-border rounded-lg shadow-xl overflow-hidden">
              {searchResults.map((r) => {
                const parts = r.display_name.split(',');
                return (
                  <button
                    key={r.place_id}
                    onClick={() => pickResult(r)}
                    className="w-full text-left px-3 py-2.5 hover:bg-primary/5 border-b last:border-b-0 border-border flex items-start gap-2 transition-colors"
                  >
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {parts[0].trim()}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {parts.slice(1, 4).join(',').trim()}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {searchError && (
            <p className="text-[11px] text-destructive font-medium mt-1">
              Search failed — you can still save with a manual name.
            </p>
          )}
        </div>

        {/* Type grid */}
        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground mb-2 block">
            Category
          </label>
          <ToggleGroup
            type="single"
            value={type}
            onValueChange={(v) => {
              if (v) setType(v as VisitType);
            }}
            className="grid grid-cols-5 gap-1.5 w-full"
          >
            {VISIT_TYPES.map((t) => (
              <ToggleGroupItem
                key={t}
                value={t}
                className={`flex flex-col items-center gap-1.5 py-2.5 px-1 h-auto rounded-xl border text-[9px] font-bold transition-all ${
                  type === t
                    ? `${getVisitTypeColor(t)} border-current shadow-sm`
                    : 'border-border text-muted-foreground hover:border-border hover:text-foreground hover:bg-muted'
                }`}
              >
                {getVisitTypeIcon(t, 'w-3.5 h-3.5')}
                <span className="leading-none">{getVisitLabel(t)}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        {/* Duration */}
        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground mb-1.5 block">
            Duration
          </label>
          <Input
            className="text-xs"
            placeholder="e.g. 2h, 90m, half day"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
        </div>

        {/* Notes */}
        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground mb-1.5 block">
            Notes
          </label>
          <Textarea
            className="text-xs resize-none"
            rows={2}
            placeholder="Booking info, tips, opening hours…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Checklist (collapsible) */}
        <details open={checklist.length > 0 || undefined}>
          <summary className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground mb-1.5 cursor-pointer select-none flex items-center gap-1.5 hover:text-foreground transition-colors">
            <ChevronDown className="w-3 h-3 transition-transform [details:not([open])_&]:-rotate-90" />
            Checklist{' '}
            {checklist.length > 0 && (
              <span className="text-[9px] font-bold text-primary bg-primary/10 px-1.5 rounded-full">
                {checklist.length}
              </span>
            )}
          </summary>
          <div className="space-y-1 mt-1">
            {checklist.map((item) => (
              <div key={item.id} className="flex items-center gap-2 group px-2">
                <Checkbox
                  checked={item.done}
                  onCheckedChange={() => toggleChecklistItem(item.id)}
                  className="size-3.5"
                />
                <span
                  className={`flex-1 text-xs ${item.done ? 'line-through text-muted-foreground' : 'text-foreground'}`}
                >
                  {item.text}
                </span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => removeChecklistItem(item.id)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                  <X data-icon="inline-start" className="w-3 h-3" />
                </Button>
              </div>
            ))}
            <div className="flex items-center gap-1.5 mt-1">
              <Input
                className="flex-1 text-xs"
                placeholder="Add item…"
                value={newChecklistText}
                onChange={(e) => { setNewChecklistText(e.target.value); setChecklistDupe(false); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addChecklistItem();
                  }
                }}
              />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={addChecklistItem}
                disabled={!newChecklistText.trim()}
              >
                <Plus data-icon="inline-start" className="w-3.5 h-3.5" />
              </Button>
            </div>
            {checklistDupe && (
              <p className="text-[11px] text-warning font-medium px-1">Item already in the list.</p>
            )}
          </div>
        </details>

        {/* Links (collapsible) */}
        <details open={links.length > 0 || undefined}>
          <summary className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground mb-1.5 cursor-pointer select-none flex items-center gap-1.5 hover:text-foreground transition-colors">
            <ChevronDown className="w-3 h-3 transition-transform [details:not([open])_&]:-rotate-90" />
            Links{' '}
            {links.length > 0 && (
              <span className="text-[9px] font-bold text-primary bg-primary/10 px-1.5 rounded-full">
                {links.length}
              </span>
            )}
          </summary>
          <div className="space-y-1 mt-1">
            {links.map((link, i) => (
              <div key={i} className="flex items-center gap-2 group px-2">
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
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
                  size="icon-xs"
                  onClick={() => setLinks((l) => l.filter((_, idx) => idx !== i))}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                  <X data-icon="inline-start" className="w-3 h-3" />
                </Button>
              </div>
            ))}
            <div className="space-y-1.5 mt-1">
              <Input
                className="text-xs"
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
                  className="flex-1 text-xs"
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
                <Button variant="outline" size="sm" onClick={addLink} disabled={!newLinkUrl.trim()}>
                  Add
                </Button>
              </div>
            </div>
          </div>
        </details>

        {/* Move to another stay */}
        {onMoveToStay && availableStays && availableStays.length > 1 && (
          <div>
            <label className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground mb-1.5 block">
              Move to another stay
            </label>
            <div className="flex flex-wrap gap-1.5">
              {availableStays
                .filter((s) => s.id !== currentStayId)
                .map((s) => (
                  <Button
                    key={s.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onMoveToStay(s.id);
                      onClose();
                    }}
                    className="gap-1.5"
                  >
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: s.color }}
                    />
                    {s.name}
                  </Button>
                ))}
            </div>
          </div>
        )}

        {/* Delete / unschedule */}
        {(onDelete || onUnschedule) && (
          <div className="flex gap-2">
            {onUnschedule && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 border-info/30 text-info hover:bg-info/10"
                onClick={() => {
                  onUnschedule();
                  onClose();
                }}
              >
                <ArrowLeftRight data-icon="inline-start" className="w-3 h-3" /> Move to Unplanned
              </Button>
            )}
            {onDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="flex-1">
                    <Trash2 data-icon="inline-start" className="w-3 h-3" /> Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Delete &ldquo;{name || initial?.name}&rdquo;?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This place will be permanently removed. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        onDelete();
                        onClose();
                      }}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        )}

        {/* Save / cancel */}
        <div className="flex gap-2.5 pt-1">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={!name.trim()}>
            {isEditing ? 'Save changes' : 'Add place'}
          </Button>
        </div>
      </div>
      </form>
    </ModalBase>
  );
}

export default VisitFormModal;
