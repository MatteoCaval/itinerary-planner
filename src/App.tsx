import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext, DragOverlay, useDraggable, useDroppable,
  type DragEndEvent, type DragStartEvent, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowLeftRight, Bed, Bus, Calendar, Car, Check,
  ChevronDown, Compass, Database, Download, Footprints,
  GripVertical, History, Landmark, LogIn, LogOut, MapPin, Maximize2, Minimize2,
  Moon, Navigation, Pencil, Plane, Plus,
  PlusCircle, Redo2, Search, Ship, SlidersHorizontal, Sparkles, Sunrise,
  Sun, Train, Trash2, Undo2, Upload, User, X, Layers, Hotel, UtensilsCrossed,
} from 'lucide-react';
import LegacyApp from './features/legacy/LegacyApp';
import { searchPlace, type PlaceSearchResult } from './utils/geocoding';
import { generateHybridItinerary, type AIHybridStay } from './aiService';
import { generateMarkdown, downloadMarkdown } from './markdownExporter';
import TripMap from './components/TripMap';
import DayFilterPills from './components/TripMap/DayFilterPills';
import { AuthProvider, useAuth } from './context/AuthContext';
import 'leaflet/dist/leaflet.css';

// ─── View switcher ────────────────────────────────────────────────────────────
const APP_VIEW_KEY = 'itinerary-app-view-v1';

// ─── Types ────────────────────────────────────────────────────────────────────
type DayPart = 'morning' | 'afternoon' | 'evening';
type TravelMode = 'train' | 'flight' | 'drive' | 'ferry' | 'bus' | 'walk';
type VisitType = 'area' | 'landmark' | 'museum' | 'food' | 'walk' | 'hotel';

type VisitItem = {
  id: string; name: string; type: VisitType; area: string;
  lat: number; lng: number; durationHint?: string;
  dayOffset: number | null; dayPart: DayPart | null; order: number;
  notes?: string;
};

type NightAccommodation = {
  name: string; lat?: number; lng?: number; cost?: number; notes?: string; link?: string;
};

type Stay = {
  id: string; name: string; color: string;
  startSlot: number; endSlot: number;
  centerLat: number; centerLng: number;
  lodging: string;
  /** Per-night accommodation keyed by dayOffset (0-based within the stay). A night on dayOffset=0 means "sleeping between day 0 and day 1". */
  nightAccommodations?: Record<number, NightAccommodation>;
  travelModeToNext: TravelMode; travelDurationToNext?: string; travelNotesToNext?: string;
  visits: VisitItem[];
};

type HybridTrip = {
  id: string; name: string; startDate: string; totalDays: number; stays: Stay[];
};

type TripStore = { trips: HybridTrip[]; activeTripId: string };

type DragState = {
  stayId: string; mode: 'move' | 'resize-start' | 'resize-end';
  originX: number; originalStart: number; originalEnd: number;
} | null;

// ─── Legacy data model types (for storage compatibility) ──────────────────────
type LegacyDaySection = 'morning' | 'afternoon' | 'evening';
type LegacyTransportType = 'walk' | 'car' | 'bus' | 'train' | 'flight' | 'ferry' | 'other';
type LegacyLocationCategory = 'sightseeing' | 'dining' | 'hotel' | 'transit' | 'other';
type LegacyAccommodation = { name: string; lat?: number; lng?: number; cost?: number; notes?: string; link?: string };
type LegacyDay = { id: string; date: string; label?: string; accommodation?: LegacyAccommodation };
type LegacyRoute = { id: string; fromLocationId: string; toLocationId: string; transportType: LegacyTransportType; duration?: string; cost?: number; notes?: string };
type LegacyLocation = {
  id: string; name: string; lat: number; lng: number;
  notes?: string; category?: LegacyLocationCategory;
  checklist?: unknown[]; links?: unknown[];
  cost?: number; targetTime?: string; imageUrl?: string;
  dayIds: string[]; startDayId?: string; startSlot?: LegacyDaySection;
  duration?: number; order: number;
  subLocations?: LegacyLocation[]; dayOffset?: number;
  _color?: string; _lodging?: string; _area?: string; _visitType?: string;
};
type LegacyStoredTrip = {
  id: string; name: string; createdAt: number; updatedAt: number;
  startDate: string; endDate: string;
  days: LegacyDay[]; locations: LegacyLocation[]; routes: LegacyRoute[];
  version: string;
};
type LegacyTripsStore = { activeTripId: string; trips: LegacyStoredTrip[] };

// ─── Constants ────────────────────────────────────────────────────────────────
const LEGACY_STORAGE_KEY = 'itinerary-trips-v1';
const DAY_PARTS: DayPart[] = ['morning', 'afternoon', 'evening'];
const TRAVEL_MODES: TravelMode[] = ['train', 'flight', 'drive', 'ferry', 'bus', 'walk'];
const TRANSPORT_LABELS: Record<TravelMode, string> = {
  train: 'Train', flight: 'Flight', drive: 'Drive', ferry: 'Ferry', bus: 'Bus', walk: 'Walk',
};
const STAY_COLORS = [
  '#2167d7', '#615cf6', '#2db6ab', '#d78035',
  '#20b5a8', '#3b6dd8', '#c45c99', '#4c9463',
];
const VISIT_TYPES: VisitType[] = ['landmark', 'area', 'food', 'museum', 'walk', 'hotel'];

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

// ─── Helpers ──────────────────────────────────────────────────────────────────
function createVisit(
  id: string, name: string, type: VisitType, area: string,
  lat: number, lng: number, dayOffset: number | null, dayPart: DayPart | null,
  order: number, durationHint?: string,
): VisitItem {
  return { id, name, type, area, lat, lng, dayOffset, dayPart, order, durationHint };
}

function jitter(base: number, mag: number) { return base + (Math.random() - 0.5) * mag; }

function clamp(v: number, min: number, max: number) { return Math.min(Math.max(v, min), max); }

function addDaysTo(date: Date, n: number) {
  const d = new Date(date); d.setDate(d.getDate() + n); return d;
}

function fmt(date: Date, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('en-US', opts).format(date);
}

