import { DayPicker, type DateRange } from 'react-day-picker';
import { parse as fnsParse, format as fnsFormat } from 'date-fns';
import { fmt } from '@/domain/dateUtils';
import { Button } from '@/components/ui/button';

export default function InlineDateRangePicker({
  startDate,
  endDate,
  onChange,
}: {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
}) {
  const parseDate = (s: string) => (s ? fnsParse(s, 'yyyy-MM-dd', new Date()) : undefined);
  const formatDate = (d: Date) => fnsFormat(d, 'yyyy-MM-dd');

  const from = parseDate(startDate);
  const to = parseDate(endDate);
  const defaultMonth = from ?? new Date();

  const handleSelect = (range: DateRange | undefined) => {
    if (!range) {
      onChange('', '');
      return;
    }
    const newStart = range.from ? formatDate(range.from) : '';
    const newEnd = range.to ? formatDate(range.to) : '';
    onChange(newStart, newEnd);
  };

  return (
    <div className="rdp-inline">
      <DayPicker
        mode="range"
        selected={from ? { from, to } : undefined}
        onSelect={handleSelect}
        defaultMonth={defaultMonth}
        weekStartsOn={1}
        showOutsideDays
        fixedWeeks
      />
      {(startDate || endDate) && (
        <div className="flex items-center justify-between mt-1 pt-2 border-t border-slate-100">
          <span className="text-[11px] text-slate-500">
            {startDate && endDate
              ? `${fmt(new Date(startDate + 'T12:00:00'), { month: 'short', day: 'numeric' })} → ${fmt(new Date(endDate + 'T12:00:00'), { month: 'short', day: 'numeric' })}`
              : startDate
                ? `${fmt(new Date(startDate + 'T12:00:00'), { month: 'short', day: 'numeric' })} → pick end`
                : ''}
          </span>
          <Button
            variant="link"
            size="sm"
            type="button"
            onClick={() => onChange('', '')}
            className="text-red-400 hover:text-red-600 h-auto p-0 text-[11px] font-bold"
          >
            Clear
          </Button>
        </div>
      )}
    </div>
  );
}
