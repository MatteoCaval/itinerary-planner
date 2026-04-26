import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import ModalBase from '@/components/ui/ModalBase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { searchPlace, PlaceSearchResult } from '@/utils/geocoding';
import { PlaceSearchField, type PlaceResult } from '@/components/ui/PlaceSearchField';
import { LocationPicker } from '@/components/ui/LocationPicker';
import type { Stay } from '@/domain/types';

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

type AddStayMode = 'schedule' | 'candidate';

type SavePayload = {
  name: string;
  days: number;
  lat?: number;
  lng?: number;
};

type PromotePayload = SavePayload & { candidateId: string };

type CandidatePayload = { name: string; lat?: number; lng?: number };

function AddStayModal({
  onClose,
  onSave,
  onSavePromote,
  onSaveCandidate,
  stayColor,
  initialDays,
  existingStayCoords,
  candidates,
  initialCandidateId,
  mode = 'schedule',
}: {
  onClose: () => void;
  stayColor: string;
  initialDays?: number;
  onSave: (data: SavePayload) => void;
  onSavePromote?: (data: PromotePayload) => void;
  onSaveCandidate?: (data: CandidatePayload) => void;
  existingStayCoords?: { lat: number; lng: number }[];
  candidates?: Stay[];
  initialCandidateId?: string;
  mode?: AddStayMode;
}) {
  const initialCandidate = candidates?.find((c) => c.id === initialCandidateId) ?? null;

  const [name, setName] = useState(initialCandidate?.name ?? '');
  const [days, setDays] = useState(initialDays ?? 3);
  const [searchResults, setSearchResults] = useState<PlaceSearchResult[] | undefined>(undefined);
  const [isSearching, setIsSearching] = useState(false);
  const [pickedCoords, setPickedCoords] = useState<{ lat: number; lng: number } | null>(
    initialCandidate ? { lat: initialCandidate.centerLat, lng: initialCandidate.centerLng } : null,
  );
  const [searchError, setSearchError] = useState(false);
  const [searchStale, setSearchStale] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(
    initialCandidate?.id ?? null,
  );

  const fitBounds: [number, number][] | undefined =
    existingStayCoords && existingStayCoords.length > 0
      ? existingStayCoords.map((c) => [c.lat, c.lng])
      : undefined;

  useEffect(() => {
    if (selectedCandidateId) {
      setSearchResults(undefined);
      setSearchError(false);
      return;
    }
    if (!name.trim() || name.trim().length < 3 || pickedCoords) {
      setSearchResults(undefined);
      setSearchError(false);
      return;
    }
    const controller = new AbortController();
    const tid = window.setTimeout(async () => {
      setIsSearching(true);
      setSearchError(false);
      setSearchStale(false);
      const staleTimer = window.setTimeout(() => setSearchStale(true), 8000);
      try {
        const results = await searchPlace(name.trim(), { signal: controller.signal });
        setSearchResults(results.slice(0, 6));
      } catch {
        if (!controller.signal.aborted) setSearchError(true);
      } finally {
        clearTimeout(staleTimer);
        if (!controller.signal.aborted) {
          setIsSearching(false);
          setSearchStale(false);
        }
      }
    }, 500);
    return () => {
      clearTimeout(tid);
      controller.abort();
      setSearchStale(false);
    };
  }, [name, pickedCoords, selectedCandidateId]);

  const pickCandidate = (c: Stay) => {
    setName(c.name);
    setPickedCoords({ lat: c.centerLat, lng: c.centerLng });
    setSelectedCandidateId(c.id);
    setSearchResults(undefined);
  };

  const clearCandidate = () => {
    setName('');
    setPickedCoords(null);
    setSelectedCandidateId(null);
  };

  const canSave = name.trim().length > 0;
  const isCandidateMode = mode === 'candidate';
  const showChipRow = !isCandidateMode && candidates !== undefined && candidates.length > 0;

  const handleSave = () => {
    if (!canSave) return;
    if (isCandidateMode) {
      onSaveCandidate?.({ name: name.trim(), lat: pickedCoords?.lat, lng: pickedCoords?.lng });
      return;
    }
    if (selectedCandidateId && onSavePromote) {
      onSavePromote({
        candidateId: selectedCandidateId,
        name: name.trim(),
        days,
        lat: pickedCoords?.lat,
        lng: pickedCoords?.lng,
      });
      return;
    }
    onSave({ name: name.trim(), days, lat: pickedCoords?.lat, lng: pickedCoords?.lng });
  };

  const saveLabel = isCandidateMode ? 'Save to Unplanned' : 'Add to Timeline';
  const modalTitle = isCandidateMode ? 'Save Destination' : 'Add Destination';

  const footer = {
    cancel: (
      <Button variant="outline" size="sm" onClick={onClose}>
        Cancel
      </Button>
    ),
    primary: (
      <Button size="sm" onClick={handleSave} disabled={!canSave}>
        {saveLabel}
      </Button>
    ),
  };

  return (
    <ModalBase title={modalTitle} onClose={onClose} footer={footer}>
      <div className="space-y-5">
        {showChipRow && (
          <div>
            <label className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground mb-2 block">
              From unplanned
            </label>
            <div className="flex gap-2 overflow-x-auto pb-1 scroll-hide">
              {candidates.map((c) => {
                const active = c.id === selectedCandidateId;
                return (
                  <button
                    key={c.id}
                    onClick={() => (active ? clearCandidate() : pickCandidate(c))}
                    aria-pressed={active}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[11px] font-semibold whitespace-nowrap transition-colors ${
                      active
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-white text-foreground border-border hover:bg-muted'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: c.color }}
                      aria-hidden
                    />
                    {c.name}
                  </button>
                );
              })}
              {selectedCandidateId && (
                <button
                  onClick={clearCandidate}
                  aria-label="Clear unplanned selection"
                  className="flex items-center gap-1 px-2 py-1.5 rounded-full text-muted-foreground hover:text-foreground text-[11px] font-medium"
                >
                  <X className="w-3 h-3" aria-hidden /> Clear
                </button>
              )}
            </div>
          </div>
        )}

        {/* Destination search */}
        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground mb-2 block">
            City or destination <span className="text-destructive">*</span>
          </label>
          <PlaceSearchField
            id="add-stay-name"
            value={name}
            onValueChange={(v) => {
              setName(v);
              setPickedCoords(null);
              setSelectedCandidateId(null);
            }}
            onPick={(r) => {
              setName(r.label);
              setPickedCoords({ lat: r.lat, lng: r.lng });
              setSearchResults(undefined);
            }}
            results={searchResults?.map(toPlaceResult)}
            loading={isSearching}
            error={searchError ? 'Search failed. Check your connection.' : null}
            stale={searchStale}
            placeholder="Search a city or region"
            picked={!!pickedCoords}
          />
          <LocationPicker
            value={pickedCoords}
            onChange={(coords) => setPickedCoords(coords)}
            fitBounds={fitBounds}
          />
        </div>

        {!isCandidateMode && (
          <div>
            <label className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground mb-2 block">
              Duration
            </label>
            <div className="flex items-center gap-3">
              <div className="flex items-center border border-border rounded-lg overflow-hidden bg-white">
                <button
                  onClick={() => setDays((d) => Math.max(1, d - 1))}
                  aria-label="Decrease days"
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setDays((d) => Math.max(1, d - 1));
                    }
                  }}
                  className="w-11 h-11 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted text-xl font-light transition-colors"
                >
                  −
                </button>
                <span className="font-num w-10 text-center font-extrabold text-sm text-foreground">
                  {days}
                </span>
                <button
                  onClick={() => setDays((d) => Math.min(90, d + 1))}
                  aria-label="Increase days"
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setDays((d) => Math.min(90, d + 1));
                    }
                  }}
                  className="w-11 h-11 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted text-xl font-light transition-colors"
                >
                  +
                </button>
              </div>
              <span className="text-sm text-muted-foreground">{days === 1 ? 'day' : 'days'}</span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-muted/60">
          <div className="w-2 h-8 rounded-full flex-shrink-0" style={{ background: stayColor }} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-extrabold text-foreground truncate">
              {name || 'New destination'}
            </p>
            <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
              {isCandidateMode
                ? 'Saved to unplanned — no dates yet'
                : `${days} ${days === 1 ? 'day' : 'days'} on the timeline`}
            </p>
          </div>
          {pickedCoords && (
            <Badge
              variant="outline"
              className="text-[9px] font-bold text-success bg-success/10 border-emerald-100 flex-shrink-0"
            >
              Located
            </Badge>
          )}
        </div>
      </div>
    </ModalBase>
  );
}

export default AddStayModal;
