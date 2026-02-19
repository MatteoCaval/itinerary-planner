import { createContext, useContext, useState, useEffect, useMemo, useRef, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Day, Location, Route, AISettings, DaySection, ItineraryData, TripSummary } from '../types';
import { itineraryImportSchema, ItineraryImportData, LocationImportData, RouteImportData } from '../utils/itinerarySchema';
import { trackError } from '../services/telemetry';
import { DEFAULT_SECTION, DEFAULT_CATEGORY, DEFAULT_AI_MODEL, UNASSIGNED_ZONE_ID, SLOT_PREFIX } from '../constants/daySection';

// Storage Keys
const STORAGE_KEY_TRIPS = 'itinerary-trips-v1';
const STORAGE_KEY_LOCATIONS = 'itinerary-locations';
const STORAGE_KEY_ROUTES = 'itinerary-routes';
const STORAGE_KEY_DATES = 'itinerary-dates';
const STORAGE_KEY_DAYS = 'itinerary-days';
const STORAGE_KEY_AI = 'itinerary-ai-settings';

type StoredTrip = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  startDate: string;
  endDate: string;
  days: Day[];
  locations: Location[];
  routes: Route[];
  version: string;
};

type TripsStore = {
  activeTripId: string;
  trips: StoredTrip[];
};

type InitialSnapshot = {
  store: TripsStore;
  activeTrip: StoredTrip;
};

type HistorySnapshot = {
  startDate: string;
  endDate: string;
  days: Day[];
  locations: Location[];
  routes: Route[];
  timestamp: number;
  label: string;
};

export interface LoadDataResult {
  success: boolean;
  error?: string;
}

const parseNumeric = (value: number | string | undefined, defaultValue: number | undefined = 0): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : defaultValue;
  }
  return defaultValue;
};

const readStorage = <T,>(key: string, fallback: T): T => {
  const saved = localStorage.getItem(key);
  if (!saved) return fallback;

  try {
    return JSON.parse(saved) as T;
  } catch (error) {
    trackError('storage_parse_failed', error, { key });
    return fallback;
  }
};

