import { useState, useEffect } from 'react';
import { Search, MapPin, Check } from 'lucide-react';
import ModalBase from '@/components/ui/ModalBase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { searchPlace, PlaceSearchResult } from '@/utils/geocoding';
import { LocationPicker } from '@/components/ui/LocationPicker';

function AddStayModal({
  onClose,
  onSave,
  stayColor,
  initialDays,
  existingStayCoords,
}: {
  onClose: () => void;
  stayColor: string;
  initialDays?: number;
  onSave: (data: { name: string; days: number; lat?: number; lng?: number }) => void;
  existingStayCoords?: { lat: number; lng: number }[];
}) {
  const [name, setName] = useState('');
  const [days, setDays] = useState(initialDays ?? 3);
  const [searchResults, setSearchResults] = useState<PlaceSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [pickedCoords, setPickedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [searchStale, setSearchStale] = useState(false);

  const fitBounds: [number, number][] | undefined =
    existingStayCoords && existingStayCoords.length > 0
      ? existingStayCoords.map((c) => [c.lat, c.lng])
      : undefined;

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
      setSearchStale(false);
      const staleTimer = window.setTimeout(() => setSearchStale(true), 8000);
      try {
        const results = await searchPlace(name.trim(), { signal: controller.signal });
        setSearchResults(results.slice(0, 6));
        setShowResults(true);
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
  }, [name, pickedCoords]);

  const pickResult = (r: PlaceSearchResult) => {
    setName(r.display_name.split(',')[0].trim());
    setPickedCoords({ lat: parseFloat(r.lat), lng: parseFloat(r.lon) });
    setSearchResults([]);
    setShowResults(false);
  };

  const canSave = name.trim().length > 0;

  return (
    <ModalBase title="Add Destination" onClose={onClose}>
      <div className="space-y-5">
        {/* Destination search */}
        <div className="relative">
          <label className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground mb-2 block">
            City or destination <span className="text-destructive">*</span>
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-9 pr-9 text-xs font-semibold placeholder:font-normal"
              placeholder="e.g. Tokyo, Kyoto, Paris…"
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
              Search failed — try a different name, or just type your destination and save.
            </p>
          )}
          {isSearching && searchStale && (
            <p className="text-[11px] text-muted-foreground font-medium mt-1">
              Search is taking longer than expected…
            </p>
          )}
          <LocationPicker
            value={pickedCoords}
            onChange={(coords) => setPickedCoords(coords)}
            fitBounds={fitBounds}
          />
        </div>

        {/* Days stepper */}
        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground mb-2 block">
            Duration
          </label>
          <div className="flex items-center gap-3">
            <div className="flex items-center border border-border rounded-lg overflow-hidden bg-white">
              <button
                onClick={() => setDays((d) => Math.max(1, d - 1))}
                className="w-11 h-11 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted text-xl font-light transition-colors"
              >
                −
              </button>
              <span className="w-10 text-center font-extrabold text-sm text-foreground tabular-nums">
                {days}
              </span>
              <button
                onClick={() => setDays((d) => Math.min(90, d + 1))}
                className="w-11 h-11 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted text-xl font-light transition-colors"
              >
                +
              </button>
            </div>
            <span className="text-sm text-muted-foreground">{days === 1 ? 'day' : 'days'}</span>
          </div>
        </div>

        {/* Preview */}
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-muted/60">
          <div className="w-2 h-8 rounded-full flex-shrink-0" style={{ background: stayColor }} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-extrabold text-foreground truncate">
              {name || 'New destination'}
            </p>
            <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
              {days} {days === 1 ? 'day' : 'days'} on the timeline
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

        {/* Actions */}
        <div className="flex gap-2.5 pt-1">
          <Button variant="outline" size="sm" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="flex-1"
            onClick={() =>
              canSave &&
              onSave({ name: name.trim(), days, lat: pickedCoords?.lat, lng: pickedCoords?.lng })
            }
            disabled={!canSave}
          >
            Add to Timeline
          </Button>
        </div>
      </div>
    </ModalBase>
  );
}

export default AddStayModal;
