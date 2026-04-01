import { Redo2 } from 'lucide-react';
import ModalBase from '@/components/ui/ModalBase';
import type { HistorySnapshot } from '@/hooks/useHistory';
import { formatRelativeTime } from '@/domain/dateUtils';
import { Badge } from '@/components/ui/badge';

function HistoryPanel({ history, index, onNavigate, onClose }: {
  history: HistorySnapshot[]; index: number; onNavigate: (i: number) => void; onClose: () => void;
}) {
  return (
    <ModalBase title="History" onClose={onClose}>
      <div className="space-y-0.5 max-h-96 overflow-y-auto -mx-1 px-1">
        {[...history].reverse().map((snap, ri) => {
          const i = history.length - 1 - ri;
          const isCurrent = i === index;
          const isFuture = i > index;
          const prev = i > 0 ? history[i - 1] : null;
          const staysDiff = prev ? snap.trip.stays.length - prev.trip.stays.length : null;
          const placesDiff = prev
            ? snap.trip.stays.reduce((s, st) => s + st.visits.length, 0) -
              prev.trip.stays.reduce((s, st) => s + st.visits.length, 0)
            : null;
          return (
            <button
              key={i}
              onClick={() => { onNavigate(i); onClose(); }}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition-all flex items-center justify-between gap-3 ${
                isCurrent
                  ? 'bg-primary/5 border border-primary/20'
                  : isFuture
                  ? 'opacity-40 hover:opacity-65 border border-dashed border-slate-200 hover:bg-slate-50'
                  : 'hover:bg-slate-50 border border-transparent'
              }`}
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <span className={`text-[11px] font-mono mt-0.5 shrink-0 ${isCurrent ? 'text-primary' : 'text-slate-300'}`}>
                  #{i}
                </span>
                <div className="min-w-0">
                  <p className={`text-xs font-semibold truncate ${isCurrent ? 'text-primary' : 'text-slate-700'}`}>
                    {snap.trip.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <p className="text-[11px] text-slate-400">
                      {snap.trip.stays.length} stays · {snap.trip.stays.reduce((s, st) => s + st.visits.length, 0)} places
                    </p>
                    {staysDiff !== null && staysDiff !== 0 && (
                      <Badge variant="secondary" className={`text-[9px] font-bold h-auto px-1.5 py-px ${staysDiff > 0 ? 'text-emerald-600 bg-emerald-50' : 'text-red-500 bg-red-50'}`}>
                        {staysDiff > 0 ? `+${staysDiff}` : staysDiff} stay{Math.abs(staysDiff) !== 1 ? 's' : ''}
                      </Badge>
                    )}
                    {placesDiff !== null && placesDiff !== 0 && (
                      <Badge variant="secondary" className={`text-[9px] font-bold h-auto px-1.5 py-px ${placesDiff > 0 ? 'text-emerald-600 bg-emerald-50' : 'text-red-500 bg-red-50'}`}>
                        {placesDiff > 0 ? `+${placesDiff}` : placesDiff} place{Math.abs(placesDiff) !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[9px] text-slate-300 tabular-nums">{formatRelativeTime(snap.timestamp)}</span>
                {isCurrent && (
                  <Badge variant="secondary" className="text-[9px] font-bold text-primary bg-primary/10 h-auto px-2 py-0.5">NOW</Badge>
                )}
                {isFuture && <Redo2 className="w-3 h-3 text-slate-300" />}
              </div>
            </button>
          );
        })}
      </div>
    </ModalBase>
  );
}

export default HistoryPanel;
