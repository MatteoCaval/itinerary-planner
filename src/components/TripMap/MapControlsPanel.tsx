import { useState } from 'react';
import { Map, Globe, Satellite, Sun, Settings, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import type { BasemapMode } from './useBasemapState';

const BASEMAP_OPTIONS: { value: BasemapMode; label: string; icon: typeof Map; desc: string }[] = [
  { value: 'voyager', label: 'Voyager', icon: Map, desc: 'Clean & colorful' },
  { value: 'osm', label: 'OSM', icon: Globe, desc: 'Classic detail' },
  { value: 'satellite', label: 'Satellite', icon: Satellite, desc: 'Aerial imagery' },
  { value: 'minimal', label: 'Minimal', icon: Sun, desc: 'Light & subtle' },
];

interface MapControlsPanelProps {
  basemap: BasemapMode;
  onBasemapChange: (mode: BasemapMode) => void;
  showArrows: boolean;
  onShowArrowsChange: (value: boolean) => void;
  showRouteIcons: boolean;
  onShowRouteIconsChange: (value: boolean) => void;
  enableClustering: boolean;
  onEnableClusteringChange: (value: boolean) => void;
}

export function MapControlsPanel({
  basemap,
  onBasemapChange,
  showArrows,
  onShowArrowsChange,
  showRouteIcons,
  onShowRouteIconsChange,
  enableClustering,
  onEnableClusteringChange,
}: MapControlsPanelProps) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="absolute top-3 right-3 z-[1000] size-10 flex items-center justify-center rounded-lg bg-background/90 backdrop-blur border border-border shadow-sm hover:bg-background hover:shadow-md transition-all text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50"
        aria-label="Map options"
      >
        <Settings className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div className="absolute top-3 right-3 z-[1000] w-56 max-md:w-[min(90vw,14rem)] bg-background/95 backdrop-blur-xl rounded-xl border border-border shadow-xl p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest">
          Map Options
        </span>
        <button
          onClick={() => setOpen(false)}
          className="size-5 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:ring-2 focus-visible:ring-primary/50"
          aria-label="Close map options"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Basemap picker — 2x2 grid */}
      <div>
        <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide block mb-1.5">
          Basemap
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {BASEMAP_OPTIONS.map(({ value, label, icon: Icon, desc }) => {
            const active = basemap === value;
            return (
              <button
                key={value}
                onClick={() => onBasemapChange(value)}
                className={`flex flex-col items-center gap-1 py-2 px-1.5 rounded-lg border text-center transition-all ${
                  active
                    ? 'bg-primary/10 border-primary/40 text-primary shadow-sm'
                    : 'bg-background border-border text-muted-foreground hover:border-border hover:bg-muted'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[10px] font-bold leading-none">{label}</span>
                <span
                  className={`text-[8px] leading-none ${active ? 'text-primary/60' : 'text-muted-foreground'}`}
                >
                  {desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Toggles */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer group">
          <Checkbox
            checked={showArrows}
            onCheckedChange={(v) => onShowArrowsChange(v === true)}
            className="size-3.5"
          />
          <span className="text-[11px] font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
            Route arrows
          </span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer group">
          <Checkbox
            checked={showRouteIcons}
            onCheckedChange={(v) => onShowRouteIconsChange(v === true)}
            className="size-3.5"
          />
          <span className="text-[11px] font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
            Route icons
          </span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer group">
          <Checkbox
            checked={enableClustering}
            onCheckedChange={(v) => onEnableClusteringChange(v === true)}
            className="size-3.5"
          />
          <span className="text-[11px] font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
            Marker clustering
          </span>
        </label>
      </div>

      {/* Minimal legend */}
      <div className="pt-2 border-t border-border">
        <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs">
          <dt aria-hidden="true">
            <span className="inline-block size-2 rounded-full bg-muted-foreground/40" />
          </dt>
          <dd className="text-[9px] font-semibold text-muted-foreground">Walking route</dd>
          <dt aria-hidden="true">
            <span className="inline-block size-2 rounded-full" style={{ background: '#7c3aed' }} />
          </dt>
          <dd className="text-[9px] font-semibold text-muted-foreground">Hotel route</dd>
        </dl>
      </div>
    </div>
  );
}
