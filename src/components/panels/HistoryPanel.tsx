import { Redo2 } from 'lucide-react';
import ModalBase from '@/components/ui/ModalBase';
import type { HistorySnapshot } from '@/hooks/useHistory';
import { formatRelativeTime } from '@/domain/dateUtils';
import { Badge } from '@/components/ui/badge';

function HistoryPanel({
  history,
  index,
  onNavigate,
  onClose,
}: {
  history: HistorySnapshot[];
  index: number;
  onNavigate: (i: number) => void;
  onClose: () => void;
}) {
  return (
    <ModalBase title="History" onClose={onClose}>
      <div className="space-y-0.5 max-h-[min(24rem,calc(100vh-12rem))] overflow-y-auto -mx-1 px-1">
        {[...history].reverse().map((snap, ri) => {
          const i = history.length - 1 - ri;
          const isCurrent = i === index;
          const isFuture = i > index;
          const prev = i > 0 ? history[i - 1] : null;
          const staysDiff = prev ? snap.trip.stays.length - prev.trip.stays.length : null;
          const placesDiff = prev
            ? snap.trip.visits.length -
              prev.trip.visits.length
            : null;
          return (
            <button
              key={i}
              onClick={() => {
                onNavigate(i);
                onClose();
              }}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition-all flex items-center justify-between gap-3 focus-visible:ring-2 focus-visible:ring-ring ${
                isCurrent
                  ? 'bg-primary/5 border border-primary/20'
                  : isFuture
                    ? 'opacity-40 hover:opacity-65 border border-dashed border-border hover:bg-muted'
                    : 'hover:bg-muted border border-transparent'
              }`}
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <span
                  className={`text-[11px] font-mono mt-0.5 shrink-0 ${isCurrent ? 'text-primary' : 'text-muted-foreground/40'}`}
                >
                  #{i}
                </span>
                <div className="min-w-0">
                  <p
                    className={`text-xs font-semibold truncate ${isCurrent ? 'text-primary' : 'text-foreground'}`}
                  >
                    {snap.trip.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <p className="text-[11px] text-muted-foreground">
                      {snap.trip.stays.length} stays ·{' '}
                      {snap.trip.visits.length} places
                    </p>
                    {staysDiff !== null && staysDiff !== 0 && (
                      <Badge
                        variant="secondary"
                        className={`text-[9px] font-bold h-auto px-1.5 py-px ${staysDiff > 0 ? 'text-success bg-success/10' : 'text-destructive bg-destructive/10'}`}
                      >
                        {staysDiff > 0 ? `+${staysDiff}` : staysDiff} stay
                        {Math.abs(staysDiff) !== 1 ? 's' : ''}
                      </Badge>
                    )}
                    {placesDiff !== null && placesDiff !== 0 && (
                      <Badge
                        variant="secondary"
                        className={`text-[9px] font-bold h-auto px-1.5 py-px ${placesDiff > 0 ? 'text-success bg-success/10' : 'text-destructive bg-destructive/10'}`}
                      >
                        {placesDiff > 0 ? `+${placesDiff}` : placesDiff} place
                        {Math.abs(placesDiff) !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[9px] text-muted-foreground/60 tabular-nums">
                  {formatRelativeTime(snap.timestamp)}
                </span>
                {isCurrent && (
                  <Badge
                    variant="secondary"
                    className="text-[9px] font-bold text-primary bg-primary/10 h-auto px-2 py-0.5"
                  >
                    NOW
                  </Badge>
                )}
                {isFuture && <Redo2 className="w-3 h-3 text-muted-foreground/40" />}
              </div>
            </button>
          );
        })}
      </div>
    </ModalBase>
  );
}

export default HistoryPanel;
