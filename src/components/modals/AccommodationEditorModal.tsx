import { useState, useEffect, useMemo } from 'react';
import { Hotel, Trash2 } from 'lucide-react';
import ModalBase from '@/components/ui/ModalBase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NightAccommodation } from '@/domain/types';
import { fmt } from '@/domain/dateUtils';
import { searchPlace, PlaceSearchResult } from '@/utils/geocoding';
import { PlaceSearchField, type PlaceResult } from '@/components/ui/PlaceSearchField';
import { Checkbox } from '@/components/ui/checkbox';

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

function AccommodationEditorModal({
  initial,
  allNights,
  initialNights,
  existingNames,
  onClose,
  onSave,
  onRemove,
}: {
  initial?: NightAccommodation;
  allNights: { dayOffset: number; date: Date }[];
  initialNights: number[];
  existingNames: string[];
  onClose: () => void;
  onSave: (accom: NightAccommodation, selectedNights: number[]) => void;
  onRemove?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [cost, setCost] = useState(initial?.cost?.toString() ?? '');
  const [selectedNights, setSelectedNights] = useState<Set<number>>(() => new Set(initialNights));
  const toggleNight = (dayOffset: number) => {
    setSelectedNights((prev) => {
      const next = new Set(prev);
      if (next.has(dayOffset)) next.delete(dayOffset);
      else next.add(dayOffset);
      return next;
    });
  };
  const [lat, setLat] = useState<number | undefined>(initial?.lat);
  const [lng, setLng] = useState<number | undefined>(initial?.lng);
  const [searchResults, setSearchResults] = useState<PlaceSearchResult[] | undefined>(undefined);
  const [isSearching, setIsSearching] = useState(false);

  // Debounced geocoding search
  useEffect(() => {
    if (!name.trim() || name.trim().length < 3 || lat) {
      setSearchResults(undefined);
      return;
    }
    const controller = new AbortController();
    const tid = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchPlace(name.trim(), { signal: controller.signal });
        setSearchResults(results.slice(0, 5));
      } catch {
        /* ignore abort */
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 500);
    return () => {
      clearTimeout(tid);
      controller.abort();
    };
  }, [name, lat]);

  const mergedResults = useMemo<PlaceResult[]>(() => {
    // Local suggestions come first (no coords — picking sets name only)
    const filtered = name.trim()
      ? existingNames.filter((n) => n.toLowerCase().includes(name.toLowerCase()) && n !== name)
      : existingNames;
    const local: PlaceResult[] = (!lat && name.trim().length > 0 ? filtered.slice(0, 4) : []).map(
      (n) => ({ id: `local-${n}`, label: n, sublabel: 'Previously used', lat: 0, lng: 0 }),
    );
    const geo: PlaceResult[] = (searchResults ?? []).map(toPlaceResult);
    return [...local, ...geo];
  }, [existingNames, searchResults, lat, name]);

  const nightCount = selectedNights.size;

  const handleSave = () => {
    if (!name.trim() || nightCount === 0) return;
    onSave(
      {
        name: name.trim(),
        notes: notes.trim() || undefined,
        cost: cost ? parseFloat(cost) || undefined : undefined,
        lat,
        lng,
      },
      Array.from(selectedNights),
    );
    onClose();
  };

  const footer = {
    destructive: onRemove ? (
      <Button
        variant="destructive"
        size="sm"
        onClick={() => {
          onRemove();
          onClose();
        }}
      >
        <Trash2 data-icon="inline-start" className="w-3.5 h-3.5" /> Remove
      </Button>
    ) : undefined,
    cancel: (
      <Button variant="outline" size="sm" onClick={onClose}>
        Cancel
      </Button>
    ),
    primary: (
      <Button size="sm" onClick={handleSave} disabled={!name.trim() || nightCount === 0}>
        Save accommodation
      </Button>
    ),
  };

  return (
    <ModalBase
      title={initial?.name ? 'Edit Accommodation' : 'Set Accommodation'}
      onClose={onClose}
      width="max-w-sm"
      footer={footer}
    >
      <div className="space-y-4">
        {/* Night count badge */}
        <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
          <Hotel className="w-4 h-4 text-primary" />
          <span className="text-[11px] font-bold text-primary">
            <span className="font-num">{nightCount}</span> {nightCount === 1 ? 'night' : 'nights'}
          </span>
        </div>

        {/* Name input with autocomplete + geocoding */}
        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground mb-1.5 block">
            Hotel / Address <span className="text-destructive">*</span>
          </label>
          <PlaceSearchField
            id="accom-name"
            value={name}
            onValueChange={(v) => {
              setName(v);
              setLat(undefined);
              setLng(undefined);
            }}
            onPick={(r) => {
              setName(r.label);
              if (!r.id.startsWith('local-')) {
                setLat(r.lat);
                setLng(r.lng);
              }
              setSearchResults(undefined);
            }}
            results={mergedResults.length > 0 ? mergedResults : undefined}
            loading={isSearching}
            picked={!!lat}
            placeholder="Search hotel or address…"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground mb-1.5 block">
            Notes
          </label>
          <Input
            className="text-xs"
            placeholder="Address, confirmation #, etc."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Cost */}
        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground mb-1.5 block">
            Nightly Cost
          </label>
          <Input
            className="text-xs"
            placeholder="0.00"
            type="number"
            min="0"
            step="0.01"
            value={cost}
            onChange={(e) => {
              const val = e.target.value;
              if (val === '' || (/^\d*\.?\d{0,2}$/.test(val) && Number(val) >= 0)) {
                setCost(val);
              }
            }}
          />
        </div>

        {/* Night picker */}
        {allNights.length > 1 && (
          <div>
            <label className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground mb-1.5 block">
              Nights covered
            </label>
            <div className="border border-border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
              {allNights.map(({ dayOffset, date }) => (
                <label
                  key={dayOffset}
                  className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-muted cursor-pointer border-b last:border-b-0 border-border"
                >
                  <Checkbox
                    checked={selectedNights.has(dayOffset)}
                    onCheckedChange={() => toggleNight(dayOffset)}
                    className="size-3.5"
                  />
                  <span className="text-xs font-semibold text-foreground">
                    Night {dayOffset + 1}
                  </span>
                  <span className="text-[11px] text-muted-foreground ml-auto flex-shrink-0">
                    {fmt(date, { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

      </div>
    </ModalBase>
  );
}

export default AccommodationEditorModal;
