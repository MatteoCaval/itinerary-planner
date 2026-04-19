import * as React from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tone = 'destructive' | 'warning' | 'info';

const toneStyles: Record<
  Tone,
  { container: string; text: string; defaultIcon: React.ReactNode }
> = {
  destructive: {
    container: 'border-destructive/30 bg-destructive/10',
    text: 'text-destructive',
    defaultIcon: <AlertCircle className="size-3.5 shrink-0" />,
  },
  warning: {
    container: 'border-warning/30 bg-warning/10',
    text: 'text-warning',
    defaultIcon: <AlertCircle className="size-3.5 shrink-0" />,
  },
  info: {
    container: 'border-info/30 bg-info/10',
    text: 'text-info',
    defaultIcon: <AlertCircle className="size-3.5 shrink-0" />,
  },
};

interface ErrorMessageProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: Tone;
  icon?: React.ReactNode;
}

export function ErrorMessage({
  tone = 'destructive',
  icon,
  className,
  children,
  ...props
}: ErrorMessageProps) {
  const styles = toneStyles[tone];
  const isDestructive = tone === 'destructive';
  return (
    <div
      role={isDestructive ? 'alert' : 'status'}
      aria-live={isDestructive ? 'assertive' : 'polite'}
      className={cn(
        'flex items-start gap-2 rounded-md border px-3 py-2 text-xs',
        styles.container,
        styles.text,
        className,
      )}
      {...props}
    >
      <span aria-hidden="true" className="mt-[1px]">
        {icon ?? styles.defaultIcon}
      </span>
      <div className="flex-1">{children}</div>
    </div>
  );
}