// Helper Functions (moved from App.tsx)
const generateDays = (startDate: string, endDate: string): Day[] => {
  if (!startDate || !endDate) return [];
  const days: Day[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  const current = new Date(start);
  while (current <= end) {
    days.push({
      id: uuidv4(),
      date: current.toISOString().split('T')[0],
    });
    current.setDate(current.getDate() + 1);
  }
  return days;
};

const migrateLocations = (oldLocations: LocationImportData[]): Location[] => {
  return oldLocations.map((loc, index) => {
    const dayIds = loc.dayIds || [];

    return {
      id: loc.id,
      name: loc.name,
      lat: loc.lat,
      lng: loc.lng,
      notes: loc.notes,
      imageUrl: loc.imageUrl,
      dayIds,
      startDayId: loc.startDayId || (dayIds.length > 0 ? dayIds[0] : undefined),
      startSlot: loc.startSlot || DEFAULT_SECTION,
      duration: loc.duration || 1,
      order: loc.order ?? index,
      category: loc.category || DEFAULT_CATEGORY,
      checklist: loc.checklist || [],
      links: loc.links || [],
      cost: parseNumeric(loc.cost),
      targetTime: loc.targetTime || '',
      dayOffset: loc.dayOffset,
      subLocations: loc.subLocations ? migrateLocations(loc.subLocations) : []
    };
  });
};

type ImportedDay = NonNullable<ItineraryImportData['days']>[number];

const migrateDays = (oldDays: ImportedDay[]): Day[] => {
  return oldDays.map(day => ({
    ...day,
    accommodation: day.accommodation ? {
      ...day.accommodation,
      cost: parseNumeric(day.accommodation.cost, undefined)
    } : undefined
  }));
};

const normalizeRoutes = (value: unknown): Route[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((route): route is RouteImportData => {
      return Boolean(
        route &&
        typeof route === 'object' &&
        typeof (route as RouteImportData).id === 'string' &&
        typeof (route as RouteImportData).fromLocationId === 'string' &&
        typeof (route as RouteImportData).toLocationId === 'string',
      );
    })
    .map((route) => ({
      id: route.id,
      fromLocationId: route.fromLocationId,
      toLocationId: route.toLocationId,
      transportType: route.transportType || 'other',
      duration: route.duration,
      notes: route.notes,
      cost: parseNumeric(route.cost),
    }));
};

const createEmptyStoredTrip = (name: string): StoredTrip => {
  const now = Date.now();
  return {
    id: uuidv4(),
    name,
    createdAt: now,
    updatedAt: now,
    startDate: '',
    endDate: '',
    days: [],
    locations: [],
    routes: [],
    version: '1.0',
  };
};

const readTripsStore = (): TripsStore | null => {
  const raw = localStorage.getItem(STORAGE_KEY_TRIPS);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<TripsStore>;
    if (!parsed || !Array.isArray(parsed.trips)) return null;

    const trips: StoredTrip[] = parsed.trips
      .map((trip, index) => {
        if (!trip || typeof trip !== 'object') return null;

        const candidate = trip as Partial<StoredTrip>;
        const id = typeof candidate.id === 'string' && candidate.id ? candidate.id : uuidv4();
        const createdAt = typeof candidate.createdAt === 'number' ? candidate.createdAt : Date.now() + index;
        const updatedAt = typeof candidate.updatedAt === 'number' ? candidate.updatedAt : createdAt;

        return {
          id,
          name: typeof candidate.name === 'string' && candidate.name.trim() ? candidate.name : `Trip ${index + 1}`,
          createdAt,
          updatedAt,
          startDate: typeof candidate.startDate === 'string' ? candidate.startDate : '',
          endDate: typeof candidate.endDate === 'string' ? candidate.endDate : '',
          days: migrateDays((Array.isArray(candidate.days) ? candidate.days : []) as ImportedDay[]),
          locations: migrateLocations((Array.isArray(candidate.locations) ? candidate.locations : []) as LocationImportData[]),
          routes: normalizeRoutes(candidate.routes),
          version: typeof candidate.version === 'string' ? candidate.version : '1.0',
        };
      })
      .filter((trip): trip is StoredTrip => Boolean(trip));

    if (trips.length === 0) return null;

    const activeTripId = typeof parsed.activeTripId === 'string' && trips.some((trip) => trip.id === parsed.activeTripId)
      ? parsed.activeTripId
      : trips[0].id;

    return { activeTripId, trips };
  } catch (error) {
    trackError('trips_storage_parse_failed', error);
    return null;
  }
};

const migrateLegacyStore = (): TripsStore => {
  const savedDates = readStorage<{ startDate?: string; endDate?: string }>(STORAGE_KEY_DATES, {});
  const legacyTrip: StoredTrip = {
    ...createEmptyStoredTrip('My Trip'),
    startDate: savedDates.startDate || '',
    endDate: savedDates.endDate || '',
    days: migrateDays(readStorage<ImportedDay[]>(STORAGE_KEY_DAYS, [])),
    locations: migrateLocations(readStorage<LocationImportData[]>(STORAGE_KEY_LOCATIONS, [])),
    routes: normalizeRoutes(readStorage<RouteImportData[]>(STORAGE_KEY_ROUTES, [])),
  };

  return {
    activeTripId: legacyTrip.id,
    trips: [legacyTrip],
  };
};

const buildInitialSnapshot = (): InitialSnapshot => {
  const existingStore = readTripsStore() || migrateLegacyStore();
  const activeTrip = existingStore.trips.find((trip) => trip.id === existingStore.activeTripId) || existingStore.trips[0];
  const normalizedStore: TripsStore = { activeTripId: activeTrip.id, trips: existingStore.trips };
  localStorage.setItem(STORAGE_KEY_TRIPS, JSON.stringify(normalizedStore));
  return { store: normalizedStore, activeTrip };
};

