import { Compass } from 'lucide-react';

export function MobileAppBar() {
  return (
    <div
      className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 bg-white border-b border-border"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.625rem)' }}
    >
      <span
        aria-hidden="true"
        className="size-6 rounded-md bg-primary text-primary-foreground grid place-items-center shadow-sm"
      >
        <Compass className="size-3.5" />
      </span>
      <span className="text-sm font-bold tracking-tight text-foreground">CHRONOS</span>
    </div>
  );
}
