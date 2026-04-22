import * as React from 'react';
import { ArrowLeft, Navigation, MapPin, Trash2, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChecklistSection } from '@/components/ui/ChecklistSection';
import { LinksSection } from '@/components/ui/LinksSection';
import type { LinkItem } from '@/components/ui/LinksSection';
import { getVisitTypeBg, getVisitLabel, getVisitTypeIcon } from '@/domain/visitTypeDisplay';
import type { VisitItem } from '@/domain/types';
import { cn } from '@/lib/utils';

interface VisitPageProps {
  visit: VisitItem;
  stayName: string;
  dayLabel: string;
  onBack: () => void;
  onUpdateVisit: (updates: Partial<VisitItem>) => void;
  onDelete: () => void;
}

export function VisitPage({
  visit,
  stayName,
  dayLabel,
  onBack,
  onUpdateVisit,
  onDelete,
}: VisitPageProps) {
  const [name, setName] = React.useState(visit.name);
  const [notes, setNotes] = React.useState(visit.notes ?? '');

  const hasCoords = typeof visit.lat === 'number' && typeof visit.lng === 'number';
  const navigateHref = hasCoords
    ? `https://www.google.com/maps/dir/?api=1&destination=${visit.lat},${visit.lng}`
    : undefined;
  const mapsHref = hasCoords
    ? `https://www.google.com/maps/search/?api=1&query=${visit.lat},${visit.lng}`
    : undefined;

  // Map VisitLink[] → LinkItem[] for LinksSection (adds synthetic id, defaults label to url)
  const linkItems: LinkItem[] = (visit.links ?? []).map((l, i) => ({
    id: `link-${i}`,
    label: l.label ?? l.url,
    url: l.url,
  }));

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-background">
      {/* Hero */}
      <div className="flex-shrink-0 relative h-[180px] overflow-hidden">
        {/* Solid type color background */}
        <div
          aria-hidden="true"
          className={cn('absolute inset-0', getVisitTypeBg(visit.type))}
        />
        {/* Grain overlay */}
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.15] mix-blend-overlay pointer-events-none"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
          }}
        />
        {/* Dark-to-transparent overlay for text legibility */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent pointer-events-none"
        />

        {/* Top chrome: back + kebab */}
        <div
          className="absolute top-0 left-0 right-0 flex items-center justify-between px-2 pb-2"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.5rem)' }}
        >
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={onBack}
            aria-label="Back"
            className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white"
          >
            <ArrowLeft className="size-5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="More actions"
                className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white"
              >
                <MoreVertical className="size-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button className="flex items-center gap-2 w-full px-2 py-1.5 text-destructive hover:bg-destructive/10 rounded-sm text-sm">
                      <Trash2 className="size-4" /> Delete visit
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete "{visit.name}"?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This removes the place from your itinerary. You can undo from history.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={onDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Top-left: type badge */}
        <div className="absolute top-12 left-3">
          <span className="inline-flex items-center gap-1.5 bg-white/90 backdrop-blur-sm text-foreground px-2 py-1 rounded-md text-[10px] font-semibold uppercase tracking-widest shadow-sm">
            {(() => {
              const Icon = getVisitTypeIcon(visit.type);
              return <Icon className="size-3" aria-hidden="true" />;
            })()}
            {getVisitLabel(visit.type)}
          </span>
        </div>

        {/* Bottom: stay/day meta + visit name */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-3">
          <div className="text-[10px] uppercase tracking-widest text-white/80 font-semibold drop-shadow">
            {stayName} · {dayLabel}
          </div>
          <h1
            className="text-2xl font-bold tracking-tight leading-tight text-white mt-0.5"
            style={{ textShadow: '0 2px 6px rgba(0,0,0,0.35)' }}
          >
            {visit.name}
          </h1>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto pb-safe">
        <div className="p-4 space-y-4">
          {/* Coords (type + day now shown in hero) */}
          {hasCoords && (
            <div className="font-num text-[11px] text-muted-foreground">
              {visit.lat!.toFixed(4)}°N · {visit.lng!.toFixed(4)}°E
            </div>
          )}

          {/* CTAs */}
          {hasCoords && (
            <div className="flex gap-2">
              <a
                href={navigateHref}
                target="_blank"
                rel="noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-1.5 bg-primary text-primary-foreground rounded-md py-2 text-sm font-semibold"
              >
                <Navigation className="size-4" /> Navigate
              </a>
              <a
                href={mapsHref}
                target="_blank"
                rel="noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-1.5 bg-muted text-foreground border border-border rounded-md py-2 text-sm font-semibold"
              >
                <MapPin className="size-4" /> Open in Maps
              </a>
            </div>
          )}

          {/* Rename */}
          <div>
            <label
              htmlFor="visit-name"
              className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold block mb-1"
            >
              Name
            </label>
            <input
              id="visit-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                if (name.trim() && name !== visit.name) onUpdateVisit({ name });
              }}
              className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:border-primary"
            />
          </div>

          {/* Notes */}
          <div>
            <label
              htmlFor="visit-notes"
              className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold block mb-1"
            >
              Notes
            </label>
            <textarea
              id="visit-notes"
              placeholder="Notes about this place"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => {
                if (notes !== (visit.notes ?? '')) onUpdateVisit({ notes });
              }}
              rows={3}
              className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:border-primary resize-none"
            />
          </div>

          {/* Checklist — VisitItem.checklist is ChecklistItem[] matching the primitive's shape exactly */}
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">
              Checklist
            </div>
            <ChecklistSection
              items={visit.checklist ?? []}
              onChange={(items) =>
                onUpdateVisit({ checklist: items.length > 0 ? items : undefined })
              }
            />
          </div>

          {/* Links — map VisitLink[] ↔ LinkItem[] at the boundary; primitive itself is unchanged */}
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">
              Links
            </div>
            <LinksSection
              items={linkItems}
              onChange={(items) =>
                onUpdateVisit({
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
