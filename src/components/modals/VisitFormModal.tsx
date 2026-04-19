import { useState, useEffect } from 'react';
import { Trash2, ArrowLeftRight } from 'lucide-react';
import ModalBase from '@/components/ui/ModalBase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
  AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { getVisitTypeIcon } from '@/components/ui/TransportIcon';
import { ChecklistItem, VisitItem, VisitLink, VisitType } from '@/domain/types';
import { VISIT_TYPES } from '@/domain/constants';
import { getVisitTypeColor, getVisitLabel } from '@/domain/visitTypeDisplay';
import { ChecklistSection } from '@/components/ui/ChecklistSection';
import { LinksSection, type LinkItem } from '@/components/ui/LinksSection';
import { PlaceSearchField, type PlaceResult } from '@/components/ui/PlaceSearchField';
import { LocationPicker } from '@/components/ui/LocationPicker';
import { searchPlace, PlaceSearchResult } from '@/utils/geocoding';

function toPlaceResult(r: PlaceSearchResult): PlaceResult {
  const parts = r.display_name.split(',');
  return {
    id: String(r.place_id),
    label: parts[0].trim(),
    lat: Number(r.lat),
    lng: Number(r.lon),
    sublabel: parts.slice(1, 4).join(',').trim() || undefined,
  };
}

const toLinkItems = (links: VisitLink[]): LinkItem[] =>
  links.map((l, i) => ({ id: `link-${i}-${l.url}`, url: l.url, label: l.label ?? l.url }));

const toVisitLinks = (items: LinkItem[]): VisitLink[] =>
  items.map((i) => ({ url: i.url, label: i.label !== i.url ? i.label : undefined }));

function DeleteDialog({ name, onDelete, onClose }: { name: string; onDelete: () => void; onClose: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 data-icon="inline-start" className="w-3 h-3" /> Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &ldquo;{name}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            Delete &ldquo;{name}&rdquo; from your itinerary? This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => { onDelete(); onClose(); }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function VisitFormModal({
  initial, title, onClose, onSave, onDelete, onUnschedule, onMoveToStay,
  availableStays, currentStayId, stayCenter,
}: {
  initial?: Partial<VisitItem>;
  title: string;
  onClose: () => void;
  onSave: (data: {
    name: string; type: VisitType; durationHint: string; notes: string;
    lat?: number; lng?: number; checklist: ChecklistItem[]; links: VisitLink[];
  }) => void;
  onDelete?: () => void;
  onUnschedule?: () => void;
  onMoveToStay?: (targetStayId: string) => void;
  availableStays?: { id: string; name: string; color: string }[];
  currentStayId?: string;
  stayCenter?: { lat: number; lng: number };
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<VisitType>(
    initial?.type && VISIT_TYPES.includes(initial.type) ? initial.type : 'landmark',
  );
  const [duration, setDuration] = useState(initial?.durationHint ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [searchResults, setSearchResults] = useState<PlaceResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [pickedCoords, setPickedCoords] = useState<{ lat: number; lng: number } | null>(
    initial?.lat != null ? { lat: initial.lat, lng: initial.lng! } : null,
  );
  const [searchError, setSearchError] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(initial?.checklist ?? []);
  const [links, setLinks] = useState<LinkItem[]>(toLinkItems(initial?.links ?? []));
  const isEditing = !!initial?.id;

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(), type, durationHint: duration, notes,
      lat: pickedCoords?.lat, lng: pickedCoords?.lng,
      checklist, links: toVisitLinks(links),
    });
    onClose();
  };

  const footer = {
    destructive: onDelete ? (
      <DeleteDialog name={name || initial?.name || ''} onDelete={onDelete} onClose={onClose} />
    ) : undefined,
    cancel: <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>,
    primary: (
      <Button size="sm" onClick={handleSave} disabled={!name.trim()}>
        {isEditing ? 'Save' : 'Add'}
      </Button>
    ),
  };

  // Debounced Nominatim search
  useEffect(() => {
    if (!name.trim() || name.trim().length < 3 || pickedCoords) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }
    const controller = new AbortController();
    const tid = window.setTimeout(async () => {
      setIsSearching(true);
      setSearchError(null);
      try {
        const raw = await searchPlace(name.trim(), { signal: controller.signal });
        setSearchResults(raw.slice(0, 6).map(toPlaceResult));
      } catch {
        if (!controller.signal.aborted)
          setSearchError('Search failed — you can still save with a manual name.');
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 500);
    return () => { clearTimeout(tid); controller.abort(); };
  }, [name, pickedCoords]);

  return (
    <ModalBase title={title} onClose={onClose} footer={footer}>
      <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
        <div className="space-y-4">
          {/* Place search */}
          <div>
            <PlaceSearchField
              id="visit-place-name"
              label="Place name"
              value={name}
              onValueChange={(v) => { setName(v); setPickedCoords(null); }}
              onPick={(r) => { setName(r.label); setPickedCoords({ lat: r.lat, lng: r.lng }); setSearchResults([]); }}
              results={searchResults}
              loading={isSearching}
              error={searchError}
              placeholder="e.g. Senso-ji Temple, Nishiki Market…"
              picked={!!pickedCoords}
            />
            <LocationPicker
              value={pickedCoords}
              onChange={(coords) => setPickedCoords(coords)}
              defaultCenter={stayCenter ? { lat: stayCenter.lat, lng: stayCenter.lng, zoom: 14 } : undefined}
            />
          </div>

          {/* Category */}
          <div>
            <label className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground mb-2 block">
              Category
            </label>
            <ToggleGroup
              type="single"
              value={type}
              onValueChange={(v) => { if (v) setType(v as VisitType); }}
              className="grid grid-cols-3 md:grid-cols-5 gap-1.5 w-full"
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
            <label htmlFor="visit-duration" className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground mb-1.5 block">
              Duration
            </label>
            <Input id="visit-duration" className="text-xs" placeholder="e.g. 2h, 90m, half day" value={duration} onChange={(e) => setDuration(e.target.value)} />
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="visit-notes" className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground mb-1.5 block">
              Notes
            </label>
            <Textarea id="visit-notes" className="text-xs resize-none" rows={2} placeholder="Booking info, tips, opening hours…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {/* Checklist */}
          <div>
            <label className="text-[11px] font-semibold tracking-wide uppercase text-muted-foreground">
              Checklist
            </label>
            <ChecklistSection items={checklist} onChange={setChecklist} className="mt-1.5" />
          </div>

          {/* Links */}
          <div>
            <label className="text-[11px] font-semibold tracking-wide uppercase text-muted-foreground">
              Links
            </label>
            <LinksSection items={links} onChange={setLinks} className="mt-1.5" />
          </div>

          {/* Move to another stay */}
          {onMoveToStay && availableStays && availableStays.length > 1 && (
            <div>
              <label className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground mb-1.5 block">
                Move to another stay
              </label>
              <div className="flex flex-wrap gap-1.5">
                {availableStays.filter((s) => s.id !== currentStayId).map((s) => (
                  <Button key={s.id} type="button" variant="outline" size="sm"
                    onClick={() => { onMoveToStay(s.id); onClose(); }} className="gap-1.5"
                  >
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                    {s.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Unschedule */}
          {onUnschedule && (
            <Button type="button" variant="outline" size="sm"
              className="w-full border-info/30 text-info hover:bg-info/10"
              onClick={() => { onUnschedule(); onClose(); }}
            >
              <ArrowLeftRight data-icon="inline-start" className="w-3 h-3" /> Move to Unplanned
            </Button>
          )}
        </div>
      </form>
    </ModalBase>
  );
}

export default VisitFormModal;
