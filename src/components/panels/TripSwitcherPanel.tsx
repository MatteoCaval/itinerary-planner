import { Plus, Check } from 'lucide-react';
import ModalBase from '@/components/ui/ModalBase';
import type { TripStore } from '@/domain/types';
import { fmt } from '@/domain/dateUtils';
import { Button } from '@/components/ui/button';

function TripSwitcherPanel({
  store,
  onSwitch,
  onNew,
  onClose,
}: {
  store: TripStore;
  onSwitch: (id: string) => void;
  onNew: () => void;
  onClose: () => void;
}) {
  return (
    <ModalBase title="Switch Trip" onClose={onClose}>
      <div className="space-y-2 mb-4">
        {store.trips.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              onSwitch(t.id);
              onClose();
            }}
            className={`w-full text-left px-4 py-3 rounded-lg border transition-all flex items-center justify-between focus-visible:ring-2 focus-visible:ring-ring ${
              t.id === store.activeTripId
                ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/10'
                : 'border-border hover:border-border hover:bg-muted'
            }`}
          >
            <div>
              <p className="text-sm font-bold text-foreground">{t.name}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {fmt(new Date(t.startDate), { month: 'short', day: 'numeric', year: 'numeric' })} ·{' '}
                {t.totalDays} days · {t.stays.length} stays
              </p>
            </div>
            {t.id === store.activeTripId && (
              <Check className="w-4 h-4 text-primary flex-shrink-0" />
            )}
          </button>
        ))}
      </div>
      <Button
        variant="outline"
        onClick={() => {
          onNew();
          onClose();
        }}
        className="w-full py-2.5 border-2 border-dashed border-border text-sm font-bold text-muted-foreground hover:border-primary/50 hover:text-primary gap-2"
      >
        <Plus className="w-4 h-4" /> New Trip
      </Button>
    </ModalBase>
  );
}

export default TripSwitcherPanel;
