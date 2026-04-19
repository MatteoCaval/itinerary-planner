import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from './ErrorMessage';
import { cn } from '@/lib/utils';

export type ChecklistItem = { id: string; text: string; done: boolean };

interface ChecklistSectionProps {
  items: ChecklistItem[];
  onChange: (next: ChecklistItem[]) => void;
  className?: string;
}

export function ChecklistSection({ items, onChange, className }: ChecklistSectionProps) {
  const [draft, setDraft] = React.useState('');

  const trimmed = draft.trim();
  const isDuplicate =
    trimmed.length > 0 && items.some((i) => i.text.trim().toLowerCase() === trimmed.toLowerCase());

  const add = () => {
    if (!trimmed || isDuplicate) return;
    const next: ChecklistItem[] = [
      ...items,
      { id: crypto.randomUUID(), text: trimmed, done: false },
    ];
    onChange(next);
    setDraft('');
  };

  const toggle = (id: string) =>
    onChange(items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));

  const remove = (id: string) => onChange(items.filter((i) => i.id !== id));

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={item.done}
              onCheckedChange={() => toggle(item.id)}
              aria-label={`Toggle "${item.text}"`}
            />
            <span className={cn('flex-1', item.done && 'line-through text-muted-foreground')}>
              {item.text}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => remove(item.id)}
              aria-label={`Remove "${item.text}"`}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <Input
          placeholder="Add item"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          aria-describedby={isDuplicate ? 'checklist-dupe' : undefined}
        />
        <Button type="button" onClick={add} disabled={!trimmed || isDuplicate} size="sm">
          <Plus className="size-3.5" />
          Add
        </Button>
      </div>
      {isDuplicate && (
        <ErrorMessage tone="destructive" id="checklist-dupe">
          This item is already in the list.
        </ErrorMessage>
      )}
    </div>
  );
}
