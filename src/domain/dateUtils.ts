/** Returns tomorrow's date as a YYYY-MM-DD string. */
export function getTomorrow() {
  const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0];
}

/** Adds n days to a Date, returning a new Date. */
export function addDaysTo(date: Date, n: number) {
  const d = new Date(date); d.setDate(d.getDate() + n); return d;
}

/** Parse a date string safely, falling back to today if empty/invalid. */
export function safeDate(s: string): Date {
  if (!s) return new Date();
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date() : d;
}

/** Format a date using Intl.DateTimeFormat with en-US locale. */
export function fmt(date: Date, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('en-US', opts).format(date);
}

/** Converts a timestamp to a human-readable relative string. */
export function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
