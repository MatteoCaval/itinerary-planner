// ─── CHRONOS data model types ─────────────────────────────────────────────────

export type DayPart = 'morning' | 'afternoon' | 'evening';
export type TravelMode = 'train' | 'flight' | 'drive' | 'ferry' | 'bus' | 'walk';
export type VisitType = 'landmark' | 'museum' | 'food' | 'walk' | 'shopping';

export type ChecklistItem = { id: string; text: string; done: boolean };
export type VisitLink = { url: string; label?: string };

export type VisitItem = {
  id: string;
  stayId: string;
  name: string;
  type: VisitType;
  lat: number;
  lng: number;
  durationHint?: string;
  dayOffset: number | null;
  dayPart: DayPart | null;
  order: number;
  notes?: string;
  imageUrl?: string;
  checklist?: ChecklistItem[];
  links?: VisitLink[];
};

export type NightAccommodation = {
  name: string;
  lat?: number;
  lng?: number;
  cost?: number;
  notes?: string;
  link?: string;
};

export type Stay = {
  id: string;
  name: string;
  color: string;
  startSlot: number;
  endSlot: number;
  centerLat: number;
  centerLng: number;
  imageUrl?: string;
  /** Per-night accommodation keyed by dayOffset (0-based within the stay). A night on dayOffset=0 means "sleeping between day 0 and day 1". */
  nightAccommodations?: Record<number, NightAccommodation>;
  checklist?: ChecklistItem[];
  notes?: string;
  links?: VisitLink[];
};

export type Route = {
  fromStayId: string;
  toStayId: string;
  mode: TravelMode;
  duration?: string;
  notes?: string;
};

export type HybridTrip = {
  id: string;
  name: string;
  startDate: string;
  totalDays: number;
  version?: number;
  createdAt?: number;
  updatedAt?: number;
  stays: Stay[];
  visits: VisitItem[];
  routes: Route[];
};

export type TripStore = { trips: HybridTrip[]; activeTripId: string };

export type DragState = {
  stayId: string;
  mode: 'move' | 'resize-start' | 'resize-end';
  originX: number;
  originalStart: number;
  originalEnd: number;
} | null;

export type AccommodationGroup = {
  name: string;
  startDayOffset: number;
  nights: number;
  accommodation: NightAccommodation;
};

// ─── V1 types (for migration from old format) ──────────────────────────────

export type V1Stay = {
  id: string;
  name: string;
  color: string;
  startSlot: number;
  endSlot: number;
  centerLat: number;
  centerLng: number;
  lodging: string;
  imageUrl?: string;
  nightAccommodations?: Record<number, NightAccommodation>;
  travelModeToNext: TravelMode;
  travelDurationToNext?: string;
  travelNotesToNext?: string;
  visits: V1VisitItem[];
  checklist?: ChecklistItem[];
  notes?: string;
  links?: VisitLink[];
};

export type V1VisitItem = {
  id: string;
  name: string;
  type: string; // may include 'area' | 'hotel'
  area: string;
  lat: number;
  lng: number;
  durationHint?: string;
  dayOffset: number | null;
  dayPart: DayPart | null;
  order: number;
  notes?: string;
  imageUrl?: string;
  checklist?: ChecklistItem[];
  links?: VisitLink[];
};

export type V1HybridTrip = {
  id: string;
  name: string;
  startDate: string;
  totalDays: number;
  stays: V1Stay[];
};

// ─── Legacy data model types (for storage compatibility) ──────────────────────

export type LegacyDaySection = 'morning' | 'afternoon' | 'evening';
export type LegacyTransportType = 'walk' | 'car' | 'bus' | 'train' | 'flight' | 'ferry' | 'other';
export type LegacyLocationCategory = 'sightseeing' | 'dining' | 'hotel' | 'transit' | 'other';
export type LegacyAccommodation = {
  name: string;
  lat?: number;
  lng?: number;
  cost?: number;
  notes?: string;
  link?: string;
};
export type LegacyDay = {
  id: string;
  date: string;
  label?: string;
  accommodation?: LegacyAccommodation;
};
export type LegacyRoute = {
  id: string;
  fromLocationId: string;
  toLocationId: string;
  transportType: LegacyTransportType;
  duration?: string;
  cost?: number;
  notes?: string;
};
export type LegacyLocation = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  notes?: string;
  category?: LegacyLocationCategory;
  checklist?: unknown[];
  links?: unknown[];
  cost?: number;
  targetTime?: string;
  imageUrl?: string;
  dayIds: string[];
  startDayId?: string;
  startSlot?: LegacyDaySection;
  duration?: number;
  order: number;
  subLocations?: LegacyLocation[];
  dayOffset?: number;
  _color?: string;
  _lodging?: string;
  _area?: string;
  _visitType?: string;
};
export type LegacyStoredTrip = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  startDate: string;
  endDate: string;
  days: LegacyDay[];
  locations: LegacyLocation[];
  routes: LegacyRoute[];
  version: string;
};
export type LegacyTripsStore = { activeTripId: string; trips: LegacyStoredTrip[] };
