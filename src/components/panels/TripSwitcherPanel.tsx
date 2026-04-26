import { useState } from 'react';
import { Plus, Check, MoreHorizontal, Trash2 } from 'lucide-react';
import ModalBase from '@/components/ui/ModalBase';
import type { TripStore } from '@/domain/types';
import { fmt } from '@/domain/dateUtils';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

function TripSwitcherPanel({
  store,
  onSwitch,
  onDeleteTrip,
  onNew,
  onClose,
  notifyReversible,
}: {
  store: TripStore;
  onSwitch: (id: string) => void;
  onDeleteTrip: (id: string) => void;
  onNew: () => void;
  onClose: () => void;
  notifyReversible: (label: string, revert: () => void, description?: string) => void;
}) {
  const [tripPendingDelete, setTripPendingDelete] = useState<TripStore['trips'][number] | null>(
    null,
  );

  return (
    <>
      <ModalBase title="Switch Trip" onClose={onClose}>
        <div className="space-y-2 mb-4">
          {store.trips.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              No trips yet. Create your first one below!
            </p>
          )}
          {store.trips.map((t) => (
            <div
              key={t.id}
              className={`w-full rounded-lg border transition-all flex items-stretch ${
                t.id === store.activeTripId
                  ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/10'
                  : 'border-border hover:border-border hover:bg-muted'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  const prev = store.activeTripId;
                  const tripName = t.name;
                  onSwitch(t.id);
                  onClose();
                  notifyReversible(`Switched to "${tripName}"`, () => onSwitch(prev));
                }}
                className="flex min-w-0 flex-1 items-center justify-between px-4 py-3 text-left focus-visible:ring-2 focus-visible:ring-ring rounded-l-lg"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{t.name}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {fmt(new Date(t.startDate), {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}{' '}
                    · {t.totalDays} days · {t.stays.length} stays
                  </p>
                </div>
              </button>
              <div className="flex items-center gap-1 pr-2">
                {t.id === store.activeTripId && (
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                )}
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-foreground"
                      aria-label={`Open actions for ${t.name}`}
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => setTripPendingDelete(t)}
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete trip
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
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

      <AlertDialog
        open={!!tripPendingDelete}
        onOpenChange={(open) => !open && setTripPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{tripPendingDelete?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {tripPendingDelete?.stays.length ?? 0}{' '}
              {(tripPendingDelete?.stays.length ?? 0) === 1 ? 'stay' : 'stays'} and{' '}
              {tripPendingDelete?.visits.length ?? 0}{' '}
              {(tripPendingDelete?.visits.length ?? 0) === 1 ? 'place' : 'places'}. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!tripPendingDelete) return;
                const deletingLastTrip = store.trips.length === 1;
                onDeleteTrip(tripPendingDelete.id);
                setTripPendingDelete(null);
                if (deletingLastTrip) {
                  onClose();
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Trip
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default TripSwitcherPanel;
