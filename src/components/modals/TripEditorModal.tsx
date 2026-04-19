import { useState } from 'react';
import { Calendar, Trash2, AlertTriangle } from 'lucide-react';
import ModalBase from '@/components/ui/ModalBase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import InlineDateRangePicker from '@/components/InlineDateRangePicker';
import { HybridTrip } from '@/domain/types';
import { fmt, addDaysTo } from '@/domain/dateUtils';
import { adjustStaysForDateChange } from '@/domain/tripMutations';
import { addDays, format as fnsFormat, parse as fnsParse } from 'date-fns';

function TripEditorModal({
  trip,
  onClose,
  onSave,
  onDelete,
}: {
  trip: HybridTrip;
  onClose: () => void;
  onSave: (updates: Partial<HybridTrip>) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(trip.name);
  const [startDate, setStartDate] = useState(trip.startDate);
  const [totalDays, setTotalDays] = useState(trip.totalDays);
  const [confirmShrink, setConfirmShrink] = useState(false);

  const endDateStr =
    startDate && totalDays > 0
      ? fnsFormat(
          addDays(fnsParse(startDate, 'yyyy-MM-dd', new Date()), totalDays - 1),
          'yyyy-MM-dd',
        )
      : '';

  const handleDateChange = (start: string, end: string) => {
    setStartDate(start);
    if (start && end) {
      const s = fnsParse(start, 'yyyy-MM-dd', new Date());
      const e = fnsParse(end, 'yyyy-MM-dd', new Date());
      const diff = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
      if (diff >= 1) setTotalDays(diff);
    }
  };

  // Detect stays affected by start-date shift and/or end-date shrink
  const oldStart = fnsParse(trip.startDate, 'yyyy-MM-dd', new Date());
  const newStart = startDate ? fnsParse(startDate, 'yyyy-MM-dd', new Date()) : oldStart;
  const startShiftDays = Math.round((newStart.getTime() - oldStart.getTime()) / 86400000);
  const slotShift = startShiftDays * 3; // positive = start moved later, stays shift left
  const newMaxSlot = totalDays * 3;

  // After applying the shift, compute which stays are affected
  const staysAfterShift = trip.stays.map((s) => ({
    ...s,
    _shiftedStart: s.startSlot - slotShift,
    _shiftedEnd: s.endSlot - slotShift,
  }));
  const affectedStays = staysAfterShift.filter(
    (s) => s._shiftedStart < 0 || s._shiftedEnd > newMaxSlot,
  );
  const fullyOutsideStays = affectedStays.filter(
    (s) => s._shiftedEnd <= 0 || s._shiftedStart >= newMaxSlot,
  );
  const partiallyCutStays = affectedStays.filter(
    (s) => !(s._shiftedEnd <= 0 || s._shiftedStart >= newMaxSlot),
  );

  // Pure date move: same totalDays, different startDate → just shift the calendar, keep stays
  const isPureDateMove = totalDays === trip.totalDays && slotShift !== 0;

  const doSave = (withClamp: boolean) => {
    if (isPureDateMove) {
      // Only update startDate — stays are trip-relative, no slot changes needed
      onSave({ name, startDate, totalDays });
    } else if (withClamp || slotShift !== 0) {
      const adjusted = adjustStaysForDateChange(
        trip.stays,
        trip.visits ?? [],
        slotShift,
        newMaxSlot,
      );
      onSave({ name, startDate, totalDays, stays: adjusted.stays, visits: adjusted.visits });
    } else {
      onSave({ name, startDate, totalDays });
    }
    onClose();
  };

  const handleSave = () => {
    if (!isPureDateMove && affectedStays.length > 0) {
      setConfirmShrink(true);
    } else {
      doSave(false);
    }
  };

  const footer = confirmShrink
    ? undefined
    : {
        destructive: onDelete ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 data-icon="inline-start" className="w-3 h-3" /> Delete trip
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete &ldquo;{trip.name}&rdquo;?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the trip and all its stays and places. This action
                  cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    onDelete();
                    onClose();
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete Trip
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : undefined,
        cancel: (
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
        ),
        primary: (
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!startDate || totalDays < 1}
          >
            Save changes
          </Button>
        ),
      };

  return (
    <ModalBase title="Edit Trip" onClose={onClose} footer={footer}>
      <div className="space-y-4">
        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground mb-2 block">
            Trip Name
          </label>
          <Input
            className="text-xs font-semibold"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>

        {/* Date range picker */}
        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground mb-2 block">
            Dates
          </label>
          <div className="border border-border rounded-xl p-3">
            <InlineDateRangePicker
              startDate={startDate}
              endDate={endDateStr}
              onChange={handleDateChange}
            />
          </div>
        </div>

        {startDate && totalDays > 0 && (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground bg-muted rounded-lg px-3 py-2">
            <Calendar className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            <span>
              {fmt(new Date(startDate), { month: 'short', day: 'numeric' })} —{' '}
              {fmt(addDaysTo(new Date(startDate), totalDays - 1), {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
              <span className="ml-1.5 text-muted-foreground">
                ({totalDays} day{totalDays !== 1 ? 's' : ''})
              </span>
            </span>
          </div>
        )}

        {confirmShrink && (
          <div
            className={`${fullyOutsideStays.length > 0 ? 'bg-destructive/10 border-destructive/30' : 'bg-warning/10 border-warning/30'} border rounded-lg p-3`}
          >
            <div className="flex items-start gap-2 mb-3">
              <AlertTriangle
                className={`w-4 h-4 flex-shrink-0 mt-0.5 ${fullyOutsideStays.length > 0 ? 'text-destructive' : 'text-warning'}`}
              />
              <div className="text-xs">
                {fullyOutsideStays.length > 0 && (
                  <p className="text-destructive mb-1">
                    <strong>{fullyOutsideStays.map((s) => s.name).join(', ')}</strong>{' '}
                    {fullyOutsideStays.length > 1 ? 'are' : 'is'} fully outside the new date range
                    and will be <strong>removed</strong>.
                  </p>
                )}
                {partiallyCutStays.length > 0 && (
                  <p className="text-warning mb-1">
                    <strong>{partiallyCutStays.map((s) => s.name).join(', ')}</strong> will be
                    shortened to fit. Activities outside the new range will be unplanned.
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setConfirmShrink(false)}
              >
                Adjust Dates
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className={`flex-1 text-white ${fullyOutsideStays.length > 0 ? 'bg-destructive hover:bg-destructive/90' : 'bg-warning hover:bg-warning/90'}`}
                onClick={() => doSave(true)}
              >
                {fullyOutsideStays.length > 0 ? 'Remove & Shorten' : 'Confirm & Shorten'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </ModalBase>
  );
}

export default TripEditorModal;
