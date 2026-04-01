import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Check, AlertCircle, Search } from 'lucide-react';
import { HybridTrip, LegacyStoredTrip, LegacyDay, LegacyLocation, LegacyRoute } from '@/domain/types';
import { normalizeTrip, legacyTripToHybrid } from '@/domain/migration';
import { loadItinerary } from '@/firebase';

function ImportFromCodeDialog({ onImport, onClose }: {
  onImport: (trip: HybridTrip) => void;
  onClose: () => void;
}) {
  const [code, setCode] = useState(() => localStorage.getItem('last-trip-passcode') ?? '');
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'loading'; message: string } | null>(null);

  const handleLoad = async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      setStatus({ type: 'error', message: 'Please enter a code.' });
      return;
    }

    setStatus({ type: 'loading', message: 'Loading...' });
    const result = await loadItinerary(trimmed);

    if (!result.success || !result.data) {
      setStatus({ type: 'error', message: result.error || 'No trip found with this code.' });
      return;
    }

    localStorage.setItem('last-trip-passcode', trimmed);
    const data = result.data as Record<string, unknown>;

    let trip: HybridTrip;
    try {
      if (data.stays && data.name) {
        // Already in HybridTrip format
        trip = data as unknown as HybridTrip;
      } else if (data.days && data.locations) {
        // Legacy format — convert
        const legacy: LegacyStoredTrip = {
          id: crypto.randomUUID(),
          name: `Imported (${trimmed})`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          startDate: (data.startDate as string) ?? '2025-01-01',
          endDate: (data.endDate as string) ?? '2025-01-01',
          days: (data.days as LegacyDay[]) ?? [],
          locations: (data.locations as LegacyLocation[]) ?? [],
          routes: (data.routes as LegacyRoute[]) ?? [],
          version: (data.version as string) ?? '1.0',
        };
        trip = legacyTripToHybrid(legacy);
      } else {
        setStatus({ type: 'error', message: 'Unrecognized trip format.' });
        return;
      }
    } catch (e) {
      console.error('[ImportFromCode] conversion failed:', e);
      setStatus({ type: 'error', message: 'Failed to convert trip data.' });
      return;
    }

    // Ensure unique ID
    trip = normalizeTrip({ ...trip, id: crypto.randomUUID() });
    setStatus({ type: 'success', message: `Loaded "${trip.name}"!` });
    setTimeout(() => {
      onImport(trip);
      onClose();
    }, 800);
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/30 z-[200] flex items-end sm:items-center justify-center p-4 sm:p-6" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="size-9 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Download className="w-4 h-4 text-violet-500" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-800 text-sm">Import from code</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Enter a share code to import a trip. It will be added as a new trip.
            </p>
          </div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleLoad(); }}>
          <input
            type="text"
            value={code}
            onChange={(e) => { setCode(e.target.value.toUpperCase()); setStatus(null); }}
            placeholder="e.g. TRIP-ABCD"
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-mono font-bold text-center tracking-widest placeholder:tracking-normal placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            autoFocus
          />

          {status && (
            <div className={`mt-3 flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
              status.type === 'success' ? 'bg-emerald-50 text-emerald-700' :
              status.type === 'error' ? 'bg-red-50 text-red-600' :
              'bg-blue-50 text-blue-600'
            }`}>
              {status.type === 'success' ? <Check className="w-3.5 h-3.5" /> :
               status.type === 'error' ? <AlertCircle className="w-3.5 h-3.5" /> :
               <Search className="w-3.5 h-3.5 animate-spin" />}
              {status.message}
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={status?.type === 'loading' || status?.type === 'success'}
              className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              Import
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

export default ImportFromCodeDialog;
