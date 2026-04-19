import * as React from 'react';
import { Search, Check, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { ErrorMessage } from './ErrorMessage';

export type PlaceResult = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  sublabel?: string;
};

interface PlaceSearchFieldProps {
  value: string;
  onValueChange: (v: string) => void;
  onPick: (result: PlaceResult) => void;
  results?: PlaceResult[];
  loading?: boolean;
  error?: string | null;
  stale?: boolean;
  placeholder?: string;
  picked?: boolean;
  id?: string;
  label?: string;
  className?: string;
}

export function PlaceSearchField({
  value,
  onValueChange,
  onPick,
  results,
  loading,
  error,
  stale,
  placeholder,
  picked,
  id,
  label,
  className,
}: PlaceSearchFieldProps) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const hasResults = !!results && results.length > 0;
  const open = hasResults && !picked;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label
          htmlFor={inputId}
          className="text-[11px] font-semibold tracking-wide uppercase text-muted-foreground"
        >
          {label}
        </label>
      )}
      <Popover open={open}>
        <PopoverAnchor asChild>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              id={inputId}
              value={value}
              onChange={(e) => onValueChange(e.target.value)}
              placeholder={placeholder ?? 'Search a place…'}
              className="pl-9 pr-9"
              aria-autocomplete="list"
              aria-expanded={open}
            />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground animate-spin" />
            )}
            {!loading && picked && (
              <Check className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-primary" />
            )}
          </div>
        </PopoverAnchor>
        <PopoverContent
          align="start"
          sideOffset={4}
          className="p-1 w-[var(--radix-popover-trigger-width)]"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <ul className="flex flex-col gap-0.5" role="listbox">
            {results?.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onPick(r)}
                  className="w-full text-left rounded-sm px-2 py-1.5 text-xs hover:bg-muted focus:bg-muted focus:outline-none"
                >
                  <div className="font-medium">{r.label}</div>
                  {r.sublabel && (
                    <div className="text-muted-foreground text-[11px]">{r.sublabel}</div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
      <span aria-live="polite" className="sr-only">
        {loading ? 'Searching' : stale ? 'Results may be stale' : ''}
      </span>
      {loading && <span className="text-[11px] text-muted-foreground">Searching…</span>}
      {stale && !loading && (
        <span className="text-[11px] text-muted-foreground">
          Showing previous results while typing…
        </span>
      )}
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </div>
  );
}
