type DayFilterPillsProps = {
  options: { dayOffset: number; label: string }[];
  selectedDayOffset: number | null;
  onChange: (dayOffset: number | null) => void;
};

export default function DayFilterPills({ options, selectedDayOffset, onChange }: DayFilterPillsProps) {
  if (options.length < 2) return null;

  const pillClass = (active: boolean) =>
    `px-2.5 py-0.5 text-[10px] font-bold rounded-full transition-colors whitespace-nowrap cursor-pointer flex-shrink-0 ${
      active
        ? 'bg-primary text-white'
        : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'
    }`;

  return (
    <div className="flex gap-1.5 overflow-x-auto scroll-hide items-center">
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
  );
}
