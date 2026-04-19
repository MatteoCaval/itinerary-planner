import { useState } from 'react';
import { Download, Check, Search } from 'lucide-react';
import {
  HybridTrip,
  LegacyStoredTrip,
  LegacyDay,
  LegacyLocation,
  LegacyRoute,
} from '@/domain/types';
import { normalizeTrip, legacyTripToHybrid } from '@/domain/migration';
import { loadItinerary } from '@/firebase';
import { isShareCodeNode } from '@/domain/shareCode';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import ModalBase from '@/components/ui/ModalBase';
import { ErrorMessage } from '@/components/ui/ErrorMessage';

function ImportFromCodeDialog({
  onImport,
  onClose,
}: {
  onImport: (trip: HybridTrip) => void;
  onClose: () => void;
}) {
  const [code, setCode] = useState(() => localStorage.getItem('last-trip-passcode') ?? '');
  const [status, setStatus] = useState<{
    type: 'success' | 'error' | 'loading';
    message: string;
  } | null>(null);

  const handleLoad = async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      setStatus({ type: 'error', message: 'Please enter a code.' });
      return;
    }

    setStatus({ type: 'loading', message: 'Looking up code…' });
    const result = await loadItinerary(trimmed);

    if (!result.success || !result.data) {
      setStatus({ type: 'error', message: result.error || 'No trip found with this code.' });
      return;
    }

    localStorage.setItem('last-trip-passcode', trimmed);
    const raw = result.data;
    // Unwrap ShareCodeNode if present (new format), otherwise treat as raw trip (legacy)
    const data = (isShareCodeNode(raw) ? raw.trip : raw) as Record<string, unknown>;

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

    // Ensure unique ID and store source metadata for pull-latest
    trip = normalizeTrip({
      ...trip,
      id: crypto.randomUUID(),
      sourceShareCode: trimmed,
      importedAt: Date.now(),
      shareCode: undefined, // don't inherit owner's share code
    });
    setStatus({ type: 'success', message: `Loaded "${trip.name}"!` });
    setTimeout(() => {
      onImport(trip);
      onClose();
    }, 800);
  };

  const isLoading = status?.type === 'loading';

  return (
    <ModalBase
      title="Import trip"
      description="Enter a share code to import a trip"
      onClose={onClose}
      width="max-w-sm"
      footer={{
        cancel: (
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        ),
        primary: (
          <Button
            type="submit"
            form="import-code-form"
            disabled={isLoading || status?.type === 'success'}
          >
            Import
          </Button>
        ),
      }}
    >
      <div className="flex items-start gap-3 mb-4">
        <div className="size-9 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Download className="w-4 h-4 text-violet-500" />
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed pt-1">
          Enter a share code to import a trip. It will be added as a new trip.
        </p>
      </div>

      <form
        id="import-code-form"
        onSubmit={(e) => {
          e.preventDefault();
          handleLoad();
        }}
      >
        <label htmlFor="import-share-code" className="sr-only">
          Share code
        </label>
        <Input
          id="import-share-code"
          type="text"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setStatus(null);
          }}
          placeholder="Enter share code (e.g. TRIP-ABC123)"
          className="w-full px-3 py-2.5 text-sm font-mono font-bold text-center tracking-widest placeholder:tracking-normal placeholder:font-normal"
          autoFocus
        />

        {status && (
          <div className="mt-3">
            {status.type === 'error' ? (
              <ErrorMessage>{status.message}</ErrorMessage>
            ) : status.type === 'loading' ? (
              <div
                role="status"
                aria-live="polite"
                className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-info/10 text-info"
              >
                <Search className="w-3.5 h-3.5 animate-spin" />
                {status.message}
              </div>
            ) : (
              <div
                role="status"
                aria-live="polite"
                className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-success/10 text-success"
              >
                <Check className="w-3.5 h-3.5" />
                {status.message}
              </div>
            )}
          </div>
        )}
      </form>
    </ModalBase>
  );
}

export default ImportFromCodeDialog;
