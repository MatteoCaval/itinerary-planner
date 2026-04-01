import { useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import ModalBase from '@/components/ui/ModalBase';
import TransportIcon from '@/components/ui/TransportIcon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Stay, TravelMode } from '@/domain/types';
import { TRAVEL_MODES } from '@/domain/constants';

function RouteEditorModal({
  stay,
  nextStay,
  onClose,
  onSave,
}: {
  stay: Stay;
  nextStay: Stay;
  onClose: () => void;
  onSave: (mode: TravelMode, duration: string, notes: string) => void;
}) {
  const [mode, setMode] = useState<TravelMode>(stay.travelModeToNext);
  const [duration, setDuration] = useState(stay.travelDurationToNext ?? '');
  const [notes, setNotes] = useState(stay.travelNotesToNext ?? '');

  const modeConfig: Record<TravelMode, { label: string; color: string }> = {
    train: { label: 'Train', color: '#0f7a72' },
    flight: { label: 'Flight', color: '#ab3b61' },
    drive: { label: 'Drive', color: '#3567d6' },
    ferry: { label: 'Ferry', color: '#3d8ec9' },
    bus: { label: 'Bus', color: '#a66318' },
    walk: { label: 'Walk', color: '#60713a' },
  };

  return (
    <ModalBase title="Edit Route" onClose={onClose}>
      <div className="space-y-5">
        {/* From → To */}
        <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-3 text-xs font-semibold text-slate-600">
          <span className="truncate">{stay.name}</span>
          <ArrowLeftRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <span className="truncate">{nextStay.name}</span>
        </div>

        {/* Transport mode picker */}
        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 mb-2 block">
            Transport Mode
          </label>
          <div className="grid grid-cols-3 gap-2">
            {TRAVEL_MODES.map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={`flex flex-col items-center gap-1.5 py-3 rounded-lg border-2 transition-all focus-visible:ring-2 focus-visible:ring-primary/50 ${
                  mode === m
                    ? 'border-current shadow-sm scale-[1.02]'
                    : 'border-slate-200 hover:border-slate-300 text-slate-500'
                }`}
                style={
                  mode === m ? { borderColor: modeConfig[m].color, color: modeConfig[m].color } : {}
                }
              >
                <TransportIcon mode={m} className="w-5 h-5" />
                <span className="text-[11px] font-bold uppercase tracking-tight">
                  {modeConfig[m].label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Duration */}
        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 mb-2 block">
            Duration
          </label>
          <Input
            className="text-xs"
            placeholder="e.g. 2h 30m"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
        </div>

        {/* Notes */}
        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 mb-2 block">
            Notes
          </label>
          <Textarea
            className="text-xs resize-none"
            rows={3}
            placeholder="Booking reference, platform, tips..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="flex gap-3 pt-1">
          <Button variant="outline" size="sm" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="flex-1"
            onClick={() => {
              onSave(mode, duration, notes);
              onClose();
            }}
          >
            Save Route
          </Button>
        </div>
      </div>
    </ModalBase>
  );
}

export default RouteEditorModal;
