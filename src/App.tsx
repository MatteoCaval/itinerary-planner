import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext, DragOverlay, useDraggable, useDroppable,
  type DragEndEvent, type DragStartEvent, PointerSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  AlertCircle, AlertTriangle, ArrowLeftRight, Bed, Bus, Calendar, Car, Check,
  ChevronDown, Compass, Database, Download, Footprints,
  GripVertical, History, Landmark, Lock, LogIn, LogOut, Mail, MapPin, Maximize2, Minimize2,
  Moon, Navigation, Palette, Pencil, Plane, Plus,
  PlusCircle, Redo2, Search, Ship, ShoppingBag, SlidersHorizontal, Sparkles, Sunrise,
  Sun, Train, Trash2, Undo2, Upload, User, X, Layers, Hotel, UtensilsCrossed,
  PanelRightOpen, PanelRightClose, Shrink, Expand, Eye, EyeOff, ExternalLink, Link2, CloudOff,
} from 'lucide-react';
import { DayPicker, type DateRange } from 'react-day-picker';
import { addDays, format as fnsFormat, parse as fnsParse } from 'date-fns';
import 'react-day-picker/style.css';
import type {
  AccommodationGroup, ChecklistItem, DayPart, DragState, HybridTrip,
  LegacyDay, LegacyLocation, LegacyRoute, LegacyStoredTrip, LegacyTripsStore,
  NightAccommodation, Stay, TravelMode, TripStore, VisitItem, VisitLink, VisitType,
} from './domain/types';
import {
  createEmptyTrip, DAY_PARTS, LEGACY_STORAGE_KEY, STAY_COLORS, TRANSPORT_LABELS,
  TRAVEL_MODES, VISIT_TYPES,
} from './domain/constants';
import { addDaysTo, fmt, formatRelativeTime, safeDate } from './domain/dateUtils';
import { haversineKm, jitter } from './domain/geoUtils';
import { deriveAccommodationGroups, deriveStayDays, getOverlapIds, getStayNightCount } from './domain/stayLogic';
import { createVisit, normalizeVisitOrders, sortVisits } from './domain/visitLogic';
import { getVisitTypeBg, getVisitTypeColor, getVisitLabel } from './domain/visitTypeDisplay';
import {
  hybridTripToLegacy, legacyTripToHybrid, normalizeTrip,
} from './domain/migration';
import { createSampleTrip } from './domain/sampleData';
import {
  adjustStaysForDateChange, applyTimelineDrag, extendTripAfter, extendTripBefore,
  shrinkTripAfter, shrinkTripBefore,
} from './domain/tripMutations';
import { searchPlace, type PlaceSearchResult } from './utils/geocoding';
import { generateHybridItinerary, type AIHybridStay } from './aiService';
import { generateMarkdown, downloadMarkdown } from './markdownExporter';
import TripMap from './components/TripMap';
import DayFilterPills from './components/TripMap/DayFilterPills';
import { AuthProvider, useAuth } from './context/AuthContext';
import { saveUserTripStore, loadUserTripStore, loadItinerary } from './firebase';
import { searchPhoto } from './unsplash';
import 'leaflet/dist/leaflet.css';

// ─── View switcher ────────────────────────────────────────────────────────────
const EMPTY_TRIP = createEmptyTrip();

// ─── Transport icon ───────────────────────────────────────────────────────────
function TransportIcon({ mode, className = 'w-3.5 h-3.5' }: { mode: TravelMode; className?: string }) {
  const icons: Record<TravelMode, React.ReactNode> = {
    train: <Train className={className} />,
    flight: <Plane className={className} />,
    drive: <Car className={className} />,
    ferry: <Ship className={className} />,
    bus: <Bus className={className} />,
    walk: <Footprints className={className} />,
  };
  return <>{icons[mode]}</>;
}

// ─── UI helpers (depend on React/JSX — stay in App.tsx) ───────────────────────

function getVisitTypeIcon(type: VisitType, cls = 'w-4 h-4') {
  switch (type) {
    case 'landmark': return <Landmark className={cls} />;
    case 'museum':   return <Palette className={cls} />;
    case 'food':     return <UtensilsCrossed className={cls} />;
    case 'walk':     return <Footprints className={cls} />;
    case 'shopping': return <ShoppingBag className={cls} />;
    default:         return <MapPin className={cls} />;
  }
}

// ─── Sample data ──────────────────────────────────────────────────────────────

// ─── Persistence ──────────────────────────────────────────────────────────────
function loadStore(): TripStore {
  // 1. Try legacy format (primary storage)
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (raw) {
      const legacyStore: LegacyTripsStore = JSON.parse(raw);
      if (legacyStore?.trips?.length) {
        return {
          activeTripId: legacyStore.activeTripId,
          trips: legacyStore.trips.map((t, i) => legacyTripToHybrid(t, i * 8)),
        };
      }
    }
  } catch { /* ignore */ }
  // 2. Fall back to previous hybrid key (users who already used new app)
  try {
    const raw = localStorage.getItem('itinerary-hybrid-trips-v2');
    if (raw) {
      const parsed: TripStore = JSON.parse(raw);
      return { ...parsed, trips: parsed.trips.map(normalizeTrip) };
    }
  } catch { /* ignore */ }
  // 3. Oldest single-trip key
  try {
    const old = localStorage.getItem('itinerary-hybrid-v3');
    if (old) {
      const trip = normalizeTrip(JSON.parse(old));
      return { trips: [trip], activeTripId: trip.id };
    }
  } catch { /* ignore */ }
  return { trips: [], activeTripId: '' };
}

function saveStore(store: TripStore) {
  const legacyStore: LegacyTripsStore = {
    activeTripId: store.activeTripId,
    trips: store.trips.map(hybridTripToLegacy),
  };
  localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(legacyStore));
}

// ─── History hook ─────────────────────────────────────────────────────────────
type HistorySnapshot = { trip: HybridTrip; timestamp: number };

function useHistory(initial: HybridTrip) {
  const stateRef = useRef({
    snapshots: [{ trip: initial, timestamp: Date.now() }] as HistorySnapshot[],
    idx: 0,
  });
  const [, forceRender] = useState(0);
  const rerender = useCallback(() => forceRender((n) => n + 1), []);

  const push = useCallback((next: HybridTrip) => {
    const s = stateRef.current;
    const sliced = [...s.snapshots.slice(0, s.idx + 1), { trip: next, timestamp: Date.now() }].slice(-50);
    stateRef.current = { snapshots: sliced, idx: Math.min(s.idx + 1, 49) };
    rerender();
  }, [rerender]);

  const undo = useCallback(() => {
    const s = stateRef.current;
    if (s.idx > 0) {
      stateRef.current = { ...s, idx: s.idx - 1 };
      rerender();
      return s.snapshots[s.idx - 1].trip;
    }
    return null;
  }, [rerender]);

  const redo = useCallback(() => {
    const s = stateRef.current;
    if (s.idx < s.snapshots.length - 1) {
      stateRef.current = { ...s, idx: s.idx + 1 };
      rerender();
      return s.snapshots[s.idx + 1].trip;
    }
    return null;
  }, [rerender]);

  const { idx, snapshots } = stateRef.current;
  return {
    push, undo, redo,
    canUndo: idx > 0, canRedo: idx < snapshots.length - 1,
    history: snapshots, historyIndex: idx,
  };
}

// ─── Modal base ───────────────────────────────────────────────────────────────
function ModalBase({ title, onClose, children, width = 'max-w-md' }: {
  title: string; onClose: () => void; children: React.ReactNode; width?: string;
}) {
  const backdropRef = React.useRef(false);
  const modalRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<Element | null>(null);

  useEffect(() => {
    // Remember the element that opened the modal so we can restore focus
    triggerRef.current = document.activeElement;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      // Focus trap: cycle Tab within the modal
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', handler);

    // Auto-focus first focusable element inside modal
    requestAnimationFrame(() => {
      const first = modalRef.current?.querySelector<HTMLElement>('input, button, textarea, select, [tabindex]');
      first?.focus();
    });

    return () => {
      window.removeEventListener('keydown', handler);
      // Restore focus to the element that triggered the modal
      if (triggerRef.current instanceof HTMLElement) triggerRef.current.focus();
    };
  }, [onClose]);
  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 z-[100] flex items-end sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => { if (e.target === e.currentTarget) backdropRef.current = true; }}
      onMouseUp={(e) => { if (e.target === e.currentTarget && backdropRef.current) onClose(); backdropRef.current = false; }}
    >
      <div ref={modalRef} className={`bg-white rounded-xl shadow-2xl w-full ${width} max-h-[90dvh] flex flex-col`}>
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 flex-shrink-0">
          <h3 className="font-extrabold text-slate-800 text-xs tracking-wide">{title}</h3>
          <button onClick={onClose} aria-label="Close dialog" className="text-slate-400 hover:text-slate-600 p-2.5 -mr-1 rounded-lg hover:bg-slate-100 transition-colors focus-visible:ring-2 focus-visible:ring-primary/50">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-4 py-3.5">{children}</div>
      </div>
    </div>,
    document.body
  );
}

