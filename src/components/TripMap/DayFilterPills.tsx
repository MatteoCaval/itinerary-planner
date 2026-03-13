type DayFilterPillsProps = {
  options: { dayOffset: number; label: string }[];
  selectedDayOffset: number | null;
  onChange: (dayOffset: number | null) => void;
};

export default function DayFilterPills({ options, selectedDayOffset, onChange }: DayFilterPillsProps) {
  if (options.length < 2) return null;

  const pillClass = (active: boolean) =>
    `px-3 py-1 text-[11px] font-bold rounded-full border transition-colors whitespace-nowrap cursor-pointer ${
      active
        ? 'bg-primary text-white border-primary'
        : 'bg-white/90 text-slate-600 border-slate-200 hover:border-slate-300'
    }`;

  return (
    <div className="absolute top-3 left-3 z-[1000] max-w-[60%] overflow-x-auto scroll-hide">
      <div className="flex gap-1.5">
        <button className={pillClass(selectedDayOffset === null)} onClick={() => onChange(null)}>
          All
        </button>
        {options.map((o) => (
          <button
            key={o.dayOffset}
            className={pillClass(selectedDayOffset === o.dayOffset)}
            onClick={() => onChange(o.dayOffset)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
