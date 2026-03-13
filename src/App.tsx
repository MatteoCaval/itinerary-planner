import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup, useMap } from 'react-leaflet';
import {
  DndContext, DragOverlay, useDraggable, useDroppable,
  type DragEndEvent, type DragStartEvent, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowLeftRight, Bed, Bus, Calendar, Car, Check,
  ChevronDown, Compass, Database, Download, Footprints,
  GripVertical, History, Landmark, MapPin, Maximize2, Minimize2,
  Moon, MoreHorizontal, Navigation, Pencil, Plane, Plus,
  PlusCircle, Redo2, Search, Ship, SlidersHorizontal, Sparkles, Sunrise,
  Sun, Train, Trash2, Undo2, User, X, Layers, Hotel, UtensilsCrossed,
} from 'lucide-react';
import LegacyApp from './features/legacy/LegacyApp';
import { searchPlace, type PlaceSearchResult } from './utils/geocoding';
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

type Stay = {
  id: string; name: string; color: string;
  startSlot: number; endSlot: number;
  centerLat: number; centerLng: number;
  lodging: string;
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
const TRANSPORT_COLORS: Record<TravelMode, string> = {
  train: '#0f7a72', flight: '#ab3b61', drive: '#3567d6',
  ferry: '#3d8ec9', bus: '#a66318', walk: '#60713a',
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
    return {
      dayOffset: i, absoluteDay,
      date: addDaysTo(new Date(trip.startDate), absoluteDay),
      enabledParts: DAY_PARTS.filter((p) => {
        const slot = absoluteDay * 3 + DAY_PARTS.indexOf(p);
        return slot >= stay.startSlot && slot < stay.endSlot;
      }),
    };
  });
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
    return {
      id: `day-${i}-${trip.id}`,
      date,
      accommodation: coveringStay?.lodging ? { name: coveringStay.lodging } : undefined,
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
function useHistory(initial: HybridTrip) {
  const [snapshots, setSnapshots] = useState<HybridTrip[]>([initial]);
  const [idx, setIdx] = useState(0);

  const push = useCallback((next: HybridTrip) => {
    setSnapshots((prev) => [...prev.slice(0, idx + 1), next].slice(-50));
    setIdx((i) => Math.min(i + 1, 49));
  }, [idx]);

  const undo = useCallback(() => {
    if (idx > 0) { setIdx((i) => i - 1); return snapshots[idx - 1]; }
    return null;
  }, [idx, snapshots]);

  const redo = useCallback(() => {
    if (idx < snapshots.length - 1) { setIdx((i) => i + 1); return snapshots[idx + 1]; }
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

  return (
    <ModalBase title="Edit Trip" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-2 block">Trip Name</label>
          <input
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none font-semibold"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-2 block">Start Date</label>
            <input
              type="date"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-2 block">Total Days</label>
            <input
              type="number"
              min={1} max={60}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none"
              value={totalDays}
              onChange={(e) => setTotalDays(Math.max(1, parseInt(e.target.value) || 1))}
            />
          </div>
        </div>
        {startDate && totalDays > 0 && (
          <p className="text-[10px] text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
            {fmt(new Date(startDate), { month: 'short', day: 'numeric' })} — {fmt(addDaysTo(new Date(startDate), totalDays - 1), { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
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
function HistoryPanel({ history, index, onNavigate, onClose }: {
  history: HybridTrip[]; index: number; onNavigate: (i: number) => void; onClose: () => void;
}) {
  return (
    <ModalBase title="History" onClose={onClose}>
      <div className="space-y-1 max-h-80 overflow-y-auto">
        {[...history].reverse().map((snap, ri) => {
          const i = history.length - 1 - ri;
          const isCurrent = i === index;
          return (
            <button
              key={i}
              onClick={() => { onNavigate(i); onClose(); }}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition-all flex items-center justify-between ${
                isCurrent ? 'bg-primary/5 border border-primary/20' : 'hover:bg-slate-50 border border-transparent'
              }`}
            >
              <div>
                <p className={`text-xs font-bold ${isCurrent ? 'text-primary' : 'text-slate-700'}`}>{snap.name}</p>
                <p className="text-[10px] text-slate-400">{snap.stays.length} stays · {snap.stays.reduce((s, st) => s + st.visits.length, 0)} places</p>
              </div>
              {isCurrent && <span className="text-[9px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">CURRENT</span>}
            </button>
          );
        })}
      </div>
    </ModalBase>
  );
}

// ─── Map ──────────────────────────────────────────────────────────────────────
function FitMap({ points, expanded }: { points: [number, number][]; expanded: boolean }) {
  const map = useMap();
  useEffect(() => { window.setTimeout(() => map.invalidateSize(), 50); }, [expanded, map]);
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) { map.setView(points[0], 13, { animate: true }); return; }
    map.fitBounds(points, { padding: [40, 40], animate: true });
  }, [map, points]);
  return null;
}

function TripMap({ visits, selectedVisitId, onSelectVisit, expanded }: {
  visits: VisitItem[]; selectedVisitId: string | null;
  onSelectVisit: (id: string) => void; expanded: boolean;
}) {
  const points = visits.map((v) => [v.lat, v.lng] as [number, number]);
  const center: [number, number] = points.length ? points[0] : [35.6762, 139.6503];
  return (
    <MapContainer center={center} zoom={11} zoomControl={true} className="w-full h-full" style={{ background: '#f1f5f9' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      />
      {points.length > 1 && (
        <Polyline positions={points} pathOptions={{ color: '#ec5b13', weight: 2.5, dashArray: '8 5', opacity: 0.7 }} />
      )}
      {visits.map((v, i) => (
        <CircleMarker
          key={v.id} center={[v.lat, v.lng]}
          radius={selectedVisitId === v.id ? 10 : i === 0 ? 8 : 6}
          pathOptions={{ fillColor: '#ec5b13', fillOpacity: selectedVisitId === v.id ? 1 : 0.8, color: 'white', weight: selectedVisitId === v.id ? 3 : 2 }}
          eventHandlers={{ click: () => onSelectVisit(v.id) }}
        >
          <Popup><div className="text-xs font-semibold">{v.name}</div><div className="text-[10px] text-slate-500">{v.area}</div></Popup>
        </CircleMarker>
      ))}
      <FitMap points={points} expanded={expanded} />
    </MapContainer>
  );
}

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
          <button onClick={onEdit} className="opacity-60 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-primary/50" aria-label={`Edit ${visit.name}`}>
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
      className={`relative p-3.5 bg-white rounded-lg border transition-all group ${
        isOver
          ? 'border-primary shadow-md ring-2 ring-primary/25 bg-primary/[0.02]'
          : isSelected
          ? 'border-primary/40 shadow-[0_4px_12px_rgba(236,91,19,0.1)] ring-1 ring-primary/10'
          : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
      }`}
    >
      {isOver && <div className="absolute -top-1 left-2 right-2 h-0.5 bg-primary rounded-full z-10" />}
      <div className="flex items-start justify-between mb-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter border ${getVisitTypeColor(visit.type)}`}>
            {getVisitLabel(visit.type)}
          </span>
          {visit.durationHint && <span className="text-[10px] text-slate-400 font-medium">{visit.durationHint}</span>}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 ml-1">
          <button onClick={onEdit} className="opacity-60 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-primary/50" aria-label={`Edit ${visit.name}`}>
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
function AIPlannerModal({ onClose, onSwitchToClassic }: { onClose: () => void; onSwitchToClassic: () => void }) {
  const [prompt, setPrompt] = useState('');
  return (
    <ModalBase title="AI Planner" onClose={onClose} width="max-w-lg">
      <div className="space-y-4">
        <p className="text-xs text-slate-600 leading-relaxed">
          Describe your trip and let AI generate a detailed itinerary — activities, routing, timing, and more.
        </p>
        <div>
          <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-2 block">What are you planning?</label>
          <textarea
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none resize-none"
            rows={4}
            placeholder="e.g. 2 weeks in Japan: Tokyo, Kyoto, Osaka. Mix of culture, food, and nature. Mid-budget, late May 2026."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            autoFocus
          />
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-800">
          <p className="font-bold mb-1">Full AI integration available in Classic Mode</p>
          <p className="opacity-80">The Classic layout includes the complete AI planner with cloud sync, activity suggestions, and itinerary generation. Native AI for this view is coming soon.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => { onClose(); onSwitchToClassic(); }}
            className="flex-1 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" /> Open in Classic Mode
          </button>
        </div>
      </div>
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
  const [viewMode, setViewMode] = useState<'15days' | 'full'>('15days');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [editingRouteStayId, setEditingRouteStayId] = useState<string | null>(null);
  const [editingStayId, setEditingStayId] = useState<string | null>(null);
  const [addingVisitToSlot, setAddingVisitToSlot] = useState<{ dayOffset: number; part: DayPart } | null>(null);
  const [editingVisit, setEditingVisit] = useState<VisitItem | null>(null);
  const [addingToInbox, setAddingToInbox] = useState(false);
  const [showTripSwitcher, setShowTripSwitcher] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showTripEditor, setShowTripEditor] = useState(false);
  const [addingStay, setAddingStay] = useState(false);
  const [showAIPlanner, setShowAIPlanner] = useState(false);

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

  // ── Derived values ────────────────────────────────────────────────────────
  const sortedStays = useMemo(() => [...trip.stays].sort((a, b) => a.startSlot - b.startSlot), [trip.stays]);
  const overlaps = useMemo(() => getOverlapIds(sortedStays), [sortedStays]);
  const selectedStay = useMemo(
    () => sortedStays.find((s) => s.id === selectedStayId) ?? sortedStays[0] ?? null,
    [selectedStayId, sortedStays],
  );
  const stayDays = useMemo(() => selectedStay ? deriveStayDays(trip, selectedStay) : [], [selectedStay, trip]);
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
    return sortVisits(selectedStay.visits.filter((v) => v.dayOffset !== null && v.dayPart !== null));
  }, [selectedStay]);

  // ── Timeline drag ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!dragState) return;
    const track = document.querySelector('[data-timeline-track]') as HTMLElement | null;
    const numDays = viewMode === '15days' ? 15 : trip.totalDays;
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
  }, [dragState, viewMode, trip.totalDays]);

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
  const numDays = viewMode === '15days' ? 15 : trip.totalDays;
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
        <header className="flex h-14 items-center justify-between border-b border-border-neutral px-5 bg-white z-50 flex-shrink-0 gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex items-center gap-2 text-primary flex-shrink-0">
              <Compass className="w-5 h-5" />
              <span className="text-sm font-extrabold tracking-tight hidden sm:block">Itinerary</span>
            </div>
            <div className="h-5 w-px bg-slate-200 flex-shrink-0" />
            {/* Trip selector */}
            <button
              onClick={() => setShowTripSwitcher(true)}
              className="flex items-center gap-2 min-w-0 hover:bg-slate-50 rounded-lg px-2 py-1 transition-colors group"
            >
              <span className="text-sm font-semibold text-slate-800 truncate">{trip.name}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 group-hover:text-slate-600" />
            </button>
            {/* Date range */}
            <button
              onClick={() => setShowTripEditor(true)}
              className="hidden md:flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-slate-500 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-sm transition-colors flex-shrink-0"
            >
              <Calendar className="w-3 h-3" />
              {tripStartLabel} — {tripEndLabel}
            </button>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {overlaps.size > 0 && (
              <div className="hidden sm:flex items-center gap-1.5 text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-2 py-1 text-[10px] font-bold">
                {overlaps.size} conflict{overlaps.size > 1 ? 's' : ''}
              </div>
            )}
            <div className="relative flex items-center group">
              <Search className="absolute left-2.5 text-slate-400 w-3.5 h-3.5 group-focus-within:text-primary transition-colors" />
              <input
                className="bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs w-44 focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none"
                placeholder="Search places..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 text-slate-400 hover:text-slate-600">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            {/* History */}
            <button
              onClick={() => setShowHistory(true)}
              disabled={!hist.canUndo && !hist.canRedo}
              title="View history (Ctrl+Z to undo)"
              className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-30 relative"
            >
              <History className="w-4 h-4" />
            </button>
            <button
              onClick={() => { const p = hist.undo(); if (p) updateTrip(() => p); }}
              disabled={!hist.canUndo}
              title="Undo (Ctrl+Z)"
              className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-30"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => { const n = hist.redo(); if (n) updateTrip(() => n); }}
              disabled={!hist.canRedo}
              title="Redo (Ctrl+Y)"
              className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-30"
            >
              <Redo2 className="w-4 h-4" />
            </button>
            {/* Export */}
            <button
              onClick={() => {
                const blob = new Blob([JSON.stringify(trip, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url;
                a.download = `${trip.name.toLowerCase().replace(/\s+/g, '-')}.json`;
                document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
              }}
              title="Export trip as JSON"
              className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
            </button>
            {/* AI Planner */}
            <button
              onClick={() => setShowAIPlanner(true)}
              title="AI Planner"
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:block">AI</span>
            </button>
            {/* Classic mode */}
            <button
              onClick={onSwitchToLegacy}
              title="Switch to Classic layout"
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-slate-600 border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden sm:block">Classic</span>
            </button>
            <button className="size-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 border border-slate-200 hover:bg-slate-200 transition-all flex-shrink-0">
              <User className="w-4 h-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 flex flex-col min-h-0 isolate">

          {/* ── Timeline ── */}
          <section className="border-b border-border-neutral flex flex-col bg-white flex-shrink-0" style={{ height: 120 }}>
            <div className="flex items-center justify-between px-6 border-b border-border-neutral bg-slate-50/50 py-1.5">
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-500">Timeline</span>
                <div className="flex bg-white rounded-md border border-border-neutral p-0.5">
                  {(['15days', 'full'] as const).map((v) => (
                    <button key={v} onClick={() => setViewMode(v)}
                      className={`px-3 py-1 text-[9px] font-bold rounded-sm transition-colors ${viewMode === v ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                      {v === '15days' ? '15 DAYS' : 'FULL TRIP'}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={() => setAddingStay(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-slate-700 border border-border-neutral rounded-md hover:bg-white shadow-sm transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" /> Add Stay
              </button>
            </div>

            <div className="flex-1 relative overflow-x-auto overflow-y-hidden scroll-hide">
              <div data-timeline-track className="h-full flex flex-col" style={{ width: `${Math.max(100, (numDays / 15) * 100)}%` }}>
                {/* Day labels */}
                <div className="flex border-b border-border-neutral bg-slate-50/30 flex-shrink-0" style={{ height: 32 }}>
                  {dayLabels.map((label, i) => (
                    <div key={i} className="flex-1 flex flex-col">
                      <div className="flex-1 flex items-center justify-center text-[9px] font-bold text-slate-400 uppercase tracking-tighter border-b border-border-neutral/30">{label}</div>
                      <div className="flex divide-x divide-border-neutral/20" style={{ height: 12 }}>
                        {['M', 'A', 'E'].map((p) => (
                          <div key={p} className="flex-1 flex items-center justify-center text-[8px] font-bold text-slate-400">{p}</div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Stay blocks */}
                <div className={`flex-1 relative ${viewMode === '15days' ? 'timeline-grid' : 'timeline-grid-month'}`}>
                  <div className="absolute inset-0 flex items-center px-2">
                    <div className="relative w-full" style={{ height: 36 }}>
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
                              className={`absolute h-8 rounded-md flex items-center select-none transition-shadow cursor-grab active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-300 ${
                                isSelected ? 'ring-2 ring-white ring-offset-1 shadow-lg z-10' : 'z-0'
                              } ${isOverlapping ? 'ring-2 ring-amber-400' : ''}`}
                              style={{
                                left: `${left}%`, width: `${Math.max(width, 2)}%`,
                                background: `linear-gradient(135deg, ${stay.color}, color-mix(in srgb, ${stay.color} 72%, #ffffff))`,
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
                              {/* Left resize */}
                              <div
                                data-handle="resize-start"
                                className="absolute -left-1 top-0 bottom-0 w-4 cursor-ew-resize z-20 flex items-center justify-center group/handle"
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  setSelectedStayId(stay.id);
                                  setDragState({ stayId: stay.id, mode: 'resize-start', originX: e.clientX, originalStart: stay.startSlot, originalEnd: stay.endSlot });
                                }}
                              >
                                <div className="w-0.5 h-3 rounded-full bg-white/0 group-hover/handle:bg-white/60 transition-colors" />
                              </div>
                              {/* Content */}
                              <div className="flex items-center gap-1.5 px-3 overflow-hidden flex-1 pointer-events-none">
                                <Bed className="w-3.5 h-3.5 text-white/80 flex-shrink-0" />
                                <span className="text-[11px] font-bold text-white truncate">{stay.name}</span>
                                <span className="text-[10px] text-white/70 font-medium flex-shrink-0">{getStayNightCount(stay)}d</span>
                              </div>
                              {/* Edit button */}
                              <button
                                aria-label={`Edit ${stay.name}`}
                                className={`absolute right-5 top-1/2 -translate-y-1/2 z-20 p-1.5 rounded hover:bg-black/20 text-white/70 hover:text-white transition-opacity focus-visible:ring-2 focus-visible:ring-white ${isSelected ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => { e.stopPropagation(); setEditingStayId(stay.id); }}
                              >
                                <SlidersHorizontal className="w-3 h-3" />
                              </button>
                              {/* Right resize */}
                              <div
                                data-handle="resize-end"
                                className="absolute -right-1 top-0 bottom-0 w-4 cursor-ew-resize z-20 flex items-center justify-center group/handle"
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  setSelectedStayId(stay.id);
                                  setDragState({ stayId: stay.id, mode: 'resize-end', originX: e.clientX, originalStart: stay.startSlot, originalEnd: stay.endSlot });
                                }}
                              >
                                <div className="w-0.5 h-3 rounded-full bg-white/0 group-hover/handle:bg-white/60 transition-colors" />
                              </div>
                            </div>

                            {/* Transit chip — centered in gap between the two stays */}
                            {nextStay && (() => {
                              const gapStart = (stay.endSlot / (numDays * 3)) * 100;
                              const gapEnd = (nextStay.startSlot / (numDays * 3)) * 100;
                              const gapWidth = gapEnd - gapStart;
                              const chipLeft = (gapStart + gapEnd) / 2;
                              const hasGap = nextStay.startSlot > stay.endSlot;
                              return (
                                <button
                                  title={stay.travelNotesToNext ?? TRANSPORT_LABELS[stay.travelModeToNext]}
                                  aria-label={`Route: ${TRANSPORT_LABELS[stay.travelModeToNext]}${stay.travelDurationToNext ? `, ${stay.travelDurationToNext}` : ''}`}
                                  onClick={() => setEditingRouteStayId(stay.id)}
                                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-30 flex items-center gap-1 font-bold bg-white border-2 rounded-full shadow-md hover:scale-105 transition-all focus-visible:ring-2 focus-visible:ring-primary/50 p-1 whitespace-nowrap"
                                  style={{
                                    left: `${chipLeft}%`,
                                    borderColor: TRANSPORT_COLORS[stay.travelModeToNext],
                                    color: TRANSPORT_COLORS[stay.travelModeToNext],
                                  }}
                                  ref={(el) => {
                                    if (!el) return;
                                    const parent = el.parentElement;
                                    if (!parent) return;
                                    const parentW = parent.offsetWidth;
                                    const maxW = (gapWidth / 100) * parentW;
                                    const label = el.querySelector<HTMLElement>('[data-transit-label]');
                                    if (label) label.style.display = el.scrollWidth > maxW ? 'none' : '';
                                  }}
                                >
                                  <TransportIcon mode={stay.travelModeToNext} className="w-3 h-3 flex-shrink-0" />
                                  {hasGap && stay.travelDurationToNext && (
                                    <span data-transit-label className="text-[8px] pr-0.5 opacity-70">{stay.travelDurationToNext}</span>
                                  )}
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
          <section className="flex-1 flex min-h-0">

            {/* Inventory */}
            <aside className={`border-r border-border-neutral flex flex-col bg-white transition-all duration-300 ${mapExpanded ? 'w-0 overflow-hidden opacity-0' : 'w-64'}`}>
              <div className="px-4 py-3 border-b border-border-neutral flex justify-between items-center bg-slate-50/50 flex-shrink-0">
                <div>
                  <h3 className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-slate-400">Unplanned</h3>
                  {selectedStay && <p className="text-[9px] text-primary font-semibold mt-0.5 truncate">{selectedStay.name}</p>}
                </div>
                <span className="text-[9px] font-bold bg-slate-200/50 px-1.5 py-0.5 rounded text-slate-600">{inboxVisits.length}</span>
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
                  className="w-full py-2 bg-white text-[11px] font-bold text-slate-600 border border-slate-200 rounded-md flex items-center justify-center gap-2 hover:border-primary/50 hover:text-primary transition-all"
                >
                  <Plus className="w-4 h-4" /> Add New Place
                </button>
              </div>
            </aside>

            {/* Day columns */}
            <div className={`flex-1 overflow-x-auto overflow-y-auto flex p-5 gap-5 min-w-0 bg-slate-50/50 scroll-hide transition-all duration-300 ${mapExpanded ? 'w-0 overflow-hidden opacity-0 p-0' : ''}`}>
              {stayDays.map((day) => {
                const dayVisits = selectedStay
                  ? sortVisits(selectedStay.visits.filter(
                      (v) => v.dayOffset === day.dayOffset && (!searchTerm || v.name.toLowerCase().includes(searchTerm) || v.area.toLowerCase().includes(searchTerm)),
                    ))
                  : [];
                return (
                  <div key={day.dayOffset} className="flex-none w-72 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-extrabold text-sm tracking-tight">
                        Day {(day.dayOffset + 1).toString().padStart(2, '0')}
                        <span className="text-slate-400 font-medium ml-1.5">{fmt(day.date, { month: 'short', day: 'numeric' })}</span>
                      </h4>
                      <button className="text-slate-400 hover:text-slate-600"><MoreHorizontal className="w-5 h-5" /></button>
                    </div>
                    <div className="space-y-3">
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
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                  <Compass className="w-12 h-12 mb-3 opacity-20" />
                  <p className="text-sm font-semibold">Select a stay from the timeline</p>
                  <p className="text-xs mt-1 opacity-60">Click any stay block to plan its days</p>
                </div>
              )}
            </div>

            {/* Map */}
            <aside className={`border-l border-border-neutral flex flex-col relative bg-slate-100 transition-all duration-500 ease-in-out ${mapExpanded ? 'flex-1' : 'w-[420px]'}`}>
              <div className="absolute top-4 left-4 z-20">
                <button
                  onClick={() => setMapExpanded(!mapExpanded)}
                  aria-label={mapExpanded ? 'Collapse map' : 'Expand map'}
                  className="bg-white/90 backdrop-blur-md shadow-xl rounded-lg p-2 border border-white/80 text-slate-600 hover:text-primary hover:bg-white transition-colors focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  {mapExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex-1 overflow-hidden relative">
                {mapVisits.length > 0 ? (
                  <TripMap visits={mapVisits} selectedVisitId={selectedVisitId}
                    onSelectVisit={(id) => setSelectedVisitId(id === selectedVisitId ? null : id)} expanded={mapExpanded} />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
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
                            <h5 className="text-sm font-extrabold text-slate-800 truncate">{visit.name}</h5>
                            <button onClick={() => setSelectedVisitId(null)} className="text-slate-400 hover:text-slate-600 flex-shrink-0 ml-2">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <p className="text-[10px] font-bold text-slate-500 mt-0.5">{visit.area}</p>
                          <div className="flex gap-2 mt-2">
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${getVisitTypeColor(visit.type)}`}>
                              {getVisitLabel(visit.type).toUpperCase()}
                            </span>
                            {visit.durationHint && (
                              <span className="text-[9px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                                {visit.durationHint}
                              </span>
                            )}
                            <button onClick={() => setEditingVisit(visit)} className="text-[9px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-100 hover:border-primary/40 hover:text-primary flex items-center gap-1">
                              <Pencil className="w-2.5 h-2.5" /> Edit
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="px-5 py-3 bg-white border-t border-border-neutral flex items-center justify-between z-10 flex-shrink-0">
                <div className="flex items-center gap-2.5">
                  <Navigation className="text-primary w-5 h-5" />
                  <div>
                    <span className="text-[10px] font-extrabold text-slate-800 uppercase tracking-tight block">
                      {selectedStay?.name ?? 'No stay selected'}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase">
                      {selectedStay ? `${getStayNightCount(selectedStay)} days · ${selectedStay.lodging}` : 'Click a stay'}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black text-slate-800">{mapVisits.length} stops</span>
                  <p className="text-[9px] font-bold text-slate-400">SCHEDULED</p>
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
              if (snap) updateTrip(() => snap);
            }}
            onClose={() => setShowHistory(false)}
          />
        )}

        {/* AI Planner */}
        {showAIPlanner && (
          <AIPlannerModal
            onClose={() => setShowAIPlanner(false)}
            onSwitchToClassic={onSwitchToLegacy}
          />
        )}
      </div>
    </DndContext>
  );
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

  return <ChronosApp onSwitchToLegacy={() => switchTo('legacy')} />;
}
