import { useState, useEffect } from 'react';
import { Search, MapPin, Check } from 'lucide-react';
import ModalBase from '@/components/ui/ModalBase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { searchPlace, PlaceSearchResult } from '@/utils/geocoding';

function AddStayModal({ onClose, onSave, stayColor, initialDays }: {
  onClose: () => void;
  stayColor: string;
  initialDays?: number;
  onSave: (data: { name: string; days: number; lat?: number; lng?: number }) => void;
}) {
  const [name, setName] = useState('');
  const [days, setDays] = useState(initialDays ?? 3);
  const [searchResults, setSearchResults] = useState<PlaceSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [pickedCoords, setPickedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [searchError, setSearchError] = useState(false);

  useEffect(() => {
    if (!name.trim() || name.trim().length < 3 || pickedCoords) { setSearchResults([]); setSearchError(false); return; }
    const controller = new AbortController();
    const tid = window.setTimeout(async () => {
      setIsSearching(true); setSearchError(false);
      try {
        const results = await searchPlace(name.trim(), { signal: controller.signal });
        setSearchResults(results.slice(0, 6)); setShowResults(true);
      } catch {
        if (!controller.signal.aborted) setSearchError(true);
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 500);
    return () => { clearTimeout(tid); controller.abort(); };
  }, [name, pickedCoords]);

  const pickResult = (r: PlaceSearchResult) => {
    setName(r.display_name.split(',')[0].trim());
    setPickedCoords({ lat: parseFloat(r.lat), lng: parseFloat(r.lon) });
    setSearchResults([]); setShowResults(false);
  };

  const canSave = name.trim().length > 0;

  return (
    <ModalBase title="Add Destination" onClose={onClose}>
      <div className="space-y-5">

        {/* Destination search */}
        <div className="relative">
          <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 mb-2 block">
            City or destination
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <Input
              className="pl-9 pr-9 text-xs font-semibold placeholder:font-normal"
              placeholder="e.g. Tokyo, Kyoto, Paris…"
              value={name}
              onChange={(e) => { setName(e.target.value); setPickedCoords(null); }}
              onFocus={() => searchResults.length > 0 && setShowResults(true)}
              autoFocus
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            )}
            {pickedCoords && !isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500">
                <Check className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
          {showResults && searchResults.length > 0 && (
            <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
              {searchResults.map((r) => {
                const parts = r.display_name.split(',');
                return (
                  <button key={r.place_id} onClick={() => pickResult(r)}
                    className="w-full text-left px-3 py-2.5 hover:bg-primary/5 border-b last:border-b-0 border-slate-100 flex items-start gap-2 transition-colors"
                  >
                    <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">{parts[0].trim()}</p>
                      <p className="text-[11px] text-slate-500 truncate">{parts.slice(1, 4).join(',').trim()}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {searchError && (
            <p className="text-[11px] text-red-500 font-medium mt-1">Search failed — you can still save with a manual name.</p>
          )}
        </div>

        {/* Days stepper */}
        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 mb-2 block">
            Duration
          </label>
          <div className="flex items-center gap-3">
            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white">
              <button
                onClick={() => setDays((d) => Math.max(1, d - 1))}
                className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 text-xl font-light transition-colors"
              >
                −
              </button>
              <span className="w-10 text-center font-extrabold text-sm text-slate-800 tabular-nums">{days}</span>
              <button
                onClick={() => setDays((d) => Math.min(90, d + 1))}
                className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 text-xl font-light transition-colors"
              >
                +
              </button>
            </div>
            <span className="text-sm text-slate-500">{days === 1 ? 'day' : 'days'}</span>
          </div>
        </div>

        {/* Preview */}
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-100 bg-slate-50/60">
          <div className="w-2 h-8 rounded-full flex-shrink-0" style={{ background: stayColor }} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-extrabold text-slate-800 truncate">{name || 'New destination'}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">{days} {days === 1 ? 'day' : 'days'} on the timeline</p>
          </div>
          {pickedCoords && (
            <Badge variant="outline" className="text-[9px] font-bold text-emerald-600 bg-emerald-50 border-emerald-100 flex-shrink-0">
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
            onClick={() => canSave && onSave({ name: name.trim(), days, lat: pickedCoords?.lat, lng: pickedCoords?.lng })}
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
