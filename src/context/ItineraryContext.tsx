import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Day, Location, Route, AISettings, DaySection } from '../types';

// Storage Keys
const STORAGE_KEY_LOCATIONS = 'itinerary-locations';
const STORAGE_KEY_ROUTES = 'itinerary-routes';
const STORAGE_KEY_DATES = 'itinerary-dates';
const STORAGE_KEY_DAYS = 'itinerary-days';
const STORAGE_KEY_AI = 'itinerary-ai-settings';

// Helper Functions (moved from App.tsx)
const generateDays = (startDate: string, endDate: string): Day[] => {
  if (!startDate || !endDate) return [];
  const days: Day[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  let current = new Date(start);
  while (current <= end) {
    days.push({
      id: uuidv4(),
      date: current.toISOString().split('T')[0],
    });
    current.setDate(current.getDate() + 1);
  }
  return days;
};

const migrateLocations = (oldLocations: any[]): Location[] => {
  return oldLocations.map((loc, index) => ({
    id: loc.id,
    name: loc.name,
    lat: loc.lat,
    lng: loc.lng,
    notes: loc.notes,
    imageUrl: loc.imageUrl,
    dayIds: loc.dayIds || [],
    startDayId: loc.startDayId || (loc.dayIds?.length > 0 ? loc.dayIds[0] : undefined),
    startSlot: loc.startSlot || 'morning',
    duration: loc.duration || 1,
    order: loc.order ?? index,
    category: loc.category || 'sightseeing',
    checklist: loc.checklist || [],
    links: loc.links || [],
    cost: loc.cost || 0,
    targetTime: loc.targetTime || '',
    dayOffset: loc.dayOffset,
    subLocations: loc.subLocations ? migrateLocations(loc.subLocations) : []
  }));
};

// Context Type Definition
interface ItineraryContextType {
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
  history: {
    startDate: string;
    endDate: string;
    days: Day[];
    locations: Location[];
    routes: Route[];
    timestamp: number;
    label: string;
  }[];
  
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
  getExportData: () => any;
  loadFromData: (data: any) => void;
  clearAll: () => void;
}

const ItineraryContext = createContext<ItineraryContextType | undefined>(undefined);

export function ItineraryProvider({ children }: { children: ReactNode }) {
  // --- Core State ---
  const [startDate, setStartDate] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_DATES);
    return saved ? JSON.parse(saved).startDate : '';
  });

  const [endDate, setEndDate] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_DATES);
    return saved ? JSON.parse(saved).endDate : '';
  });

  const [days, setDays] = useState<Day[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_DAYS);
    return saved ? JSON.parse(saved) : [];
  });

  const [locations, setLocations] = useState<Location[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_LOCATIONS);
    return saved ? migrateLocations(JSON.parse(saved)) : [];
  });

  const [routes, setRoutes] = useState<Route[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_ROUTES);
    return saved ? JSON.parse(saved) : [];
  });

  const [aiSettings, setAiSettings] = useState<AISettings>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_AI);
    if (!saved) return { apiKey: '', model: 'gemini-3-flash-preview' };

    try {
      const parsed = JSON.parse(saved);
      // Migration logic
      if (parsed.configs && parsed.configs.gemini) {
        return {
          apiKey: parsed.configs.gemini.apiKey || '',
          model: parsed.configs.gemini.model || 'gemini-3-flash-preview'
        };
      }
      return {
        apiKey: parsed.apiKey || '',
        model: parsed.model || 'gemini-3-flash-preview'
      };
    } catch (e) {
      return { apiKey: '', model: 'gemini-3-flash-preview' };
    }
  });

  // --- UI Selection State ---
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [hoveredLocationId, setHoveredLocationId] = useState<string | null>(null);

  // --- History State ---
  const [history, setHistory] = useState<{
    startDate: string;
    endDate: string;
    days: Day[];
    locations: Location[];
    routes: Route[];
    timestamp: number;
    label: string;
  }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isNavigatingHistory, setIsNavigatingHistory] = useState(false);

  // --- Effects for Persistence ---
  useEffect(() => { localStorage.setItem(STORAGE_KEY_LOCATIONS, JSON.stringify(locations)); }, [locations]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_ROUTES, JSON.stringify(routes)); }, [routes]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_DATES, JSON.stringify({ startDate, endDate })); }, [startDate, endDate]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_DAYS, JSON.stringify(days)); }, [days]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_AI, JSON.stringify(aiSettings)); }, [aiSettings]);

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
  }, [days.length]); // Depend on days.length to catch initial load

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

    const locationToRemove = locations.find(l => l.id === id);
    const idsToRemove = locationToRemove ? getAllIds(locationToRemove) : [id];
    const idSet = new Set(idsToRemove);

    setLocations(locations.filter(l => l.id !== id));
    setRoutes(routes.filter(r => !idSet.has(r.fromLocationId) && !idSet.has(r.toLocationId)));
    if (selectedLocationId === id) setSelectedLocationId(null);
  };

  const updateLocation = (id: string, updates: Partial<Location>) => {
    setLocations(locations.map(l => l.id === id ? { ...l, ...updates } : l));
  };

  const updateDay = (id: string, updates: Partial<Day>) => {
    setDays(days.map(d => d.id === id ? { ...d, ...updates } : d));
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
      let newLocations = [...prev];
      newLocations[activeIndex] = {
        ...newLocations[activeIndex],
        startDayId: newDayId || undefined,
        startSlot: newSlot || newLocations[activeIndex].startSlot || 'morning'
      };
      if (overId && overId !== activeId && overId !== 'unassigned-zone' && !overId.startsWith('slot-')) {
        const overIndex = newLocations.findIndex(l => l.id === overId);
        const [moved] = newLocations.splice(activeIndex, 1);
        newLocations.splice(overIndex, 0, moved);
      }
      return newLocations.map((loc, idx) => ({ ...loc, order: idx }));
    });
  };

  const clearAll = () => {
    setLocations([]);
    // Optionally reset other things? User prompt said "clear all data", typically implies just the itinerary content
  };

  const getExportData = () => ({
    startDate, endDate, days, locations, routes, version: '1.0'
  });

  const loadFromData = (data: any) => {
    if (data.startDate) setStartDate(data.startDate);
    if (data.endDate) setEndDate(data.endDate);
    if (data.days) setDays(data.days);
    if (data.locations) setLocations(migrateLocations(data.locations));
    if (data.routes) setRoutes(data.routes);
  };

  const value = {
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
