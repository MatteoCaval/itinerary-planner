import * as React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChecklistSection } from '@/components/ui/ChecklistSection';
import { LinksSection } from '@/components/ui/LinksSection';
import type { LinkItem } from '@/components/ui/LinksSection';
import type { AccommodationGroup, Stay } from '@/domain/types';

interface StayPageProps {
  stay: Stay;
  visitCount: number;
  totalDays: number;
  totalNights: number;
  accommodationGroups: AccommodationGroup[];
  onBack: () => void;
  onUpdateStay: (updates: Partial<Stay>) => void;
}

export function StayPage({
  stay,
  visitCount,
  totalDays,
  totalNights,
  accommodationGroups,
  onBack,
  onUpdateStay,
}: StayPageProps) {
  const [notes, setNotes] = React.useState(stay.notes ?? '');

  // Map VisitLink[] → LinkItem[] for LinksSection (adds synthetic id, defaults label to url)
  const linkItems: LinkItem[] = (stay.links ?? []).map((l, i) => ({
    id: `link-${i}`,
    label: l.label ?? l.url,
    url: l.url,
  }));

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-background">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 border-b border-border bg-white">
        <Button size="icon-sm" variant="ghost" onClick={onBack} aria-label="Back">
          <ArrowLeft className="size-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground truncate">{stay.name}</div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto pb-safe">
        <div className="p-4 space-y-5">
          {/* Hero */}
          <div
            className="h-32 rounded-xl flex items-end p-3 relative overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${stay.color}55 0%, ${stay.color}aa 100%)`,
            }}
          >
            {/* Grain overlay */}
            <div
              aria-hidden="true"
              className="absolute inset-0 opacity-[0.18] mix-blend-overlay pointer-events-none"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
              }}
            />
            <div className="relative">
              <div className="flex items-center gap-2 mb-1">
                <span
                  aria-hidden="true"
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: stay.color }}
                />
                <span className="text-white text-lg font-serif italic drop-shadow">
                  {stay.name}
                </span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="font-num text-lg font-semibold text-primary">{totalDays}</div>
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">
                Days
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="font-num text-lg font-semibold text-primary">{totalNights}</div>
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">
                Nights
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="font-num text-lg font-semibold text-primary">{visitCount}</div>
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">
                Places
              </div>
            </div>
          </div>

          {/* Sleeping (read-only) */}
          {accommodationGroups.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">
                Sleeping
              </div>
              <div className="space-y-1.5">
                {accommodationGroups.map((g, i) => (
                  <div
                    key={`${g.name}-${i}`}
                    className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span>🛏</span>
                      <span className="text-sm font-medium truncate">{g.name}</span>
                    </div>
                    <span className="font-num text-xs text-muted-foreground flex-shrink-0">
                      {g.nights} night{g.nights !== 1 ? 's' : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label
              htmlFor="stay-notes"
              className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold block mb-1"
            >
              Notes
            </label>
            <textarea
              id="stay-notes"
              placeholder="Notes about this stay"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => {
                if (notes !== (stay.notes ?? '')) onUpdateStay({ notes });
              }}
              rows={3}
              className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:border-primary resize-none"
            />
          </div>

          {/* Checklist */}
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">
              To-do
            </div>
            <ChecklistSection
              items={stay.checklist ?? []}
              onChange={(items) =>
                onUpdateStay({ checklist: items.length > 0 ? items : undefined })
              }
            />
          </div>

          {/* Links */}
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">
              Links
            </div>
            <LinksSection
              items={linkItems}
              onChange={(items) =>
                onUpdateStay({
                  links:
                    items.length > 0
                      ? items.map((i) => ({ url: i.url, label: i.label }))
                      : undefined,
                })
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