// ─── Accommodation editor modal ──────────────────────────────────────────────
function AccommodationEditorModal({ initial, allNights, initialNights, existingNames, onClose, onSave, onRemove }: {
  initial?: NightAccommodation;
  allNights: { dayOffset: number; date: Date }[];
  initialNights: number[];
  existingNames: string[];
  onClose: () => void;
  onSave: (accom: NightAccommodation, selectedNights: number[]) => void;
  onRemove?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [cost, setCost] = useState(initial?.cost?.toString() ?? '');
  const [selectedNights, setSelectedNights] = useState<Set<number>>(() => new Set(initialNights));
  const toggleNight = (dayOffset: number) => {
    setSelectedNights((prev) => {
      const next = new Set(prev);
      if (next.has(dayOffset)) next.delete(dayOffset); else next.add(dayOffset);
      return next;
    });
  };
  const [lat, setLat] = useState<number | undefined>(initial?.lat);
  const [lng, setLng] = useState<number | undefined>(initial?.lng);
  const [searchResults, setSearchResults] = useState<PlaceSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Filter existing names for autocomplete
  const filteredNames = name.trim()
    ? existingNames.filter((n) => n.toLowerCase().includes(name.toLowerCase()) && n !== name)
    : existingNames;

  // Debounced geocoding search
  useEffect(() => {
    if (!name.trim() || name.trim().length < 3 || lat) { setSearchResults([]); return; }
    const controller = new AbortController();
    const tid = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchPlace(name.trim(), { signal: controller.signal });
        setSearchResults(results.slice(0, 5));
        setShowResults(true);
      } catch { /* ignore abort */ }
      finally { if (!controller.signal.aborted) setIsSearching(false); }
    }, 500);
    return () => { clearTimeout(tid); controller.abort(); };
  }, [name, lat]);

  const pickResult = (r: PlaceSearchResult) => {
    setName(r.display_name.split(',')[0].trim());
    setLat(parseFloat(r.lat));
    setLng(parseFloat(r.lon));
    setSearchResults([]);
    setShowResults(false);
  };

  const nightCount = selectedNights.size;

  const handleSave = () => {
    if (!name.trim() || nightCount === 0) return;
    onSave({
      name: name.trim(),
      notes: notes.trim() || undefined,
      cost: cost ? parseFloat(cost) || undefined : undefined,
      lat, lng,
    }, Array.from(selectedNights));
    onClose();
  };

  return (
    <ModalBase title={initial?.name ? 'Edit Accommodation' : 'Set Accommodation'} onClose={onClose} width="max-w-sm">
      <div className="space-y-4">
        {/* Night count badge */}
        <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
          <Hotel className="w-4 h-4 text-primary" />
          <span className="text-[11px] font-bold text-primary">
            {nightCount} {nightCount === 1 ? 'night' : 'nights'}
          </span>
        </div>

        {/* Name input with autocomplete */}
        <div className="relative">
          <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 mb-1.5 block">
            Hotel / Address <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              className="w-full border border-slate-200 rounded-lg pl-9 pr-8 py-2 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none font-semibold"
              placeholder="Search hotel or address..."
              value={name}
              onChange={(e) => { setName(e.target.value); setLat(undefined); setLng(undefined); }}
              onFocus={() => { if (searchResults.length > 0) setShowResults(true); }}
              autoFocus
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            )}
            {lat && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500" title={`Location: ${lat.toFixed(4)}, ${lng?.toFixed(4)}`}>
                <Check className="w-3.5 h-3.5" />
              </div>
            )}
          </div>

          {/* Existing accommodation suggestions */}
          {filteredNames.length > 0 && !showResults && !lat && name.trim().length > 0 && (
            <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
              {filteredNames.slice(0, 4).map((n) => (
                <button
                  key={n}
                  onClick={() => { setName(n); }}
                  className="w-full text-left px-3 py-2 hover:bg-primary/5 border-b last:border-b-0 border-slate-100 flex items-center gap-2 transition-colors"
                >
                  <Hotel className="w-3 h-3 text-slate-400" />
                  <span className="text-xs font-semibold text-slate-700">{n}</span>
                </button>
              ))}
            </div>
          )}

          {/* Geocoding results */}
          {showResults && searchResults.length > 0 && (
            <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
              {searchResults.map((r) => {
                const parts = r.display_name.split(',');
                return (
                  <button
                    key={r.place_id}
                    onClick={() => pickResult(r)}
                    className="w-full text-left px-3 py-2.5 hover:bg-primary/5 border-b last:border-b-0 border-slate-100 flex items-start gap-2 transition-colors"
                  >
                    <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">{parts[0].trim()}</p>
                      <p className="text-[11px] text-slate-500 truncate">{parts.slice(1, 4).join(',').trim()}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 mb-1.5 block">Notes</label>
          <input
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            placeholder="Address, confirmation #, etc."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Cost */}
        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 mb-1.5 block">Nightly Cost</label>
          <input
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            placeholder="0.00"
            type="number"
            min="0"
            step="0.01"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
          />
        </div>

        {/* Night picker */}
        {allNights.length > 1 && (
          <div>
            <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 mb-1.5 block">
              Nights covered
            </label>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              {allNights.map(({ dayOffset, date }) => (
                <label
                  key={dayOffset}
                  className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-slate-50 cursor-pointer border-b last:border-b-0 border-slate-100"
                >
                  <input
                    type="checkbox"
                    checked={selectedNights.has(dayOffset)}
                    onChange={() => toggleNight(dayOffset)}
                    className="accent-primary w-3.5 h-3.5 flex-shrink-0"
                  />
                  <span className="text-xs font-semibold text-slate-700">
                    Night {dayOffset + 1}
                  </span>
                  <span className="text-[11px] text-slate-400 ml-auto flex-shrink-0">
                    {fmt(date, { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          {onRemove ? (
            <button
              onClick={() => { onRemove(); onClose(); }}
              className="text-xs font-bold text-red-500 hover:text-red-600 flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Remove
            </button>
          ) : <div />}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim() || nightCount === 0}
              className="px-4 py-2 text-xs font-bold text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </ModalBase>
  );
}

// ─── Route editor modal ───────────────────────────────────────────────────────
function RouteEditorModal({ stay, nextStay, onClose, onSave }: {
  stay: Stay; nextStay: Stay; onClose: () => void;
  onSave: (mode: TravelMode, duration: string, notes: string) => void;
}) {
  const [mode, setMode] = useState<TravelMode>(stay.travelModeToNext);
  const [duration, setDuration] = useState(stay.travelDurationToNext ?? '');
  const [notes, setNotes] = useState(stay.travelNotesToNext ?? '');

  const modeConfig: Record<TravelMode, { label: string; color: string }> = {
    train:  { label: 'Train',  color: '#0f7a72' },
    flight: { label: 'Flight', color: '#ab3b61' },
    drive:  { label: 'Drive',  color: '#3567d6' },
    ferry:  { label: 'Ferry',  color: '#3d8ec9' },
    bus:    { label: 'Bus',    color: '#a66318' },
    walk:   { label: 'Walk',   color: '#60713a' },
  };

  return (
    <ModalBase title="Edit Route" onClose={onClose}>
      <div className="space-y-5">
        {/* From → To */}
        <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-3 text-xs font-semibold text-slate-600">
          <span className="truncate">{stay.name}</span>
          <ArrowLeftRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <span className="truncate">{nextStay.name}</span>
        </div>

        {/* Transport mode picker */}
        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 mb-2 block">Transport Mode</label>
          <div className="grid grid-cols-3 gap-2">
            {TRAVEL_MODES.map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={`flex flex-col items-center gap-1.5 py-3 rounded-lg border-2 transition-all focus-visible:ring-2 focus-visible:ring-primary/50 ${
                  mode === m
                    ? 'border-current shadow-sm scale-[1.02]'
                    : 'border-slate-200 hover:border-slate-300 text-slate-500'
                }`}
                style={mode === m ? { borderColor: modeConfig[m].color, color: modeConfig[m].color } : {}}
              >
                <TransportIcon mode={m} className="w-5 h-5" />
                <span className="text-[11px] font-bold uppercase tracking-tight">{modeConfig[m].label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Duration */}
        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 mb-2 block">Duration</label>
          <input
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            placeholder="e.g. 2h 30m"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
        </div>

        {/* Notes */}
        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 mb-2 block">Notes</label>
          <textarea
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none resize-none"
            rows={3}
            placeholder="Booking reference, platform, tips..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => { onSave(mode, duration, notes); onClose(); }}
            className="flex-1 py-2 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/90 transition-colors"
          >
            Save Route
          </button>
        </div>
      </div>
    </ModalBase>
  );
}

// ─── Stay editor modal ────────────────────────────────────────────────────────
function StayEditorModal({ stay, onClose, onSave, onDelete }: {
  stay: Stay; onClose: () => void;
  onSave: (updates: Partial<Stay>) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(stay.name);
  const [lodging, setLodging] = useState(stay.lodging);
  const [color, setColor] = useState(stay.color);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <ModalBase title="Edit Stay" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 mb-2 block">Destination Name</label>
          <input
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none font-semibold"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 mb-2 block">Lodging</label>
          <input
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            value={lodging}
            onChange={(e) => setLodging(e.target.value)}
            placeholder="Hotel name or area"
          />
        </div>
        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 mb-2 block">Color</label>
          <div className="flex gap-2 flex-wrap">
            {STAY_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                aria-label={`Color ${c}`}
                aria-pressed={color === c}
                className={`size-9 rounded-full border-2 transition-all focus-visible:ring-2 focus-visible:ring-primary/50 ${color === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'border-white hover:scale-110'}`}
                style={{ background: c }}
              />
            ))}
            <div className="flex flex-col items-center gap-0.5">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="size-9 rounded-full border-2 border-slate-200 cursor-pointer"
                aria-label="Pick custom color"
                title="Custom color"
              />
            </div>
          </div>
        </div>
        {confirmDelete ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-red-700 mb-2">
              Delete "{stay.name}"? This removes all {stay.visits.length} scheduled {stay.visits.length === 1 ? 'place' : 'places'}.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-white transition-colors">
                Keep
              </button>
              <button onClick={() => { onDelete(); onClose(); }} className="flex-1 py-2 bg-red-500 text-white rounded-lg text-xs font-bold hover:bg-red-600 transition-colors">
                Delete Stay
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-3 pt-2">
            <button onClick={() => setConfirmDelete(true)} className="py-2 px-3 border border-red-200 text-red-500 rounded-lg text-xs font-bold hover:bg-red-50 transition-colors flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-red-300">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
            <button onClick={onClose} className="flex-1 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors focus-visible:ring-2 focus-visible:ring-primary/50">
              Cancel
            </button>
            <button
              onClick={() => { onSave({ name, lodging, color }); onClose(); }}
              className="flex-1 py-2 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/90 transition-colors focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              Save
            </button>
          </div>
        )}
      </div>
    </ModalBase>
  );
}

// ─── Add stay modal ───────────────────────────────────────────────────────────
function AddStayModal({ onClose, onSave, stayColor, initialDays }: {
  onClose: () => void;
  stayColor: string;
  initialDays?: number;
  onSave: (data: { name: string; days: number; lat?: number; lng?: number }) => void;
}) {
  const [name, setName] = useState('');
  const [days, setDays] = useState(initialDays ?? 3);
  const [searchResults, setSearchResults] = useState<PlaceSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [pickedCoords, setPickedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [searchError, setSearchError] = useState(false);

  useEffect(() => {
    if (!name.trim() || name.trim().length < 3 || pickedCoords) { setSearchResults([]); setSearchError(false); return; }
    const controller = new AbortController();
    const tid = window.setTimeout(async () => {
      setIsSearching(true); setSearchError(false);
      try {
        const results = await searchPlace(name.trim(), { signal: controller.signal });
        setSearchResults(results.slice(0, 6)); setShowResults(true);
      } catch (err) {
        if (!controller.signal.aborted) setSearchError(true);
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 500);
    return () => { clearTimeout(tid); controller.abort(); };
  }, [name, pickedCoords]);

  const pickResult = (r: PlaceSearchResult) => {
    setName(r.display_name.split(',')[0].trim());
    setPickedCoords({ lat: parseFloat(r.lat), lng: parseFloat(r.lon) });
    setSearchResults([]); setShowResults(false);
  };

  const canSave = name.trim().length > 0;

  return (
    <ModalBase title="Add Destination" onClose={onClose}>
      <div className="space-y-5">

        {/* Destination search */}
        <div className="relative">
          <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 mb-2 block">
            City or destination
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              className="w-full border border-slate-200 rounded-lg pl-9 pr-9 py-2 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none font-semibold placeholder:font-normal"
              placeholder="e.g. Tokyo, Kyoto, Paris…"
              value={name}
              onChange={(e) => { setName(e.target.value); setPickedCoords(null); }}
              onFocus={() => searchResults.length > 0 && setShowResults(true)}
              autoFocus
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            )}
            {pickedCoords && !isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500">
                <Check className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
          {showResults && searchResults.length > 0 && (
            <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
              {searchResults.map((r) => {
                const parts = r.display_name.split(',');
                return (
                  <button key={r.place_id} onClick={() => pickResult(r)}
                    className="w-full text-left px-3 py-2.5 hover:bg-primary/5 border-b last:border-b-0 border-slate-100 flex items-start gap-2 transition-colors"
                  >
                    <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">{parts[0].trim()}</p>
                      <p className="text-[11px] text-slate-500 truncate">{parts.slice(1, 4).join(',').trim()}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {searchError && (
            <p className="text-[11px] text-red-500 font-medium mt-1">Search failed — you can still save with a manual name.</p>
          )}
        </div>

        {/* Days stepper */}
        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 mb-2 block">
            Duration
          </label>
          <div className="flex items-center gap-3">
            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white">
              <button
                onClick={() => setDays((d) => Math.max(1, d - 1))}
                className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 text-xl font-light transition-colors"
              >
                −
              </button>
              <span className="w-10 text-center font-extrabold text-sm text-slate-800 tabular-nums">{days}</span>
              <button
                onClick={() => setDays((d) => Math.min(90, d + 1))}
                className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 text-xl font-light transition-colors"
              >
                +
              </button>
            </div>
            <span className="text-sm text-slate-500">{days === 1 ? 'day' : 'days'}</span>
          </div>
        </div>

        {/* Preview */}
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-100 bg-slate-50/60">
          <div className="w-2 h-8 rounded-full flex-shrink-0" style={{ background: stayColor }} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-extrabold text-slate-800 truncate">{name || 'New destination'}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">{days} {days === 1 ? 'day' : 'days'} on the timeline</p>
          </div>
          {pickedCoords && (
            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full flex-shrink-0">
              Located
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2.5 pt-1">
          <button onClick={onClose}
            className="flex-1 py-2 text-xs font-bold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => canSave && onSave({ name: name.trim(), days, lat: pickedCoords?.lat, lng: pickedCoords?.lng })}
            disabled={!canSave}
            className="flex-1 py-2 text-xs font-bold text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-40"
          >
            Add to Timeline
          </button>
        </div>
      </div>
    </ModalBase>
  );
}

// ─── Visit editor modal ───────────────────────────────────────────────────────
function VisitFormModal({ initial, title, onClose, onSave, onDelete, onUnschedule }: {
  initial?: Partial<VisitItem>; title: string; onClose: () => void;
  onSave: (data: { name: string; type: VisitType; durationHint: string; notes: string; lat?: number; lng?: number; checklist: ChecklistItem[]; links: VisitLink[] }) => void;
  onDelete?: () => void;
  onUnschedule?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<VisitType>(initial?.type && VISIT_TYPES.includes(initial.type) ? initial.type : 'landmark');
  const [duration, setDuration] = useState(initial?.durationHint ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [searchResults, setSearchResults] = useState<PlaceSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [pickedCoords, setPickedCoords] = useState<{ lat: number; lng: number } | null>(
    initial?.lat != null ? { lat: initial.lat, lng: initial.lng! } : null,
  );
  const [showResults, setShowResults] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const isEditing = !!initial?.id;
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Checklist
  const [checklist, setChecklist] = useState<ChecklistItem[]>(initial?.checklist ?? []);
  const [newChecklistText, setNewChecklistText] = useState('');
  const addChecklistItem = () => {
    const text = newChecklistText.trim();
    if (!text) return;
    setChecklist((c) => [...c, { id: `cl-${Date.now()}`, text, done: false }]);
    setNewChecklistText('');
  };
  const toggleChecklistItem = (id: string) =>
    setChecklist((c) => c.map((item) => item.id === id ? { ...item, done: !item.done } : item));
  const removeChecklistItem = (id: string) =>
    setChecklist((c) => c.filter((item) => item.id !== id));

  // Links
  const [links, setLinks] = useState<VisitLink[]>(initial?.links ?? []);
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const addLink = () => {
    const url = newLinkUrl.trim();
    if (!url) return;
    const normalized = url.startsWith('http') ? url : `https://${url}`;
    setLinks((l) => [...l, { url: normalized, label: newLinkLabel.trim() || undefined }]);
    setNewLinkUrl('');
    setNewLinkLabel('');
  };

  // Debounced Nominatim search (only fires when user is actively typing a name without geocode yet)
  useEffect(() => {
    if (!name.trim() || name.trim().length < 3 || pickedCoords) { setSearchResults([]); setSearchError(false); return; }
    const controller = new AbortController();
    const tid = window.setTimeout(async () => {
      setIsSearching(true);
      setSearchError(false);
      try {
        const results = await searchPlace(name.trim(), { signal: controller.signal });
        setSearchResults(results.slice(0, 6));
        setShowResults(true);
      } catch (err) {
        if (!controller.signal.aborted) setSearchError(true);
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 500);
    return () => { clearTimeout(tid); controller.abort(); };
  }, [name, pickedCoords]);

  const pickResult = (r: PlaceSearchResult) => {
    const parts = r.display_name.split(',');
    setName(parts[0].trim());
    setPickedCoords({ lat: parseFloat(r.lat), lng: parseFloat(r.lon) });
    setSearchResults([]);
    setShowResults(false);
  };

  return (
    <ModalBase title={title} onClose={onClose}>
      <div className="space-y-4">

        {/* Place search */}
        <div className="relative">
          <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 mb-2 block">
            Place name
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              className="w-full border border-slate-200 rounded-lg pl-9 pr-9 py-2 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none font-semibold placeholder:font-normal"
              placeholder="e.g. Senso-ji Temple, Nishiki Market…"
              value={name}
              onChange={(e) => { setName(e.target.value); setPickedCoords(null); }}
              onFocus={() => searchResults.length > 0 && setShowResults(true)}
              autoFocus
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            )}
            {pickedCoords && !isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500">
                <Check className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
          {showResults && searchResults.length > 0 && (
            <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
              {searchResults.map((r) => {
                const parts = r.display_name.split(',');
                return (
                  <button key={r.place_id} onClick={() => pickResult(r)}
                    className="w-full text-left px-3 py-2.5 hover:bg-primary/5 border-b last:border-b-0 border-slate-100 flex items-start gap-2 transition-colors"
                  >
                    <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">{parts[0].trim()}</p>
                      <p className="text-[11px] text-slate-500 truncate">{parts.slice(1, 4).join(',').trim()}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {searchError && (
            <p className="text-[11px] text-red-500 font-medium mt-1">Search failed — you can still save with a manual name.</p>
          )}
        </div>

        {/* Type grid */}
        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 mb-2 block">Category</label>
          <div className="grid grid-cols-5 gap-1.5">
            {VISIT_TYPES.map((t) => {
              const selected = type === t;
              return (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  aria-pressed={selected}
                  className={`flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl border text-[9px] font-bold transition-all focus-visible:ring-2 focus-visible:ring-primary/50 ${
                    selected
                      ? `${getVisitTypeColor(t)} border-current shadow-sm`
                      : 'border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {getVisitTypeIcon(t, 'w-3.5 h-3.5')}
                  <span className="leading-none">{getVisitLabel(t)}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Duration */}
        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 mb-1.5 block">
            Duration
          </label>
          <input
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            placeholder="e.g. 2h, 90m, half day"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
        </div>

        {/* Notes */}
        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 mb-1.5 block">Notes</label>
          <textarea
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none resize-none"
            rows={2}
            placeholder="Booking info, tips, opening hours…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Checklist (collapsible) */}
        <details open={checklist.length > 0 || undefined}>
          <summary className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 mb-1.5 cursor-pointer select-none flex items-center gap-1.5 hover:text-slate-700 transition-colors">
            <ChevronDown className="w-3 h-3 transition-transform [details:not([open])_&]:-rotate-90" />
            Checklist {checklist.length > 0 && <span className="text-[9px] font-bold text-primary bg-primary/10 px-1.5 rounded-full">{checklist.length}</span>}
          </summary>
          <div className="space-y-1 mt-1">
            {checklist.map((item) => (
              <div key={item.id} className="flex items-center gap-2 group px-2">
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={() => toggleChecklistItem(item.id)}
                  className="accent-primary w-3.5 h-3.5 flex-shrink-0 cursor-pointer"
                />
                <span className={`flex-1 text-xs ${item.done ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                  {item.text}
                </span>
                <button
                  onClick={() => removeChecklistItem(item.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-1.5 mt-1">
              <input
                className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none placeholder:text-slate-400"
                placeholder="Add item…"
                value={newChecklistText}
                onChange={(e) => setNewChecklistText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addChecklistItem(); } }}
              />
              <button
                onClick={addChecklistItem}
                disabled={!newChecklistText.trim()}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-primary/10 text-slate-500 hover:text-primary transition-colors disabled:opacity-40"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </details>

        {/* Links (collapsible) */}
        <details open={links.length > 0 || undefined}>
          <summary className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 mb-1.5 cursor-pointer select-none flex items-center gap-1.5 hover:text-slate-700 transition-colors">
            <ChevronDown className="w-3 h-3 transition-transform [details:not([open])_&]:-rotate-90" />
            Links {links.length > 0 && <span className="text-[9px] font-bold text-primary bg-primary/10 px-1.5 rounded-full">{links.length}</span>}
          </summary>
          <div className="space-y-1 mt-1">
            {links.map((link, i) => (
              <div key={i} className="flex items-center gap-2 group px-2">
                <ExternalLink className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-xs text-primary hover:underline truncate"
                  onClick={(e) => e.stopPropagation()}
                >
                  {link.label || link.url}
                </a>
                <button
                  onClick={() => setLinks((l) => l.filter((_, idx) => idx !== i))}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <div className="space-y-1.5 mt-1">
              <input
                className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                placeholder="https://…"
                value={newLinkUrl}
                onChange={(e) => setNewLinkUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }}
              />
              <div className="flex gap-1.5">
                <input
                  className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                  placeholder="Label (optional)"
                  value={newLinkLabel}
                  onChange={(e) => setNewLinkLabel(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }}
                />
                <button
                  onClick={addLink}
                  disabled={!newLinkUrl.trim()}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-primary/10 text-slate-500 hover:text-primary text-xs font-bold transition-colors disabled:opacity-40"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </details>

        {/* Delete / unschedule */}
        {(onDelete || onUnschedule) && !confirmDelete && (
          <div className="flex gap-2">
            {onUnschedule && (
              <button onClick={() => { onUnschedule(); onClose(); }}
                className="flex-1 py-1.5 border border-blue-200 rounded-lg text-xs font-bold text-blue-500 hover:bg-blue-50 transition-colors flex items-center justify-center gap-1.5"
              >
                <ArrowLeftRight className="w-3 h-3" /> Move to Unplanned
              </button>
            )}
            {onDelete && (
              <button onClick={() => setConfirmDelete(true)}
                className="flex-1 py-1.5 border border-red-200 text-red-500 rounded-lg text-xs font-bold hover:bg-red-50 transition-colors flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3 h-3" /> Delete
              </button>
            )}
          </div>
        )}
        {confirmDelete && onDelete && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-red-700 mb-2">Delete &ldquo;{name || initial?.name}&rdquo;?</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-white transition-colors">
                Keep
              </button>
              <button onClick={() => { onDelete(); onClose(); }} className="flex-1 py-1.5 bg-red-500 text-white rounded-lg text-xs font-bold hover:bg-red-600 transition-colors">
                Delete
              </button>
            </div>
          </div>
        )}

        {/* Save / cancel */}
        <div className="flex gap-2.5 pt-1">
          <button onClick={onClose}
            className="flex-1 py-2.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={!name.trim()}
            onClick={() => {
              if (name.trim()) {
                onSave({ name: name.trim(), type, durationHint: duration, notes, lat: pickedCoords?.lat, lng: pickedCoords?.lng, checklist, links });
                onClose();
              }
            }}
            className="flex-1 py-2.5 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isEditing ? 'Save changes' : 'Add place'}
          </button>
        </div>
      </div>
    </ModalBase>
  );
}

// ─── Inline date range picker ─────────────────────────────────────────────────
function InlineDateRangePicker({ startDate, endDate, onChange }: {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
}) {
  const parseDate = (s: string) => s ? fnsParse(s, 'yyyy-MM-dd', new Date()) : undefined;
  const formatDate = (d: Date) => fnsFormat(d, 'yyyy-MM-dd');

  const from = parseDate(startDate);
  const to = parseDate(endDate);
  const defaultMonth = from ?? new Date();

  const handleSelect = (range: DateRange | undefined) => {
    if (!range) { onChange('', ''); return; }
    const newStart = range.from ? formatDate(range.from) : '';
    const newEnd = range.to ? formatDate(range.to) : '';
    onChange(newStart, newEnd);
  };

  return (
    <div className="rdp-inline">
      <DayPicker
        mode="range"
        selected={from ? { from, to } : undefined}
        onSelect={handleSelect}
        defaultMonth={defaultMonth}
        weekStartsOn={1}
        showOutsideDays
        fixedWeeks
      />
      {(startDate || endDate) && (
        <div className="flex items-center justify-between mt-1 pt-2 border-t border-slate-100">
          <span className="text-[11px] text-slate-500">
            {startDate && endDate
              ? `${fmt(new Date(startDate + 'T12:00:00'), { month: 'short', day: 'numeric' })} → ${fmt(new Date(endDate + 'T12:00:00'), { month: 'short', day: 'numeric' })}`
              : startDate
                ? `${fmt(new Date(startDate + 'T12:00:00'), { month: 'short', day: 'numeric' })} → pick end`
                : ''}
          </span>
          <button
            type="button"
            onClick={() => onChange('', '')}
            className="text-[11px] font-bold text-red-400 hover:text-red-600 transition-colors"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Trip editor modal ────────────────────────────────────────────────────────
function TripEditorModal({ trip, onClose, onSave, onDelete }: {
  trip: HybridTrip; onClose: () => void;
  onSave: (updates: Partial<HybridTrip>) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(trip.name);
  const [startDate, setStartDate] = useState(trip.startDate);
  const [totalDays, setTotalDays] = useState(trip.totalDays);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmShrink, setConfirmShrink] = useState(false);

  const endDateStr = startDate && totalDays > 0
    ? fnsFormat(addDays(fnsParse(startDate, 'yyyy-MM-dd', new Date()), totalDays - 1), 'yyyy-MM-dd')
    : '';

  const handleDateChange = (start: string, end: string) => {
    setStartDate(start);
    if (start && end) {
      const s = fnsParse(start, 'yyyy-MM-dd', new Date());
      const e = fnsParse(end, 'yyyy-MM-dd', new Date());
      const diff = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
      if (diff >= 1) setTotalDays(diff);
    }
  };

  // Detect stays affected by start-date shift and/or end-date shrink
  const oldStart = fnsParse(trip.startDate, 'yyyy-MM-dd', new Date());
  const newStart = startDate ? fnsParse(startDate, 'yyyy-MM-dd', new Date()) : oldStart;
  const startShiftDays = Math.round((newStart.getTime() - oldStart.getTime()) / 86400000);
  const slotShift = startShiftDays * 3; // positive = start moved later, stays shift left
  const newMaxSlot = totalDays * 3;

  // After applying the shift, compute which stays are affected
  const staysAfterShift = trip.stays.map((s) => ({
    ...s,
    _shiftedStart: s.startSlot - slotShift,
    _shiftedEnd: s.endSlot - slotShift,
  }));
  const affectedStays = staysAfterShift.filter(
    (s) => s._shiftedStart < 0 || s._shiftedEnd > newMaxSlot,
  );
  const fullyOutsideStays = affectedStays.filter(
    (s) => s._shiftedEnd <= 0 || s._shiftedStart >= newMaxSlot,
  );
  const partiallyCutStays = affectedStays.filter(
    (s) => !(s._shiftedEnd <= 0 || s._shiftedStart >= newMaxSlot),
  );

  // Pure date move: same totalDays, different startDate → just shift the calendar, keep stays
  const isPureDateMove = totalDays === trip.totalDays && slotShift !== 0;

  const doSave = (withClamp: boolean) => {
    if (isPureDateMove) {
      // Only update startDate — stays are trip-relative, no slot changes needed
      onSave({ name, startDate, totalDays });
    } else if (withClamp || slotShift !== 0) {
      const adjustedStays = adjustStaysForDateChange(trip.stays, slotShift, newMaxSlot);
      onSave({ name, startDate, totalDays, stays: adjustedStays });
    } else {
      onSave({ name, startDate, totalDays });
    }
    onClose();
  };

  const handleSave = () => {
    if (!isPureDateMove && affectedStays.length > 0) {
      setConfirmShrink(true);
    } else {
      doSave(false);
    }
  };

  const inputClass = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none';

  return (
    <ModalBase title="Edit Trip" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 mb-2 block">Trip Name</label>
          <input
            className={`${inputClass} font-semibold`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>

        {/* Date range picker */}
        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 mb-2 block">Dates</label>
          <div className="border border-slate-200 rounded-xl p-3">
            <InlineDateRangePicker
              startDate={startDate}
              endDate={endDateStr}
              onChange={handleDateChange}
            />
          </div>
        </div>

        {startDate && totalDays > 0 && (
          <div className="flex items-center gap-2 text-[11px] text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
            <Calendar className="w-3 h-3 text-slate-400 flex-shrink-0" />
            <span>
              {fmt(new Date(startDate), { month: 'short', day: 'numeric' })} — {fmt(addDaysTo(new Date(startDate), totalDays - 1), { month: 'short', day: 'numeric', year: 'numeric' })}
              <span className="ml-1.5 text-slate-400">({totalDays} day{totalDays !== 1 ? 's' : ''})</span>
            </span>
          </div>
        )}

        {confirmShrink ? (
          <div className={`${fullyOutsideStays.length > 0 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'} border rounded-lg p-3`}>
            <div className="flex items-start gap-2 mb-3">
              <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${fullyOutsideStays.length > 0 ? 'text-red-500' : 'text-amber-500'}`} />
              <div className="text-xs">
                {fullyOutsideStays.length > 0 && (
                  <p className="text-red-700 mb-1">
                    <strong>{fullyOutsideStays.map((s) => s.name).join(', ')}</strong> {fullyOutsideStays.length > 1 ? 'are' : 'is'} fully outside the new date range and will be <strong>removed</strong>.
                  </p>
                )}
                {partiallyCutStays.length > 0 && (
                  <p className="text-amber-700 mb-1">
                    <strong>{partiallyCutStays.map((s) => s.name).join(', ')}</strong> will be shortened to fit. Activities outside the new range will be unplanned.
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmShrink(false)} className="flex-1 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-white transition-colors">
                Go Back
              </button>
              <button onClick={() => doSave(true)} className={`flex-1 py-2 text-white rounded-lg text-xs font-bold transition-colors ${fullyOutsideStays.length > 0 ? 'bg-red-500 hover:bg-red-600' : 'bg-amber-500 hover:bg-amber-600'}`}>
                {fullyOutsideStays.length > 0 ? 'Remove & Shorten' : 'Confirm & Shorten'}
              </button>
            </div>
          </div>
        ) : confirmDelete && onDelete ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-red-700 mb-2">Delete &ldquo;{trip.name}&rdquo;? This cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-white transition-colors">
                Keep
              </button>
              <button onClick={() => { onDelete(); onClose(); }} className="flex-1 py-2 bg-red-500 text-white rounded-lg text-xs font-bold hover:bg-red-600 transition-colors">
                Delete Trip
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-3 pt-2">
            {onDelete && (
              <button onClick={() => setConfirmDelete(true)} className="py-2 px-3 border border-red-200 text-red-500 rounded-lg text-xs font-bold hover:bg-red-50 transition-colors flex items-center gap-1.5">
                <Trash2 className="w-3 h-3" /> Delete
              </button>
            )}
            <button onClick={onClose} className="flex-1 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!startDate || totalDays < 1}
              className="flex-1 py-2 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/90 transition-colors disabled:opacity-40"
            >
              Save
            </button>
          </div>
        )}
      </div>
    </ModalBase>
  );
}

// ─── Trip switcher panel ──────────────────────────────────────────────────────
function TripSwitcherPanel({ store, onSwitch, onNew, onClose }: {
  store: TripStore; onSwitch: (id: string) => void;
  onNew: () => void; onClose: () => void;
}) {
  return (
    <ModalBase title="Switch Trip" onClose={onClose}>
      <div className="space-y-2 mb-4">
        {store.trips.map((t) => (
          <button
            key={t.id}
            onClick={() => { onSwitch(t.id); onClose(); }}
            className={`w-full text-left px-4 py-3 rounded-lg border transition-all flex items-center justify-between ${
              t.id === store.activeTripId
                ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/10'
                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <div>
              <p className="text-sm font-bold text-slate-800">{t.name}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {fmt(new Date(t.startDate), { month: 'short', day: 'numeric', year: 'numeric' })} · {t.totalDays} days · {t.stays.length} stays
              </p>
            </div>
            {t.id === store.activeTripId && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
          </button>
        ))}
      </div>
      <button
        onClick={() => { onNew(); onClose(); }}
        className="w-full py-2.5 border-2 border-dashed border-slate-300 rounded-lg text-sm font-bold text-slate-500 hover:border-primary/50 hover:text-primary transition-all flex items-center justify-center gap-2"
      >
        <Plus className="w-4 h-4" /> New Trip
      </button>
    </ModalBase>
  );
}

// ─── History panel ────────────────────────────────────────────────────────────
function HistoryPanel({ history, index, onNavigate, onClose }: {
  history: HistorySnapshot[]; index: number; onNavigate: (i: number) => void; onClose: () => void;
}) {
  return (
    <ModalBase title="History" onClose={onClose}>
      <div className="space-y-0.5 max-h-96 overflow-y-auto -mx-1 px-1">
        {[...history].reverse().map((snap, ri) => {
          const i = history.length - 1 - ri;
          const isCurrent = i === index;
          const isFuture = i > index;
          const prev = i > 0 ? history[i - 1] : null;
          const staysDiff = prev ? snap.trip.stays.length - prev.trip.stays.length : null;
          const placesDiff = prev
            ? snap.trip.stays.reduce((s, st) => s + st.visits.length, 0) -
              prev.trip.stays.reduce((s, st) => s + st.visits.length, 0)
            : null;
          return (
            <button
              key={i}
              onClick={() => { onNavigate(i); onClose(); }}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition-all flex items-center justify-between gap-3 ${
                isCurrent
                  ? 'bg-primary/5 border border-primary/20'
                  : isFuture
                  ? 'opacity-40 hover:opacity-65 border border-dashed border-slate-200 hover:bg-slate-50'
                  : 'hover:bg-slate-50 border border-transparent'
              }`}
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <span className={`text-[11px] font-mono mt-0.5 shrink-0 ${isCurrent ? 'text-primary' : 'text-slate-300'}`}>
                  #{i}
                </span>
                <div className="min-w-0">
                  <p className={`text-xs font-semibold truncate ${isCurrent ? 'text-primary' : 'text-slate-700'}`}>
                    {snap.trip.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <p className="text-[11px] text-slate-400">
                      {snap.trip.stays.length} stays · {snap.trip.stays.reduce((s, st) => s + st.visits.length, 0)} places
                    </p>
                    {staysDiff !== null && staysDiff !== 0 && (
                      <span className={`text-[9px] font-bold px-1.5 py-px rounded ${staysDiff > 0 ? 'text-emerald-600 bg-emerald-50' : 'text-red-500 bg-red-50'}`}>
                        {staysDiff > 0 ? `+${staysDiff}` : staysDiff} stay{Math.abs(staysDiff) !== 1 ? 's' : ''}
                      </span>
                    )}
                    {placesDiff !== null && placesDiff !== 0 && (
                      <span className={`text-[9px] font-bold px-1.5 py-px rounded ${placesDiff > 0 ? 'text-emerald-600 bg-emerald-50' : 'text-red-500 bg-red-50'}`}>
                        {placesDiff > 0 ? `+${placesDiff}` : placesDiff} place{Math.abs(placesDiff) !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[9px] text-slate-300 tabular-nums">{formatRelativeTime(snap.timestamp)}</span>
                {isCurrent && (
                  <span className="text-[9px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">NOW</span>
                )}
                {isFuture && <Redo2 className="w-3 h-3 text-slate-300" />}
              </div>
            </button>
          );
        })}
      </div>
    </ModalBase>
  );
}

// ─── Map ──────────────────────────────────────────────────────────────────────
// TripMap is now imported from ./components/TripMap

// ─── Draggable inventory card ──────────────────────────────────────────────────
function DraggableInventoryCard({ visit, onEdit }: { visit: VisitItem; onEdit: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `inbox-${visit.id}`, data: { type: 'inbox', visit },
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 }}
      className="p-3 bg-white rounded-lg border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all group select-none touch-none cursor-grab active:cursor-grabbing"
      aria-label={`Drag ${visit.name} to schedule`}
    >
      <div className="flex justify-between items-start mb-1.5">
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter border ${getVisitTypeColor(visit.type)}`}>
          {getVisitLabel(visit.type)}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="opacity-60 group-hover:opacity-100 transition-opacity p-2.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-primary/50 touch-auto"
            aria-label={`Edit ${visit.name}`}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <div className="p-2.5 text-slate-300" aria-hidden="true">
            <GripVertical className="w-4 h-4" />
          </div>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-slate-800">{visit.name}</p>
          {visit.durationHint && <p className="text-[11px] text-slate-400 mt-0.5">{visit.durationHint}</p>}
          {(visit.checklist?.length || visit.links?.length) ? (
            <div className="flex items-center gap-1.5 mt-1.5">
              {visit.checklist?.length ? (
                <span className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500 bg-slate-100 rounded-full px-2 py-1">
                  <Check className="w-2.5 h-2.5" />
                  {visit.checklist.filter(i => i.done).length}/{visit.checklist.length}
                </span>
              ) : null}
              {visit.links?.length ? (
                <span className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500 bg-slate-100 rounded-full px-2 py-1">
                  <Link2 className="w-2.5 h-2.5" />
                  {visit.links.length}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        {visit.imageUrl && (
          <div className="size-9 rounded-md overflow-hidden flex-shrink-0 border border-slate-100 shadow-sm">
            <img src={visit.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sortable visit card ──────────────────────────────────────────────────────
function SortableVisitCard({ visit, isSelected, onSelect, onEdit }: {
  visit: VisitItem; isSelected: boolean; onSelect: () => void; onEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({
    id: `visit-${visit.id}`, data: { type: 'visit', visit },
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 }}
      className={`relative pl-[18px] pr-3.5 py-3.5 bg-white rounded-lg border transition-all group select-none touch-none cursor-grab active:cursor-grabbing ${
        isOver
          ? 'border-primary shadow-md ring-2 ring-primary/25 bg-primary/[0.02]'
          : isSelected
          ? 'border-primary/30 shadow-[0_4px_12px_rgba(236,91,19,0.1)] ring-1 ring-primary/10'
          : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
      }`}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg ${getVisitTypeBg(visit.type)}`} />
      {isOver && <div className="absolute -top-1 left-2 right-2 h-0.5 bg-primary rounded-full z-10" />}
      <div className="flex items-start justify-between mb-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter border ${getVisitTypeColor(visit.type)}`}>
            {getVisitLabel(visit.type)}
          </span>
          {visit.durationHint && <span className="text-[11px] text-slate-400 font-medium">{visit.durationHint}</span>}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 ml-1">
          <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="opacity-60 group-hover:opacity-100 transition-opacity p-2.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-primary/50 touch-auto" aria-label={`Edit ${visit.name}`}>
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <div className="p-2.5" aria-hidden="true">
            <GripVertical className="w-4 h-4 text-slate-300" />
          </div>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p onClick={onSelect} className="text-xs font-bold leading-tight text-slate-800 cursor-pointer hover:text-primary transition-colors flex items-center gap-1">
            <span className="truncate">{visit.name}</span>
            <Eye className="w-3 h-3 flex-shrink-0 opacity-0 group-hover:opacity-40 transition-opacity" />
          </p>
          {visit.notes && (
            <p className="text-[11px] text-slate-400 mt-1 italic leading-snug">{visit.notes}</p>
          )}
          {(visit.checklist?.length || visit.links?.length) ? (
            <div className="flex items-center gap-1.5 mt-1.5">
              {visit.checklist?.length ? (
                <span className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500 bg-slate-100 rounded-full px-2 py-1">
                  <Check className="w-2.5 h-2.5" />
                  {visit.checklist.filter(i => i.done).length}/{visit.checklist.length}
                </span>
              ) : null}
              {visit.links?.length ? (
                <span className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500 bg-slate-100 rounded-full px-2 py-1">
                  <Link2 className="w-2.5 h-2.5" />
                  {visit.links.length}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        {visit.imageUrl && (
          <div className="size-9 rounded-md overflow-hidden flex-shrink-0 border border-slate-100 shadow-sm">
            <img src={visit.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Stay overview panel ──────────────────────────────────────────────────────
function StayOverviewPanel({ stay, stayDays, accommodationGroups, onUpdate }: {
  stay: Stay;
  stayDays: ReturnType<typeof deriveStayDays>;
  accommodationGroups: AccommodationGroup[];
  onUpdate: (updates: Partial<Stay>) => void;
}) {
  const [notes, setNotes] = useState(stay.notes ?? '');
  const [links, setLinks] = useState<VisitLink[]>(stay.links ?? []);
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkLabel, setNewLinkLabel] = useState('');

  // Reset local state when switching to a different stay
  useEffect(() => {
    setNotes(stay.notes ?? '');
    setLinks(stay.links ?? []);
  }, [stay.id]);

  const nights = stayDays.filter((d) => d.hasNight).length;
  const startDate = stayDays[0]?.date;
  const endDate = stayDays[stayDays.length - 1]?.date;

  const addLink = () => {
    const url = newLinkUrl.trim();
    if (!url) return;
    const normalized = url.startsWith('http') ? url : `https://${url}`;
    const next = [...links, { url: normalized, label: newLinkLabel.trim() || undefined }];
    setLinks(next);
    onUpdate({ links: next });
    setNewLinkUrl('');
    setNewLinkLabel('');
  };

  return (
    <div className="flex-1 overflow-y-auto scroll-hide">
      {/* Hero */}
      <div className="relative h-24 bg-slate-100 flex-shrink-0">
        {stay.imageUrl ? (
          <img src={stay.imageUrl} alt={stay.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
            <MapPin className="w-7 h-7 text-slate-300" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute bottom-2.5 left-3.5 right-3.5">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full flex-shrink-0 ring-1 ring-white/40" style={{ backgroundColor: stay.color }} />
            <h2 className="text-white font-bold text-sm leading-tight truncate">{stay.name}</h2>
          </div>
          {startDate && endDate && (
            <p className="text-white/70 text-[11px] mt-0.5">
              {fmt(startDate, { month: 'short', day: 'numeric' })} → {fmt(endDate, { month: 'short', day: 'numeric' })}
            </p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 border-b border-border-neutral">
        {[
          { value: stayDays.length, label: 'Days' },
          { value: nights, label: 'Nights' },
          { value: stay.visits.length, label: 'Places' },
        ].map(({ value, label }, i) => (
          <div key={label} className={`px-3 py-2 text-center ${i < 2 ? 'border-r border-border-neutral' : ''}`}>
            <p className="text-base font-extrabold text-slate-800">{value}</p>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Accommodation */}
      {accommodationGroups.length > 0 && (
        <div className="px-4 py-2 border-b border-border-neutral">
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400 mb-1.5">Sleeping</p>
          <div className="space-y-1">
            {accommodationGroups.map((g, i) => (
              <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 bg-primary/5 rounded-lg">
                <Hotel className="w-3 h-3 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate">{g.name}</p>
                  <p className="text-[9px] text-slate-400">{g.nights} {g.nights === 1 ? 'night' : 'nights'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="px-4 py-2 border-b border-border-neutral">
        <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400 mb-1.5 block">Notes</label>
        <textarea
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none resize-none text-slate-700 placeholder:text-slate-300"
          rows={3}
          placeholder="Travel tips, booking info, things to know…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => onUpdate({ notes: notes.trim() || undefined })}
        />
      </div>

      {/* Links */}
      <div className="px-4 py-2 border-b border-border-neutral">
        <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400 mb-1.5 block">Links</label>
        <div className="space-y-1.5">
          {links.map((link, i) => (
            <div key={i} className="flex items-center gap-2 group">
              <ExternalLink className="w-3 h-3 text-slate-400 flex-shrink-0" />
              <a href={link.url} target="_blank" rel="noopener noreferrer"
                className="flex-1 text-xs text-primary hover:underline truncate" onClick={(e) => e.stopPropagation()}>
                {link.label || link.url}
              </a>
              <button
                onClick={() => { const next = links.filter((_, idx) => idx !== i); setLinks(next); onUpdate({ links: next.length > 0 ? next : undefined }); }}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <div className="space-y-1.5 mt-1">
            <input
              className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none"
              placeholder="https://…"
              value={newLinkUrl}
              onChange={(e) => setNewLinkUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }}
            />
            <div className="flex gap-1.5">
              <input
                className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                placeholder="Label (optional)"
                value={newLinkLabel}
                onChange={(e) => setNewLinkLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }}
              />
              <button
                onClick={addLink}
                disabled={!newLinkUrl.trim()}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-primary/10 text-slate-500 hover:text-primary text-xs font-bold transition-colors disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* To-do */}
      <StayTodoSection
        key={stay.id}
        stay={stay}
        onUpdate={(cl) => onUpdate({ checklist: cl.length > 0 ? cl : undefined })}
      />
    </div>
  );
}

// ─── Stay to-do section ───────────────────────────────────────────────────────
function StayTodoSection({ stay, onUpdate }: {
  stay: Stay;
  onUpdate: (checklist: ChecklistItem[]) => void;
}) {
  const checklist = stay.checklist ?? [];
  const [open, setOpen] = useState(checklist.length > 0);
  const [inputText, setInputText] = useState('');
  const doneCount = checklist.filter((i) => i.done).length;

  const addItem = () => {
    const text = inputText.trim();
    if (!text) return;
    onUpdate([...checklist, { id: `cl-${Date.now()}`, text, done: false }]);
    setInputText('');
  };

  return (
    <div className="border-b border-border-neutral flex-shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-2 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">To-Do</span>
          {checklist.length > 0 && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${doneCount === checklist.length ? 'bg-emerald-50 text-emerald-600' : 'bg-primary/10 text-primary'}`}>
              {doneCount}/{checklist.length}
            </span>
          )}
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-all duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 pb-3 space-y-1.5">
          {checklist.map((item) => (
            <div key={item.id} className="flex items-center gap-2 group">
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => onUpdate(checklist.map((i) => i.id === item.id ? { ...i, done: !i.done } : i))}
                className="accent-primary w-3.5 h-3.5 flex-shrink-0 cursor-pointer"
              />
              <span className={`flex-1 text-xs ${item.done ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                {item.text}
              </span>
              <button
                onClick={() => onUpdate(checklist.filter((i) => i.id !== item.id))}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-1.5 mt-1">
            <input
              className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none placeholder:text-slate-400"
              placeholder="Add to-do…"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
            />
            <button
              onClick={addItem}
              disabled={!inputText.trim()}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-primary/10 text-slate-500 hover:text-primary transition-colors disabled:opacity-40"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Visit detail drawer ─────────────────────────────────────────────────────
function VisitDetailDrawer({ visit, dayLabel, onClose, onEdit, onUnschedule, onDelete, onUpdateVisit }: {
  visit: VisitItem;
  dayLabel: string;
  onClose: () => void;
  onEdit: () => void;
  onUnschedule: () => void;
  onDelete: () => void;
  onUpdateVisit: (updates: Partial<VisitItem>) => void;
}) {
  const [notes, setNotes] = useState(visit.notes ?? '');
  const [checklist, setChecklist] = useState<ChecklistItem[]>(visit.checklist ?? []);
  const [newChecklistText, setNewChecklistText] = useState('');

  useEffect(() => {
    setNotes(visit.notes ?? '');
    setChecklist(visit.checklist ?? []);
  }, [visit.id]);

  const saveNotes = () => {
    const trimmed = notes.trim() || undefined;
    if (trimmed !== visit.notes) onUpdateVisit({ notes: trimmed });
  };

  const toggleChecklistItem = (itemId: string) => {
    const next = checklist.map((c) => c.id === itemId ? { ...c, done: !c.done } : c);
    setChecklist(next);
    onUpdateVisit({ checklist: next.length > 0 ? next : undefined });
  };

  const addChecklistItem = () => {
    const text = newChecklistText.trim();
    if (!text) return;
    const next = [...checklist, { id: `cl-${Date.now()}`, text, done: false }];
    setChecklist(next);
    setNewChecklistText('');
    onUpdateVisit({ checklist: next });
  };

  const removeChecklistItem = (itemId: string) => {
    const next = checklist.filter((c) => c.id !== itemId);
    setChecklist(next);
    onUpdateVisit({ checklist: next.length > 0 ? next : undefined });
  };

  const doneCount = checklist.filter((c) => c.done).length;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Back to stay */}
      <button
        onClick={onClose}
        className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold text-slate-500 hover:text-primary hover:bg-slate-50 transition-colors border-b border-border-neutral flex-shrink-0"
      >
        <ChevronDown className="w-3.5 h-3.5 rotate-90" />
        Back to stay
      </button>
      {/* Hero */}
      <div className="relative h-28 flex-shrink-0">
        {visit.imageUrl ? (
          <img src={visit.imageUrl} alt={visit.name} className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full flex items-center justify-center ${getVisitTypeBg(visit.type)} opacity-20`} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="absolute bottom-2.5 left-3.5 right-3.5">
          <span className={`inline-flex text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter border ${getVisitTypeColor(visit.type)} bg-white/90`}>
            {getVisitLabel(visit.type)}
          </span>
          <h3 className="text-white font-bold text-sm leading-tight mt-1 truncate">{visit.name}</h3>
          {visit.area && <p className="text-white/60 text-[11px] truncate">{visit.area}</p>}
        </div>
      </div>

      {/* Schedule + duration bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border-neutral bg-slate-50/50 text-[11px]">
        <div className="flex items-center gap-1.5 text-slate-600">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-semibold">{dayLabel}</span>
        </div>
        {visit.durationHint && (
          <>
            <span className="text-slate-300">·</span>
            <span className="font-medium text-slate-500">{visit.durationHint}</span>
          </>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto scroll-hide">
        {/* Notes */}
        <div className="px-4 py-3 border-b border-border-neutral">
          <label className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 mb-1.5 block">Notes</label>
          <textarea
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 resize-none focus:ring-1 focus:ring-primary focus:border-primary outline-none placeholder:text-slate-400"
            rows={3}
            placeholder="Add notes about this place..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveNotes}
          />
        </div>

        {/* Checklist */}
        <div className="px-4 py-3 border-b border-border-neutral">
          <details open={checklist.length > 0 || undefined}>
            <summary className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 mb-1.5 cursor-pointer select-none flex items-center gap-1.5 hover:text-slate-600 transition-colors">
              <ChevronDown className="w-3 h-3 transition-transform [details:not([open])_&]:-rotate-90" />
              Checklist
              {checklist.length > 0 && (
                <span className="text-[9px] font-bold text-primary bg-primary/10 px-1.5 rounded-full">{doneCount}/{checklist.length}</span>
              )}
            </summary>
            <div className="space-y-1 mt-1">
              {checklist.map((item) => (
                <div key={item.id} className="flex items-center gap-2 group">
                  <input
                    type="checkbox" checked={item.done}
                    onChange={() => toggleChecklistItem(item.id)}
                    className="accent-primary w-3.5 h-3.5 flex-shrink-0 cursor-pointer"
                  />
                  <span className={`flex-1 text-xs ${item.done ? 'line-through text-slate-400' : 'text-slate-700'}`}>{item.text}</span>
                  <button onClick={() => removeChecklistItem(item.id)} className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-1.5 mt-1">
                <input
                  className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none placeholder:text-slate-400"
                  placeholder="Add item..."
                  value={newChecklistText}
                  onChange={(e) => setNewChecklistText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addChecklistItem(); } }}
                />
                <button onClick={addChecklistItem} disabled={!newChecklistText.trim()} className="p-1.5 rounded-lg bg-slate-100 hover:bg-primary/10 text-slate-500 hover:text-primary transition-colors disabled:opacity-40">
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </details>
        </div>

        {/* Links */}
        {visit.links && visit.links.length > 0 && (
          <div className="px-4 py-3 border-b border-border-neutral">
            <p className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 mb-1.5">Links</p>
            <div className="space-y-1.5">
              {visit.links.map((link, i) => (
                <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-primary hover:underline truncate"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-primary/50 flex-shrink-0" />
                  {link.label || link.url}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-border-neutral bg-white flex-shrink-0">
        <button
          onClick={onEdit}
          className="flex-1 py-2 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5"
        >
          <Pencil className="w-3 h-3" /> Edit Details
        </button>
        <button
          onClick={onUnschedule}
          className="py-2 px-3 border border-blue-200 text-blue-500 rounded-lg text-xs font-bold hover:bg-blue-50 transition-colors"
          title="Move to Inbox"
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => { onDelete(); onClose(); }}
          className="py-2 px-3 border border-red-200 text-red-500 rounded-lg text-xs font-bold hover:bg-red-50 transition-colors"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Droppable period slot ────────────────────────────────────────────────────
function DroppablePeriodSlot({ dayOffset, period, visits, selectedVisitId, onSelectVisit, onEditVisit, onAddVisit }: {
  dayOffset: number; period: DayPart; visits: VisitItem[];
  selectedVisitId: string | null;
  onSelectVisit: (id: string) => void;
  onEditVisit: (v: VisitItem) => void;
  onAddVisit: (dayOffset: number, part: DayPart) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${dayOffset}-${period}` });
  const PeriodIcon = period === 'morning' ? Sunrise : period === 'afternoon' ? Sun : Moon;
  const label = period === 'morning' ? 'Morning' : period === 'afternoon' ? 'Afternoon' : 'Evening';

  return (
    <div ref={setNodeRef} aria-label={`${label} slot, day ${dayOffset + 1}`} className={`p-1.5 rounded-xl border transition-colors ${isOver ? 'bg-primary/5 border-primary/30' : 'bg-slate-200/40 border-slate-200/80'}`}>
      <div className="flex items-center gap-1.5 px-2 py-1.5 mb-1">
        <PeriodIcon className="w-3 h-3 text-slate-500" />
        <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-500">{label}</span>
      </div>
      <div className="space-y-2">
        <SortableContext items={visits.map((v) => `visit-${v.id}`)} strategy={verticalListSortingStrategy}>
          {visits.map((v) => (
            <SortableVisitCard
              key={v.id} visit={v}
              isSelected={selectedVisitId === v.id}
              onSelect={() => onSelectVisit(v.id)}
              onEdit={() => onEditVisit(v)}
            />
          ))}
        </SortableContext>
        <button
          onClick={() => onAddVisit(dayOffset, period)}
          className="w-full h-10 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center gap-1.5 text-slate-400 hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all group"
        >
          <PlusCircle className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
          <span className="text-[11px] font-bold uppercase tracking-tight">Drop or add</span>
        </button>
      </div>
    </div>
  );
}

// ─── AI Planner modal ─────────────────────────────────────────────────────────
function AIPlannerModal({
  trip, settings, onSettingsChange, onClose, onApply,
}: {
  trip: HybridTrip;
  settings: { apiKey: string; model: string };
  onSettingsChange: (s: { apiKey: string; model: string }) => void;
  onClose: () => void;
  onApply: (stays: Stay[]) => void;
}) {
  const [tab, setTab] = useState<'generate' | 'settings'>('generate');
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<'scratch' | 'refine'>('scratch');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [pendingStays, setPendingStays] = useState<Stay[] | null>(null);

  const handleGenerate = async () => {
    if (!settings.apiKey.trim()) {
      setError('Please add your Gemini API key in the Settings tab.');
      setTab('settings');
      return;
    }
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setExplanation(null);
    setPendingStays(null);
    try {
      const result = await generateHybridItinerary(
        prompt, { apiKey: settings.apiKey, model: settings.model },
        trip.totalDays, trip.startDate, trip.name, mode,
        mode === 'refine' ? trip.stays.map((s) => ({
          name: s.name, startSlot: s.startSlot, endSlot: s.endSlot,
          visits: s.visits.map((v) => ({ name: v.name, dayOffset: v.dayOffset, dayPart: v.dayPart })),
        })) : undefined,
      );
      // Map AI output → app Stay type
      const newStays: Stay[] = (result.stays as AIHybridStay[]).map((s, i) => {
        // Parse nightAccommodations from AI response
        const rawAccom = (s as unknown as Record<string, unknown>).nightAccommodations as
          Record<string, { name: string; lat?: number; lng?: number; cost?: number; notes?: string; link?: string }> | undefined;
        const nightAccommodations: Record<number, NightAccommodation> | undefined = rawAccom
          ? Object.fromEntries(
              Object.entries(rawAccom).map(([k, v]) => [Number(k), { name: v.name, lat: v.lat, lng: v.lng, cost: v.cost, notes: v.notes, link: v.link }]),
            )
          : undefined;

        return {
          id: `ai-stay-${Date.now()}-${i}`,
          name: s.name,
          color: s.color,
          startSlot: s.startSlot,
          endSlot: s.endSlot,
          centerLat: s.centerLat,
          centerLng: s.centerLng,
          lodging: s.lodging ?? '',
          nightAccommodations: nightAccommodations && Object.keys(nightAccommodations).length > 0 ? nightAccommodations : undefined,
          travelModeToNext: s.travelModeToNext ?? 'train',
          travelDurationToNext: s.travelDurationToNext,
          travelNotesToNext: s.travelNotesToNext,
          visits: (s.visits ?? []).map((v, vi) => ({
            id: `ai-visit-${Date.now()}-${i}-${vi}`,
            name: v.name,
            type: v.type ?? 'landmark',
            area: v.area ?? '',
            lat: v.lat,
            lng: v.lng,
            dayOffset: v.dayOffset ?? 0,
            dayPart: v.dayPart ?? 'morning',
            order: v.order ?? vi,
            durationHint: v.durationHint,
            notes: v.notes,
          })),
        };
      });
      if (result.explanation) {
        setExplanation(result.explanation);
        setPendingStays(newStays);
      } else {
        onApply(newStays);
        onClose();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (pendingStays) { onApply(pendingStays); onClose(); }
  };

  return (
    <ModalBase title="AI Planner" onClose={onClose} width="max-w-lg">
      {/* Tabs */}
      <div className="flex border-b border-slate-100 -mx-6 px-6 mb-5 gap-4">
        {(['generate', 'settings'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2.5 text-[11px] font-extrabold uppercase tracking-widest border-b-2 transition-colors -mb-px ${
              tab === t ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {t === 'generate' ? <><Sparkles className="w-3 h-3 inline -mt-0.5 mr-1" />Generate</> : <><SlidersHorizontal className="w-3 h-3 inline -mt-0.5 mr-1" />Settings</>}
          </button>
        ))}
      </div>

      {tab === 'generate' && (
        <div className="space-y-4">
          {/* Mode toggle */}
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400 mb-2 block">Mode</span>
            <div className="flex gap-2">
              {(['scratch', 'refine'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${
                    mode === m
                      ? 'bg-primary text-white border-primary shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {m === 'scratch' ? 'From Scratch' : 'Refine Existing'}
                </button>
              ))}
            </div>
          </div>

          {/* Prompt */}
          {!explanation ? (
            <div>
              <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400 mb-2 block">
                What should I plan? <span className="text-slate-300 normal-case font-medium">({trip.totalDays} days available)</span>
              </label>
              <textarea
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none resize-none"
                rows={4}
                placeholder={`e.g. ${trip.totalDays} days in Japan — Tokyo, Kyoto, Osaka. Culture, food, and nature. Mid-budget, late May 2026.`}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate(); }}
                disabled={loading}
                autoFocus
              />
              {loading && (
                <div className="mt-3 space-y-2 animate-pulse">
                  <div className="h-2.5 bg-slate-100 rounded-full w-3/4" />
                  <div className="h-2.5 bg-slate-100 rounded-full w-1/2" />
                  <div className="h-2.5 bg-slate-100 rounded-full w-5/6" />
                  <p className="text-[11px] text-slate-400 font-medium pt-1">Generating your itinerary…</p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-primary">AI Plan Ready</span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed italic">{explanation}</p>
              <p className="text-[11px] text-slate-400 pt-1">Review the summary above, then apply to your timeline.</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-xs text-red-700 flex gap-2 items-start">
              <X className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} disabled={loading} className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40">
              Cancel
            </button>
            {explanation ? (
              <button
                onClick={handleApply}
                className="flex-1 py-2.5 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" /> Apply to Timeline
              </button>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={loading || !prompt.trim()}
                className="flex-1 py-2.5 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center gap-2"><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Generating…</span>
                ) : (
                  <><Sparkles className="w-4 h-4" /> Generate</>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {tab === 'settings' && (
        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400 mb-2 block">Gemini API Key</label>
            <input
              type="password"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none font-mono"
              placeholder="AIza…"
              value={settings.apiKey}
              onChange={(e) => onSettingsChange({ ...settings, apiKey: e.target.value })}
            />
            <p className="text-[11px] text-slate-400 mt-1.5">
              Stored locally in your browser.{' '}
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-primary underline">Get a free key →</a>
            </p>
          </div>
          <div>
            <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400 mb-2 block">Model</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {[
                { id: 'gemini-3.1-flash-lite-preview', label: '3.1 Lite', badge: 'recommended' },
                { id: 'gemini-3-flash-preview', label: '3 Flash' },
                { id: 'gemini-3.1-pro-preview', label: '3.1 Pro' },
              ].map(({ id, label, badge }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSettingsChange({ ...settings, model: id })}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all ${
                    settings.model === id
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-primary/50 hover:text-primary'
                  }`}
                >
                  {label}{badge && settings.model !== id ? <span className="ml-1 text-slate-400 font-medium">★</span> : ''}
                </button>
              ))}
            </div>
            <input
              type="text"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none font-mono"
              placeholder="or type a custom model ID"
              value={settings.model}
              onChange={(e) => onSettingsChange({ ...settings, model: e.target.value })}
            />
          </div>
        </div>
      )}
    </ModalBase>
  );
}

// ─── Profile dropdown menu ────────────────────────────────────────────────────
function ProfileMenu({ trip, onImport, onImportFromCode, onGoHome, onSignOut }: {
  trip: HybridTrip;
  onImport: (data: HybridTrip) => void;
  onImportFromCode: () => void;
  onGoHome: () => void;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { user, signOutUser } = useAuth();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-profile-menu]')) setOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [open]);

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(trip, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `${trip.name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    setOpen(false);
  };

  const handleExportMarkdown = () => {
    const start = trip.startDate || new Date().toISOString().split('T')[0];
    const legacy = hybridTripToLegacy({ ...trip, startDate: start });
    const endDate = addDaysTo(new Date(start), trip.totalDays - 1).toISOString().split('T')[0];
    const md = generateMarkdown(legacy.days, legacy.locations as any, legacy.routes, start, endDate);
    downloadMarkdown(md, `${trip.name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.md`);
    setOpen(false);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result || '{}'));
        if (!parsed.stays || !parsed.name) {
          alert('Invalid trip file — expected a Chronos trip JSON with "name" and "stays".');
          return;
        }
        const imported = normalizeTrip({
          ...parsed,
          id: parsed.id || `trip-${Date.now()}`,
          startDate: parsed.startDate || '',
          totalDays: parsed.totalDays || 1,
        } as HybridTrip);
        onImport(imported);
      } catch {
        alert('Error reading file. Please ensure it is valid JSON.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
    setOpen(false);
  };

  return (
    <div className="relative" data-profile-menu>
      <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
      <button
        onClick={() => setOpen(!open)}
        className={`size-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all flex-shrink-0 ml-1 ${
          open ? 'bg-primary text-white border-primary'
            : user ? 'bg-emerald-500 text-white border-emerald-400 hover:bg-emerald-600'
            : 'bg-primary/10 text-primary border-primary/20 hover:bg-primary hover:text-white'
        }`}
      >
        {user ? <span className="text-[11px] font-bold">{(user.email?.[0] ?? 'U').toUpperCase()}</span> : <User className="w-3.5 h-3.5" />}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-60 bg-white rounded-xl shadow-2xl border border-slate-200/60 overflow-hidden z-50">

          {/* Header */}
          <div className={`px-4 pt-4 pb-3 ${user ? 'bg-emerald-50/60' : 'bg-slate-50/80'}`}>
            <div className="flex items-center gap-3">
              <div className={`size-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${user ? 'bg-emerald-500 text-white' : 'bg-primary/10 text-primary'}`}>
                {user ? (user.email?.[0] ?? 'U').toUpperCase() : <User className="w-4 h-4" />}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-slate-800 truncate leading-tight">
                  {user ? user.email : 'Guest User'}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {user ? <Check className="w-3 h-3 text-emerald-500 flex-shrink-0" /> : <Lock className="w-3 h-3 text-slate-300 flex-shrink-0" />}
                  <p className={`text-[11px] font-semibold ${user ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {user ? 'Synced to cloud' : 'Local storage only'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Trip data section */}
          <div className="px-2 pt-2 pb-1">
            <p className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 px-2 mb-1">Trip data</p>
            <button onClick={handleExport} className="w-full flex items-center gap-2.5 px-2 py-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 rounded-lg transition-colors text-left">
              <div className="size-6 rounded-md bg-blue-50 flex items-center justify-center flex-shrink-0">
                <Download className="w-3 h-3 text-blue-500" />
              </div>
              Export JSON
            </button>
            <button onClick={handleExportMarkdown} className="w-full flex items-center gap-2.5 px-2 py-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 rounded-lg transition-colors text-left">
              <div className="size-6 rounded-md bg-blue-50 flex items-center justify-center flex-shrink-0">
                <Download className="w-3 h-3 text-blue-500" />
              </div>
              Export Markdown
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center gap-2.5 px-2 py-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 rounded-lg transition-colors text-left">
              <div className="size-6 rounded-md bg-violet-50 flex items-center justify-center flex-shrink-0">
                <Upload className="w-3 h-3 text-violet-500" />
              </div>
              Import JSON
            </button>
            <button onClick={() => { onImportFromCode(); setOpen(false); }} className="w-full flex items-center gap-2.5 px-2 py-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 rounded-lg transition-colors text-left">
              <div className="size-6 rounded-md bg-violet-50 flex items-center justify-center flex-shrink-0">
                <Download className="w-3 h-3 text-violet-500" />
              </div>
              Import from code
            </button>
          </div>

          {/* Navigation section */}
          <div className="px-2 pb-2 border-t border-slate-100 pt-2">
            <button onClick={() => { onGoHome(); setOpen(false); }} className="w-full flex items-center gap-2.5 px-2 py-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 rounded-lg transition-colors text-left">
              <div className="size-6 rounded-md bg-slate-100 flex items-center justify-center flex-shrink-0">
                <Compass className="w-3 h-3 text-slate-500" />
              </div>
              Back to start
            </button>
          </div>

          {/* Auth footer */}
          <div className="px-3 pb-3 pt-1 border-t border-slate-100">
            {user ? (
              <button
                onClick={async () => { await signOutUser(); onSignOut(); setOpen(false); }}
                className="w-full flex items-center justify-center gap-2 py-2 text-[11px] font-bold text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign out
              </button>
            ) : (
              <button
                onClick={() => { setOpen(false); setShowAuth(true); }}
                className="w-full flex items-center justify-center gap-2 py-2 text-[11px] font-bold text-primary border border-primary/25 bg-primary/5 hover:bg-primary/10 rounded-lg transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                Sign in
              </button>
            )}
          </div>
        </div>
      )}
      {showAuth && <AuthModalSimple onClose={() => setShowAuth(false)} />}
    </div>
  );
}

// ─── Auth modal for Chronos ───────────────────────────────────────────────────
function AuthModalSimple({ onClose }: { onClose: () => void }) {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) { setError('Email and password are required.'); return; }
    setError(null); setLoading(true);
    const result = mode === 'signin' ? await signIn(email.trim(), password) : await signUp(email.trim(), password);
    setLoading(false);
    if (result.success) onClose();
    else setError(result.error || 'Authentication failed.');
  };

  const handleGoogle = async () => {
    setError(null); setLoading(true);
    const result = await signInWithGoogle();
    setLoading(false);
    if (result.success) onClose();
    else setError(result.error || 'Google sign-in failed.');
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-sm bg-white rounded-xl overflow-hidden"
        style={{ boxShadow: '0 24px 60px -8px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)' }}
      >
        {/* Top accent bar */}
        <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #ec5b13, #f5844a)' }} />

        <div className="px-8 pt-7 pb-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="size-6 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Navigation className="w-3 h-3 text-primary" />
                </div>
                <span className="text-[11px] font-extrabold tracking-[0.18em] uppercase text-slate-400">Itinerary</span>
              </div>
              <h2 className="text-[22px] font-extrabold text-slate-900 tracking-tight leading-none">
                {mode === 'signin' ? 'Welcome back' : 'Get started'}
              </h2>
              <p className="text-[11px] text-slate-400 mt-1.5 font-medium">
                {mode === 'signin' ? 'Sign in to sync your trips' : 'Create your free account'}
              </p>
            </div>
            <button onClick={onClose} aria-label="Close dialog"
              className="size-9 flex items-center justify-center rounded-lg text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition-all -mt-1 -mr-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Mode tabs */}
          <div className="flex gap-4 mb-5 border-b border-slate-100">
            {(['signin', 'signup'] as const).map((m) => (
              <button key={m} type="button"
                onClick={() => { setMode(m); setError(null); }}
                className={`pb-3 text-[11px] font-extrabold tracking-wider uppercase transition-all border-b-2 -mb-px ${
                  mode === m ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                {m === 'signin' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300 pointer-events-none" />
              <input
                type="email" placeholder="Email address" value={email}
                onChange={(e) => setEmail(e.target.value)} autoFocus
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none transition-all focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/10 placeholder:text-slate-300 font-medium text-slate-800"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'} placeholder="Password" value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none transition-all focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/10 placeholder:text-slate-300 font-medium text-slate-800"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-300 hover:text-slate-500 transition-colors"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5">
                <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-red-600 font-semibold leading-relaxed">{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-2.5 text-sm font-extrabold text-white rounded-xl transition-all disabled:opacity-50 relative overflow-hidden group mt-1"
              style={{ background: 'linear-gradient(135deg, #ec5b13 0%, #d44e0f 100%)', boxShadow: '0 4px 14px -2px rgba(236,91,19,0.4)' }}
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {loading
                  ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Please wait…</>
                  : mode === 'signin' ? 'Sign In' : 'Create Account'}
              </span>
              <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors" />
            </button>
          </form>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-slate-100" />
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-widest">or</span>
            <div className="flex-1 h-px bg-slate-100" />
          </div>

          <button type="button" onClick={handleGoogle} disabled={loading}
            className="w-full py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50 flex items-center justify-center gap-2.5"
          >
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <p className="text-[11px] text-center text-slate-400 mt-4">
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button type="button"
              onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); }}
              className="text-primary font-bold hover:underline"
            >{mode === 'signin' ? 'Sign up free' : 'Sign in'}</button>
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Merge dialog ─────────────────────────────────────────────────────────────
function MergeDialog({ localCount, cloudCount, cloudTripNames, localTripNames, onMerge, onKeepLocal, onUseCloud, onDismiss }: {
  localCount: number;
  cloudCount: number;
  cloudTripNames: string[];
  localTripNames: string[];
  onMerge: () => void;
  onKeepLocal: () => void;
  onUseCloud: () => void;
  onDismiss: () => void;
}) {
  return createPortal(
    <div className="fixed inset-0 bg-black/30 z-[200] flex items-end sm:items-center justify-center p-4 sm:p-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Database className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-800 text-sm">Trips found in your account</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              You have <strong className="text-slate-700">{localCount} local</strong> and{' '}
              <strong className="text-slate-700">{cloudCount} cloud</strong> trips.
              What would you like to do?
            </p>
          </div>
        </div>

        {/* Trip name lists */}
        <div className="grid grid-cols-2 gap-2 mb-4 text-[11px]">
          <div className="bg-slate-50 rounded-lg px-3 py-2">
            <span className="font-bold text-slate-500 uppercase tracking-wide text-[11px]">Local</span>
            <ul className="mt-1 space-y-0.5">
              {localTripNames.map((name, i) => (
                <li key={i} className="text-slate-700 truncate">{name || 'Untitled trip'}</li>
              ))}
            </ul>
          </div>
          <div className="bg-primary/5 rounded-lg px-3 py-2">
            <span className="font-bold text-primary/60 uppercase tracking-wide text-[11px]">Cloud</span>
            <ul className="mt-1 space-y-0.5">
              {cloudTripNames.map((name, i) => (
                <li key={i} className="text-slate-700 truncate">{name || 'Untitled trip'}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-2">
          <button
            onClick={onMerge}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/90 transition-colors"
          >
            <span>Merge everything</span>
            <span className="opacity-70 font-normal">{localCount + cloudCount} trips total</span>
          </button>
          <button
            onClick={onKeepLocal}
            className="w-full flex items-center justify-between px-4 py-2.5 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors"
          >
            <span>Keep local only</span>
            <span className="text-slate-400 font-normal">overwrite cloud</span>
          </button>
          <button
            onClick={onUseCloud}
            className="w-full flex items-center justify-between px-4 py-2.5 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors"
          >
            <span>Use cloud only</span>
            <span className="text-slate-400 font-normal">discard local</span>
          </button>
        </div>

        <button
          onClick={onDismiss}
          className="mt-3 w-full text-center text-[11px] text-slate-400 hover:text-slate-600 transition-colors py-1"
        >
          Decide later
        </button>
      </div>
    </div>,
    document.body,
  );
}

// ─── Import from code dialog ──────────────────────────────────────────────────
function ImportFromCodeDialog({ onImport, onClose }: {
  onImport: (trip: HybridTrip) => void;
  onClose: () => void;
}) {
  const [code, setCode] = useState(() => localStorage.getItem('last-trip-passcode') ?? '');
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'loading'; message: string } | null>(null);

  const handleLoad = async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      setStatus({ type: 'error', message: 'Please enter a code.' });
      return;
    }

    setStatus({ type: 'loading', message: 'Loading...' });
    const result = await loadItinerary(trimmed);

    if (!result.success || !result.data) {
      setStatus({ type: 'error', message: result.error || 'No trip found with this code.' });
      return;
    }

    localStorage.setItem('last-trip-passcode', trimmed);
    const data = result.data as Record<string, unknown>;

    let trip: HybridTrip;
    try {
      if (data.stays && data.name) {
        // Already in HybridTrip format
        trip = data as unknown as HybridTrip;
      } else if (data.days && data.locations) {
        // Legacy format — convert
        const legacy: LegacyStoredTrip = {
          id: crypto.randomUUID(),
          name: `Imported (${trimmed})`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          startDate: (data.startDate as string) ?? '2025-01-01',
          endDate: (data.endDate as string) ?? '2025-01-01',
          days: (data.days as LegacyDay[]) ?? [],
          locations: (data.locations as LegacyLocation[]) ?? [],
          routes: (data.routes as LegacyRoute[]) ?? [],
          version: (data.version as string) ?? '1.0',
        };
        trip = legacyTripToHybrid(legacy);
      } else {
        setStatus({ type: 'error', message: 'Unrecognized trip format.' });
        return;
      }
    } catch (e) {
      console.error('[ImportFromCode] conversion failed:', e);
      setStatus({ type: 'error', message: 'Failed to convert trip data.' });
      return;
    }

    // Ensure unique ID
    trip = normalizeTrip({ ...trip, id: crypto.randomUUID() });
    setStatus({ type: 'success', message: `Loaded "${trip.name}"!` });
    setTimeout(() => {
      onImport(trip);
      onClose();
    }, 800);
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/30 z-[200] flex items-end sm:items-center justify-center p-4 sm:p-6" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="size-9 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Download className="w-4 h-4 text-violet-500" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-800 text-sm">Import from code</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Enter a share code to import a trip. It will be added as a new trip.
            </p>
          </div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleLoad(); }}>
          <input
            type="text"
            value={code}
            onChange={(e) => { setCode(e.target.value.toUpperCase()); setStatus(null); }}
            placeholder="e.g. TRIP-ABCD"
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-mono font-bold text-center tracking-widest placeholder:tracking-normal placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            autoFocus
          />

          {status && (
            <div className={`mt-3 flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
              status.type === 'success' ? 'bg-emerald-50 text-emerald-700' :
              status.type === 'error' ? 'bg-red-50 text-red-600' :
              'bg-blue-50 text-blue-600'
            }`}>
              {status.type === 'success' ? <Check className="w-3.5 h-3.5" /> :
               status.type === 'error' ? <AlertCircle className="w-3.5 h-3.5" /> :
               <Search className="w-3.5 h-3.5 animate-spin" />}
              {status.message}
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={status?.type === 'loading' || status?.type === 'success'}
              className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              Import
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

// ─── Welcome screen ───────────────────────────────────────────────────────────
function WelcomeScreen({ onCreateTrip, onLoadDemo }: { onCreateTrip: () => void; onLoadDemo: () => void }) {
  const { user, signInWithGoogle } = useAuth();

  const stayPreviews = [
    { left: '4%', width: '28%', color: '#2167d7', label: 'Tokyo' },
    { left: '35%', width: '20%', color: '#615cf6', label: 'Kyoto' },
    { left: '58%', width: '32%', color: '#d78035', label: 'Osaka' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="flex h-14 items-center justify-between border-b border-slate-100 px-6 bg-white/80 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-2.5 text-primary">
          <div className="size-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Compass className="w-4 h-4 text-primary" />
          </div>
          <span className="text-sm font-extrabold tracking-tight">Itinerary</span>
        </div>
        {!user && (
          <button
            onClick={signInWithGoogle}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-primary transition-colors"
          >
            <LogIn className="w-3.5 h-3.5" />
            Sign in
          </button>
        )}
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="max-w-md w-full">

          {/* Decorative timeline preview */}
          <div className="mb-10 relative h-16 w-full select-none">
            {/* Track line */}
            <div className="absolute inset-y-0 left-0 right-0 flex items-center pointer-events-none">
              <div className="h-px w-full bg-slate-200" />
            </div>
            {/* Stay blocks */}
            {stayPreviews.map((s, i) => (
              <div
                key={i}
                className="absolute h-10 rounded-lg flex items-center px-3 gap-2"
                style={{
                  left: s.left, width: s.width, top: '50%', transform: 'translateY(-50%)',
                  background: `color-mix(in srgb, ${s.color} 10%, white)`,
                  border: `1.5px solid color-mix(in srgb, ${s.color} 28%, transparent)`,
                }}
              >
                <div className="w-1 h-5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                <span className="text-[11px] font-bold truncate" style={{ color: s.color }}>{s.label}</span>
              </div>
            ))}
            {/* Transit chips */}
            {[{ left: '33%', mode: 'train' as const }, { left: '56%', mode: 'flight' as const }].map((chip) => (
              <div
                key={chip.left}
                className="absolute flex items-center justify-center"
                style={{ left: chip.left, top: '50%', transform: 'translate(-50%, -50%)' }}
              >
                <div className="bg-white border border-slate-200 rounded-full p-1.5 shadow-sm z-10">
                  <TransportIcon mode={chip.mode} className="w-3 h-3 text-slate-400" />
                </div>
              </div>
            ))}
          </div>

          <h1 className="text-[2.6rem] font-black text-slate-900 tracking-tight leading-none mb-3">
            Plan your next<br />
            <span className="text-primary">adventure.</span>
          </h1>
          <p className="text-slate-500 text-sm leading-relaxed mb-8 max-w-sm">
            A visual day-by-day planner with a timeline, interactive map,
            and AI-powered suggestions.
          </p>

          <div className="flex items-center gap-3">
            <button
              onClick={onCreateTrip}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-primary hover:bg-primary/90 rounded-lg transition-all shadow-sm shadow-primary/20 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Plan a trip
            </button>
            <button
              onClick={onLoadDemo}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-600 border border-slate-200 bg-white rounded-lg hover:shadow-sm hover:border-slate-300 transition-all"
            >
              See a demo
            </button>
          </div>

          {!user && (
            <p className="mt-6 text-[11px] text-slate-400">
              Trips are saved locally.{' '}
              <button onClick={signInWithGoogle} className="text-primary font-semibold hover:underline">
                Sign in
              </button>{' '}
              to sync across devices.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

// ─── CHRONOS App ──────────────────────────────────────────────────────────────
function ChronosApp() {
  // ── Store (multi-trip) ───────────────────────────────────────────────────
  const [store, setStore] = useState<TripStore>(() => loadStore());
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [pendingMerge, setPendingMerge] = useState<{ cloudTrips: HybridTrip[]; cloudActiveTripId: string } | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const syncedUidRef = useRef<string | null>(null);
  const storeRef = useRef(store);
  useEffect(() => { storeRef.current = store; }, [store]);

  const trip = useMemo(
    () => store.trips.find((t) => t.id === store.activeTripId) ?? store.trips[0] ?? EMPTY_TRIP,
    [store],
  );

  const updateTrip = useCallback((updater: (t: HybridTrip) => HybridTrip) => {
    setStore((s) => {
      const updated = s.trips.map((t) => t.id === trip.id ? updater(t) : t);
      const next = { ...s, trips: updated };
      saveStore(next);
      return next;
    });
  }, [trip.id]);

  // ── Auto-fetch Unsplash photos ────────────────────────────────────────────
  const updateTripRef = useRef(updateTrip);
  useEffect(() => { updateTripRef.current = updateTrip; }, [updateTrip]);

  useEffect(() => {
    if (!import.meta.env.VITE_UNSPLASH_ACCESS_KEY) return;
    const staysNeedingImages = trip.stays.filter((s) => !s.imageUrl);
    if (staysNeedingImages.length === 0) return;
    staysNeedingImages.forEach(async (stay) => {
      const url = await searchPhoto(`${stay.name} city travel`);
      if (url) updateTripRef.current((t) => ({ ...t, stays: t.stays.map((s) => s.id === stay.id ? { ...s, imageUrl: url } : s) }));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.stays.map((s) => `${s.id}:${s.imageUrl ?? ''}`).join('|')]);

  // Sync with history
  const hist = useHistory(trip);

  const setTrip = useCallback((fn: ((t: HybridTrip) => HybridTrip) | HybridTrip) => {
    const next = typeof fn === 'function' ? fn(trip) : fn;
    hist.push(next);
    updateTrip(() => next);
  }, [trip, hist, updateTrip]);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [selectedStayId, setSelectedStayId] = useState<string>(trip.stays[0]?.id ?? '');
  const [sidebarTab, setSidebarTab] = useState<'overview' | 'unplanned'>('unplanned');
  const [hoveredStayId, setHoveredStayId] = useState<string | null>(null);
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mapExpanded, setMapExpanded] = useState(() => localStorage.getItem('itinerary-map-expanded') === '1');
  const [mapCollapsed, setMapCollapsed] = useState(() => localStorage.getItem('itinerary-map-collapsed') === '1');
  const [mapMini, setMapMini] = useState(() => localStorage.getItem('itinerary-map-mini') === '1');
  useEffect(() => { localStorage.setItem('itinerary-map-expanded', mapExpanded ? '1' : '0'); }, [mapExpanded]);
  useEffect(() => { localStorage.setItem('itinerary-map-collapsed', mapCollapsed ? '1' : '0'); }, [mapCollapsed]);
  useEffect(() => { localStorage.setItem('itinerary-map-mini', mapMini ? '1' : '0'); }, [mapMini]);
  const [mapAnimClass, setMapAnimClass] = useState('');
  const triggerMapAnim = useCallback((cls: string) => {
    setMapAnimClass(cls);
    const timer = setTimeout(() => setMapAnimClass(''), 500);
    return () => clearTimeout(timer);
  }, []);
  const [mapWidth, setMapWidth] = useState(() => {
    const saved = localStorage.getItem('itinerary-map-width');
    return saved ? Number(saved) : 500;
  });
  const mapResizingRef = useRef<{ startX: number; startWidth: number; currentWidth: number } | null>(null);
  const mapPanelRef = useRef<HTMLElement>(null);
  const startMapResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    mapResizingRef.current = { startX: e.clientX, startWidth: mapWidth, currentWidth: mapWidth };
    const onMove = (ev: MouseEvent) => {
      if (!mapResizingRef.current) return;
      const newWidth = Math.min(900, Math.max(280, mapResizingRef.current.startWidth + (mapResizingRef.current.startX - ev.clientX)));
      mapResizingRef.current.currentWidth = newWidth;
      setMapWidth(newWidth);
    };
    const onUp = () => {
      if (mapResizingRef.current) {
        localStorage.setItem('itinerary-map-width', String(mapResizingRef.current.currentWidth));
      }
      mapResizingRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [mapWidth]);
  const [mapMode, setMapMode] = useState<'overview' | 'stay' | 'detail'>('overview');
  const [mapDayFilter, setMapDayFilter] = useState<number | null>(null);
  const [zoomDays, setZoomDays] = useState(() => {
    const saved = localStorage.getItem('itinerary-timeline-zoom');
    const v = saved ? Number(saved) : 0;
    // Clamp: if saved zoom exceeds trip length, fall back to ALL
    return v !== 0 && v > trip.totalDays ? 0 : v;
  });
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [editingRouteStayId, setEditingRouteStayId] = useState<string | null>(null);
  const [editingStayId, setEditingStayId] = useState<string | null>(null);
  const [addingVisitToSlot, setAddingVisitToSlot] = useState<{ dayOffset: number; part: DayPart } | null>(null);
  const [editingVisit, setEditingVisit] = useState<VisitItem | null>(null);
  const [addingToInbox, setAddingToInbox] = useState(false);
  const [editingAccommodation, setEditingAccommodation] = useState<{ group: AccommodationGroup } | { dayOffset: number } | null>(null);
  const [showTripSwitcher, setShowTripSwitcher] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showTripEditor, setShowTripEditor] = useState(false);
  const [addingStay, setAddingStay] = useState(false);
  const [timelineHoverDay, setTimelineHoverDay] = useState<number | null>(null);
  const [timelineDragCreate, setTimelineDragCreate] = useState<{ startSlot: number; currentSlot: number } | null>(null);
  const [pendingTimelineSlot, setPendingTimelineSlot] = useState<{ startSlot: number; days: number } | null>(null);
  const timelineZoneRef = useRef<HTMLDivElement>(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const mobileSearchRef = useRef<HTMLInputElement>(null);
  const [showAIPlanner, setShowAIPlanner] = useState(false);
  const [showImportCode, setShowImportCode] = useState(false);
  const [aiSettings, setAiSettings] = useState<{ apiKey: string; model: string }>(() => {
    const saved = localStorage.getItem('chronos-ai-settings');
    return saved ? JSON.parse(saved) : { apiKey: '', model: 'gemini-2.0-flash' };
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 12 } }),
  );

  // Keyboard shortcuts (Ctrl+Z / Ctrl+Y)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        const prev = hist.undo();
        if (prev) updateTrip(() => prev);
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        const next = hist.redo();
        if (next) updateTrip(() => next);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [hist, updateTrip]);

  useEffect(() => { setMapDayFilter(null); setMapMode(selectedStayId ? 'stay' : 'overview'); }, [selectedStayId]);


  // ── Cloud sync: load on login ─────────────────────────────────────────────
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    if (syncedUidRef.current === user.uid) return; // already handled this session
    syncedUidRef.current = user.uid;

    (async () => {
      const result = await loadUserTripStore(user.uid);
      if (!result.success) {
        setSyncError(result.error || 'Could not load your trips from the cloud. Your local trips are safe.');
        return;
      }

      const currentStore = storeRef.current;

      if (!result.exists) {
        // First sign-in — upload local trips to cloud silently
        if (currentStore.trips.length > 0) saveUserTripStore(user.uid, currentStore);
        return;
      }

      const cloudStore = result.data as TripStore;
      const cloudTrips: HybridTrip[] = (cloudStore?.trips ?? []).map(normalizeTrip);
      const localIds = new Set(currentStore.trips.map((t) => t.id));
      const cloudOnlyTrips = cloudTrips.filter((t) => !localIds.has(t.id));

      if (cloudOnlyTrips.length === 0) {
        // No new cloud trips — push local state up
        if (currentStore.trips.length > 0) saveUserTripStore(user.uid, currentStore);
        return;
      }

      if (currentStore.trips.length === 0) {
        // No local trips — simply pull cloud
        const next: TripStore = {
          trips: cloudTrips,
          activeTripId: cloudStore.activeTripId ?? cloudTrips[0]?.id ?? '',
        };
        setStore(next);
        saveStore(next);
        return;
      }

      // Both sides have unique trips — ask the user
      setPendingMerge({ cloudTrips: cloudOnlyTrips, cloudActiveTripId: cloudStore.activeTripId ?? '' });
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  // ── Cloud sync: auto-save on store change ─────────────────────────────────
  const [syncStatus, setSyncStatus] = useState<'saved' | 'saving' | 'error' | 'local'>('local');
  useEffect(() => {
    if (!user || isDemoMode) { setSyncStatus('local'); return; }
    if (pendingMerge) return;
    setSyncStatus('saving');
    const timer = setTimeout(async () => {
      try {
        await saveUserTripStore(user.uid, store);
        setSyncStatus('saved');
      } catch {
        setSyncStatus('error');
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [store, user, isDemoMode, pendingMerge]);

  // ── Derived values ────────────────────────────────────────────────────────
  const sortedStays = useMemo(() => [...trip.stays].sort((a, b) => a.startSlot - b.startSlot), [trip.stays]);
  const overlaps = useMemo(() => getOverlapIds(sortedStays), [sortedStays]);
  const selectedStay = useMemo(
    () => selectedStayId ? (sortedStays.find((s) => s.id === selectedStayId) ?? null) : null,
    [selectedStayId, sortedStays],
  );
  const stayDays = useMemo(() => selectedStay ? deriveStayDays(trip, selectedStay) : [], [selectedStay, trip]);
  const overviewStays = useMemo(() =>
    sortedStays.map(s => ({
      id: s.id, name: s.name, color: s.color,
      centerLat: s.centerLat, centerLng: s.centerLng,
      travelModeToNext: s.travelModeToNext,
      travelDurationToNext: s.travelDurationToNext,
    })),
    [sortedStays]
  );
  const dayFilterOptions = useMemo(() =>
    stayDays.map(d => ({ dayOffset: d.dayOffset, label: `Day ${d.dayOffset + 1}` })),
    [stayDays]
  );
  const accommodationGroups = useMemo(() => deriveAccommodationGroups(stayDays), [stayDays]);
  const existingAccommodationNames = useMemo(() => {
    const names = new Set<string>();
    trip.stays.forEach((s) => {
      if (s.lodging) names.add(s.lodging);
      if (s.nightAccommodations) Object.values(s.nightAccommodations).forEach((a) => { if (a.name) names.add(a.name); });
    });
    return Array.from(names);
  }, [trip.stays]);
  const searchTerm = searchQuery.trim().toLowerCase();

  const inboxVisits = useMemo(() => {
    if (!selectedStay) return [];
    return selectedStay.visits
      .filter((v) => v.dayOffset === null || v.dayPart === null)
      .filter((v) => !searchTerm || v.name.toLowerCase().includes(searchTerm))
      .sort((a, b) => a.order - b.order);
  }, [selectedStay, searchTerm]);

  const mapVisits = useMemo(() => {
    if (!selectedStay) return [];
    let scheduled = selectedStay.visits.filter((v) => v.dayOffset !== null && v.dayPart !== null);
    if (mapMode === 'detail' && mapDayFilter !== null) {
      scheduled = scheduled.filter((v) => v.dayOffset === mapDayFilter);
    }
    return sortVisits(scheduled);
  }, [selectedStay, mapDayFilter, mapMode]);

  // ── Timeline drag ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!dragState) return;
    const zone = timelineZoneRef.current;
    const numDays = zoomDays === 0 ? trip.totalDays : zoomDays;
    const slotWidth = (zone?.clientWidth ?? numDays * 42) / (numDays * 3);

    const applyDelta = (clientX: number) => {
      const delta = Math.round((clientX - dragState.originX) / slotWidth);
      setTrip((curr) => ({
        ...curr,
        stays: applyTimelineDrag(curr.stays, dragState, delta, curr.totalDays * 3),
      }));
    };
    const onMove = (e: MouseEvent) => applyDelta(e.clientX);
    const onTouchMove = (e: TouchEvent) => { e.preventDefault(); applyDelta(e.touches[0].clientX); };
    const onUp = () => setDragState(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [dragState, zoomDays, trip.totalDays]);

  // ── Auto-fetch visit photos for selected stay ─────────────────────────────
  useEffect(() => {
    if (!import.meta.env.VITE_UNSPLASH_ACCESS_KEY || !selectedStay) return;
    const visitsNeedingImages = selectedStay.visits.filter((v) => !v.imageUrl);
    if (visitsNeedingImages.length === 0) return;
    const stayId = selectedStay.id;
    visitsNeedingImages.forEach(async (visit) => {
      const url = await searchPhoto(visit.name);
      if (url) updateTripRef.current((t) => ({ ...t, stays: t.stays.map((s) => s.id === stayId ? { ...s, visits: s.visits.map((v) => v.id === visit.id ? { ...v, imageUrl: url } : v) } : s) }));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStay?.id, selectedStay?.visits.map((v) => `${v.id}:${v.imageUrl ?? ''}`).join('|')]);

  // ── Mutators ──────────────────────────────────────────────────────────────
  const updateSelectedStay = (fn: (s: Stay) => Stay) => {
    if (!selectedStay) return;
    setTrip((curr) => ({ ...curr, stays: curr.stays.map((s) => s.id === selectedStay.id ? fn(s) : s) }));
  };

  const scheduleVisit = (visitId: string, targetDayOffset: number | null, targetPart: DayPart | null) => {
    if (!selectedStay) return;
    updateSelectedStay((stay) => {
      const moving = stay.visits.find((v) => v.id === visitId);
      if (!moving) return stay;
      const rest = stay.visits.filter((v) => v.id !== visitId);
      return { ...stay, visits: normalizeVisitOrders([...rest, { ...moving, dayOffset: targetDayOffset, dayPart: targetPart, order: 9999 }]) };
    });
  };

  const reorderVisits = (aId: string, bId: string) => {
    if (!selectedStay) return;
    updateSelectedStay((stay) => {
      const aVisit = stay.visits.find((v) => v.id === aId);
      if (!aVisit) return stay;
      // Operate only on the visits in this slot, preserving order values elsewhere
      const slotVisits = stay.visits
        .filter((v) => v.dayOffset === aVisit.dayOffset && v.dayPart === aVisit.dayPart)
        .sort((a, b) => a.order - b.order);
      const fromIdx = slotVisits.findIndex((v) => v.id === aId);
      const toIdx = slotVisits.findIndex((v) => v.id === bId);
      if (fromIdx === -1 || toIdx === -1) return stay;
      const reordered = arrayMove(slotVisits, fromIdx, toIdx);
      const newOrders = new Map(reordered.map((v, i) => [v.id, i]));
      return {
        ...stay,
        visits: stay.visits.map((v) => newOrders.has(v.id) ? { ...v, order: newOrders.get(v.id)! } : v),
      };
    });
  };

  // ── DnD ───────────────────────────────────────────────────────────────────
  const handleDragStart = ({ active }: DragStartEvent) => setActiveId(active.id as string);

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over || !selectedStay) return;
    const aId = active.id as string;
    const oId = over.id as string;
    const visitId = aId.slice(6); // works for both 'inbox-' (6) and 'visit-' (6)

    // Dropped directly onto a slot container
    if (oId.startsWith('slot-')) {
      const parts = oId.split('-');
      scheduleVisit(visitId, parseInt(parts[1]), parts[2] as DayPart);
      return;
    }

    // Dropped onto another visit card (common when slot is populated)
    if (oId.startsWith('visit-')) {
      const targetVisitId = oId.slice(6);
      const targetVisit = selectedStay.visits.find((v) => v.id === targetVisitId);
      if (!targetVisit) return;

      if (aId.startsWith('inbox-')) {
        // Unplanned card → place in target visit's slot
        if (targetVisit.dayOffset !== null && targetVisit.dayPart !== null) {
          scheduleVisit(visitId, targetVisit.dayOffset, targetVisit.dayPart);
        }
        return;
      }

      // Scheduled visit → another visit
      const activeVisit = selectedStay.visits.find((v) => v.id === visitId);
      if (!activeVisit) return;
      if (activeVisit.dayOffset === targetVisit.dayOffset && activeVisit.dayPart === targetVisit.dayPart) {
        // Same slot → reorder
        reorderVisits(visitId, targetVisitId);
      } else {
        // Different slot → move there
        scheduleVisit(visitId, targetVisit.dayOffset, targetVisit.dayPart);
      }
    }
  };

  // ── Trip management ───────────────────────────────────────────────────────
  const handleNewTrip = () => {
    const sample: HybridTrip = { id: `trip-${Date.now()}`, name: 'New Trip', stays: [], startDate: '', totalDays: 7 };
    setStore((s) => {
      const next = { trips: [...s.trips, sample], activeTripId: sample.id };
      saveStore(next);
      return next;
    });
    setSelectedStayId('');
  };

  const handleLoadDemo = () => {
    const sample = createSampleTrip();
    const next = { trips: [sample], activeTripId: sample.id };
    setStore(next); // intentionally NOT saved to localStorage
    setIsDemoMode(true);
    setSelectedStayId(sample.stays[0]?.id ?? '');
  };

  const handleMakeMine = () => {
    saveStore(store);
    setIsDemoMode(false);
  };

  const handleGoHome = () => {
    setStore({ trips: [], activeTripId: '' });
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    setIsDemoMode(false);
    setSelectedStayId('');
  };

  const handleSignOut = () => {
    setStore({ trips: [], activeTripId: '' });
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    setIsDemoMode(false);
    setSelectedStayId('');
    setPendingMerge(null);
    setSyncError(null);
    syncedUidRef.current = null;
  };

  const handleMergeDecision = (decision: 'merge' | 'keep-local' | 'use-cloud') => {
    if (!pendingMerge || !user) { setPendingMerge(null); return; }
    const { cloudTrips, cloudActiveTripId } = pendingMerge;

    let next: TripStore;
    if (decision === 'merge') {
      const merged = [...store.trips, ...cloudTrips];
      next = { trips: merged, activeTripId: store.activeTripId || (merged[0]?.id ?? '') };
    } else if (decision === 'keep-local') {
      next = store;
    } else {
      // use-cloud: replace local with cloud trips + any local-only trips we discard
      next = { trips: cloudTrips, activeTripId: cloudActiveTripId || (cloudTrips[0]?.id ?? '') };
      setSelectedStayId('');
    }

    // Dismiss modal first so it always closes even if saves fail
    setPendingMerge(null);
    setStore(next);
    try {
      saveStore(next);
    } catch (e) {
      console.error('[MergeDecision] saveStore failed:', e);
    }
    saveUserTripStore(user.uid, next);
  };

  const handleSwitchTrip = (id: string) => {
    setStore((s) => { const next = { ...s, activeTripId: id }; saveStore(next); return next; });
    setSelectedStayId('');
  };

  const handleImportFromCode = (importedTrip: HybridTrip) => {
    setStore((s) => {
      const next = { trips: [...s.trips, importedTrip], activeTripId: importedTrip.id };
      saveStore(next);
      return next;
    });
    setSelectedStayId('');
  };

  // ── Render helpers ────────────────────────────────────────────────────────
  const numDays = zoomDays === 0 ? trip.totalDays : zoomDays;

  // ── Timeline drag-to-create helpers ──────────────────────────────────────
  const numSlots = numDays * 3;

  const getSlotFromClientX = useCallback((clientX: number): number => {
    const el = timelineZoneRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const innerLeft = rect.left + rect.width * 0.01;
    const innerWidth = rect.width * 0.98;
    const ratio = Math.max(0, Math.min(1, (clientX - innerLeft) / innerWidth));
    return Math.min(numSlots - 1, Math.floor(ratio * numSlots));
  }, [numSlots]);

  const isSlotRangeEmpty = useCallback((startSlot: number, endSlotExcl: number): boolean => {
    return !sortedStays.some((s) => s.startSlot < endSlotExcl && s.endSlot > startSlot);
  }, [sortedStays]);

  useEffect(() => {
    const handleMouseUp = () => {
      if (!timelineDragCreate) return;
      const { startSlot, currentSlot } = timelineDragCreate;
      const minSlot = Math.min(startSlot, currentSlot);
      const maxSlot = Math.max(startSlot, currentSlot);
      if (isSlotRangeEmpty(minSlot, maxSlot + 1)) {
        setPendingTimelineSlot({ startSlot: minSlot, days: Math.max(1, Math.ceil((maxSlot - minSlot + 1) / 3)) });
        setAddingStay(true);
      }
      setTimelineDragCreate(null);
    };
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [timelineDragCreate, isSlotRangeEmpty]);
  const dayLabels = Array.from({ length: numDays }, (_, i) => {
    const d = addDaysTo(safeDate(trip.startDate), i);
    return {
      date: fmt(d, { month: 'short', day: 'numeric' }),
      weekday: fmt(d, { weekday: 'short' }),
    };
  });
  const bufferBefore = (() => {
    const d = addDaysTo(safeDate(trip.startDate), -1);
    return { date: fmt(d, { month: 'short', day: 'numeric' }), weekday: fmt(d, { weekday: 'short' }) };
  })();
  const bufferAfter = (() => {
    const d = addDaysTo(safeDate(trip.startDate), trip.totalDays);
    return { date: fmt(d, { month: 'short', day: 'numeric' }), weekday: fmt(d, { weekday: 'short' }) };
  })();
  const displayDays = numDays + 2;

  const handleExtendBefore = () => setTrip((t) => extendTripBefore(t));
  const handleExtendAfter = () => setTrip((t) => extendTripAfter(t));
  const canShrinkBefore = trip.totalDays > 1 && !sortedStays.some((s) => s.startSlot < 3);
  const canShrinkAfter = trip.totalDays > 1 && !sortedStays.some((s) => s.endSlot > (trip.totalDays - 1) * 3);
  const handleShrinkBefore = () => { const r = shrinkTripBefore(trip); if (r) setTrip(r); };
  const handleShrinkAfter = () => { const r = shrinkTripAfter(trip); if (r) setTrip(r); };

  const tripStartLabel = fmt(safeDate(trip.startDate), { month: 'short', day: 'numeric' });

  const editingRouteStay = editingRouteStayId ? sortedStays.find((s) => s.id === editingRouteStayId) ?? null : null;
  const editingRouteNextStay = editingRouteStay
    ? sortedStays[sortedStays.indexOf(editingRouteStay) + 1] ?? null
    : null;

  const activeInboxVisit = activeId?.startsWith('inbox-') ? inboxVisits.find((v) => `inbox-${v.id}` === activeId) : null;
  const activeScheduledVisit = activeId?.startsWith('visit-') && selectedStay ? selectedStay.visits.find((v) => `visit-${v.id}` === activeId) : null;

  // ── Welcome screen for first-time users ──────────────────────────────────
  if (store.trips.length === 0) {
    return (
      <WelcomeScreen
        onCreateTrip={() => { handleNewTrip(); setShowTripEditor(true); }}
        onLoadDemo={handleLoadDemo}
      />
    );
  }

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex h-dvh w-full flex-col overflow-hidden bg-background-light text-slate-900 font-sans">

        {/* ── Header ── */}
        <header className="relative flex h-11 items-center justify-between border-b border-border-neutral px-4 bg-white/80 backdrop-blur-md z-50 flex-shrink-0 gap-2">

          {/* ── Mobile search overlay ── */}
          {mobileSearchOpen && (
            <div className="md:hidden absolute inset-0 bg-white/95 backdrop-blur-md z-10 flex items-center px-3 gap-2 animate-search-reveal">
              <Search className="w-4 h-4 text-primary flex-shrink-0" />
              <input
                ref={mobileSearchRef}
                autoFocus
                className="flex-1 text-sm bg-transparent outline-none text-slate-800 placeholder:text-slate-400 min-w-0"
                placeholder="Search places..."
                aria-label="Search places"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button
                onClick={() => { setMobileSearchOpen(false); setSearchQuery(''); }}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors flex-shrink-0"
                aria-label="Close search"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2.5 text-primary flex-shrink-0">
              <div className="size-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Compass className="w-4 h-4 text-primary" />
              </div>
              <span className="text-xs font-extrabold tracking-tight hidden sm:block">Itinerary</span>
            </div>
            <div className="h-5 w-px bg-slate-200 flex-shrink-0" />
            {/* Trip selector */}
            <button
              onClick={() => setShowTripSwitcher(true)}
              className="flex items-center gap-2 min-w-0 hover:bg-slate-50 rounded-lg px-2.5 py-1.5 -ml-1 transition-colors group"
            >
              <span className="text-xs font-bold text-slate-800 truncate max-w-[120px] sm:max-w-none">{trip.name}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 group-hover:text-slate-600 transition-colors" />
            </button>
            {/* Date range — full on desktop, compact on mobile */}
            <button
              onClick={() => setShowTripEditor(true)}
              className="hidden md:flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-50 border border-slate-200/60 px-2.5 py-1 rounded-lg transition-colors flex-shrink-0"
            >
              <span className="font-bold text-slate-700">{tripStartLabel}</span>
              <span className="text-slate-300">–</span>
              <span className="font-bold text-slate-700">{fmt(addDaysTo(safeDate(trip.startDate), trip.totalDays - 1), { month: 'short', day: 'numeric' })}</span>
              <span className="ml-0.5 text-[9px] font-extrabold text-primary bg-primary/8 px-1.5 py-0.5 rounded-md">{trip.totalDays}d</span>
            </button>
            <button
              onClick={() => setShowTripEditor(true)}
              className="md:hidden flex items-center gap-1 text-[9px] font-bold text-primary bg-primary/8 px-2 py-1 rounded-lg transition-colors flex-shrink-0"
            >
              <Calendar className="w-3 h-3" />
              {trip.totalDays}d
            </button>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {isDemoMode && (
              <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-lg pl-2.5 pr-1 py-1 text-[11px] font-bold text-slate-500 mr-1">
                <span className="hidden sm:inline">Demo</span>
                <button
                  onClick={handleMakeMine}
                  aria-label="Save demo trip to your trips"
                  className="px-2 py-0.5 bg-primary text-white rounded-md text-[11px] font-bold hover:bg-primary/90 transition-colors whitespace-nowrap"
                >
                  <span className="hidden sm:inline">Make it mine</span>
                  <span className="sm:hidden">Save</span>
                </button>
                <button
                  onClick={handleGoHome}
                  aria-label="Discard demo and start fresh"
                  className="hidden sm:block px-2 py-0.5 rounded-md text-[11px] font-semibold hover:bg-slate-200 transition-colors"
                >
                  Start fresh
                </button>
              </div>
            )}
            {overlaps.size > 0 && (
              <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 text-[11px] font-bold">
                <AlertCircle className="w-3 h-3 flex-shrink-0" />
                <span className="hidden sm:inline">{overlaps.size} conflict{overlaps.size > 1 ? 's' : ''}</span>
              </div>
            )}

            {/* Search — icon on mobile, input on desktop */}
            <button
              onClick={() => setMobileSearchOpen(true)}
              className="md:hidden p-2 text-slate-400 hover:text-primary hover:bg-slate-50 rounded-lg transition-colors"
              aria-label="Search"
            >
              <Search className="w-4 h-4" />
            </button>
            <div className="hidden md:flex relative items-center group">
              <Search className="absolute left-2.5 text-slate-400 w-3.5 h-3.5 group-focus-within:text-primary transition-colors" />
              <input
                className="bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs w-48 focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none"
                placeholder="Search places, flights..."
                aria-label="Search places"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 text-slate-400 hover:text-slate-600" aria-label="Clear search">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="h-5 w-px bg-slate-200 mx-1" />

            {/* Undo/Redo cluster */}
            <div className="flex items-center">
              <button
                onClick={() => { const p = hist.undo(); if (p) updateTrip(() => p); }}
                disabled={!hist.canUndo}
                title="Undo (Ctrl+Z)"
                aria-label="Undo"
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-40"
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => { const n = hist.redo(); if (n) updateTrip(() => n); }}
                disabled={!hist.canRedo}
                title="Redo (Ctrl+Y)"
                aria-label="Redo"
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-40"
              >
                <Redo2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowHistory(true)}
                disabled={!hist.canUndo && !hist.canRedo}
                title="View history"
                className="hidden sm:block p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-40"
              >
                <History className="w-4 h-4" />
              </button>
            </div>

            <div className="hidden sm:block h-5 w-px bg-slate-200 mx-1" />

            {/* AI Planner */}
            <button
              onClick={() => setShowAIPlanner(true)}
              title="AI Planner"
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors shadow-sm shadow-primary/20"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:block">AI</span>
            </button>
            {/* Profile menu */}
            <ProfileMenu trip={trip} onImport={(data) => setTrip(() => data)} onImportFromCode={() => setShowImportCode(true)} onGoHome={handleGoHome} onSignOut={handleSignOut} />
          </div>
        </header>

        {/* ── Sync error banner ── */}
        {syncError && (
          <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border-b border-red-100 text-xs text-red-700 flex-shrink-0 z-40">
            <CloudOff className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="flex-1">{syncError}</span>
            <button
              onClick={() => setSyncError(null)}
              className="p-0.5 hover:bg-red-100 rounded transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        <main className="flex-1 flex flex-col min-h-0 isolate">

          {/* ── Timeline ── */}
          <section className="border-b border-border-neutral flex flex-col bg-white flex-shrink-0 z-40" style={{ height: 140 }}>
            <div className="flex items-center justify-between px-6 border-b border-border-neutral bg-slate-50/50 py-1.5">
              <div className="flex items-center gap-4">
                <span className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-slate-500">Timeline</span>
                <div className="flex bg-white rounded-lg border border-border-neutral p-0.5 overflow-x-auto scroll-hide">
                  {([5, 10, 15, 30, 0] as const).filter((d) => d === 0 || d <= trip.totalDays).map((d) => (
                    <button key={d} onClick={() => { setZoomDays(d); localStorage.setItem('itinerary-timeline-zoom', String(d)); }}
                      className={`px-3 py-1.5 text-[9px] font-bold rounded-md transition-colors whitespace-nowrap ${zoomDays === d ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                      {d === 0 ? 'ALL' : `${d} DAYS`}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={() => setAddingStay(true)}
                className="size-8 flex items-center justify-center rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors"
                aria-label="Add stay"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex-1 relative overflow-x-auto overflow-y-hidden scroll-hide">
              <div data-timeline-track className="h-full" style={{ width: `${Math.max(100, (displayDays / ((zoomDays || numDays) + 2)) * 100)}%`, display: 'grid', gridTemplateColumns: `1fr repeat(${numDays}, 1fr) 1fr`, gridTemplateRows: '28px 1fr' }}>
                {/* Day labels — buffer before */}
                <div className="flex flex-col bg-slate-100/80 border-b border-r border-border-neutral">
                  <div className="flex-1 flex items-center justify-center gap-1 text-[9px] font-bold text-slate-300 uppercase tracking-tighter border-b border-slate-100">
                    <span className="text-slate-200">{bufferBefore.weekday}</span>
                    <span className="text-slate-300">{bufferBefore.date}</span>
                  </div>
                  <div className="flex h-3 divide-x divide-slate-100">
                    {['M', 'A', 'E'].map((p) => (
                      <div key={p} className="flex-1 flex items-center justify-center text-[9px] font-semibold text-slate-200">{p}</div>
                    ))}
                  </div>
                </div>
                {/* Day labels — trip days */}
                {dayLabels.map(({ date, weekday }, i) => (
                  <div key={i} className="flex flex-col border-b border-r border-border-neutral bg-slate-50/30">
                    <div className="flex-1 flex items-center justify-center gap-1 text-[9px] font-bold text-slate-400 uppercase tracking-tighter border-b border-slate-100">
                      <span className="text-slate-300">{weekday}</span>
                      <span>{date}</span>
                    </div>
                    <div className="flex h-3 divide-x divide-slate-100">
                      {['M', 'A', 'E'].map((p) => (
                        <div key={p} className="flex-1 flex items-center justify-center text-[9px] font-semibold text-slate-300">{p}</div>
                      ))}
                    </div>
                  </div>
                ))}
                {/* Day labels — buffer after */}
                <div className="flex flex-col bg-slate-100/80 border-b border-border-neutral">
                  <div className="flex-1 flex items-center justify-center gap-1 text-[9px] font-bold text-slate-300 uppercase tracking-tighter border-b border-slate-100">
                    <span className="text-slate-200">{bufferAfter.weekday}</span>
                    <span className="text-slate-300">{bufferAfter.date}</span>
                  </div>
                  <div className="flex h-3 divide-x divide-slate-100">
                    {['M', 'A', 'E'].map((p) => (
                      <div key={p} className="flex-1 flex items-center justify-center text-[9px] font-semibold text-slate-200">{p}</div>
                    ))}
                  </div>
                </div>
                {/* Stay zone — buffer before */}
                <button
                  onClick={handleExtendBefore}
                  className="group/buf relative flex items-center justify-center border-r border-border-neutral transition-colors hover:bg-slate-100/60"
                  style={{
                    background: 'repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(148,163,184,0.13) 4px, rgba(148,163,184,0.13) 8px), rgba(241,245,249,0.8)',
                  }}
                  title="Extend trip one day earlier"
                >
                  <div className="flex flex-col items-center gap-0.5 opacity-0 group-hover/buf:opacity-100 transition-opacity">
                    <Plus className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Extend</span>
                  </div>
                </button>
                {/* Stay zone — main (spans all trip day columns) */}
                <div
                  ref={timelineZoneRef}
                  className="relative overflow-hidden"
                  style={{
                    gridColumn: `2 / ${numDays + 2}`,
                    backgroundImage: 'linear-gradient(to right, rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(to right, rgba(0,0,0,0.02) 1px, transparent 1px)',
                    backgroundSize: `calc(100% / ${numDays}) 100%, calc(100% / ${numDays * 3}) 100%`,
                    cursor: (timelineHoverDay !== null || timelineDragCreate) ? 'crosshair' : undefined,
                  }}
                  onMouseMove={(e) => {
                    if (dragState) return;
                    const slot = getSlotFromClientX(e.clientX);
                    if (timelineDragCreate) {
                      setTimelineDragCreate((prev) => prev ? { ...prev, currentSlot: slot } : null);
                    } else if (isSlotRangeEmpty(slot, slot + 1)) {
                      setTimelineHoverDay(slot);
                    } else {
                      setTimelineHoverDay(null);
                    }
                  }}
                  onMouseDown={(e) => {
                    if (dragState) return;
                    const slot = getSlotFromClientX(e.clientX);
                    if (!isSlotRangeEmpty(slot, slot + 1)) return;
                    e.preventDefault();
                    setTimelineDragCreate({ startSlot: slot, currentSlot: slot });
                    setTimelineHoverDay(null);
                  }}
                  onMouseLeave={() => setTimelineHoverDay(null)}
                  onTouchStart={(e) => {
                    if (dragState) return;
                    const touch = e.touches[0];
                    const slot = getSlotFromClientX(touch.clientX);
                    if (!isSlotRangeEmpty(slot, slot + 1)) return;
                    setTimelineDragCreate({ startSlot: slot, currentSlot: slot });
                    setTimelineHoverDay(null);
                  }}
                  onTouchMove={(e) => {
                    if (!timelineDragCreate) return;
                    const touch = e.touches[0];
                    const slot = getSlotFromClientX(touch.clientX);
                    setTimelineDragCreate((prev) => prev ? { ...prev, currentSlot: slot } : null);
                  }}
                  onTouchEnd={() => {
                    if (!timelineDragCreate) return;
                    const { startSlot, currentSlot } = timelineDragCreate;
                    const minSlot = Math.min(startSlot, currentSlot);
                    const maxSlot = Math.max(startSlot, currentSlot);
                    if (isSlotRangeEmpty(minSlot, maxSlot + 1)) {
                      setPendingTimelineSlot({ startSlot: minSlot, days: Math.max(1, Math.ceil((maxSlot - minSlot + 1) / 3)) });
                      setAddingStay(true);
                    }
                    setTimelineDragCreate(null);
                  }}
                >
                  <div className="absolute inset-0 flex items-center">
                    {sortedStays.length === 0 ? (
                      <button
                        onClick={() => setAddingStay(true)}
                        className="w-full h-10 flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-lg text-slate-400 hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span className="text-[11px] font-bold">Add your first destination</span>
                      </button>
                    ) : (
                    <div className="relative w-full" style={{ height: 42 }}>
                      {/* Drag-to-create: hover highlight */}
                      {timelineHoverDay !== null && !timelineDragCreate && (
                        <div
                          className="absolute top-0.5 bottom-0.5 rounded-md pointer-events-none bg-primary/10 border border-dashed border-primary/40 flex items-center justify-center z-20"
                          style={{ left: `${(timelineHoverDay / numSlots) * 100}%`, width: `${(1 / numSlots) * 100}%` }}
                        >
                          <Plus className="w-3 h-3 text-primary/50" />
                        </div>
                      )}
                      {/* Drag-to-create: drag range highlight */}
                      {timelineDragCreate && (() => {
                        const minSlot = Math.min(timelineDragCreate.startSlot, timelineDragCreate.currentSlot);
                        const maxSlot = Math.max(timelineDragCreate.startSlot, timelineDragCreate.currentSlot);
                        const span = maxSlot - minSlot + 1;
                        const empty = isSlotRangeEmpty(minSlot, maxSlot + 1);
                        const days = Math.max(1, Math.ceil(span / 3));
                        return (
                          <div
                            className={`absolute top-0.5 bottom-0.5 rounded-md pointer-events-none border z-20 flex items-center justify-center ${
                              empty ? 'bg-primary/15 border-primary/60' : 'bg-red-100/60 border-red-400/60'
                            }`}
                            style={{ left: `${(minSlot / numSlots) * 100}%`, width: `${(span / numSlots) * 100}%` }}
                          >
                            <span className={`text-[9px] font-bold ${empty ? 'text-primary/70' : 'text-red-500/70'}`}>
                              {empty ? `${days} day${days > 1 ? 's' : ''}` : 'conflict'}
                            </span>
                          </div>
                        );
                      })()}
                      {sortedStays.map((stay, index) => {
                        const isSelected = selectedStay?.id === stay.id;
                        const isOverlapping = overlaps.has(stay.id);
                        const left = (stay.startSlot / (numDays * 3)) * 100;
                        const width = ((stay.endSlot - stay.startSlot) / (numDays * 3)) * 100;
                        const nextStay = sortedStays[index + 1];

                        return (
                          <React.Fragment key={stay.id}>
                            <div
                              role="button"
                              tabIndex={0}
                              aria-label={`${stay.name}, ${getStayNightCount(stay)} days${isOverlapping ? ', has scheduling conflict' : ''}`}
                              aria-selected={isSelected}
                              className={`absolute rounded-lg flex items-center select-none transition-all duration-150 cursor-grab active:cursor-grabbing group border focus-visible:ring-2 focus-visible:ring-offset-2 ${
                                isSelected
                                  ? 'z-10'
                                  : 'z-0 hover:shadow-md'
                              } ${isOverlapping ? 'ring-2 ring-amber-400' : ''}`}
                              style={{
                                left: `calc(${left}% + 6px)`, width: `calc(${Math.max(width, 2)}% - 12px)`, height: 42,
                                background: isSelected
                                  ? `linear-gradient(135deg, ${stay.color}, color-mix(in srgb, ${stay.color} 80%, #ffffff))`
                                  : `color-mix(in srgb, ${stay.color} 8%, white)`,
                                borderColor: isSelected ? stay.color : `color-mix(in srgb, ${stay.color} 35%, transparent)`,
                                boxShadow: isSelected ? `0 0 0 2px white, 0 0 0 4px ${stay.color}, 0 4px 12px color-mix(in srgb, ${stay.color} 25%, transparent)` : undefined,
                              }}
                              onClick={() => {
                                if (selectedStay?.id === stay.id) { setSelectedStayId(''); }
                                else { setSelectedStayId(stay.id); setSidebarTab('overview'); }
                              }}
                              onMouseEnter={() => setHoveredStayId(stay.id)}
                              onMouseLeave={() => setHoveredStayId(null)}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedStayId(stay.id); setSidebarTab('overview'); } }}
                              onMouseDown={(e) => {
                                // Only start move drag from the body (not resize handles)
                                if ((e.target as HTMLElement).dataset.handle) return;
                                setDragState({ stayId: stay.id, mode: 'move', originX: e.clientX, originalStart: stay.startSlot, originalEnd: stay.endSlot });
                              }}
                            >
                              {/* Photo background */}
                              {stay.imageUrl && (
                                <div className="absolute inset-0 rounded-lg overflow-hidden pointer-events-none">
                                  <img src={stay.imageUrl} alt="" className="w-full h-full object-cover" style={{ opacity: isSelected ? 0.18 : 0.12 }} />
                                </div>
                              )}
                              {/* Colored left accent bar */}
                              <div
                                className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-full transition-opacity"
                                style={{ background: stay.color, opacity: isSelected ? 0 : 1 }}
                              />
                              {/* Left resize */}
                              <div
                                data-handle="resize-start"
                                className="absolute -left-1.5 top-0 bottom-0 w-5 cursor-ew-resize z-20 flex items-center justify-center"
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  setSelectedStayId(stay.id);
                                  setDragState({ stayId: stay.id, mode: 'resize-start', originX: e.clientX, originalStart: stay.startSlot, originalEnd: stay.endSlot });
                                }}
                              >
                                <div className="w-0.5 h-4 rounded-full bg-current opacity-15 group-hover:opacity-40 transition-opacity pointer-events-none"
                                  style={{ color: isSelected ? 'white' : stay.color }} />
                              </div>
                              {/* Content */}
                              {(() => {
                                const staySlots = stay.endSlot - stay.startSlot;
                                const isNarrow = staySlots < 6; // less than 2 days
                                const isVeryNarrow = staySlots < 3; // less than 1 day
                                return (
                                  <div className="flex flex-col overflow-hidden flex-1 pointer-events-none pl-3.5 pr-2">
                                    <div className="flex items-center gap-1.5">
                                      {!isVeryNarrow && <Bed className="w-3 h-3 flex-shrink-0" style={{ color: isSelected ? 'rgba(255,255,255,0.85)' : stay.color }} />}
                                      <span
                                        className="text-[11px] font-bold truncate"
                                        style={{ color: isSelected ? 'white' : stay.color }}
                                      >{stay.name}</span>
                                      {isOverlapping && (
                                        <span className="flex-shrink-0 text-[9px] font-extrabold px-1 py-0.5 rounded-md bg-amber-400 text-white leading-none">!</span>
                                      )}
                                    </div>
                                    {stay.lodging && !isNarrow && (
                                      <span
                                        className="text-[9px] font-semibold truncate mt-px"
                                        style={{ color: isSelected ? 'rgba(255,255,255,0.6)' : `color-mix(in srgb, ${stay.color} 60%, #64748b)` }}
                                      >{stay.lodging}</span>
                                    )}
                                  </div>
                                );
                              })()}
                              {/* Drag grip — visible on hover when not selected */}
                              <GripVertical
                                className="w-3 h-3 flex-shrink-0 mr-1 opacity-0 group-hover:opacity-40 transition-opacity pointer-events-none"
                                style={{ color: isSelected ? 'white' : stay.color }}
                              />
                              {/* Edit button */}
                              <button
                                aria-label={`Edit ${stay.name}`}
                                className={`absolute right-4 top-1/2 -translate-y-1/2 z-20 p-1 rounded transition-opacity focus-visible:ring-2 ${
                                  isSelected ? 'opacity-100 text-white/70 hover:text-white hover:bg-white/15' : 'opacity-0 pointer-events-none'
                                }`}
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => { e.stopPropagation(); setEditingStayId(stay.id); }}
                              >
                                <SlidersHorizontal className="w-3 h-3" />
                              </button>
                              {/* Right resize */}
                              <div
                                data-handle="resize-end"
                                className="absolute -right-1.5 top-0 bottom-0 w-5 cursor-ew-resize z-20 flex items-center justify-center"
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  setSelectedStayId(stay.id);
                                  setDragState({ stayId: stay.id, mode: 'resize-end', originX: e.clientX, originalStart: stay.startSlot, originalEnd: stay.endSlot });
                                }}
                              >
                                <div className="w-0.5 h-4 rounded-full bg-current opacity-15 group-hover:opacity-40 transition-opacity pointer-events-none"
                                  style={{ color: isSelected ? 'white' : stay.color }} />
                              </div>
                            </div>

                            {/* Transit chip — centered in gap between the two stays */}
                            {nextStay && (() => {
                              const gapStart = (stay.endSlot / (numDays * 3)) * 100;
                              const gapEnd = (nextStay.startSlot / (numDays * 3)) * 100;
                              const chipLeft = (gapStart + gapEnd) / 2;
                              return (
                                <button
                                  aria-label={`Route: ${TRANSPORT_LABELS[stay.travelModeToNext]}${stay.travelDurationToNext ? `, ${stay.travelDurationToNext}` : ''}`}
                                  onClick={() => setEditingRouteStayId(stay.id)}
                                  className="group/chip absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-30 size-8 bg-white border border-slate-200 rounded-full flex items-center justify-center cursor-pointer hover:border-primary/40 hover:shadow-md transition-all shadow-sm"
                                  style={{ left: `${chipLeft}%` }}
                                >
                                  <TransportIcon mode={stay.travelModeToNext} className="w-3.5 h-3.5 text-slate-400" />
                                  {stay.travelDurationToNext && (
                                    <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-[11px] font-bold rounded-md whitespace-nowrap opacity-0 group-hover/chip:opacity-100 transition-opacity shadow-lg">
                                      {stay.travelDurationToNext}
                                    </div>
                                  )}
                                </button>
                              );
                            })()}
                          </React.Fragment>
                        );
                      })}
                    </div>
                    )}
                  </div>
                  {/* Shrink strip — empty first day (bottom edge) */}
                  {canShrinkBefore && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleShrinkBefore(); }}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="absolute bottom-0 left-0 z-30 h-5 flex items-center justify-center gap-1 rounded-tr-md transition-all opacity-0 hover:opacity-100 bg-slate-100/80 hover:bg-red-50 border-t border-r border-slate-200/60"
                      style={{ width: `${(1 / numDays) * 100}%` }}
                      title="Remove empty first day"
                    >
                      <Trash2 className="w-2.5 h-2.5 text-red-400" />
                      <span className="text-[9px] font-bold text-red-400 uppercase">Remove day</span>
                    </button>
                  )}
                  {/* Shrink strip — empty last day (bottom edge) */}
                  {canShrinkAfter && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleShrinkAfter(); }}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="absolute bottom-0 right-0 z-30 h-5 flex items-center justify-center gap-1 rounded-tl-md transition-all opacity-0 hover:opacity-100 bg-slate-100/80 hover:bg-red-50 border-t border-l border-slate-200/60"
                      style={{ width: `${(1 / numDays) * 100}%` }}
                      title="Remove empty last day"
                    >
                      <Trash2 className="w-2.5 h-2.5 text-red-400" />
                      <span className="text-[9px] font-bold text-red-400 uppercase">Remove day</span>
                    </button>
                  )}
                </div>
                {/* Stay zone — buffer after */}
                <button
                  onClick={handleExtendAfter}
                  className="group/buf relative flex items-center justify-center border-l border-border-neutral transition-colors hover:bg-slate-100/60"
                  style={{
                    background: 'repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(148,163,184,0.13) 4px, rgba(148,163,184,0.13) 8px), rgba(241,245,249,0.8)',
                  }}
                  title="Extend trip one day later"
                >
                  <div className="flex flex-col items-center gap-0.5 opacity-0 group-hover/buf:opacity-100 transition-opacity">
                    <Plus className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Extend</span>
                  </div>
                </button>
              </div>
            </div>
          </section>

          {/* ── Main content ── */}
          <section className="flex-1 flex min-h-0 relative overflow-hidden">

            {/* Inventory */}
            <aside className={`border-r border-border-neutral flex flex-col bg-white transition-all duration-300 ${mapExpanded ? 'w-0 overflow-hidden opacity-0' : 'w-64 hidden md:flex'}`}>
              {/* Tab bar */}
              <div className="flex-shrink-0 bg-slate-50 border-b border-border-neutral">
                <div className="flex h-9">
                  <button
                    onClick={() => setSidebarTab('overview')}
                    className={`flex-1 flex items-center justify-center gap-1.5 text-[11px] font-semibold whitespace-nowrap -mb-px border-b-2 transition-all duration-150 ${sidebarTab === 'overview' ? 'bg-white text-primary border-primary shadow-[0_1px_0_0_white]' : 'text-slate-400 hover:text-slate-600 border-transparent hover:bg-white/60'}`}
                  >
                    Details
                  </button>
                  <button
                    onClick={() => setSidebarTab('unplanned')}
                    className={`flex-1 flex items-center justify-center gap-1.5 text-[11px] font-semibold whitespace-nowrap -mb-px border-b-2 transition-all duration-150 ${sidebarTab === 'unplanned' ? 'bg-white text-primary border-primary shadow-[0_1px_0_0_white]' : 'text-slate-400 hover:text-slate-600 border-transparent hover:bg-white/60'}`}
                  >
                    {inboxVisits.length > 0 ? (
                      <>Inbox <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold ${sidebarTab === 'unplanned' ? 'bg-primary/15 text-primary' : 'bg-slate-200 text-slate-500'}`}>{inboxVisits.length}</span></>
                    ) : 'Inbox'}
                  </button>
                  <button
                    onClick={() => setAddingToInbox(true)}
                    className={`px-2.5 flex items-center justify-center border-l border-border-neutral text-slate-400 hover:text-primary hover:bg-white transition-colors ${sidebarTab === 'unplanned' ? '' : 'invisible pointer-events-none'}`}
                    aria-label="Add new place"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Overview tab — visit detail or stay overview */}
              {sidebarTab === 'overview' && selectedStay && selectedVisitId && (() => {
                const visit = selectedStay.visits.find((v) => v.id === selectedVisitId);
                if (!visit) return null;
                const dayLabel = visit.dayOffset !== null
                  ? `Day ${visit.dayOffset + 1}${visit.dayPart ? ', ' + visit.dayPart.charAt(0).toUpperCase() + visit.dayPart.slice(1) : ''}`
                  : 'Unplanned';
                return (
                  <VisitDetailDrawer
                    key={visit.id}
                    visit={visit}
                    dayLabel={dayLabel}
                    onClose={() => setSelectedVisitId(null)}
                    onEdit={() => { setEditingVisit(visit); setSelectedVisitId(null); }}
                    onUnschedule={() => {
                      updateSelectedStay((stay) => ({
                        ...stay,
                        visits: stay.visits.map((v) => v.id === visit.id ? { ...v, dayOffset: null, dayPart: null } : v),
                      }));
                      setSelectedVisitId(null);
                    }}
                    onDelete={() => {
                      updateSelectedStay((stay) => ({ ...stay, visits: stay.visits.filter((v) => v.id !== visit.id) }));
                      setSelectedVisitId(null);
                    }}
                    onUpdateVisit={(updates) => {
                      updateSelectedStay((stay) => ({
                        ...stay,
                        visits: stay.visits.map((v) => v.id === visit.id ? { ...v, ...updates } : v),
                      }));
                    }}
                  />
                );
              })()}
              {sidebarTab === 'overview' && selectedStay && !selectedVisitId && (
                <StayOverviewPanel
                  key={selectedStay.id}
                  stay={selectedStay}
                  stayDays={stayDays}
                  accommodationGroups={accommodationGroups}
                  onUpdate={(updates) => updateSelectedStay((s) => ({ ...s, ...updates }))}
                />
              )}
              {sidebarTab === 'overview' && !selectedStay && (
                <div className="flex-1 flex flex-col items-center justify-center p-6 gap-3">
                  <div className="size-10 rounded-xl bg-primary/8 flex items-center justify-center">
                    <Navigation className="w-5 h-5 text-primary/40" />
                  </div>
                  <div className="text-center">
                    <p className="text-[11px] font-bold text-slate-600">Trip Overview</p>
                    <p className="text-[11px] text-slate-400 mt-1">{sortedStays.length} destination{sortedStays.length !== 1 ? 's' : ''} · {trip.totalDays} days</p>
                  </div>
                  <p className="text-[9px] text-slate-400 text-center leading-relaxed">Click a destination on the timeline to see its details and plan activities.</p>
                </div>
              )}

              {/* Unplanned tab */}
              {sidebarTab === 'unplanned' && (
                <div className="flex-1 overflow-y-auto p-4 space-y-3 scroll-hide">
                  {inboxVisits.map((v) => (
                    <DraggableInventoryCard key={v.id} visit={v} onEdit={() => setEditingVisit(v)} />
                  ))}
                  {inboxVisits.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 gap-2">
                      <div className="size-9 rounded-xl bg-slate-100 flex items-center justify-center">
                        {searchTerm ? <Search className="w-4 h-4 text-slate-400" /> : selectedStay ? <Check className="w-4 h-4 text-emerald-500" /> : <Compass className="w-4 h-4 text-slate-400" />}
                      </div>
                      <p className="text-[11px] font-bold text-slate-500">
                        {searchTerm ? 'No matching places' : selectedStay ? 'All scheduled!' : 'No stay selected'}
                      </p>
                      <p className="text-[9px] text-slate-400 text-center leading-relaxed">
                        {searchTerm ? 'Try a different search term.' : selectedStay ? 'Add more with the + button above.' : 'Click a destination on the timeline.'}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </aside>

            {/* Day columns */}
            <div data-day-columns className={`flex-1 overflow-x-auto overflow-y-auto flex p-5 gap-5 min-w-0 bg-slate-50/50 scroll-hide transition-all duration-300 max-md:snap-x max-md:snap-mandatory max-md:scroll-pl-5 ${mapExpanded ? 'w-0 overflow-hidden opacity-0 p-0' : ''}`} style={mapExpanded ? undefined : { paddingRight: mapWidth + 20 }}>
              {sortedStays.length === 0 && (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center space-y-3">
                    <div className="size-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto">
                      <MapPin className="w-5 h-5 text-slate-400" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-600 text-sm">No destinations yet</p>
                      <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                        Add a stay in the timeline above<br />to start planning your days.
                      </p>
                    </div>
                    <button
                      onClick={() => setAddingStay(true)}
                      className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-primary border border-primary/20 rounded-lg hover:bg-primary/5 transition-colors mx-auto"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add first stay
                    </button>
                  </div>
                </div>
              )}
              {stayDays.map((day) => {
                const dayVisits = selectedStay
                  ? sortVisits(selectedStay.visits.filter(
                      (v) => v.dayOffset === day.dayOffset && (!searchTerm || v.name.toLowerCase().includes(searchTerm)),
                    ))
                  : [];
                return (
                  <div key={day.dayOffset} className={`flex-none w-72 max-md:w-[85vw] max-md:snap-start flex flex-col gap-4 rounded-xl transition-colors ${mapMode === 'detail' && mapDayFilter === day.dayOffset ? 'ring-2 ring-primary/40 bg-primary/[0.03] p-2 -m-2' : ''}`}>
                    <button
                      className={`flex items-center justify-between w-full cursor-pointer group rounded-lg px-2 py-1 -mx-2 transition-colors ${mapMode === 'detail' && mapDayFilter === day.dayOffset ? 'bg-primary/8' : 'hover:bg-slate-50'}`}
                      onClick={() => {
                        if (mapDayFilter === day.dayOffset) { setMapDayFilter(null); setMapMode('stay'); }
                        else { setMapDayFilter(day.dayOffset); setMapMode('detail'); }
                      }}
                      title="Click to show this day on the map"
                    >
                      <h4 className="font-extrabold text-sm tracking-tight group-hover:text-primary transition-colors">
                        Day {(day.dayOffset + 1).toString().padStart(2, '0')}
                        <span className="text-slate-400 font-medium ml-1.5">{fmt(day.date, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                      </h4>
                      <MapPin className={`w-3 h-3 transition-colors ${mapMode === 'detail' && mapDayFilter === day.dayOffset ? 'text-primary' : 'text-slate-300 group-hover:text-primary/50'}`} />
                    </button>
                    {/* Accommodation bar — rendered on the first day of each accommodation group */}
                    {(() => {
                      const group = accommodationGroups.find((g) => g.startDayOffset === day.dayOffset);
                      const isNightDay = day.hasNight;
                      const hasAnyGroup = accommodationGroups.some((g) => day.dayOffset >= g.startDayOffset && day.dayOffset < g.startDayOffset + g.nights);
                      // Reserve space on days covered by a group but not the start
                      if (!group && hasAnyGroup) return <div className="h-12 flex-shrink-0 -mb-2" />;
                      // Day with a night but no accommodation set — show "add" prompt
                      if (!group && isNightDay) return (
                        <div className="h-12 flex-shrink-0 -mb-2">
                          <button
                            onClick={() => setEditingAccommodation({ dayOffset: day.dayOffset })}
                            className="h-full w-full border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center gap-2 text-slate-400 hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all"
                          >
                            <Hotel className="w-4 h-4" />
                            <span className="text-[11px] font-bold">Set Accommodation</span>
                          </button>
                        </div>
                      );
                      // No night on this day (e.g., checkout morning only) — no bar
                      if (!group) return null;
                      // Render the spanning bar for this group
                      return (
                        <div className="relative h-12 flex-shrink-0 -mb-2">
                          <div className="absolute inset-y-0 left-0 z-10" style={{ width: `calc(${group.nights} * var(--day-col-width) + ${group.nights - 1} * var(--day-col-gap))` }}>
                            <button
                              onClick={() => setEditingAccommodation({ group })}
                              className="group/accom h-full w-full bg-white border border-primary/30 rounded-lg shadow-sm flex items-center px-4 gap-3 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer text-left"
                            >
                              <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                                <Hotel className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-extrabold text-primary uppercase tracking-tighter">
                                    {group.nights > 1 ? 'Continuous Stay' : 'Overnight'}
                                  </span>
                                  <span className="text-[11px] font-medium text-slate-400 tracking-tight">
                                    • {group.nights} {group.nights === 1 ? 'Night' : 'Nights'}
                                  </span>
                                </div>
                                <p className="text-xs font-extrabold text-slate-800 truncate">{group.name}</p>
                              </div>
                              {group.accommodation.notes && (
                                <span className="text-[11px] font-medium text-slate-500 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-full flex items-center gap-1.5 flex-shrink-0 max-w-[180px] truncate">
                                  <span className="material-icons text-slate-400 text-[12px]">#</span>
                                  {group.accommodation.notes}
                                </span>
                              )}
                              <Pencil className="w-3.5 h-3.5 text-slate-300 group-hover/accom:text-primary/60 transition-colors flex-shrink-0" />
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                    <div className="space-y-4 pt-2">
                      {DAY_PARTS.filter((p) => day.enabledParts.includes(p)).map((period) => (
                        <DroppablePeriodSlot
                          key={period}
                          dayOffset={day.dayOffset} period={period}
                          visits={dayVisits.filter((v) => v.dayPart === period)}
                          selectedVisitId={selectedVisitId}
                          onSelectVisit={(id) => {
                            const next = id === selectedVisitId ? null : id;
                            setSelectedVisitId(next);
                            if (next) setSidebarTab('overview');
                          }}
                          onEditVisit={(v) => setEditingVisit(v)}
                          onAddVisit={(d, p) => setAddingVisitToSlot({ dayOffset: d, part: p })}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
              {stayDays.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center gap-3">
                  <div className="size-14 rounded-2xl bg-primary/8 flex items-center justify-center">
                    <Compass className="w-7 h-7 text-primary/40" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-extrabold text-slate-600">Select a stay to plan</p>
                    <p className="text-xs text-slate-400 mt-1"><span className="md:hidden">Tap</span><span className="hidden md:inline">Click</span> any block on the timeline above</p>
                  </div>
                  {sortedStays.length === 0 && (
                    <button
                      onClick={() => setAddingStay(true)}
                      className="mt-1 flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/90 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add your first stay
                    </button>
                  )}
                </div>
              )}
            </div>


            {/* Map — Collapsed tab */}
            {mapCollapsed && !mapExpanded && (
              <button
                onClick={() => { setMapCollapsed(false); triggerMapAnim('map-anim-reveal'); }}
                className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-30 items-center gap-1 px-1.5 py-3 bg-white border border-r-0 border-slate-200 rounded-l-xl shadow-lg hover:bg-slate-50 transition-colors"
                aria-label="Show map"
              >
                <PanelRightOpen className="w-4 h-4 text-slate-500" />
              </button>
            )}

            {/* Map — Floating Panel */}
            <aside
              ref={mapPanelRef}
              className={`map-panel-container hidden md:flex flex-col overflow-hidden z-30 bg-white ${mapAnimClass} ${
                mapCollapsed && !mapExpanded
                  ? 'absolute pointer-events-none'
                  : mapExpanded
                    ? 'absolute rounded-none'
                    : 'absolute rounded-2xl shadow-[0_0_50px_-12px_rgba(0,0,0,0.25)] border border-slate-200/60'
              }`}
              style={
                mapCollapsed && !mapExpanded
                  ? { top: 16, bottom: 16, right: -mapWidth, width: mapWidth, opacity: 0 }
                  : mapExpanded
                    ? { top: 0, bottom: 0, right: 0, left: 0 }
                    : mapMini
                      ? { bottom: 16, right: 16, width: 'clamp(320px, 28vw, 480px)', height: 'clamp(240px, 25vh, 360px)' }
                      : { top: 16, bottom: 16, right: 16, width: mapWidth }
              }
            >
              {/* Resize handle — left edge */}
              {!mapExpanded && !mapCollapsed && !mapMini && (
                <div
                  onMouseDown={startMapResize}
                  className="absolute left-0 top-0 bottom-0 w-3 -ml-1.5 cursor-col-resize z-50 group flex items-center justify-center"
                  title="Drag to resize"
                >
                  <div className="w-1 h-8 rounded-full bg-slate-300/60 group-hover:bg-primary/50 group-hover:h-12 transition-all" />
                </div>
              )}
              {/* Map panel header */}
              <div className={`${mapMini ? 'h-9 px-2.5' : 'h-11 px-4'} border-b border-slate-100 flex items-center gap-3 bg-white/80 backdrop-blur-md flex-shrink-0`}>
                {/* Left: mode icon + title */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="size-5 bg-primary/10 rounded-md flex items-center justify-center">
                    <MapPin className="w-3 h-3 text-primary" />
                  </div>
                  {!mapMini && (
                    <span className="text-[11px] font-extrabold text-slate-600 tracking-tight uppercase">
                      {mapMode === 'overview' ? 'Overview' : mapMode === 'stay' ? 'All spots' : 'Day route'}
                    </span>
                  )}
                </div>
                {/* Middle: day filter pills — scrollable, only in detail mode */}
                <div className="flex-1 overflow-x-auto scroll-hide min-w-0">
                  {!mapMini && (mapMode === 'stay' || mapMode === 'detail') && dayFilterOptions.length >= 2 && (
                    <DayFilterPills
                      options={dayFilterOptions}
                      selectedDayOffset={mapDayFilter}
                      onChange={(d) => { setMapDayFilter(d); setMapMode(d !== null ? 'detail' : 'stay'); }}
                    />
                  )}
                </div>
                {/* Right: action buttons */}
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  {!mapMini && (
                    <button
                      aria-label={mapMode === 'overview' ? 'Show stay spots' : 'Show trip overview'}
                      onClick={() => {
                        if (mapMode === 'overview') {
                          // Re-select first stay to go back to stay mode
                          if (sortedStays.length > 0) setSelectedStayId(sortedStays[0].id);
                          setMapMode('stay');
                        } else {
                          setSelectedStayId('');
                          setMapMode('overview');
                          setMapDayFilter(null);
                        }
                      }}
                      className={`p-1.5 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-primary/50 ${
                        mapMode === 'overview'
                          ? 'text-primary bg-primary/10'
                          : 'text-slate-400 hover:text-primary hover:bg-slate-50'
                      }`}
                    >
                      <Layers className="w-4 h-4" />
                    </button>
                  )}
                  {/* Mini / restore toggle */}
                  {!mapExpanded && (
                    <button
                      onClick={() => { triggerMapAnim(mapMini ? 'map-anim-restore' : 'map-anim-mini'); setMapMini(m => !m); }}
                      aria-label={mapMini ? 'Restore map' : 'Shrink map'}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-slate-50 transition-colors focus-visible:ring-2 focus-visible:ring-primary/50"
                    >
                      {mapMini ? <Expand className="w-4 h-4" /> : <Shrink className="w-4 h-4" />}
                    </button>
                  )}
                  <button
                    onClick={() => { triggerMapAnim(mapExpanded ? 'map-anim-shrink' : 'map-anim-expand'); setMapExpanded(!mapExpanded); if (mapMini) setMapMini(false); }}
                    aria-label={mapExpanded ? 'Exit fullscreen' : 'Fullscreen map'}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-slate-50 transition-colors focus-visible:ring-2 focus-visible:ring-primary/50"
                  >
                    {mapExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>
                  {!mapExpanded && !mapMini && (
                    <button
                      onClick={() => { triggerMapAnim('map-anim-collapse'); setTimeout(() => setMapCollapsed(true), 350); }}
                      aria-label="Hide map"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-slate-50 transition-colors focus-visible:ring-2 focus-visible:ring-primary/50"
                    >
                      <PanelRightClose className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-hidden relative">
                {(mapMode === 'overview' || mapMode === 'stay' || mapVisits.length > 0 || mapDayFilter !== null) ? (
                  <TripMap
                    visits={mapMode !== 'overview' ? mapVisits : []}
                    selectedVisitId={mapMode !== 'overview' ? selectedVisitId : null}
                    onSelectVisit={(id) => setSelectedVisitId(id)}
                    expanded={mapExpanded}
                    stay={mapMode !== 'overview' ? selectedStay : null}
                    mode={mapMode}
                    overviewStays={overviewStays}
                    onSelectStay={(stayId) => { setSelectedStayId(stayId); }}
                    selectedDayOffset={mapDayFilter}
                    highlightedStayId={mapMode === 'overview' ? hoveredStayId : null}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
                    <div className="text-center text-slate-400">
                      <MapPin className="w-10 h-10 mx-auto mb-2 opacity-20" />
                      <p className="text-xs font-medium">Schedule activities to see the map</p>
                    </div>
                  </div>
                )}

                {selectedVisitId && (() => {
                  const visit = mapVisits.find((v) => v.id === selectedVisitId);
                  if (!visit) return null;
                  return (
                    <div className="absolute bottom-5 left-5 right-5 z-20 pointer-events-none">
                      <div className="bg-white/95 backdrop-blur-xl p-4 rounded-xl shadow-2xl border border-primary/20 flex gap-3 pointer-events-auto">
                        <div className={`size-10 rounded-lg flex items-center justify-center flex-shrink-0 border ${getVisitTypeColor(visit.type)}`}>
                          {getVisitTypeIcon(visit.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <div>
                              {visit.dayOffset !== null && visit.dayPart && (
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">
                                  {visit.dayPart === 'morning' ? 'Morning' : visit.dayPart === 'afternoon' ? 'Afternoon' : 'Evening'}, Day {(visit.dayOffset ?? 0) + 1}
                                </p>
                              )}
                              <h5 className="text-sm font-extrabold text-slate-800 truncate">{visit.name}</h5>
                            </div>
                            <button onClick={() => setSelectedVisitId(null)} className="text-slate-400 hover:text-slate-600 flex-shrink-0 ml-2">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="flex gap-2 mt-2 flex-wrap">
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${getVisitTypeColor(visit.type)}`}>
                              {getVisitLabel(visit.type).toUpperCase()}
                            </span>
                            {selectedStay && (
                              <span className="text-[9px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                                {haversineKm(selectedStay.centerLat, selectedStay.centerLng, visit.lat, visit.lng).toFixed(1)} km from hotel
                              </span>
                            )}
                            {visit.durationHint && (
                              <span className="text-[9px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                                {visit.durationHint}
                              </span>
                            )}
                            <button onClick={() => setEditingVisit(visit)} className="text-[9px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100 hover:border-primary/40 hover:text-primary flex items-center gap-1">
                              <Pencil className="w-2.5 h-2.5" /> Edit
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Map panel footer */}
              <div className="px-5 py-3 bg-white/80 backdrop-blur-md border-t border-slate-100 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className={`size-8 rounded-full flex items-center justify-center flex-shrink-0 ${mapMode === 'overview' ? 'bg-slate-600' : 'bg-primary'}`}>
                    <Navigation className="text-white w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">
                      {mapMode === 'overview' ? 'Trip Route' : 'Active Route'}
                    </span>
                    <span className="text-xs font-extrabold text-slate-800">
                      {mapMode === 'overview'
                        ? `${sortedStays.length} destinations`
                        : selectedStay
                          ? mapDayFilter !== null
                            ? `${selectedStay.name} · Day ${String(mapDayFilter + 1).padStart(2, '0')}`
                            : `${selectedStay.name} · All Days`
                          : 'No stay selected'}
                    </span>
                  </div>
                </div>
                <div className="text-right tabular-nums">
                  {mapMode === 'overview' ? (
                    <>
                      <span className="text-xs font-black text-slate-800">
                        {(() => {
                          let totalKm = 0;
                          for (let i = 0; i < sortedStays.length - 1; i++) {
                            totalKm += haversineKm(sortedStays[i].centerLat, sortedStays[i].centerLng, sortedStays[i + 1].centerLat, sortedStays[i + 1].centerLng);
                          }
                          return `${totalKm.toFixed(0)} km`;
                        })()}
                      </span>
                      <p className="text-[9px] font-bold text-slate-400">{sortedStays.length} cities</p>
                    </>
                  ) : (
                    <>
                      <span className="text-xs font-black text-slate-800">
                        {selectedStay ? (() => {
                          let totalKm = 0;
                          for (let i = 1; i < mapVisits.length; i++) {
                            totalKm += haversineKm(mapVisits[i - 1].lat, mapVisits[i - 1].lng, mapVisits[i].lat, mapVisits[i].lng);
                          }
                          return `${totalKm.toFixed(1)} km`;
                        })() : '—'}
                      </span>
                      <p className="text-[9px] font-bold text-slate-400">{mapVisits.length} stops</p>
                    </>
                  )}
                </div>
              </div>
            </aside>
          </section>
        </main>

        {/* ── Mobile FAB for unplanned items ── */}
        {!mobileDrawerOpen && (
          <button
            onClick={() => setMobileDrawerOpen(true)}
            className="md:hidden fixed right-5 z-50 size-14 rounded-full bg-primary text-white shadow-lg shadow-primary/30 flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all"
            style={{ bottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}
            aria-label="Open unplanned items"
          >
            <Layers className="w-6 h-6" />
            {inboxVisits.length > 0 && (
              <span className="absolute -top-1 -right-1 size-5 rounded-full bg-white text-primary text-[11px] font-extrabold flex items-center justify-center shadow-sm border border-primary/20">
                {inboxVisits.length}
              </span>
            )}
          </button>
        )}

        {/* ── Mobile bottom drawer ── */}
        {mobileDrawerOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end" onClick={() => setMobileDrawerOpen(false)}>
            <div className="absolute inset-0 bg-black/40" />
            <div
              className="relative bg-white rounded-t-2xl max-h-[70dvh] flex flex-col animate-slide-up"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag handle — tapping it also closes the drawer */}
              <div
                className="flex justify-center py-3 cursor-pointer"
                onClick={() => setMobileDrawerOpen(false)}
                onTouchStart={(e) => {
                  const startY = e.touches[0].clientY;
                  const onTouchMove = (ev: TouchEvent) => {
                    if (ev.touches[0].clientY - startY > 60) {
                      setMobileDrawerOpen(false);
                      document.removeEventListener('touchmove', onTouchMove);
                    }
                  };
                  document.addEventListener('touchmove', onTouchMove, { passive: true });
                  document.addEventListener('touchend', () => document.removeEventListener('touchmove', onTouchMove), { once: true });
                }}
                aria-label="Close drawer"
                role="button"
              >
                <div className="w-10 h-1 rounded-full bg-slate-300" />
              </div>
              {/* Header */}
              <div className="px-4 pb-3 flex justify-between items-center border-b border-border-neutral">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-extrabold text-slate-800">Unplanned</h3>
                  <span className={`text-[11px] font-extrabold px-1.5 py-0.5 rounded ${inboxVisits.length > 0 ? 'bg-primary/10 text-primary' : 'bg-emerald-50 text-emerald-600'}`}>
                    {inboxVisits.length > 0 ? inboxVisits.length : <Check className="w-3 h-3" />}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAddingToInbox(true)}
                    className="size-8 flex items-center justify-center rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors"
                    aria-label="Add new place"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setMobileDrawerOpen(false)}
                    className="size-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
                    aria-label="Close drawer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {/* Stay to-do */}
              {selectedStay && (
                <StayTodoSection
                  key={selectedStay.id}
                  stay={selectedStay}
                  onUpdate={(cl) => updateSelectedStay((s) => ({ ...s, checklist: cl.length > 0 ? cl : undefined }))}
                />
              )}
              {/* Items */}
              <div className="flex-1 overflow-y-auto p-4 pb-safe space-y-3 scroll-hide">
                {inboxVisits.map((v) => (
                  <DraggableInventoryCard key={v.id} visit={v} onEdit={() => setEditingVisit(v)} />
                ))}
                {inboxVisits.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 gap-2">
                    <div className="size-9 rounded-xl bg-slate-100 flex items-center justify-center">
                      {selectedStay ? <Check className="w-4 h-4 text-emerald-500" /> : <Compass className="w-4 h-4 text-slate-400" />}
                    </div>
                    <p className="text-[11px] font-bold text-slate-500">
                      {selectedStay ? 'All scheduled!' : 'No stay selected'}
                    </p>
                    <p className="text-[11px] text-slate-400 text-center">
                      {selectedStay ? 'Add more with the + button.' : 'Tap a destination on the timeline.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        <footer className="hidden md:flex bg-white text-slate-500 px-6 py-1.5 text-[11px] font-bold justify-between items-center border-t border-border-neutral flex-shrink-0">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className={`size-1.5 rounded-full ${
                syncStatus === 'saved' ? 'bg-emerald-500' :
                syncStatus === 'saving' ? 'bg-amber-400 animate-pulse' :
                syncStatus === 'error' ? 'bg-red-500' :
                'bg-slate-400'
              }`} />
              <span className="uppercase tracking-widest text-slate-400">
                {syncStatus === 'saved' ? 'Synced' :
                 syncStatus === 'saving' ? 'Saving…' :
                 syncStatus === 'error' ? 'Sync error' :
                 'Local only'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <Database className="w-3 h-3" />
              <span className="uppercase tracking-widest">{trip.name.slice(0, 24)}</span>
            </div>
          </div>
          <div className="flex items-center gap-4 tracking-widest text-slate-400">
            <span>{trip.totalDays} DAYS · {sortedStays.length} STAYS</span>
          </div>
        </footer>

        {/* ── Drag overlay ── */}
        <DragOverlay>
          {(activeInboxVisit ?? activeScheduledVisit) && (() => {
            const v = activeInboxVisit ?? activeScheduledVisit!;
            return (
              <div className="p-3 bg-white rounded-lg border border-primary shadow-xl opacity-90 w-56 pointer-events-none">
                <p className="text-xs font-bold text-slate-800">{v.name}</p>
              </div>
            );
          })()}
        </DragOverlay>

        {/* ── Modals ── */}

        {/* Route editor */}
        {editingRouteStay && editingRouteNextStay && (
          <RouteEditorModal
            stay={editingRouteStay} nextStay={editingRouteNextStay}
            onClose={() => setEditingRouteStayId(null)}
            onSave={(mode, duration, notes) => {
              setTrip((t) => ({
                ...t,
                stays: t.stays.map((s) =>
                  s.id === editingRouteStay.id
                    ? { ...s, travelModeToNext: mode, travelDurationToNext: duration, travelNotesToNext: notes }
                    : s
                ),
              }));
            }}
          />
        )}

        {/* Stay editor */}
        {editingStayId && (() => {
          const stay = trip.stays.find((s) => s.id === editingStayId);
          if (!stay) return null;
          return (
            <StayEditorModal
              stay={stay}
              onClose={() => setEditingStayId(null)}
              onSave={(updates) => {
                setTrip((t) => ({ ...t, stays: t.stays.map((s) => s.id === editingStayId ? { ...s, ...updates } : s) }));
              }}
              onDelete={() => {
                setTrip((t) => ({ ...t, stays: t.stays.filter((s) => s.id !== editingStayId) }));
                setSelectedStayId(trip.stays[0]?.id ?? '');
              }}
            />
          );
        })()}

        {/* Add stay */}
        {addingStay && (
          <AddStayModal
            onClose={() => { setAddingStay(false); setPendingTimelineSlot(null); }}
            stayColor={STAY_COLORS[trip.stays.length % STAY_COLORS.length]}
            initialDays={pendingTimelineSlot?.days}
            onSave={({ name, days, lat, lng }) => {
              const startSlot = pendingTimelineSlot?.startSlot
                ?? (sortedStays.length > 0 ? sortedStays[sortedStays.length - 1].endSlot : 0);
              const newStay: Stay = {
                id: `stay-${Date.now()}`, name,
                color: STAY_COLORS[trip.stays.length % STAY_COLORS.length],
                startSlot, endSlot: Math.min(startSlot + days * 3, trip.totalDays * 3),
                centerLat: lat ?? jitter(35.6762, 5), centerLng: lng ?? jitter(139.6503, 5),
                lodging: '', travelModeToNext: 'train', visits: [],
              };
              setTrip((t) => ({ ...t, stays: [...t.stays, newStay] }));
              setSelectedStayId(newStay.id);
              setAddingStay(false);
              setPendingTimelineSlot(null);
            }}
          />
        )}

        {/* Edit / Add accommodation */}
        {editingAccommodation && selectedStay && (() => {
          const isGroup = 'group' in editingAccommodation;
          const group = isGroup ? editingAccommodation.group : undefined;
          const dayOffset = isGroup ? editingAccommodation.group.startDayOffset : editingAccommodation.dayOffset;
          const nightCount = group ? group.nights : 1;
          const initial = group ? group.accommodation : undefined;
          const initialNights = Array.from({ length: nightCount }, (_, i) => dayOffset + i);
          const allNights = stayDays.filter((d) => d.hasNight).map((d) => ({ dayOffset: d.dayOffset, date: d.date }));

          const handleSave = (accom: NightAccommodation, newNights: number[]) => {
            setTrip((curr) => ({
              ...curr,
              stays: curr.stays.map((s) => {
                if (s.id !== selectedStay.id) return s;
                const updated = { ...s.nightAccommodations };
                // Remove from nights that were in the old group but not the new selection
                for (const n of initialNights) {
                  if (!newNights.includes(n)) delete updated[n];
                }
                // Apply to newly selected nights
                for (const n of newNights) {
                  updated[n] = accom;
                }
                // Clear lodging if it matches — prevents fallback re-appearing
                const clearLodging = s.lodging === accom.name || (group && s.lodging === group.name);
                return {
                  ...s,
                  lodging: clearLodging ? '' : s.lodging,
                  nightAccommodations: Object.keys(updated).length > 0 ? updated : undefined,
                };
              }),
            }));
          };

          const handleRemove = group ? () => {
            setTrip((curr) => ({
              ...curr,
              stays: curr.stays.map((s) => {
                if (s.id !== selectedStay.id) return s;
                const updated = { ...s.nightAccommodations };
                for (let i = 0; i < nightCount; i++) {
                  delete updated[dayOffset + i];
                }
                const clearLodging = s.lodging === group.name;
                return {
                  ...s,
                  lodging: clearLodging ? '' : s.lodging,
                  nightAccommodations: Object.keys(updated).length > 0 ? updated : undefined,
                };
              }),
            }));
          } : undefined;

          return (
            <AccommodationEditorModal
              initial={initial}
              allNights={allNights}
              initialNights={initialNights}
              existingNames={existingAccommodationNames}
              onClose={() => setEditingAccommodation(null)}
              onSave={handleSave}
              onRemove={handleRemove}
            />
          );
        })()}

        {/* Add visit to inbox */}
        {addingToInbox && selectedStay && (
          <VisitFormModal
            title={`Add Place to ${selectedStay.name}`}
            onClose={() => setAddingToInbox(false)}
            onSave={({ name, type, durationHint, lat, lng }) => {
              updateSelectedStay((stay) => ({
                ...stay,
                visits: [...stay.visits, createVisit(
                  `visit-${Date.now()}`, name, type, '',
                  lat ?? jitter(stay.centerLat, 0.08), lng ?? jitter(stay.centerLng, 0.08),
                  null, null,
                  stay.visits.filter((v) => v.dayOffset === null || v.dayPart === null).length,
                  durationHint || undefined,
                )],
              }));
            }}
          />
        )}

        {/* Add visit to slot */}
        {addingVisitToSlot && selectedStay && (
          <VisitFormModal
            title={`Add to Day ${addingVisitToSlot.dayOffset + 1} · ${addingVisitToSlot.part}`}
            onClose={() => setAddingVisitToSlot(null)}
            onSave={({ name, type, durationHint, notes, lat, lng }) => {
              const { dayOffset, part } = addingVisitToSlot;
              const bucketSize = selectedStay.visits.filter(
                (v) => v.dayOffset === dayOffset && v.dayPart === part,
              ).length;
              updateSelectedStay((stay) => ({
                ...stay,
                visits: [...stay.visits, {
                  ...createVisit(
                    `visit-${Date.now()}`, name, type, '',
                    lat ?? jitter(stay.centerLat, 0.05), lng ?? jitter(stay.centerLng, 0.05),
                    dayOffset, part, bucketSize, durationHint || undefined,
                  ),
                  notes,
                }],
              }));
            }}
          />
        )}

        {/* Edit visit */}
        {editingVisit && selectedStay && (
          <VisitFormModal
            title="Edit Place"
            initial={editingVisit}
            onClose={() => setEditingVisit(null)}
            onSave={({ name, type, durationHint, notes, checklist, links }) => {
              updateSelectedStay((stay) => ({
                ...stay,
                visits: stay.visits.map((v) =>
                  v.id === editingVisit.id ? {
                    ...v, name, type, durationHint: durationHint || undefined, notes,
                    checklist: checklist.length > 0 ? checklist : undefined,
                    links: links.length > 0 ? links : undefined,
                  } : v
                ),
              }));
            }}
            onDelete={() => {
              updateSelectedStay((stay) => ({
                ...stay,
                visits: normalizeVisitOrders(stay.visits.filter((v) => v.id !== editingVisit.id)),
              }));
              setEditingVisit(null);
            }}
            onUnschedule={
              editingVisit.dayOffset !== null
                ? () => scheduleVisit(editingVisit.id, null, null)
                : undefined
            }
          />
        )}

        {/* Trip editor */}
        {showTripEditor && (
          <TripEditorModal
            trip={trip}
            onClose={() => setShowTripEditor(false)}
            onSave={(updates) => setTrip((t) => ({ ...t, ...updates }))}
            onDelete={() => {
              if (store.trips.length > 1) {
                setStore((s) => {
                  const remaining = s.trips.filter((t) => t.id !== trip.id);
                  const next = { trips: remaining, activeTripId: remaining[0].id };
                  saveStore(next); return next;
                });
                setSelectedStayId('');
              } else {
                handleGoHome();
              }
              setShowTripEditor(false);
            }}
          />
        )}

        {/* Trip switcher */}
        {showTripSwitcher && (
          <TripSwitcherPanel
            store={store}
            onSwitch={handleSwitchTrip}
            onNew={handleNewTrip}
            onClose={() => setShowTripSwitcher(false)}
          />
        )}

        {/* History */}
        {showHistory && (
          <HistoryPanel
            history={hist.history}
            index={hist.historyIndex}
            onNavigate={(i) => {
              const snap = hist.history[i];
              if (snap) updateTrip(() => snap.trip);
            }}
            onClose={() => setShowHistory(false)}
          />
        )}

        {/* AI Planner */}
        {showAIPlanner && (
          <AIPlannerModal
            trip={trip}
            settings={aiSettings}
            onSettingsChange={(s) => {
              setAiSettings(s);
              localStorage.setItem('chronos-ai-settings', JSON.stringify(s));
            }}
            onClose={() => setShowAIPlanner(false)}
            onApply={(newStays) => {
              updateTrip((t) => ({ ...t, stays: newStays }));
            }}
          />
        )}

        {/* Cloud merge dialog */}
        {pendingMerge && (
          <MergeDialog
            localCount={store.trips.length}
            cloudCount={pendingMerge.cloudTrips.length}
            localTripNames={store.trips.map((t) => t.name)}
            cloudTripNames={pendingMerge.cloudTrips.map((t) => t.name)}
            onMerge={() => handleMergeDecision('merge')}
            onKeepLocal={() => handleMergeDecision('keep-local')}
            onUseCloud={() => handleMergeDecision('use-cloud')}
            onDismiss={() => setPendingMerge(null)}
          />
        )}

        {showImportCode && (
          <ImportFromCodeDialog
            onImport={handleImportFromCode}
            onClose={() => setShowImportCode(false)}
          />
        )}
      </div>
    </DndContext>
  );
}

// ─── Error boundary ───────────────────────────────────────────────────────────
import { Component, type ErrorInfo, type ReactNode } from 'react';

class ChronosErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ChronosErrorBoundary]', error, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="h-screen flex items-center justify-center bg-slate-50 p-8">
          <div className="max-w-md w-full bg-white rounded-2xl border border-red-100 shadow-xl p-8 text-center space-y-4">
            <div className="size-12 rounded-full bg-red-50 flex items-center justify-center mx-auto">
              <X className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-800">Something went wrong</h2>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">{this.state.error.message}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => this.setState({ error: null })}
                className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex-1 py-2.5 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/90 transition-colors"
              >
                Reload App
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <ChronosErrorBoundary>
      <AuthProvider>
        <ChronosApp />
      </AuthProvider>
    </ChronosErrorBoundary>
  );
}
