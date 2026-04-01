import { useState, useEffect } from 'react';
import { Hotel, Search, MapPin, Check, Trash2 } from 'lucide-react';
import ModalBase from '@/components/ui/ModalBase';
import { NightAccommodation } from '@/domain/types';
import { fmt } from '@/domain/dateUtils';
import { searchPlace, PlaceSearchResult } from '@/utils/geocoding';

function AccommodationEditorModal({ initial, allNights, initialNights, existingNames, onClose, onSave, onRemove }: {
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
      if (next.has(dayOffset)) next.delete(dayOffset); else next.add(dayOffset);
      return next;
    });
  };
  const [lat, setLat] = useState<number | undefined>(initial?.lat);
  const [lng, setLng] = useState<number | undefined>(initial?.lng);
  const [searchResults, setSearchResults] = useState<PlaceSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Filter existing names for autocomplete
  const filteredNames = name.trim()
    ? existingNames.filter((n) => n.toLowerCase().includes(name.toLowerCase()) && n !== name)
    : existingNames;

  // Debounced geocoding search
  useEffect(() => {
    if (!name.trim() || name.trim().length < 3 || lat) { setSearchResults([]); return; }
    const controller = new AbortController();
    const tid = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchPlace(name.trim(), { signal: controller.signal });
        setSearchResults(results.slice(0, 5));
        setShowResults(true);
      } catch { /* ignore abort */ }
      finally { if (!controller.signal.aborted) setIsSearching(false); }
    }, 500);
    return () => { clearTimeout(tid); controller.abort(); };
  }, [name, lat]);

  const pickResult = (r: PlaceSearchResult) => {
    setName(r.display_name.split(',')[0].trim());
    setLat(parseFloat(r.lat));
    setLng(parseFloat(r.lon));
    setSearchResults([]);
    setShowResults(false);
  };

  const nightCount = selectedNights.size;

  const handleSave = () => {
    if (!name.trim() || nightCount === 0) return;
    onSave({
      name: name.trim(),
      notes: notes.trim() || undefined,
      cost: cost ? parseFloat(cost) || undefined : undefined,
      lat, lng,
    }, Array.from(selectedNights));
    onClose();
  };

  return (
    <ModalBase title={initial?.name ? 'Edit Accommodation' : 'Set Accommodation'} onClose={onClose} width="max-w-sm">
      <div className="space-y-4">
        {/* Night count badge */}
        <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
          <Hotel className="w-4 h-4 text-primary" />
          <span className="text-[11px] font-bold text-primary">
            {nightCount} {nightCount === 1 ? 'night' : 'nights'}
          </span>
        </div>

        {/* Name input with autocomplete */}
        <div className="relative">
          <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 mb-1.5 block">
            Hotel / Address <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              className="w-full border border-slate-200 rounded-lg pl-9 pr-8 py-2 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none font-semibold"
              placeholder="Search hotel or address..."
              value={name}
              onChange={(e) => { setName(e.target.value); setLat(undefined); setLng(undefined); }}
              onFocus={() => { if (searchResults.length > 0) setShowResults(true); }}
              autoFocus
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            )}
            {lat && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500" title={`Location: ${lat.toFixed(4)}, ${lng?.toFixed(4)}`}>
                <Check className="w-3.5 h-3.5" />
              </div>
            )}
          </div>

          {/* Existing accommodation suggestions */}
          {filteredNames.length > 0 && !showResults && !lat && name.trim().length > 0 && (
            <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
              {filteredNames.slice(0, 4).map((n) => (
                <button
                  key={n}
                  onClick={() => { setName(n); }}
                  className="w-full text-left px-3 py-2 hover:bg-primary/5 border-b last:border-b-0 border-slate-100 flex items-center gap-2 transition-colors"
                >
                  <Hotel className="w-3 h-3 text-slate-400" />
                  <span className="text-xs font-semibold text-slate-700">{n}</span>
                </button>
              ))}
            </div>
          )}

          {/* Geocoding results */}
          {showResults && searchResults.length > 0 && (
            <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
              {searchResults.map((r) => {
                const parts = r.display_name.split(',');
                return (
                  <button
                    key={r.place_id}
                    onClick={() => pickResult(r)}
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
        </div>

        {/* Notes */}
        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 mb-1.5 block">Notes</label>
          <input
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            placeholder="Address, confirmation #, etc."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Cost */}
        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 mb-1.5 block">Nightly Cost</label>
          <input
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            placeholder="0.00"
            type="number"
            min="0"
            step="0.01"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
          />
        </div>

        {/* Night picker */}
        {allNights.length > 1 && (
          <div>
            <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 mb-1.5 block">
              Nights covered
            </label>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              {allNights.map(({ dayOffset, date }) => (
                <label
                  key={dayOffset}
                  className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-slate-50 cursor-pointer border-b last:border-b-0 border-slate-100"
                >
                  <input
                    type="checkbox"
                    checked={selectedNights.has(dayOffset)}
                    onChange={() => toggleNight(dayOffset)}
                    className="accent-primary w-3.5 h-3.5 flex-shrink-0"
                  />
                  <span className="text-xs font-semibold text-slate-700">
                    Night {dayOffset + 1}
                  </span>
                  <span className="text-[11px] text-slate-400 ml-auto flex-shrink-0">
                    {fmt(date, { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          {onRemove ? (
            <button
              onClick={() => { onRemove(); onClose(); }}
              className="text-xs font-bold text-red-500 hover:text-red-600 flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Remove
            </button>
          ) : <div />}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim() || nightCount === 0}
              className="px-4 py-2 text-xs font-bold text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </ModalBase>
  );
}

export default AccommodationEditorModal;
