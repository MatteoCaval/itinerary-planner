import { useState } from 'react';
import { Settings, X } from 'lucide-react';
import type { BasemapMode } from './useBasemapState';

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
        className="absolute top-3 right-3 z-[1000] size-8 flex items-center justify-center rounded-lg bg-white/90 backdrop-blur border border-slate-200 shadow-sm hover:bg-white hover:shadow-md transition-all text-slate-500 hover:text-slate-700"
        aria-label="Map options"
      >
        <Settings className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div className="absolute top-3 right-3 z-[1000] w-52 bg-white/95 backdrop-blur-xl rounded-xl border border-slate-200 shadow-xl p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">
          Map Options
        </span>
        <button
          onClick={() => setOpen(false)}
          className="size-5 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          aria-label="Close map options"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Basemap toggle */}
      <div>
        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block mb-1.5">
          Basemap
        </label>
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          <button
            onClick={() => onBasemapChange('local')}
            className={`flex-1 text-[10px] font-bold py-1.5 transition-colors ${
              basemap === 'local'
                ? 'bg-primary text-white'
                : 'bg-white text-slate-500 hover:bg-slate-50'
            }`}
          >
            Local
          </button>
          <button
            onClick={() => onBasemapChange('english')}
            className={`flex-1 text-[10px] font-bold py-1.5 transition-colors ${
              basemap === 'english'
                ? 'bg-primary text-white'
                : 'bg-white text-slate-500 hover:bg-slate-50'
            }`}
          >
            English
          </button>
        </div>
      </div>

      {/* Toggles */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer group">
          <input
            type="checkbox"
            checked={showArrows}
            onChange={(e) => onShowArrowsChange(e.target.checked)}
            className="size-3.5 rounded border-slate-300 text-primary accent-[var(--color-primary)]"
          />
          <span className="text-[11px] font-semibold text-slate-600 group-hover:text-slate-800 transition-colors">
            Route arrows
          </span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer group">
          <input
            type="checkbox"
            checked={showRouteIcons}
            onChange={(e) => onShowRouteIconsChange(e.target.checked)}
            className="size-3.5 rounded border-slate-300 text-primary accent-[var(--color-primary)]"
          />
          <span className="text-[11px] font-semibold text-slate-600 group-hover:text-slate-800 transition-colors">
            Route icons
          </span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer group">
          <input
            type="checkbox"
            checked={enableClustering}
            onChange={(e) => onEnableClusteringChange(e.target.checked)}
            className="size-3.5 rounded border-slate-300 text-primary accent-[var(--color-primary)]"
          />
          <span className="text-[11px] font-semibold text-slate-600 group-hover:text-slate-800 transition-colors">
            Marker clustering
          </span>
        </label>
      </div>

      {/* Minimal legend */}
      <div className="pt-2 border-t border-slate-100">
        <div className="flex items-center gap-1.5">
          <div className="size-2 rounded-full bg-slate-400" />
          <span className="text-[9px] font-semibold text-slate-400">Walking route</span>
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <div className="size-2 rounded-full" style={{ background: '#7c3aed' }} />
          <span className="text-[9px] font-semibold text-slate-400">Hotel route</span>
        </div>
      </div>
    </div>
  );
}