function getStayNightCount(stay: Stay) {
  return Math.max(1, Math.ceil((stay.endSlot - stay.startSlot) / 3));
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getVisitTypeBg(type: VisitType) {
  switch (type) {
    case 'food':     return 'bg-emerald-400';
    case 'landmark': return 'bg-primary';
    case 'museum':   return 'bg-blue-400';
    case 'walk':     return 'bg-teal-400';
    case 'hotel':    return 'bg-slate-400';
    default:         return 'bg-violet-400';
  }
}

function getOverlapIds(stays: Stay[]) {
  const overlaps = new Set<string>();
  stays.forEach((a, i) => stays.slice(i + 1).forEach((b) => {
    if (a.startSlot < b.endSlot && b.startSlot < a.endSlot) {
      overlaps.add(a.id); overlaps.add(b.id);
    }
  }));
  return overlaps;
}

function sortVisits(visits: VisitItem[]) {
  return [...visits].sort((a, b) => {
    if (a.dayOffset === null && b.dayOffset === null) return a.order - b.order;
    if (a.dayOffset === null) return -1;
    if (b.dayOffset === null) return 1;
    if (a.dayOffset !== b.dayOffset) return a.dayOffset - b.dayOffset;
    if (a.dayPart !== b.dayPart)
      return DAY_PARTS.indexOf(a.dayPart as DayPart) - DAY_PARTS.indexOf(b.dayPart as DayPart);
    return a.order - b.order;
  });
}

function normalizeVisitOrders(visits: VisitItem[]) {
  const buckets = new Map<string, VisitItem[]>();
  sortVisits(visits).forEach((v) => {
    const key = v.dayOffset === null || v.dayPart === null ? 'inbox' : `${v.dayOffset}-${v.dayPart}`;
    buckets.set(key, [...(buckets.get(key) ?? []), v]);
  });
  return Array.from(buckets.values()).flatMap((b) => b.map((v, i) => ({ ...v, order: i })));
}

function deriveStayDays(trip: HybridTrip, stay: Stay) {
  const firstDay = Math.floor(stay.startSlot / 3);
  const lastDay = Math.floor((stay.endSlot - 1) / 3);
  return Array.from({ length: lastDay - firstDay + 1 }, (_, i) => {
    const absoluteDay = firstDay + i;
    const enabledParts = DAY_PARTS.filter((p) => {
      const slot = absoluteDay * 3 + DAY_PARTS.indexOf(p);
      return slot >= stay.startSlot && slot < stay.endSlot;
    });
    // A night is spent here if the evening slot is within the stay
    const hasNight = enabledParts.includes('evening');
    const nightAccom = hasNight ? (stay.nightAccommodations?.[i] ?? (stay.lodging ? { name: stay.lodging } : undefined)) : undefined;
    return {
      dayOffset: i, absoluteDay,
      date: addDaysTo(new Date(trip.startDate), absoluteDay),
      enabledParts,
      hasNight,
      nightAccommodation: nightAccom as NightAccommodation | undefined,
    };
  });
}

type AccommodationGroup = {
  name: string;
  startDayOffset: number;
  nights: number;
  accommodation: NightAccommodation;
};

/** Groups consecutive nights with the same accommodation into spans */
function deriveAccommodationGroups(stayDays: ReturnType<typeof deriveStayDays>): AccommodationGroup[] {
  const groups: AccommodationGroup[] = [];
  let current: AccommodationGroup | null = null;
  for (const day of stayDays) {
    if (!day.hasNight || !day.nightAccommodation) {
      if (current) { groups.push(current); current = null; }
      continue;
    }
    if (current && current.name === day.nightAccommodation.name) {
      current.nights++;
    } else {
      if (current) groups.push(current);
      current = {
        name: day.nightAccommodation.name,
        startDayOffset: day.dayOffset,
        nights: 1,
        accommodation: day.nightAccommodation,
      };
    }
  }
  if (current) groups.push(current);
  return groups;
}

function getVisitTypeColor(type: VisitType) {
  switch (type) {
    case 'food':     return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    case 'landmark': return 'text-primary bg-primary/10 border-primary/20';
    case 'museum':   return 'text-blue-600 bg-blue-50 border-blue-200';
    case 'walk':     return 'text-teal-600 bg-teal-50 border-teal-200';
    case 'hotel':    return 'text-slate-600 bg-slate-50 border-slate-200';
    default:         return 'text-violet-600 bg-violet-50 border-violet-200';
  }
}

function getVisitLabel(type: VisitType) {
  switch (type) {
    case 'food': return 'Food'; case 'landmark': return 'Iconic';
    case 'museum': return 'Culture'; case 'walk': return 'Scenic';
    case 'hotel': return 'Stay'; default: return 'Lively';
  }
}

function getVisitTypeIcon(type: VisitType, cls = 'w-4 h-4') {
  switch (type) {
    case 'food':    return <UtensilsCrossed className={cls} />;
    case 'hotel':   return <Hotel className={cls} />;
    case 'walk':    return <MapPin className={cls} />;
    case 'landmark':
    case 'museum':  return <Landmark className={cls} />;
    default:        return <Compass className={cls} />;
  }
}

// ─── Sample data ──────────────────────────────────────────────────────────────
function createSampleTrip(): HybridTrip {
  return {
    id: 'sample-hybrid-trip',
    name: 'Japan Late Spring Circuit',
    startDate: '2026-05-28',
    totalDays: 15,
    stays: [
      {
        id: 'stay-tokyo', name: 'Tokyo Exploration', color: '#2167d7',
        startSlot: 0, endSlot: 10, centerLat: 35.6895, centerLng: 139.6917,
        lodging: 'Park Hyatt Tokyo', travelModeToNext: 'train',
        travelDurationToNext: '150 mins',
        travelNotesToNext: 'Hokuriku Shinkansen Kagayaki from Tokyo to Kanazawa.',
        visits: [
          createVisit('tokyo-1', 'Shinjuku & Omoide Yokocho', 'area', 'Shinjuku', 35.6923, 139.7024, 0, 'evening', 0),
          createVisit('tokyo-2', 'Sushi dinner at Sukiyabashi Jiro', 'food', 'Ginza', 35.6716, 139.7657, 0, 'evening', 1, '90m'),
          createVisit('tokyo-3', 'Meiji Jingu & Harajuku', 'landmark', 'Harajuku', 35.6764, 139.6993, 1, 'morning', 0, '2h'),
          createVisit('tokyo-4', 'Shibuya Crossing & Hachiko', 'area', 'Shibuya', 35.6585, 139.7013, 1, 'afternoon', 0, '2h'),
          createVisit('tokyo-5', 'Tokyo Tower', 'landmark', 'Minato', 35.6584, 139.7455, 2, 'morning', 0, '1h'),
          createVisit('tokyo-6', 'Senso-ji & Sumida River', 'landmark', 'Asakusa', 35.7148, 139.7967, 2, 'afternoon', 0, '2h'),
          createVisit('tokyo-7', 'Akihabara Electric Town', 'area', 'Akihabara', 35.6984, 139.7711, 2, 'evening', 0, '2h'),
          createVisit('tokyo-8', 'Tsukiji Outer Market', 'food', 'Tsukiji', 35.6655, 139.7707, 3, 'morning', 0, '90m'),
          createVisit('tokyo-9', 'Ginza department stores', 'area', 'Ginza', 35.671, 139.765, null, null, 0, 'Flexible'),
          createVisit('tokyo-10', 'Imperial Palace gardens', 'walk', 'Chiyoda', 35.6852, 139.7528, null, null, 1, '1h'),
          createVisit('tokyo-11', 'teamLab Planets', 'museum', 'Toyosu', 35.6449, 139.7904, null, null, 2, '2h'),
        ],
      },
      {
        id: 'stay-kanazawa', name: 'Kanazawa & Hokuriku', color: '#615cf6',
        startSlot: 10, endSlot: 18, centerLat: 36.5613, centerLng: 136.6562,
        lodging: 'Hyatt Centric Kanazawa', travelModeToNext: 'bus',
        travelDurationToNext: '75 mins',
        travelNotesToNext: 'Advance-booked Nohi Bus toward Shirakawa-go.',
        visits: [
          createVisit('kanazawa-1', 'Higashi Chaya District', 'area', 'Higashi Chaya', 36.5724, 136.6665, 0, 'evening', 0, '2h'),
          createVisit('kanazawa-2', 'Kenrokuen Garden & Castle', 'walk', 'Kenrokuen', 36.5621, 136.6627, 1, 'morning', 0, '2-3h'),
          createVisit('kanazawa-3', '21st Century Museum of Contemporary Art', 'museum', 'Hirosaka', 36.5609, 136.6582, 1, 'evening', 0, '2h'),
          createVisit('kanazawa-4', 'Omicho Market dinner', 'food', 'Omicho', 36.5718, 136.6567, 1, 'afternoon', 0, '90m'),
          createVisit('kanazawa-5', 'Kaga Onsen (Yamanaka)', 'walk', 'Yamanaka Onsen', 36.2464, 136.3758, 2, 'morning', 0, 'Half day'),
          createVisit('kanazawa-6', 'Nagamachi Samurai District', 'area', 'Nagamachi', 36.5596, 136.6514, null, null, 0, '90m'),
        ],
      },
      {
        id: 'stay-kyoto', name: 'Kyoto & Nara Cultural Core', color: '#d78035',
        startSlot: 21, endSlot: 36, centerLat: 35.0116, centerLng: 135.7681,
        lodging: 'The Ritz-Carlton Kyoto', travelModeToNext: 'train',
        travelDurationToNext: '30 mins',
        travelNotesToNext: 'JR Special Rapid Service from Kyoto to Osaka.',
        visits: [
          createVisit('kyoto-1', 'Gion & Pontocho Alley', 'area', 'Gion', 35.0037, 135.775, 0, 'evening', 0, '2h'),
          createVisit('kyoto-2', 'Arashiyama Bamboo Grove & Tenryu-ji', 'walk', 'Arashiyama', 35.0158, 135.672, 1, 'morning', 0, '2h'),
          createVisit('kyoto-3', 'Kinkaku-ji & Ryoan-ji', 'landmark', 'Kita', 35.0394, 135.7292, 1, 'afternoon', 0, '2h'),
          createVisit('kyoto-4', 'Kiyomizu-dera & Sannenzaka', 'landmark', 'Higashiyama', 34.9949, 135.785, 1, 'evening', 0, '2h'),
          createVisit('kyoto-5', 'Nara Day Trip (Todai-ji & Deer Park)', 'landmark', 'Nara', 34.6851, 135.8048, 2, 'morning', 0, 'Half day'),
          createVisit('kyoto-6', 'Fushimi Inari Shrine', 'landmark', 'Fushimi', 34.9671, 135.7727, 3, 'morning', 0, '90m'),
          createVisit('kyoto-7', 'Nishiki Market & Teramachi', 'food', 'Downtown', 35.005, 135.7649, 3, 'afternoon', 0, '2h'),
          createVisit('kyoto-8', "Philosopher's Path", 'walk', 'Sakyo', 35.0269, 135.7959, null, null, 0, 'Flexible'),
        ],
      },
      {
        id: 'stay-osaka', name: 'Osaka City', color: '#20b5a8',
        startSlot: 36, endSlot: 45, centerLat: 34.6937, centerLng: 135.5023,
        lodging: 'W Osaka', travelModeToNext: 'train',
        travelDurationToNext: '155 mins',
        travelNotesToNext: 'Tokaido Shinkansen Nozomi to Tokyo Station.',
        visits: [
          createVisit('osaka-1', 'Osaka Castle Park', 'landmark', 'Chuo', 34.6873, 135.5262, 0, 'morning', 0, '2h'),
          createVisit('osaka-2', 'Dotonbori Neon & Food Tour', 'food', 'Namba', 34.6687, 135.5013, 0, 'evening', 0, '2h'),
          createVisit('osaka-3', 'Kuromon Market', 'food', 'Nippombashi', 34.6654, 135.5064, 1, 'morning', 0, '90m'),
          createVisit('osaka-4', 'Shinsekai & Abeno Harukas', 'area', 'Tennoji', 34.6525, 135.5063, 1, 'afternoon', 0, '2h'),
          createVisit('osaka-5', 'teamLab Botanical Garden', 'museum', 'Nagai', 34.6129, 135.5227, null, null, 0, '2h'),
        ],
      },
    ],
  };
}

// ─── Legacy ↔ Hybrid adapters ─────────────────────────────────────────────────
function legacySlotToIndex(slot?: LegacyDaySection): number {
  if (slot === 'afternoon') return 1;
  if (slot === 'evening') return 2;
  return 0;
}

function indexToLegacySlot(idx: number): LegacyDaySection {
  const r = idx % 3;
  if (r === 1) return 'afternoon';
  if (r === 2) return 'evening';
  return 'morning';
}

function legacyTransportToMode(t?: LegacyTransportType): TravelMode {
  if (t === 'car') return 'drive';
  if (t === 'other' || !t) return 'train';
  return t as TravelMode;
}

function modeToLegacyTransport(m: TravelMode): LegacyTransportType {
  if (m === 'drive') return 'car';
  return m as LegacyTransportType;
}

function legacyCategoryToVisitType(cat?: LegacyLocationCategory, hint?: string): VisitType {
  if (hint && (VISIT_TYPES as string[]).includes(hint)) return hint as VisitType;
  if (cat === 'dining') return 'food';
  if (cat === 'hotel') return 'hotel';
  if (cat === 'sightseeing') return 'landmark';
  if (cat === 'transit') return 'walk';
  return 'area';
}

function visitTypeToLegacyCategory(type: VisitType): LegacyLocationCategory {
  if (type === 'food') return 'dining';
  if (type === 'hotel') return 'hotel';
  if (type === 'landmark' || type === 'museum') return 'sightseeing';
  if (type === 'walk') return 'transit';
  return 'other';
}

function legacyTripToHybrid(leg: LegacyStoredTrip, colorOffset = 0): HybridTrip {
  const startDate = leg.startDate ?? '2025-01-01';
  const s = new Date(startDate);
  const e = new Date(leg.endDate ?? startDate);
  const rawDays = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
  const totalDays = Number.isFinite(rawDays) && rawDays >= 1 ? rawDays : 1;
  const days = leg.days ?? [];
  const routes = leg.routes ?? [];

  const dayIdxById: Record<string, number> = {};
  days.forEach((d, i) => { dayIdxById[d.id] = i; });

  const stays: Stay[] = (leg.locations ?? []).map((loc, locIdx) => {
    const startDayIdx = loc.startDayId ? (dayIdxById[loc.startDayId] ?? 0) : 0;
    const startSlot = startDayIdx * 3 + legacySlotToIndex(loc.startSlot);
    const duration = loc.duration ?? 3;
    const endSlot = Math.min(startSlot + duration, totalDays * 3);

    const nextLoc = leg.locations?.[locIdx + 1];
    const routeToNext = nextLoc
      ? routes.find((r) =>
          (r.fromLocationId === loc.id && r.toLocationId === nextLoc.id) ||
          (r.fromLocationId === nextLoc.id && r.toLocationId === loc.id),
        )
      : undefined;

    const lodging = loc._lodging ?? days[startDayIdx]?.accommodation?.name ?? '';
    const color = loc._color ?? STAY_COLORS[(colorOffset + locIdx) % STAY_COLORS.length];

    // Build per-night accommodation from legacy days.
    // A "night" on dayOffset i means sleeping between day i and day i+1,
    // so we check if the evening slot of that absolute day is within the stay.
    const lastDay = Math.floor((endSlot - 1) / 3);
    const nightAccommodations: Record<number, NightAccommodation> = {};
    for (let absDay = startDayIdx; absDay <= lastDay; absDay++) {
      const eveningSlot = absDay * 3 + 2; // evening = last slot of the day
      if (eveningSlot >= startSlot && eveningSlot < endSlot) {
        const legDay = days[absDay];
        if (legDay?.accommodation?.name) {
          const a = legDay.accommodation;
          nightAccommodations[absDay - startDayIdx] = {
            name: a.name, lat: a.lat, lng: a.lng, cost: a.cost, notes: a.notes, link: a.link,
          };
        }
      }
    }

    const visits: VisitItem[] = (loc.subLocations ?? []).map((sub) => {
      // Legacy uses sub.dayOffset (0-based relative to parent) + sub.startSlot directly
      const dayOffset = sub.dayOffset ?? null;
      const dayPart = sub.startSlot ? (sub.startSlot as DayPart) : null;
      const isScheduled = dayOffset !== null && dayPart !== null;
      return {
        id: sub.id,
        name: sub.name,
        type: legacyCategoryToVisitType(sub.category, sub._visitType),
        area: sub._area ?? sub.name,
        lat: sub.lat,
        lng: sub.lng,
        durationHint: sub.duration != null ? `${sub.duration}h` : undefined,
        dayOffset: isScheduled ? dayOffset : null,
        dayPart: isScheduled ? dayPart : null,
        order: sub.order ?? 0,
        notes: sub.notes,
      };
    });

    return {
      id: loc.id, name: loc.name, color,
      startSlot, endSlot,
      centerLat: loc.lat, centerLng: loc.lng,
      lodging,
      nightAccommodations: Object.keys(nightAccommodations).length > 0 ? nightAccommodations : undefined,
      travelModeToNext: legacyTransportToMode(routeToNext?.transportType),
      travelDurationToNext: routeToNext?.duration,
      travelNotesToNext: routeToNext?.notes,
      visits,
    };
  });

  return { id: leg.id, name: leg.name, startDate, totalDays, stays };
}

function hybridTripToLegacy(trip: HybridTrip): LegacyStoredTrip {
  const startDate = trip.startDate || '2025-01-01';
  const totalDays = Number.isFinite(trip.totalDays) && trip.totalDays >= 1 ? trip.totalDays : 1;
  const endDate = addDaysTo(new Date(startDate), totalDays - 1).toISOString().split('T')[0];

  const days: LegacyDay[] = Array.from({ length: totalDays }, (_, i) => {
    const date = addDaysTo(new Date(startDate), i).toISOString().split('T')[0];
    const coveringStay = trip.stays.find((s) => {
      const sStart = Math.floor(s.startSlot / 3);
      const sEnd = Math.ceil(s.endSlot / 3);
      return i >= sStart && i < sEnd;
    });
    // Prefer per-night accommodation if available, fall back to stay.lodging
    let accommodation: LegacyAccommodation | undefined;
    if (coveringStay) {
      const dayOffset = i - Math.floor(coveringStay.startSlot / 3);
      const nightAccom = coveringStay.nightAccommodations?.[dayOffset];
      if (nightAccom) {
        accommodation = { ...nightAccom };
      } else if (coveringStay.lodging) {
        accommodation = { name: coveringStay.lodging };
      }
    }
    return {
      id: `day-${i}-${trip.id}`,
      date,
      accommodation,
    };
  });

  const dayIdByIdx: Record<number, string> = {};
  days.forEach((d, i) => { dayIdByIdx[i] = d.id; });

  const routes: LegacyRoute[] = [];
  const sortedStays = [...trip.stays].sort((a, b) => a.startSlot - b.startSlot);

  const locations: LegacyLocation[] = sortedStays.map((stay, stayIdx) => {
    const startDayIdx = Math.floor(stay.startSlot / 3);
    const startDayId = dayIdByIdx[startDayIdx];
    const duration = stay.endSlot - stay.startSlot;

    const nextStay = sortedStays[stayIdx + 1];
    if (nextStay) {
      routes.push({
        id: `route-${stay.id}-${nextStay.id}`,
        fromLocationId: stay.id,
        toLocationId: nextStay.id,
        transportType: modeToLegacyTransport(stay.travelModeToNext),
        duration: stay.travelDurationToNext,
        notes: stay.travelNotesToNext,
      });
    }

    const subLocations: LegacyLocation[] = stay.visits.map((v) => {
      const absDayIdx = v.dayOffset !== null ? startDayIdx + v.dayOffset : startDayIdx;
      const subDayId = v.dayOffset !== null ? (dayIdByIdx[absDayIdx] ?? startDayId) : undefined;
      let durationNum: number | undefined;
      if (v.durationHint) {
        const m = v.durationHint.match(/(\d+(?:\.\d+)?)/);
        if (m) durationNum = parseFloat(m[1]);
      }
      return {
        id: v.id, name: v.name,
        lat: v.lat, lng: v.lng,
        notes: v.notes,
        category: visitTypeToLegacyCategory(v.type),
        dayIds: subDayId ? [subDayId] : [],
        startDayId: subDayId,
        startSlot: v.dayPart as LegacyDaySection | undefined,
        // dayOffset is the canonical scheduling field in legacy sub-itineraries
        dayOffset: v.dayOffset ?? undefined,
        duration: durationNum,
        order: v.order,
        checklist: [], links: [],
        _area: v.area,
        _visitType: v.type,
      };
    });

    return {
      id: stay.id, name: stay.name,
      lat: stay.centerLat, lng: stay.centerLng,
      notes: '', category: 'hotel',
      dayIds: [],
      startDayId,
      startSlot: indexToLegacySlot(stay.startSlot),
      duration,
      order: stayIdx,
      subLocations,
      checklist: [], links: [],
      _color: stay.color,
      _lodging: stay.lodging,
    };
  });

  return {
    id: trip.id, name: trip.name,
    createdAt: Date.now(), updatedAt: Date.now(),
    startDate, endDate,
    days, locations, routes,
    version: '2.0',
  };
}

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
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  // 3. Oldest single-trip key
  try {
    const old = localStorage.getItem('itinerary-hybrid-v3');
    if (old) {
      const trip: HybridTrip = JSON.parse(old);
      return { trips: [trip], activeTripId: trip.id };
    }
  } catch { /* ignore */ }
  const sample = createSampleTrip();
  return { trips: [sample], activeTripId: sample.id };
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
  const [snapshots, setSnapshots] = useState<HistorySnapshot[]>([{ trip: initial, timestamp: Date.now() }]);
  const [idx, setIdx] = useState(0);

  const push = useCallback((next: HybridTrip) => {
    setSnapshots((prev) => [...prev.slice(0, idx + 1), { trip: next, timestamp: Date.now() }].slice(-50));
    setIdx((i) => Math.min(i + 1, 49));
  }, [idx]);

  const undo = useCallback(() => {
    if (idx > 0) { setIdx((i) => i - 1); return snapshots[idx - 1].trip; }
    return null;
  }, [idx, snapshots]);

  const redo = useCallback(() => {
    if (idx < snapshots.length - 1) { setIdx((i) => i + 1); return snapshots[idx + 1].trip; }
    return null;
  }, [idx, snapshots]);

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
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => { if (e.target === e.currentTarget) backdropRef.current = true; }}
      onMouseUp={(e) => { if (e.target === e.currentTarget && backdropRef.current) onClose(); backdropRef.current = false; }}
    >
      <div className={`bg-white rounded-xl shadow-2xl w-full ${width} max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
          <h3 className="font-extrabold text-slate-800 text-sm">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition-colors focus-visible:ring-2 focus-visible:ring-primary/50">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

// ─── Accommodation editor modal ──────────────────────────────────────────────
function AccommodationEditorModal({ initial, nightCount, existingNames, onClose, onSave, onRemove }: {
  initial?: NightAccommodation;
  nightCount: number;
  existingNames: string[];
  onClose: () => void;
  onSave: (accom: NightAccommodation) => void;
  onRemove?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [cost, setCost] = useState(initial?.cost?.toString() ?? '');
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

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      notes: notes.trim() || undefined,
      cost: cost ? parseFloat(cost) || undefined : undefined,
      lat, lng,
    });
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
          <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-1.5 block">
            Hotel / Address
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              className="w-full border border-slate-200 rounded-lg pl-9 pr-8 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none font-semibold"
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
                      <p className="text-[10px] text-slate-500 truncate">{parts.slice(1, 4).join(',').trim()}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-1.5 block">Notes</label>
          <input
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            placeholder="Address, confirmation #, etc."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Cost */}
        <div>
          <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-1.5 block">Nightly Cost</label>
          <input
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            placeholder="0.00"
            type="number"
            min="0"
            step="0.01"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          {onRemove ? (
            <button
              onClick={() => { onRemove(); onClose(); }}
              className="text-[11px] font-bold text-red-500 hover:text-red-600 flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Remove
            </button>
          ) : <div />}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-[11px] font-bold text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim()}
              className="px-4 py-2 text-[11px] font-bold text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
          <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-2 block">Transport Mode</label>
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
                <span className="text-[10px] font-bold uppercase tracking-tight">{modeConfig[m].label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Duration */}
        <div>
          <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-2 block">Duration</label>
          <input
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            placeholder="e.g. 2h 30m"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
        </div>

        {/* Notes */}
        <div>
          <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-2 block">Notes</label>
          <textarea
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none resize-none"
            rows={3}
            placeholder="Booking reference, platform, tips..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => { onSave(mode, duration, notes); onClose(); }}
            className="flex-1 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors"
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
          <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-2 block">Destination Name</label>
          <input
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none font-semibold"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        <div>
          <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-2 block">Lodging</label>
          <input
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            value={lodging}
            onChange={(e) => setLodging(e.target.value)}
            placeholder="Hotel name or area"
          />
        </div>
        <div>
          <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-2 block">Color</label>
          <div className="flex gap-2 flex-wrap">
            {STAY_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                aria-label={`Color ${c}`}
                aria-pressed={color === c}
                className={`size-8 rounded-full border-2 transition-all focus-visible:ring-2 focus-visible:ring-primary/50 ${color === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'border-white hover:scale-110'}`}
                style={{ background: c }}
              />
            ))}
            <div className="flex flex-col items-center gap-0.5">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="size-8 rounded-full border-2 border-slate-200 cursor-pointer"
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
            <button onClick={() => setConfirmDelete(true)} className="py-2.5 px-4 border border-red-200 text-red-500 rounded-lg text-sm font-bold hover:bg-red-50 transition-colors flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-red-300">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
            <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors focus-visible:ring-2 focus-visible:ring-primary/50">
              Cancel
            </button>
            <button
              onClick={() => { onSave({ name, lodging, color }); onClose(); }}
              className="flex-1 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              Save
            </button>
          </div>
        )}
      </div>
    </ModalBase>
  );
}

// ─── Visit editor modal ───────────────────────────────────────────────────────
function VisitFormModal({ initial, title, onClose, onSave, onDelete, onUnschedule }: {
  initial?: Partial<VisitItem>; title: string; onClose: () => void;
  onSave: (data: { name: string; type: VisitType; area: string; durationHint: string; notes: string; lat?: number; lng?: number }) => void;
  onDelete?: () => void;
  onUnschedule?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<VisitType>(initial?.type ?? 'area');
  const [area, setArea] = useState(initial?.area ?? '');
  const [duration, setDuration] = useState(initial?.durationHint ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [searchResults, setSearchResults] = useState<PlaceSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [pickedCoords, setPickedCoords] = useState<{ lat: number; lng: number } | null>(
    initial?.lat != null ? { lat: initial.lat, lng: initial.lng! } : null,
  );
  const [showResults, setShowResults] = useState(false);
  const [showExtras, setShowExtras] = useState(!!initial?.id); // show extras when editing
  const [searchError, setSearchError] = useState(false);
  const isEditing = !!initial?.id;

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
    setArea(parts.slice(1, 3).map((s) => s.trim()).filter(Boolean).join(', '));
    setPickedCoords({ lat: parseFloat(r.lat), lng: parseFloat(r.lon) });
    setSearchResults([]);
    setShowResults(false);
  };

  const typeConfig: Record<VisitType, string> = {
    area: 'Lively', landmark: 'Iconic', food: 'Food',
    museum: 'Culture', walk: 'Scenic', hotel: 'Stay',
  };

  return (
    <ModalBase title={title} onClose={onClose}>
      <div className="space-y-4">
        <div className="relative">
          <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-2 block">
            Search or enter a place name
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none font-semibold"
              placeholder="e.g. Senso-ji Temple, Tokyo"
              value={name}
              onChange={(e) => { setName(e.target.value); setPickedCoords(null); }}
              onFocus={() => searchResults.length > 0 && setShowResults(true)}
              autoFocus
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            )}
            {pickedCoords && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500" title="Location geocoded">
                <Check className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
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
                      <p className="text-[10px] text-slate-500 truncate">{parts.slice(1, 4).join(',').trim()}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {searchError && (
            <p className="text-[10px] text-red-500 font-medium mt-1">Search failed. You can still save with a manual name.</p>
          )}
        </div>
        {/* Type — compact pill row, always visible */}
        <div>
          <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-2 block">Type</label>
          <div className="flex flex-wrap gap-1.5">
            {VISIT_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                aria-pressed={type === t}
                className={`py-1.5 px-3 rounded-full border text-[10px] font-bold transition-all flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-primary/50 ${
                  type === t ? `${getVisitTypeColor(t)} border-current` : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                {getVisitTypeIcon(t, 'w-3 h-3')}
                {typeConfig[t]}
              </button>
            ))}
          </div>
        </div>

        {/* Extras — collapsed for new places, expanded when editing */}
        {!isEditing && (
          <button
            onClick={() => setShowExtras((v) => !v)}
            className="text-[10px] font-bold text-slate-400 hover:text-primary transition-colors flex items-center gap-1"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showExtras ? 'rotate-180' : ''}`} />
            {showExtras ? 'Less details' : 'Add duration, area, notes…'}
          </button>
        )}

        {showExtras && (
          <>
            <div>
              <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-2 block">Area / Neighbourhood</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                placeholder="e.g. Shibuya, Tokyo"
                value={area}
                onChange={(e) => setArea(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-2 block">Duration</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                placeholder="e.g. 2h, 90m, Half day"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-2 block">Notes</label>
              <textarea
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none resize-none"
                rows={2}
                placeholder="Booking info, tips..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </>
        )}

        {(onDelete || onUnschedule) && (
          <div className="flex gap-2 pt-1">
            {onUnschedule && (
              <button onClick={() => { onUnschedule(); onClose(); }} className="flex-1 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5">
                <X className="w-3 h-3" /> Move to Unplanned
              </button>
            )}
            {onDelete && (
              <button onClick={() => { onDelete(); onClose(); }} className="flex-1 py-2 border border-red-200 text-red-500 rounded-lg text-xs font-bold hover:bg-red-50 transition-colors flex items-center justify-center gap-1.5">
                <Trash2 className="w-3 h-3" /> Delete
              </button>
            )}
          </div>
        )}
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button
            disabled={!name.trim()}
            onClick={() => {
              if (name.trim()) {
                onSave({ name: name.trim(), type, area, durationHint: duration, notes, lat: pickedCoords?.lat, lng: pickedCoords?.lng });
                onClose();
              }
            }}
            className="flex-1 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      </div>
    </ModalBase>
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
  const [dateMode, setDateMode] = useState<'duration' | 'endDate'>('duration');

  const endDateStr = startDate
    ? addDaysTo(new Date(startDate), totalDays - 1).toISOString().split('T')[0]
    : '';

  const handleEndDateChange = (end: string) => {
    if (!startDate || !end) return;
    const diff = Math.round((new Date(end).getTime() - new Date(startDate).getTime()) / 86400000) + 1;
    if (diff >= 1) setTotalDays(diff);
  };

  const inputClass = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none';

  return (
    <ModalBase title="Edit Trip" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-2 block">Trip Name</label>
          <input
            className={`${inputClass} font-semibold`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>

        {/* Date mode toggle */}
        <div>
          <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-2 block">Dates</label>
          <div className="flex bg-slate-100 rounded-lg p-0.5 mb-3">
            <button
              onClick={() => setDateMode('duration')}
              className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-colors ${dateMode === 'duration' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Start + Days
            </button>
            <button
              onClick={() => setDateMode('endDate')}
              className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-colors ${dateMode === 'endDate' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Start + End Date
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">Start</label>
              <input
                type="date"
                className={inputClass}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            {dateMode === 'duration' ? (
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">Days</label>
                <input
                  type="number"
                  min={1} max={60}
                  className={inputClass}
                  value={totalDays}
                  onChange={(e) => setTotalDays(Math.max(1, parseInt(e.target.value) || 1))}
                />
              </div>
            ) : (
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">End</label>
                <input
                  type="date"
                  className={inputClass}
                  value={endDateStr}
                  min={startDate}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>

        {startDate && totalDays > 0 && (
          <div className="flex items-center gap-2 text-[10px] text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
            <Calendar className="w-3 h-3 text-slate-400 flex-shrink-0" />
            <span>
              {fmt(new Date(startDate), { month: 'short', day: 'numeric' })} — {fmt(addDaysTo(new Date(startDate), totalDays - 1), { month: 'short', day: 'numeric', year: 'numeric' })}
              <span className="ml-1.5 text-slate-400">({totalDays} day{totalDays !== 1 ? 's' : ''})</span>
            </span>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          {onDelete && (
            <button onClick={() => { onDelete(); onClose(); }} className="py-2.5 px-4 border border-red-200 text-red-500 rounded-lg text-sm font-bold hover:bg-red-50 transition-colors flex items-center gap-1.5">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          )}
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => { onSave({ name, startDate, totalDays }); onClose(); }}
            className="flex-1 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors"
          >
            Save
          </button>
        </div>
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
              <p className="text-[10px] text-slate-500 mt-0.5">
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
function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

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
                <span className={`text-[10px] font-mono mt-0.5 shrink-0 ${isCurrent ? 'text-primary' : 'text-slate-300'}`}>
                  #{i}
                </span>
                <div className="min-w-0">
                  <p className={`text-xs font-semibold truncate ${isCurrent ? 'text-primary' : 'text-slate-700'}`}>
                    {snap.trip.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <p className="text-[10px] text-slate-400">
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
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 }}
      className="p-3 bg-white rounded-lg border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all group"
    >
      <div className="flex justify-between items-start mb-1.5">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter border ${getVisitTypeColor(visit.type)}`}>
          {getVisitLabel(visit.type)}
        </span>
        <div className="flex items-center gap-1">
          <button onClick={onEdit} className="opacity-60 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-primary/50" aria-label={`Edit ${visit.name}`}>
            <Pencil className="w-3 h-3" />
          </button>
          <div className="cursor-grab active:cursor-grabbing p-1" {...listeners} {...attributes} aria-label="Drag to schedule" role="button">
            <GripVertical className="w-4 h-4 text-slate-400 hover:text-slate-500" />
          </div>
        </div>
      </div>
      <p className="text-xs font-bold text-slate-800">{visit.name}</p>
      <p className="text-[10px] text-slate-500 mt-1 font-medium">{visit.area}</p>
      {visit.durationHint && <p className="text-[10px] text-slate-400 mt-0.5">{visit.durationHint}</p>}
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
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 }}
      className={`relative pl-[18px] pr-3.5 py-3.5 bg-white rounded-lg border transition-all group ${
        isOver
          ? 'border-primary shadow-md ring-2 ring-primary/25 bg-primary/[0.02]'
          : isSelected
          ? 'border-primary/30 shadow-[0_4px_12px_rgba(236,91,19,0.1)] ring-1 ring-primary/10'
          : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
      }`}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg ${getVisitTypeBg(visit.type)}`} />
      {isOver && <div className="absolute -top-1 left-2 right-2 h-0.5 bg-primary rounded-full z-10" />}
      <div className="flex items-start justify-between mb-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter border ${getVisitTypeColor(visit.type)}`}>
            {getVisitLabel(visit.type)}
          </span>
          {visit.durationHint && <span className="text-[10px] text-slate-400 font-medium">{visit.durationHint}</span>}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 ml-1">
          <button onClick={onEdit} className="opacity-60 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-primary/50" aria-label={`Edit ${visit.name}`}>
            <Pencil className="w-3 h-3" />
          </button>
          <div className="cursor-grab active:cursor-grabbing p-1" {...listeners} {...attributes} onClick={(e) => e.stopPropagation()} aria-label="Drag to reorder" role="button">
            <GripVertical className="w-4 h-4 text-slate-300 hover:text-slate-400" />
          </div>
        </div>
      </div>
      <p onClick={onSelect} className="text-xs font-bold leading-tight text-slate-800 cursor-pointer hover:text-primary transition-colors">
        {visit.name}
      </p>
      {visit.area && (
        <p className="text-[10px] text-slate-500 mt-1.5 flex items-center gap-1 font-medium">
          <MapPin className="w-2.5 h-2.5 text-slate-400" /> {visit.area}
        </p>
      )}
      {visit.notes && (
        <p className="text-[10px] text-slate-400 mt-1 italic leading-snug">{visit.notes}</p>
      )}
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
          <span className="text-[10px] font-bold uppercase tracking-tight">Drop or add</span>
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
        trip.totalDays, mode,
        mode === 'refine' ? trip.stays.map((s) => ({ name: s.name, startSlot: s.startSlot, endSlot: s.endSlot })) : undefined,
      );
      // Map AI output → app Stay type
      const newStays: Stay[] = (result.stays as AIHybridStay[]).map((s, i) => ({
        id: `ai-stay-${Date.now()}-${i}`,
        name: s.name,
        color: s.color,
        startSlot: s.startSlot,
        endSlot: s.endSlot,
        centerLat: s.centerLat,
        centerLng: s.centerLng,
        lodging: s.lodging ?? '',
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
      }));
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
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2 block">Mode</span>
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
              <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2 block">
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
                  <p className="text-[10px] text-slate-400 font-medium pt-1">Generating your itinerary…</p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary">AI Plan Ready</span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed italic">{explanation}</p>
              <p className="text-[10px] text-slate-400 pt-1">Review the summary above, then apply to your timeline.</p>
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
                className="flex-1 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" /> Apply to Timeline
              </button>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={loading || !prompt.trim()}
                className="flex-1 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
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
            <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2 block">Gemini API Key</label>
            <input
              type="password"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none font-mono"
              placeholder="AIza…"
              value={settings.apiKey}
              onChange={(e) => onSettingsChange({ ...settings, apiKey: e.target.value })}
            />
            <p className="text-[10px] text-slate-400 mt-1.5">
              Stored locally in your browser.{' '}
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-primary underline">Get a free key →</a>
            </p>
          </div>
          <div>
            <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2 block">Model</label>
            <input
              type="text"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none font-mono"
              placeholder="gemini-2.0-flash"
              value={settings.model}
              onChange={(e) => onSettingsChange({ ...settings, model: e.target.value })}
            />
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-lg px-4 py-3 text-[10px] text-slate-500 leading-relaxed">
            Recommended: <span className="font-mono font-bold text-slate-700">gemini-2.0-flash</span> — fast and capable.<br />
            For complex trips try <span className="font-mono font-bold text-slate-700">gemini-2.5-pro</span>.
          </div>
        </div>
      )}
    </ModalBase>
  );
}

