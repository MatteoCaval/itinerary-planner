import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StayChipProps {
  name: string;
  color: string;
  dayOfStay: number;
  totalDays: number;
  onClick: () => void;
}

export function StayChip({ name, color, dayOfStay, totalDays, onClick }: StayChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-2 bg-primary/5 border-b border-border',
        'text-left hover:bg-primary/10 active:bg-primary/15 transition-colors',
      )}
      aria-label={`View ${name} stay details`}
    >
      <span
        aria-hidden="true"
        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
        style={{ background: color }}
      />
      <span className="font-semibold text-sm text-foreground truncate">{name}</span>
      <span className="font-num text-xs text-muted-foreground flex-shrink-0">
        · Day {dayOfStay} of {totalDays}
      </span>
      <span className="flex-1" />
      <span className="text-xs font-semibold text-primary flex-shrink-0">View stay</span>
      <ChevronRight className="size-4 text-primary flex-shrink-0" aria-hidden="true" />
    </button>
  );
}