const updateLocationTree = (
  items: Location[],
  id: string,
  updates: Partial<Location>,
): { locations: Location[]; updated: boolean } => {
  let hasUpdated = false;

  const nextLocations = items.map((item) => {
    if (item.id === id) {
      hasUpdated = true;
      return { ...item, ...updates };
    }

    if (item.subLocations?.length) {
      const nestedResult = updateLocationTree(item.subLocations, id, updates);
      if (nestedResult.updated) {
        hasUpdated = true;
        return { ...item, subLocations: nestedResult.locations };
      }
    }

    return item;
  });

  return hasUpdated
    ? { locations: nextLocations, updated: true }
    : { locations: items, updated: false };
};

// Context Type Definition
interface ItineraryContextType {
  // Trip Management
  trips: TripSummary[];
  activeTripId: string;
  switchTrip: (tripId: string) => void;
  createTrip: (name?: string) => string;
  renameTrip: (tripId: string, name: string) => void;
  deleteTrip: (tripId: string) => boolean;

  // State
  startDate: string;
  endDate: string;
  days: Day[];
  locations: Location[];
  routes: Route[];
  aiSettings: AISettings;
  
  // Selection / Interaction State
  selectedLocationId: string | null;
  hoveredLocationId: string | null;

  // History State
  historyIndex: number;
  historyLength: number;
  history: HistorySnapshot[];
  
  // Actions
  setStartDate: (date: string) => void;
  setEndDate: (date: string) => void;
  updateDateRange: (start: string, end: string) => void;
  
  setDays: (days: Day[]) => void;
  updateDay: (id: string, updates: Partial<Day>) => void;
  
  setLocations: (locations: Location[]) => void;
  addLocation: (location: Location) => void;
  removeLocation: (id: string) => void;
  updateLocation: (id: string, updates: Partial<Location>) => void;
  reorderLocations: (activeId: string, overId: string | null, newDayId: string | null, newSlot: DaySection | null) => void;
  
  setRoutes: (routes: Route[]) => void;
  updateRoute: (route: Route) => void; // Updates or Adds if not exists
  
  setAiSettings: (settings: AISettings) => void;
  
  setSelectedLocationId: (id: string | null) => void;
  setHoveredLocationId: (id: string | null) => void;
  
  // History Actions
  navigateHistory: (index: number) => void;
  
  // Import/Export
  getExportData: () => ItineraryData;
  loadFromData: (data: unknown) => LoadDataResult;
  clearAll: () => void;
}

const ItineraryContext = createContext<ItineraryContextType | undefined>(undefined);