// ─── Profile dropdown menu ────────────────────────────────────────────────────
function ProfileMenu({ trip, onImport, onSwitchToLegacy }: {
  trip: HybridTrip;
  onImport: (data: HybridTrip) => void;
  onSwitchToLegacy: () => void;
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
    const legacy = hybridTripToLegacy(trip);
    const endDate = addDaysTo(new Date(trip.startDate), trip.totalDays - 1).toISOString().split('T')[0];
    const md = generateMarkdown(legacy.days, legacy.locations as unknown as import('./types').Location[], legacy.routes, trip.startDate, endDate);
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
        onImport(parsed as HybridTrip);
      } catch {
        alert('Error reading file. Please ensure it is valid JSON.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
    setOpen(false);
  };

  const menuItem = 'w-full flex items-center gap-2.5 px-3 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors';

  return (
    <div className="relative" data-profile-menu>
      <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
      <button
        onClick={() => setOpen(!open)}
        className={`size-8 rounded-full flex items-center justify-center text-xs font-bold border transition-all flex-shrink-0 ml-1 ${
          open ? 'bg-primary text-white border-primary'
            : user ? 'bg-emerald-500 text-white border-emerald-400 hover:bg-emerald-600'
            : 'bg-primary/10 text-primary border-primary/20 hover:bg-primary hover:text-white'
        }`}
      >
        {user ? <span className="text-[10px] font-bold">{(user.email?.[0] ?? 'U').toUpperCase()}</span> : <User className="w-3.5 h-3.5" />}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-xl border border-slate-200/80 py-1.5 z-50">
          <div className="px-3 py-2 border-b border-slate-100">
            {user ? (
              <>
                <p className="text-xs font-bold text-slate-800 truncate">{user.email}</p>
                <p className="text-[10px] text-emerald-500 font-semibold mt-0.5">Signed in</p>
              </>
            ) : (
              <>
                <p className="text-xs font-bold text-slate-800">Guest User</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Local storage only</p>
              </>
            )}
          </div>
          <div className="py-1">
            <button onClick={handleExport} className={menuItem}>
              <Download className="w-3.5 h-3.5 text-slate-400" />
              Export Trip (JSON)
            </button>
            <button onClick={handleExportMarkdown} className={menuItem}>
              <Download className="w-3.5 h-3.5 text-slate-400" />
              Export Trip (Markdown)
            </button>
            <button onClick={() => fileInputRef.current?.click()} className={menuItem}>
              <Upload className="w-3.5 h-3.5 text-slate-400" />
              Import Trip (JSON)
            </button>
          </div>
          <div className="border-t border-slate-100 py-1">
            <button onClick={() => { onSwitchToLegacy(); setOpen(false); }} className={menuItem}>
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              Switch to Classic View
            </button>
          </div>
          <div className="border-t border-slate-100 py-1">
            {user ? (
              <button
                onClick={async () => { await signOutUser(); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[11px] font-semibold text-red-500 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            ) : (
              <button
                onClick={() => { setOpen(false); setShowAuth(true); }}
                className={menuItem}
              >
                <LogIn className="w-3.5 h-3.5 text-slate-400" />
                Sign In / Sign Up
              </button>
            )}
          </div>
        </div>
      )}
      {showAuth && <AuthModalSimple onClose={() => setShowAuth(false)} />}
    </div>
  );
}

// ─── Simple auth modal for Chronos ───────────────────────────────────────────
function AuthModalSimple({ onClose }: { onClose: () => void }) {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  const inputClass = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none';

  return (
    <ModalBase title={mode === 'signin' ? 'Sign In' : 'Sign Up'} onClose={onClose} width="max-w-sm">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex bg-slate-100 rounded-lg p-0.5 mb-1">
          <button type="button" onClick={() => { setMode('signin'); setError(null); }}
            className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-colors ${mode === 'signin' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
          >Sign In</button>
          <button type="button" onClick={() => { setMode('signup'); setError(null); }}
            className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-colors ${mode === 'signup' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
          >Sign Up</button>
        </div>
        <input className={inputClass} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        <input className={inputClass} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="text-[11px] text-red-500 font-semibold bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <button type="submit" disabled={loading} className="w-full py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50">
          {loading ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
        </button>
        <div className="relative flex items-center gap-3 py-1">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-[9px] font-bold text-slate-400 uppercase">or</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>
        <button type="button" onClick={handleGoogle} disabled={loading}
          className="w-full py-2.5 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Continue with Google
        </button>
        <p className="text-[10px] text-center text-slate-400">
          {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          <button type="button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); }} className="text-primary font-bold hover:underline">
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </form>
    </ModalBase>
  );
}

// ─── CHRONOS App ──────────────────────────────────────────────────────────────
function ChronosApp({ onSwitchToLegacy }: { onSwitchToLegacy: () => void }) {
  // ── Store (multi-trip) ───────────────────────────────────────────────────
  const [store, setStore] = useState<TripStore>(() => loadStore());

  const trip = useMemo(
    () => store.trips.find((t) => t.id === store.activeTripId) ?? store.trips[0],
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

  // Sync with history
  const hist = useHistory(trip);

  const setTrip = useCallback((fn: ((t: HybridTrip) => HybridTrip) | HybridTrip) => {
    const next = typeof fn === 'function' ? fn(trip) : fn;
    hist.push(next);
    updateTrip(() => next);
  }, [trip, hist, updateTrip]);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [selectedStayId, setSelectedStayId] = useState<string>(trip.stays[0]?.id ?? '');
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [mapWidth, setMapWidth] = useState(() => {
    const saved = localStorage.getItem('itinerary-map-width');
    return saved ? Number(saved) : 500;
  });
  const mapResizingRef = useRef<{ startX: number; startWidth: number; currentWidth: number } | null>(null);
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
  const [mapMode, setMapMode] = useState<'overview' | 'detail'>('overview');
  const [mapDayFilter, setMapDayFilter] = useState<number | null>(null);
  const [zoomDays, setZoomDays] = useState(() => {
    const saved = localStorage.getItem('itinerary-timeline-zoom');
    return saved ? Number(saved) : 15;
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
  const [showAIPlanner, setShowAIPlanner] = useState(false);
  const [aiSettings, setAiSettings] = useState<{ apiKey: string; model: string }>(() => {
    const saved = localStorage.getItem('chronos-ai-settings');
    return saved ? JSON.parse(saved) : { apiKey: '', model: 'gemini-2.0-flash' };
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

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

  useEffect(() => { setMapDayFilter(null); setMapMode('overview'); }, [selectedStayId]);

  // ── Derived values ────────────────────────────────────────────────────────
  const sortedStays = useMemo(() => [...trip.stays].sort((a, b) => a.startSlot - b.startSlot), [trip.stays]);
  const overlaps = useMemo(() => getOverlapIds(sortedStays), [sortedStays]);
  const selectedStay = useMemo(
    () => sortedStays.find((s) => s.id === selectedStayId) ?? sortedStays[0] ?? null,
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
      .filter((v) => !searchTerm || v.name.toLowerCase().includes(searchTerm) || v.area.toLowerCase().includes(searchTerm))
      .sort((a, b) => a.order - b.order);
  }, [selectedStay, searchTerm]);

  const mapVisits = useMemo(() => {
    if (!selectedStay) return [];
    let scheduled = selectedStay.visits.filter((v) => v.dayOffset !== null && v.dayPart !== null);
    if (mapDayFilter !== null) {
      scheduled = scheduled.filter((v) => v.dayOffset === mapDayFilter);
    }
    return sortVisits(scheduled);
  }, [selectedStay, mapDayFilter]);

  // ── Timeline drag ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!dragState) return;
    const track = document.querySelector('[data-timeline-track]') as HTMLElement | null;
    const numDays = zoomDays === 0 ? trip.totalDays : zoomDays;
    const slotWidth = (track?.clientWidth ?? numDays * 42) / (numDays * 3);

    const onMove = (e: MouseEvent) => {
      const delta = Math.round((e.clientX - dragState.originX) / slotWidth);
      setTrip((curr) => ({
        ...curr,
        stays: curr.stays.map((s) => {
          if (s.id !== dragState.stayId) return s;
          const len = dragState.originalEnd - dragState.originalStart;
          if (dragState.mode === 'move') {
            const next = clamp(dragState.originalStart + delta, 0, curr.totalDays * 3 - len);
            return { ...s, startSlot: next, endSlot: next + len };
          }
          if (dragState.mode === 'resize-start') {
            return { ...s, startSlot: clamp(dragState.originalStart + delta, 0, dragState.originalEnd - 1) };
          }
          return { ...s, endSlot: clamp(dragState.originalEnd + delta, dragState.originalStart + 1, curr.totalDays * 3) };
        }),
      }));
    };
    const onUp = () => setDragState(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragState, zoomDays, trip.totalDays]);

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
    const sample = { ...createSampleTrip(), id: `trip-${Date.now()}`, name: 'New Trip', stays: [] };
    setStore((s) => {
      const next = { trips: [...s.trips, sample], activeTripId: sample.id };
      saveStore(next);
      return next;
    });
    setSelectedStayId('');
  };

  const handleSwitchTrip = (id: string) => {
    setStore((s) => { const next = { ...s, activeTripId: id }; saveStore(next); return next; });
    setSelectedStayId('');
  };

  // ── Render helpers ────────────────────────────────────────────────────────
  const numDays = zoomDays === 0 ? trip.totalDays : zoomDays;
  const dayLabels = Array.from({ length: numDays }, (_, i) =>
    fmt(addDaysTo(new Date(trip.startDate), i), { month: 'short', day: 'numeric' }),
  );
  const tripStartLabel = fmt(new Date(trip.startDate), { month: 'short', day: 'numeric' });
  const tripEndLabel = fmt(addDaysTo(new Date(trip.startDate), trip.totalDays - 1), { month: 'short', day: 'numeric', year: 'numeric' });

  const editingRouteStay = editingRouteStayId ? sortedStays.find((s) => s.id === editingRouteStayId) ?? null : null;
  const editingRouteNextStay = editingRouteStay
    ? sortedStays[sortedStays.indexOf(editingRouteStay) + 1] ?? null
    : null;

  const activeInboxVisit = activeId?.startsWith('inbox-') ? inboxVisits.find((v) => `inbox-${v.id}` === activeId) : null;
  const activeScheduledVisit = activeId?.startsWith('visit-') && selectedStay ? selectedStay.visits.find((v) => `visit-${v.id}` === activeId) : null;

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex h-screen w-full flex-col overflow-hidden bg-background-light text-slate-900 font-sans">

        {/* ── Header ── */}
        <header className="flex h-14 items-center justify-between border-b border-border-neutral px-5 bg-white/80 backdrop-blur-md z-50 flex-shrink-0 gap-4">
          <div className="flex items-center gap-5 min-w-0">
            <div className="flex items-center gap-2.5 text-primary flex-shrink-0">
              <div className="size-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Compass className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm font-extrabold tracking-tight hidden sm:block">Itinerary</span>
            </div>
            <div className="h-5 w-px bg-slate-200 flex-shrink-0" />
            {/* Trip selector */}
            <button
              onClick={() => setShowTripSwitcher(true)}
              className="flex items-center gap-2 min-w-0 hover:bg-slate-50 rounded-lg px-2.5 py-1.5 -ml-1 transition-colors group"
            >
              <span className="text-sm font-bold text-slate-800 truncate">{trip.name}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 group-hover:text-slate-600 transition-colors" />
            </button>
            {/* Date range */}
            <button
              onClick={() => setShowTripEditor(true)}
              className="hidden md:flex items-center gap-2 text-[10px] font-bold tracking-wider text-slate-500 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
            >
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{tripStartLabel} — {tripEndLabel}</span>
              <span className="text-slate-300">·</span>
              <span className="text-primary font-extrabold">{trip.totalDays}d</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {overlaps.size > 0 && (
              <div className="hidden sm:flex items-center gap-1.5 text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1 text-[10px] font-bold mr-1">
                {overlaps.size} conflict{overlaps.size > 1 ? 's' : ''}
              </div>
            )}
            <div className="relative flex items-center group">
              <Search className="absolute left-2.5 text-slate-400 w-3.5 h-3.5 group-focus-within:text-primary transition-colors" />
              <input
                className="bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs w-48 focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none"
                placeholder="Search places, flights..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 text-slate-400 hover:text-slate-600">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="h-5 w-px bg-slate-150 mx-1" />

            {/* Undo/Redo cluster */}
            <div className="flex items-center">
              <button
                onClick={() => { const p = hist.undo(); if (p) updateTrip(() => p); }}
                disabled={!hist.canUndo}
                title="Undo (Ctrl+Z)"
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-25"
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => { const n = hist.redo(); if (n) updateTrip(() => n); }}
                disabled={!hist.canRedo}
                title="Redo (Ctrl+Y)"
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-25"
              >
                <Redo2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowHistory(true)}
                disabled={!hist.canUndo && !hist.canRedo}
                title="View history"
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-25"
              >
                <History className="w-4 h-4" />
              </button>
            </div>

            <div className="h-5 w-px bg-slate-150 mx-1" />

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
            <ProfileMenu trip={trip} onImport={(data) => setTrip(() => data)} onSwitchToLegacy={onSwitchToLegacy} />
          </div>
        </header>

        <main className="flex-1 flex flex-col min-h-0 isolate">

          {/* ── Timeline ── */}
          <section className="border-b border-border-neutral flex flex-col bg-white flex-shrink-0 z-40" style={{ height: 140 }}>
            <div className="flex items-center justify-between px-6 border-b border-border-neutral bg-slate-50/50 py-1.5">
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-500">Timeline</span>
                <div className="flex bg-white rounded-md border border-border-neutral p-0.5">
                  {([5, 10, 15, 30, 0] as const).filter((d) => d === 0 || d <= trip.totalDays).map((d) => (
                    <button key={d} onClick={() => { setZoomDays(d); localStorage.setItem('itinerary-timeline-zoom', String(d)); }}
                      className={`px-3 py-1 text-[9px] font-bold rounded-sm transition-colors ${zoomDays === d ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                      {d === 0 ? 'ALL' : `${d} DAYS`}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={() => setAddingStay(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-slate-700 border border-border-neutral rounded-lg hover:bg-white shadow-sm transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" /> Add Stay
              </button>
            </div>

            <div className="flex-1 relative overflow-x-auto overflow-y-hidden scroll-hide">
              <div data-timeline-track className="h-full flex flex-col" style={{ width: `${Math.max(100, (numDays / (zoomDays || numDays)) * 100)}%` }}>
                {/* Day labels */}
                <div className="flex border-b border-border-neutral divide-x divide-border-neutral bg-slate-50/30 flex-shrink-0" style={{ height: 28 }}>
                  {dayLabels.map((label, i) => (
                    <div key={i} className="flex-1 flex flex-col">
                      <div className="flex-1 flex items-center justify-center text-[9px] font-bold text-slate-400 uppercase tracking-tighter border-b border-slate-100">{label}</div>
                      <div className="flex h-3 divide-x divide-slate-100">
                        {['M', 'A', 'E'].map((p) => (
                          <div key={p} className="flex-1 flex items-center justify-center text-[7px] font-semibold text-slate-300">{p}</div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Stay blocks */}
                <div className={`flex-1 relative ${numDays <= 15 ? 'timeline-grid' : 'timeline-grid-month'} snap-grid`}>
                  <div className="absolute inset-0 flex items-center px-[1%]">
                    <div className="relative w-full" style={{ height: 42 }}>
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
                                left: `calc(${left}% + 3px)`, width: `calc(${Math.max(width, 2)}% - 6px)`, height: 42,
                                background: isSelected
                                  ? `linear-gradient(135deg, ${stay.color}, color-mix(in srgb, ${stay.color} 80%, #ffffff))`
                                  : `color-mix(in srgb, ${stay.color} 8%, white)`,
                                borderColor: isSelected ? stay.color : `color-mix(in srgb, ${stay.color} 35%, transparent)`,
                                boxShadow: isSelected ? `0 0 0 2px white, 0 0 0 4px ${stay.color}, 0 4px 12px color-mix(in srgb, ${stay.color} 25%, transparent)` : undefined,
                              }}
                              onClick={() => setSelectedStayId(stay.id)}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedStayId(stay.id); } }}
                              onMouseDown={(e) => {
                                // Only start move drag from the body (not resize handles)
                                if ((e.target as HTMLElement).dataset.handle) return;
                                setSelectedStayId(stay.id);
                                setDragState({ stayId: stay.id, mode: 'move', originX: e.clientX, originalStart: stay.startSlot, originalEnd: stay.endSlot });
                              }}
                            >
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
                                <div className="w-0.5 h-4 rounded-full bg-current opacity-0 group-hover:opacity-30 transition-opacity pointer-events-none"
                                  style={{ color: isSelected ? 'white' : stay.color }} />
                              </div>
                              {/* Content */}
                              <div className="flex flex-col overflow-hidden flex-1 pointer-events-none pl-3.5 pr-2">
                                <div className="flex items-center gap-1.5">
                                  <Bed className="w-3 h-3 flex-shrink-0" style={{ color: isSelected ? 'rgba(255,255,255,0.85)' : stay.color }} />
                                  <span
                                    className="text-[10px] font-bold truncate"
                                    style={{ color: isSelected ? 'white' : stay.color }}
                                  >{stay.name}</span>
                                  {isOverlapping && (
                                    <span className="flex-shrink-0 text-[8px] font-extrabold px-1 py-0.5 rounded bg-amber-400 text-white leading-none">!</span>
                                  )}
                                </div>
                                {stay.lodging && (
                                  <span
                                    className="text-[8px] font-semibold truncate mt-px"
                                    style={{ color: isSelected ? 'rgba(255,255,255,0.6)' : `color-mix(in srgb, ${stay.color} 60%, #64748b)` }}
                                  >{stay.lodging}</span>
                                )}
                              </div>
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
                                <div className="w-0.5 h-4 rounded-full bg-current opacity-0 group-hover:opacity-30 transition-opacity pointer-events-none"
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
                                  title={stay.travelNotesToNext ?? `${TRANSPORT_LABELS[stay.travelModeToNext]}${stay.travelDurationToNext ? ` · ${stay.travelDurationToNext}` : ''}`}
                                  aria-label={`Route: ${TRANSPORT_LABELS[stay.travelModeToNext]}${stay.travelDurationToNext ? `, ${stay.travelDurationToNext}` : ''}`}
                                  onClick={() => setEditingRouteStayId(stay.id)}
                                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-30 size-7 bg-white border border-slate-200 rounded-full flex items-center justify-center cursor-pointer hover:border-primary/40 hover:shadow-md transition-all shadow-sm"
                                  style={{ left: `${chipLeft}%` }}
                                >
                                  <TransportIcon mode={stay.travelModeToNext} className="w-3.5 h-3.5 text-slate-400" />
                                </button>
                              );
                            })()}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── Main content ── */}
          <section className="flex-1 flex min-h-0 relative overflow-hidden">

            {/* Inventory */}
            <aside className={`border-r border-border-neutral flex flex-col bg-white transition-all duration-300 ${mapExpanded ? 'w-0 overflow-hidden opacity-0' : 'w-64'}`}>
              <div className="px-4 py-3 border-b border-border-neutral flex justify-between items-center bg-slate-50/50 flex-shrink-0">
                <div>
                  <h3 className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-slate-400">Unplanned</h3>
                  {selectedStay && <p className="text-[9px] text-primary font-semibold mt-0.5 truncate">{selectedStay.name}</p>}
                </div>
                <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${inboxVisits.length > 0 ? 'bg-primary/10 text-primary' : 'bg-emerald-50 text-emerald-600'}`}>
                  {inboxVisits.length > 0 ? inboxVisits.length : '✓'}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 scroll-hide">
                {inboxVisits.map((v) => (
                  <DraggableInventoryCard key={v.id} visit={v} onEdit={() => setEditingVisit(v)} />
                ))}
                {inboxVisits.length === 0 && (
                  <p className="text-[10px] text-slate-400 text-center py-6 leading-relaxed">
                    {selectedStay ? 'All places scheduled! Add more below.' : 'Click a stay to see its unplanned places'}
                  </p>
                )}
              </div>
              <div className="p-4 border-t border-border-neutral bg-slate-50/50 flex-shrink-0">
                <button
                  onClick={() => setAddingToInbox(true)}
                  className="w-full py-2 bg-white text-[11px] font-bold text-slate-600 border border-slate-200 rounded-lg flex items-center justify-center gap-2 hover:border-primary/50 hover:text-primary transition-all"
                >
                  <Plus className="w-4 h-4" /> Add New Place
                </button>
              </div>
            </aside>

            {/* Day columns */}
            <div className={`flex-1 overflow-x-auto overflow-y-auto flex p-5 gap-5 min-w-0 bg-slate-50/50 scroll-hide transition-all duration-300 ${mapExpanded ? 'w-0 overflow-hidden opacity-0 p-0' : ''}`} style={mapExpanded ? undefined : { paddingRight: mapWidth + 20 }}>
              {stayDays.map((day) => {
                const dayVisits = selectedStay
                  ? sortVisits(selectedStay.visits.filter(
                      (v) => v.dayOffset === day.dayOffset && (!searchTerm || v.name.toLowerCase().includes(searchTerm) || v.area.toLowerCase().includes(searchTerm)),
                    ))
                  : [];
                return (
                  <div key={day.dayOffset} className={`flex-none w-72 flex flex-col gap-4 rounded-xl transition-colors ${mapMode === 'detail' && mapDayFilter === day.dayOffset ? 'ring-2 ring-primary/40 bg-primary/[0.03] p-2 -m-2' : ''}`}>
                    <div
                      className="flex items-center justify-between cursor-pointer group"
                      onClick={() => {
                        if (mapDayFilter === day.dayOffset) { setMapDayFilter(null); setMapMode('overview'); }
                        else { setMapDayFilter(day.dayOffset); setMapMode('detail'); }
                      }}
                    >
                      <h4 className="font-extrabold text-sm tracking-tight group-hover:text-primary transition-colors">
                        Day {(day.dayOffset + 1).toString().padStart(2, '0')}
                        <span className="text-slate-400 font-medium ml-1.5">{fmt(day.date, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                      </h4>
                    </div>
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
                            <span className="text-[10px] font-bold">Set Accommodation</span>
                          </button>
                        </div>
                      );
                      // No night on this day (e.g., checkout morning only) — no bar
                      if (!group) return null;
                      // Render the spanning bar for this group
                      return (
                        <div className="relative h-12 flex-shrink-0 -mb-2">
                          <div className="absolute inset-y-0 left-0 z-10" style={{ width: `calc(${group.nights} * 288px + ${group.nights - 1} * 20px)` }}>
                            <button
                              onClick={() => setEditingAccommodation({ group })}
                              className="h-full w-full bg-white border border-primary/30 rounded-lg shadow-sm flex items-center px-4 gap-3 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer text-left"
                            >
                              <div className="size-8 rounded bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                                <Hotel className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-extrabold text-primary uppercase tracking-tighter">
                                    {group.nights > 1 ? 'Continuous Stay' : 'Overnight'}
                                  </span>
                                  <span className="text-[10px] font-medium text-slate-400 tracking-tight">
                                    • {group.nights} {group.nights === 1 ? 'Night' : 'Nights'}
                                  </span>
                                </div>
                                <p className="text-xs font-extrabold text-slate-800 truncate">{group.name}</p>
                              </div>
                              {group.accommodation.notes && (
                                <span className="text-[10px] font-medium text-slate-500 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-full flex items-center gap-1.5 flex-shrink-0 max-w-[180px] truncate">
                                  <span className="material-icons text-slate-400 text-[12px]">#</span>
                                  {group.accommodation.notes}
                                </span>
                              )}
                              <Pencil className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
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
                          onSelectVisit={(id) => setSelectedVisitId(id === selectedVisitId ? null : id)}
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
                    <p className="text-xs text-slate-400 mt-1">Click any block on the timeline above</p>
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

            {/* Map — Floating Panel */}
            <aside
              className={`map-panel-container flex flex-col overflow-hidden z-30 ${mapExpanded ? 'absolute inset-0 w-full rounded-none bg-white' : 'absolute top-4 bottom-4 right-4 bg-white rounded-2xl shadow-[0_0_50px_-12px_rgba(0,0,0,0.25)] border border-slate-200/60'}`}
              style={mapExpanded ? undefined : { width: mapWidth }}
            >
              {/* Resize handle */}
              {!mapExpanded && (
                <div
                  onMouseDown={startMapResize}
                  className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-50 group"
                  title="Drag to resize"
                >
                  <div className="absolute inset-y-0 left-0 w-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-primary/40" style={{ left: 2 }} />
                </div>
              )}
              {/* Map panel header */}
              <div className="h-11 px-4 border-b border-slate-100 flex items-center gap-3 bg-white/80 backdrop-blur-md flex-shrink-0">
                {/* Left: mode icon + title */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="size-5 bg-primary/10 rounded flex items-center justify-center">
                    <MapPin className="w-3 h-3 text-primary" />
                  </div>
                  <span className="text-[10px] font-extrabold text-slate-600 tracking-tight uppercase">
                    {mapMode === 'overview' ? 'Overview' : 'Detail'}
                  </span>
                </div>
                {/* Middle: day filter pills — scrollable, only in detail mode */}
                <div className="flex-1 overflow-x-auto scroll-hide min-w-0">
                  {mapMode === 'detail' && dayFilterOptions.length >= 2 && (
                    <DayFilterPills
                      options={dayFilterOptions}
                      selectedDayOffset={mapDayFilter}
                      onChange={(d) => { setMapDayFilter(d); setMapMode(d !== null ? 'detail' : 'overview'); }}
                    />
                  )}
                </div>
                {/* Right: action buttons */}
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <button
                    aria-label={mapMode === 'overview' ? 'Show stay detail' : 'Show trip overview'}
                    onClick={() => { setMapMode(m => m === 'overview' ? 'detail' : 'overview'); if (mapMode === 'detail') setMapDayFilter(null); }}
                    className={`p-1.5 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-primary/50 ${
                      mapMode === 'overview'
                        ? 'text-primary bg-primary/10'
                        : 'text-slate-400 hover:text-primary hover:bg-slate-50'
                    }`}
                  >
                    <Layers className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setMapExpanded(!mapExpanded)}
                    aria-label={mapExpanded ? 'Collapse map' : 'Expand map'}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-slate-50 transition-colors focus-visible:ring-2 focus-visible:ring-primary/50"
                  >
                    {mapExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-hidden relative">
                {(mapMode === 'overview' || mapVisits.length > 0 || mapDayFilter !== null) ? (
                  <TripMap
                    visits={mapMode === 'detail' ? mapVisits : []}
                    selectedVisitId={mapMode === 'detail' ? selectedVisitId : null}
                    onSelectVisit={(id) => setSelectedVisitId(id)}
                    expanded={mapExpanded}
                    stay={mapMode === 'detail' ? selectedStay : null}
                    mode={mapMode}
                    overviewStays={overviewStays}
                    onSelectStay={(stayId) => { setSelectedStayId(stayId); setMapMode('detail'); }}
                    selectedDayOffset={mapDayFilter}
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
                          <p className="text-[10px] font-bold text-slate-500 mt-0.5">{visit.area}</p>
                          <div className="flex gap-2 mt-2 flex-wrap">
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${getVisitTypeColor(visit.type)}`}>
                              {getVisitLabel(visit.type).toUpperCase()}
                            </span>
                            {selectedStay && (
                              <span className="text-[9px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                                {haversineKm(selectedStay.centerLat, selectedStay.centerLng, visit.lat, visit.lng).toFixed(1)} km from hotel
                              </span>
                            )}
                            {visit.durationHint && (
                              <span className="text-[9px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
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
                <div className="text-right">
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

        {/* ── Footer ── */}
        <footer className="bg-white text-slate-500 px-6 py-1.5 text-[10px] font-bold flex justify-between items-center border-t border-border-neutral flex-shrink-0">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="size-1.5 rounded-full bg-emerald-500" />
              <span className="uppercase tracking-widest text-slate-400">Saved</span>
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
                <p className="text-[10px] text-slate-500 mt-0.5">{v.area}</p>
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
          <VisitFormModal
            title="New Stay"
            initial={{ name: '', type: 'area', area: '' }}
            onClose={() => setAddingStay(false)}
            onSave={({ name }) => {
              const last = sortedStays[sortedStays.length - 1];
              const start = Math.min((last?.endSlot ?? -1) + 1, trip.totalDays * 3 - 3);
              const newStay: Stay = {
                id: `stay-${Date.now()}`, name,
                color: STAY_COLORS[trip.stays.length % STAY_COLORS.length],
                startSlot: start, endSlot: Math.min(start + 9, trip.totalDays * 3),
                centerLat: jitter(35.6762, 5), centerLng: jitter(139.6503, 5),
                lodging: 'Set lodging', travelModeToNext: 'train', visits: [],
              };
              setTrip((t) => ({ ...t, stays: [...t.stays, newStay] }));
              setSelectedStayId(newStay.id);
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

          const handleSave = (accom: NightAccommodation) => {
            setTrip((curr) => ({
              ...curr,
              stays: curr.stays.map((s) => {
                if (s.id !== selectedStay.id) return s;
                const updated = { ...s.nightAccommodations };
                // Apply to all nights in the group (or just the single night)
                for (let i = 0; i < nightCount; i++) {
                  updated[dayOffset + i] = accom;
                }
                return { ...s, nightAccommodations: updated };
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
                return { ...s, nightAccommodations: Object.keys(updated).length > 0 ? updated : undefined };
              }),
            }));
          } : undefined;

          return (
            <AccommodationEditorModal
              initial={initial}
              nightCount={nightCount}
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
            onSave={({ name, type, area, durationHint, lat, lng }) => {
              updateSelectedStay((stay) => ({
                ...stay,
                visits: [...stay.visits, createVisit(
                  `visit-${Date.now()}`, name, type, area,
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
            onSave={({ name, type, area, durationHint, notes, lat, lng }) => {
              const { dayOffset, part } = addingVisitToSlot;
              const bucketSize = selectedStay.visits.filter(
                (v) => v.dayOffset === dayOffset && v.dayPart === part,
              ).length;
              updateSelectedStay((stay) => ({
                ...stay,
                visits: [...stay.visits, {
                  ...createVisit(
                    `visit-${Date.now()}`, name, type, area,
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
            onSave={({ name, type, area, durationHint, notes }) => {
              updateSelectedStay((stay) => ({
                ...stay,
                visits: stay.visits.map((v) =>
                  v.id === editingVisit.id ? { ...v, name, type, area, durationHint: durationHint || undefined, notes } : v
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
            onDelete={store.trips.length > 1 ? () => {
              setStore((s) => {
                const remaining = s.trips.filter((t) => t.id !== trip.id);
                const next = { trips: remaining, activeTripId: remaining[0].id };
                saveStore(next); return next;
              });
              setSelectedStayId('');
            } : undefined}
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
                className="flex-1 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors"
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

// ─── Root switcher ────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState<'itinerary' | 'legacy'>(
    () => (localStorage.getItem(APP_VIEW_KEY) as 'itinerary' | 'legacy') ?? 'itinerary',
  );

  const switchTo = (v: 'itinerary' | 'legacy') => {
    setView(v);
    localStorage.setItem(APP_VIEW_KEY, v);
  };

  if (view === 'legacy') {
    return (
      <div className="relative h-screen">
        <LegacyApp />
        <button
          onClick={() => switchTo('itinerary')}
          className="fixed bottom-4 right-4 z-[9999] flex items-center gap-2 bg-slate-900 text-slate-200 text-[10px] font-bold px-3 py-2 rounded-full shadow-xl border border-slate-700 hover:bg-slate-700 transition-all"
        >
          <Layers className="w-3.5 h-3.5" />
          New View
        </button>
      </div>
    );
  }

  return (
    <ChronosErrorBoundary>
      <AuthProvider>
        <ChronosApp onSwitchToLegacy={() => switchTo('legacy')} />
      </AuthProvider>
    </ChronosErrorBoundary>
  );
}
