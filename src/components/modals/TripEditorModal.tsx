import { useState } from 'react';
import { Calendar, Trash2, AlertTriangle } from 'lucide-react';
import ModalBase from '@/components/ui/ModalBase';
import InlineDateRangePicker from '@/components/InlineDateRangePicker';
import { HybridTrip } from '@/domain/types';
import { fmt, addDaysTo } from '@/domain/dateUtils';
import { adjustStaysForDateChange } from '@/domain/tripMutations';
import { addDays, format as fnsFormat, parse as fnsParse } from 'date-fns';

function TripEditorModal({ trip, onClose, onSave, onDelete }: {
  trip: HybridTrip; onClose: () => void;
  onSave: (updates: Partial<HybridTrip>) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(trip.name);
  const [startDate, setStartDate] = useState(trip.startDate);
  const [totalDays, setTotalDays] = useState(trip.totalDays);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmShrink, setConfirmShrink] = useState(false);

  const endDateStr = startDate && totalDays > 0
    ? fnsFormat(addDays(fnsParse(startDate, 'yyyy-MM-dd', new Date()), totalDays - 1), 'yyyy-MM-dd')
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
      const adjustedStays = adjustStaysForDateChange(trip.stays, slotShift, newMaxSlot);
      onSave({ name, startDate, totalDays, stays: adjustedStays });
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

  const inputClass = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none';

  return (
    <ModalBase title="Edit Trip" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 mb-2 block">Trip Name</label>
          <input
            className={`${inputClass} font-semibold`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>

        {/* Date range picker */}
        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 mb-2 block">Dates</label>
          <div className="border border-slate-200 rounded-xl p-3">
            <InlineDateRangePicker
              startDate={startDate}
              endDate={endDateStr}
              onChange={handleDateChange}
            />
          </div>
        </div>

        {startDate && totalDays > 0 && (
          <div className="flex items-center gap-2 text-[11px] text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
            <Calendar className="w-3 h-3 text-slate-400 flex-shrink-0" />
            <span>
              {fmt(new Date(startDate), { month: 'short', day: 'numeric' })} — {fmt(addDaysTo(new Date(startDate), totalDays - 1), { month: 'short', day: 'numeric', year: 'numeric' })}
              <span className="ml-1.5 text-slate-400">({totalDays} day{totalDays !== 1 ? 's' : ''})</span>
            </span>
          </div>
        )}

        {confirmShrink ? (
          <div className={`${fullyOutsideStays.length > 0 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'} border rounded-lg p-3`}>
            <div className="flex items-start gap-2 mb-3">
              <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${fullyOutsideStays.length > 0 ? 'text-red-500' : 'text-amber-500'}`} />
              <div className="text-xs">
                {fullyOutsideStays.length > 0 && (
                  <p className="text-red-700 mb-1">
                    <strong>{fullyOutsideStays.map((s) => s.name).join(', ')}</strong> {fullyOutsideStays.length > 1 ? 'are' : 'is'} fully outside the new date range and will be <strong>removed</strong>.
                  </p>
                )}
                {partiallyCutStays.length > 0 && (
                  <p className="text-amber-700 mb-1">
                    <strong>{partiallyCutStays.map((s) => s.name).join(', ')}</strong> will be shortened to fit. Activities outside the new range will be unplanned.
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmShrink(false)} className="flex-1 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-white transition-colors">
                Go Back
              </button>
              <button onClick={() => doSave(true)} className={`flex-1 py-2 text-white rounded-lg text-xs font-bold transition-colors ${fullyOutsideStays.length > 0 ? 'bg-red-500 hover:bg-red-600' : 'bg-amber-500 hover:bg-amber-600'}`}>
                {fullyOutsideStays.length > 0 ? 'Remove & Shorten' : 'Confirm & Shorten'}
              </button>
            </div>
          </div>
        ) : confirmDelete && onDelete ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-red-700 mb-2">Delete &ldquo;{trip.name}&rdquo;? This cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-white transition-colors">
                Keep
              </button>
              <button onClick={() => { onDelete(); onClose(); }} className="flex-1 py-2 bg-red-500 text-white rounded-lg text-xs font-bold hover:bg-red-600 transition-colors">
                Delete Trip
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-3 pt-2">
            {onDelete && (
              <button onClick={() => setConfirmDelete(true)} className="py-2 px-3 border border-red-200 text-red-500 rounded-lg text-xs font-bold hover:bg-red-50 transition-colors flex items-center gap-1.5">
                <Trash2 className="w-3 h-3" /> Delete
              </button>
            )}
            <button onClick={onClose} className="flex-1 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!startDate || totalDays < 1}
              className="flex-1 py-2 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/90 transition-colors disabled:opacity-40"
            >
              Save
            </button>
          </div>
        )}
      </div>
    </ModalBase>
  );
}

export default TripEditorModal;
