import * as React from 'react';
import { Plus, Trash2, ExternalLink } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from './ErrorMessage';
import { cn } from '@/lib/utils';

export type LinkItem = { id: string; label: string; url: string };

interface LinksSectionProps {
  items: LinkItem[];
  onChange: (next: LinkItem[]) => void;
  className?: string;
}

function normalize(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProto);
    if (!url.hostname.includes('.')) return null;
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

export function LinksSection({ items, onChange, className }: LinksSectionProps) {
  const [label, setLabel] = React.useState('');
  const [url, setUrl] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const add = () => {
    const normalized = normalize(url);
    if (!normalized) {
      setError('Enter a valid URL (e.g. example.com or https://example.com).');
      return;
    }
    onChange([
      ...items,
      {
        id: crypto.randomUUID(),
        label: label.trim() || normalized,
        url: normalized,
      },
    ]);
    setLabel('');
    setUrl('');
    setError(null);
  };

  const remove = (id: string) => onChange(items.filter((i) => i.id !== id));

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2 text-sm">
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="flex-1 truncate text-primary hover:underline flex items-center gap-1"
            >
              <ExternalLink className="size-3 shrink-0" />
              <span className="truncate">{item.label}</span>
            </a>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => remove(item.id)}
              aria-label={`Remove link ${item.label}`}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <Input
          placeholder="Label (optional)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="max-w-[140px]"
        />
        <Input
          placeholder="URL"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" onClick={add} disabled={!url.trim()} size="sm">
          <Plus className="size-3.5" />
          Add
        </Button>
      </div>
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </div>
  );
}