export function ItineraryProvider({ children }: { children: ReactNode }) {
  const initialSnapshotRef = useRef<InitialSnapshot | null>(null);
  if (!initialSnapshotRef.current) {
    initialSnapshotRef.current = buildInitialSnapshot();
  }
  const initialSnapshot = initialSnapshotRef.current;

  const [tripStore, setTripStore] = useState<TripsStore>(initialSnapshot.store);

  // --- Core State ---
  const [startDate, setStartDate] = useState<string>(initialSnapshot.activeTrip.startDate);
  const [endDate, setEndDate] = useState<string>(initialSnapshot.activeTrip.endDate);
  const [days, setDays] = useState<Day[]>(initialSnapshot.activeTrip.days);
  const [locations, setLocations] = useState<Location[]>(initialSnapshot.activeTrip.locations);
  const [routes, setRoutes] = useState<Route[]>(initialSnapshot.activeTrip.routes);

  const [aiSettings, setAiSettings] = useState<AISettings>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_AI);
    if (!saved) return { apiKey: '', model: DEFAULT_AI_MODEL };

    try {
      const parsed = JSON.parse(saved);
      // Migration logic
      if (parsed.configs && parsed.configs.gemini) {
        return {
          apiKey: parsed.configs.gemini.apiKey || '',
          model: parsed.configs.gemini.model || DEFAULT_AI_MODEL
        };
      }
      return {
        apiKey: parsed.apiKey || '',
        model: parsed.model || DEFAULT_AI_MODEL
      };
    } catch {
      return { apiKey: '', model: DEFAULT_AI_MODEL };
    }
  });

  // --- UI Selection State ---
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [hoveredLocationId, setHoveredLocationId] = useState<string | null>(null);

  // --- History State ---
  const [history, setHistory] = useState<HistorySnapshot[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isNavigatingHistory, setIsNavigatingHistory] = useState(false);

  const activeTripId = tripStore.activeTripId;
  const tripSummaries = useMemo<TripSummary[]>(
    () =>
      tripStore.trips.map((trip) => ({
        id: trip.id,
        name: trip.name,
        createdAt: trip.createdAt,
        updatedAt: trip.updatedAt,
      })),
    [tripStore.trips],
  );

  const persistTripsStore = (nextStore: TripsStore) => {
    localStorage.setItem(STORAGE_KEY_TRIPS, JSON.stringify(nextStore));
  };

  const applyTripToState = (trip: StoredTrip) => {
    setStartDate(trip.startDate);
    setEndDate(trip.endDate);
    setDays(trip.days);
    setLocations(trip.locations);
    setRoutes(trip.routes);
    setSelectedLocationId(null);
    setHoveredLocationId(null);
    setHistory([]);
    setHistoryIndex(-1);
    setIsNavigatingHistory(false);
  };

  // --- Effects for Persistence ---
  useEffect(() => { localStorage.setItem(STORAGE_KEY_AI, JSON.stringify(aiSettings)); }, [aiSettings]);
  useEffect(() => {
    setTripStore((prev) => {
      const activeIndex = prev.trips.findIndex((trip) => trip.id === prev.activeTripId);
      if (activeIndex === -1) return prev;

      const activeTrip = prev.trips[activeIndex];
      if (
        activeTrip.startDate === startDate &&
        activeTrip.endDate === endDate &&
        activeTrip.days === days &&
        activeTrip.locations === locations &&
        activeTrip.routes === routes
      ) {
        return prev;
      }

      const updatedTrip: StoredTrip = {
        ...activeTrip,
        startDate,
        endDate,
        days,
        locations,
        routes,
        version: '1.0',
        updatedAt: Date.now(),
      };

      const nextTrips = [...prev.trips];
      nextTrips[activeIndex] = updatedTrip;
      const nextStore = { ...prev, trips: nextTrips };
      persistTripsStore(nextStore);
      return nextStore;
    });
  }, [startDate, endDate, days, locations, routes]);

  // --- History Logic ---
  const currentState = useMemo(() => ({
    startDate, endDate, days, locations, routes
  }), [startDate, endDate, days, locations, routes]);

  // Initial history entry
  useEffect(() => {
    if (history.length === 0 && days.length > 0) {
        setHistory([{ ...currentState, timestamp: Date.now(), label: 'Initial State' }]);
        setHistoryIndex(0);
    }
  }, [currentState, days.length, history.length]);

  // Push to history
  useEffect(() => {
    if (isNavigatingHistory) return;

    const timer = setTimeout(() => {
        const lastHistoryEntry = history[historyIndex];
        const stateString = JSON.stringify(currentState);
        const lastStateString = lastHistoryEntry ? JSON.stringify({
            startDate: lastHistoryEntry.startDate,
            endDate: lastHistoryEntry.endDate,
            days: lastHistoryEntry.days,
            locations: lastHistoryEntry.locations,
            routes: lastHistoryEntry.routes,
        }) : '';

        if (stateString !== lastStateString) {
            const newHistory = history.slice(0, historyIndex + 1);
            const label = history.length === 0 ? 'Initial State' : `Change ${newHistory.length}`;
            newHistory.push({ ...currentState, timestamp: Date.now(), label });
            setHistory(newHistory);
            setHistoryIndex(newHistory.length - 1);
        }
    }, 1000);

    return () => clearTimeout(timer);
  }, [currentState, isNavigatingHistory, historyIndex, history]);

  const navigateHistory = (index: number) => {
    if (index < 0 || index >= history.length) return;
    
    setIsNavigatingHistory(true);
    const snapshot = history[index];
    
    setStartDate(snapshot.startDate);
    setEndDate(snapshot.endDate);
    setDays(snapshot.days);
    setLocations(snapshot.locations);
    setRoutes(snapshot.routes);
    setHistoryIndex(index);
    
    setTimeout(() => setIsNavigatingHistory(false), 100);
  };

  const switchTrip = (tripId: string) => {
    if (tripId === tripStore.activeTripId) return;
    const targetTrip = tripStore.trips.find((trip) => trip.id === tripId);
    if (!targetTrip) return;

    setTripStore((prev) => {
      const nextStore = { ...prev, activeTripId: tripId };
      persistTripsStore(nextStore);
      return nextStore;
    });

    applyTripToState(targetTrip);
  };

  const createTrip = (name?: string): string => {
    const normalizedName = name?.trim() || `Trip ${tripStore.trips.length + 1}`;
    const newTrip = createEmptyStoredTrip(normalizedName);

    setTripStore((prev) => {
      const nextStore = {
        activeTripId: newTrip.id,
        trips: [...prev.trips, newTrip],
      };
      persistTripsStore(nextStore);
      return nextStore;
    });

    applyTripToState(newTrip);
    return newTrip.id;
  };

  const renameTrip = (tripId: string, name: string) => {
    const normalizedName = name.trim();
    if (!normalizedName) return;

    setTripStore((prev) => {
      const tripIndex = prev.trips.findIndex((trip) => trip.id === tripId);
      if (tripIndex === -1) return prev;

      const nextTrips = [...prev.trips];
      nextTrips[tripIndex] = {
        ...nextTrips[tripIndex],
        name: normalizedName,
        updatedAt: Date.now(),
      };

      const nextStore = { ...prev, trips: nextTrips };
      persistTripsStore(nextStore);
      return nextStore;
    });
  };

  const deleteTrip = (tripId: string): boolean => {
    if (tripStore.trips.length <= 1) return false;
    const remainingTrips = tripStore.trips.filter((trip) => trip.id !== tripId);
    if (remainingTrips.length === tripStore.trips.length) return false;

    const nextActiveTripId = tripStore.activeTripId === tripId
      ? remainingTrips[0].id
      : tripStore.activeTripId;
    const nextActiveTrip = remainingTrips.find((trip) => trip.id === nextActiveTripId) || remainingTrips[0];

    setTripStore(() => {
      const nextStore = {
        activeTripId: nextActiveTrip.id,
        trips: remainingTrips,
      };
      persistTripsStore(nextStore);
      return nextStore;
    });

    if (tripStore.activeTripId === tripId) {
      applyTripToState(nextActiveTrip);
    }

    return true;
  };

  // --- Actions ---

  const updateDateRange = (newStart: string, newEnd: string) => {
    setStartDate(newStart);
    setEndDate(newEnd);
    const newDays = generateDays(newStart, newEnd);
    const oldDaysMap = new Map(days.map(d => [d.date, d]));
    const updatedDays = newDays.map(day => {
      const existingDay = oldDaysMap.get(day.date);
      return existingDay ? { ...existingDay } : day;
    });
    setDays(updatedDays);
    const newDayIds = new Set(updatedDays.map(d => d.id));
    setLocations(prev => prev.map(loc => ({
      ...loc,
      startDayId: loc.startDayId && newDayIds.has(loc.startDayId) ? loc.startDayId : undefined,
    })));
  };

  const addLocation = (location: Location) => {
    setLocations(prev => [...prev, location]);
  };

  const removeLocation = (id: string) => {
    // Collect IDs of this location and all its sub-locations for route cleanup
    const getAllIds = (loc: Location): string[] => {
      let ids = [loc.id];
      if (loc.subLocations) {
        loc.subLocations.forEach(sub => {
          ids = [...ids, ...getAllIds(sub)];
        });
      }
      return ids;
    };

    setLocations(prevLocations => {
      const locationToRemove = prevLocations.find(l => l.id === id);
      const idsToRemove = locationToRemove ? getAllIds(locationToRemove) : [id];
      const idSet = new Set(idsToRemove);

      setRoutes(prevRoutes => prevRoutes.filter(r => !idSet.has(r.fromLocationId) && !idSet.has(r.toLocationId)));
      if (selectedLocationId && idSet.has(selectedLocationId)) {
        setSelectedLocationId(null);
      }

      return prevLocations.filter(l => l.id !== id);
    });
  };

  const updateLocation = (id: string, updates: Partial<Location>) => {
    setLocations((prev) => {
      const result = updateLocationTree(prev, id, updates);
      return result.updated ? result.locations : prev;
    });
  };

  const updateDay = (id: string, updates: Partial<Day>) => {
    setDays(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
  };

  const updateRoute = (route: Route) => {
    setRoutes(prev => {
        const idx = prev.findIndex(r => r.id === route.id);
        if (idx >= 0) {
            const u = [...prev];
            u[idx] = route;
            return u;
        }
        return [...prev, route];
    });
  };

  const reorderLocations = (activeId: string, overId: string | null, newDayId: string | null, newSlot: DaySection | null) => {
    setLocations(prev => {
      const activeIndex = prev.findIndex(l => l.id === activeId);
      if (activeIndex === -1) return prev;
      const newLocations = [...prev];
      newLocations[activeIndex] = {
        ...newLocations[activeIndex],
        startDayId: newDayId || undefined,
        startSlot: newSlot || newLocations[activeIndex].startSlot || DEFAULT_SECTION
      };
      if (overId && overId !== activeId && overId !== UNASSIGNED_ZONE_ID && !overId.startsWith(SLOT_PREFIX)) {
        const overIndex = newLocations.findIndex(l => l.id === overId);
        const [moved] = newLocations.splice(activeIndex, 1);
        newLocations.splice(overIndex, 0, moved);
      }
      return newLocations.map((loc, idx) => ({ ...loc, order: idx }));
    });
  };

  const clearAll = () => {
    setStartDate('');
    setEndDate('');
    setDays([]);
    setLocations([]);
    setRoutes([]);
    setSelectedLocationId(null);
    setHoveredLocationId(null);
    setHistory([]);
    setHistoryIndex(-1);
  };

  const getExportData = () => ({
    startDate, endDate, days, locations, routes, version: '1.0'
  });

  const loadFromData = (data: unknown): LoadDataResult => {
    const parsed = itineraryImportSchema.safeParse(data);
    if (!parsed.success) {
      trackError('load_data_validation_failed', parsed.error, {
        issues: parsed.error.issues.map(issue => issue.path.join('.')).join(','),
      });
      return { success: false, error: 'Invalid itinerary format. Please import a valid itinerary JSON file.' };
    }

    const payload = parsed.data;

    if (payload.startDate) setStartDate(payload.startDate);
    if (payload.endDate) setEndDate(payload.endDate);
    if (payload.days) setDays(migrateDays(payload.days));
    if (payload.locations) setLocations(migrateLocations(payload.locations));
    if (payload.routes) {
      const migratedRoutes: Route[] = payload.routes.map((route: RouteImportData) => ({
        id: route.id,
        fromLocationId: route.fromLocationId,
        toLocationId: route.toLocationId,
        transportType: route.transportType || 'other',
        duration: route.duration,
        notes: route.notes,
        cost: parseNumeric(route.cost),
      }));
      setRoutes(migratedRoutes);
    }

    return { success: true };
  };

  const value = {
    trips: tripSummaries,
    activeTripId,
    switchTrip,
    createTrip,
    renameTrip,
    deleteTrip,
    startDate, endDate, days, locations, routes, aiSettings,
    selectedLocationId, hoveredLocationId,
    historyIndex, historyLength: history.length, history,
    setStartDate, setEndDate, updateDateRange,
    setDays, updateDay,
    setLocations, addLocation, removeLocation, updateLocation, reorderLocations,
    setRoutes, updateRoute,
    setAiSettings,
    setSelectedLocationId, setHoveredLocationId,
    navigateHistory,
    getExportData, loadFromData, clearAll
  };

  return (
    <ItineraryContext.Provider value={value}>
      {children}
    </ItineraryContext.Provider>
  );
}

export const useItinerary = () => {
  const context = useContext(ItineraryContext);
  if (context === undefined) {
    throw new Error('useItinerary must be used within an ItineraryProvider');
  }
  return context;
};
