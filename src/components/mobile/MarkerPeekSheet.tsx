import { ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MarkerPeekSheetProps {
  open: boolean;
  name: string;
  subtitle?: string;
  onOpen: () => void;
  onDismiss: () => void;
  openLabel?: string;
  className?: string;
  /** Optional CSS color for the left accent stripe. */
  stripeColor?: string;
}

export function MarkerPeekSheet({
  open,
  name,
  subtitle,
  onOpen,
  onDismiss,
  openLabel = 'Open',
  className,
  stripeColor,
}: MarkerPeekSheetProps) {
  if (!open) return null;
  // TODO: animate exit. Currently the sheet unmounts instantly when `open` flips false.
  return (
    <div
      role="dialog"
      aria-label={`${name} preview`}
      className={cn(
        'absolute left-2 right-2 bottom-2 z-[1000]',
        'bg-white/85 backdrop-blur-md border border-border rounded-xl shadow-lg',
        'relative overflow-hidden',
        'p-3 pl-4 flex items-center gap-3 animate-slide-up',
        className,
      )}
    >
      {stripeColor && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-0 bottom-0 w-1"
          style={{ background: stripeColor }}
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-foreground truncate">{name}</div>
        {subtitle && <div className="text-xs text-muted-foreground truncate">{subtitle}</div>}
      </div>
      <Button size="sm" onClick={onOpen}>
        {openLabel}
        <ChevronRight className="size-3.5 ml-0.5" aria-hidden="true" />
      </Button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss preview"
        className="p-1 text-muted-foreground hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
