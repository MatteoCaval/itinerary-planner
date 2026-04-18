import * as React from 'react';
import { cn } from '@/lib/utils';

export function Kbd({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        'inline-flex items-center rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground tabular-nums',
        className,
      )}
      {...props}
    >
      {children}
    </kbd>
  );
}
