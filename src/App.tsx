import React, { useState, useEffect, useMemo } from 'react';
import { Row, Col, Button, Form } from 'react-bootstrap';
import { v4 as uuidv4 } from 'uuid';
import { Trash2, Map as MapIcon, Search } from 'lucide-react';
import MapDisplay from './components/MapDisplay';
import { DateRangePicker } from './components/DateRangePicker';
import { DaySidebar } from './components/DaySidebar';
import { RouteEditor } from './components/RouteEditor';
import { DayAssignmentModal } from './components/DayAssignmentModal';
import { Location, Day, Route, DaySection } from './types';

// Nominatim OpenStreetMap Search Service
const searchPlace = async (query: string) => {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Search failed", error);
    return [];
  }
};

const reverseGeocode = async (lat: number, lng: number) => {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
    const data = await response.json();
    return data.display_name || `Location at ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch {
    return `Location at ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

// Generate days between two dates
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

// Migrate old data format to new format
interface OldLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  notes?: string;
  dayIds?: string[];
  startDayId?: string;
  startSlot?: DaySection;
  duration?: number;
}

const migrateLocations = (oldLocations: OldLocation[]): Location[] => {
  return oldLocations.map((loc, index) => {
    const dayIds = loc.dayIds || [];
    const startDayId = loc.startDayId || (dayIds.length > 0 ? dayIds[0] : undefined);
    
    return {
      id: loc.id,
      name: loc.name,
      lat: loc.lat,
      lng: loc.lng,
      notes: loc.notes,
      dayIds: dayIds, // Keep for now
      startDayId: startDayId,
      startSlot: loc.startSlot || 'morning',
      duration: loc.duration || (dayIds.length > 0 ? dayIds.length * 3 : 1),
      order: index,
    };
  });
};

// Storage keys
const STORAGE_KEY_LOCATIONS = 'itinerary-locations';
const STORAGE_KEY_ROUTES = 'itinerary-routes';
const STORAGE_KEY_DATES = 'itinerary-dates';
const STORAGE_KEY_DAYS = 'itinerary-days';

function App() {
  // Date range state
  const [startDate, setStartDate] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_DATES);
    if (saved) {
      const { startDate } = JSON.parse(saved);
      return startDate || '';
    }
    return '';
  });

  const [endDate, setEndDate] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_DATES);
    if (saved) {
      const { endDate } = JSON.parse(saved);
      return endDate || '';
    }
    return '';
  });

  // Days state
  const [days, setDays] = useState<Day[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_DAYS);
    return saved ? JSON.parse(saved) : [];
  });

  // Locations state with migration
  const [locations, setLocations] = useState<Location[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_LOCATIONS);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Always run migration to ensure new fields exist
      return migrateLocations(parsed);
    }
    return [];
  });

  // Routes state
  const [routes, setRoutes] = useState<Route[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_ROUTES);
    return saved ? JSON.parse(saved) : [];
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Modal states
  const [editingRoute, setEditingRoute] = useState<{ fromId: string; toId: string } | null>(null);
  const [editingDayAssignment, setEditingDayAssignment] = useState<Location | null>(null);
  const [pendingAddToDay, setPendingAddToDay] = useState<{ dayId: string, slot?: DaySection } | null>(null);

  // Persist state
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_LOCATIONS, JSON.stringify(locations));
  }, [locations]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_ROUTES, JSON.stringify(routes));
  }, [routes]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_DATES, JSON.stringify({ startDate, endDate }));
  }, [startDate, endDate]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_DAYS, JSON.stringify(days));
  }, [days]);

  // Handle date range change
  const handleDateRangeChange = (newStart: string, newEnd: string) => {
    setStartDate(newStart);
    setEndDate(newEnd);

    // Generate new days
    const newDays = generateDays(newStart, newEnd);

    // Preserve day assignments where possible by matching dates
    const oldDateToId = new Map(days.map(d => [d.date, d.id]));

    // Update days, reusing IDs where dates match
    const updatedDays = newDays.map(day => {
      const existingId = oldDateToId.get(day.date);
      return existingId ? { ...day, id: existingId } : day;
    });

    setDays(updatedDays);

    // Cleanup invalid startDayIds
    const newDayIds = new Set(updatedDays.map(d => d.id));
    setLocations(prev => prev.map(loc => {
      const validStartDay = loc.startDayId && newDayIds.has(loc.startDayId) ? loc.startDayId : undefined;
      return {
        ...loc,
        startDayId: validStartDay,
        // If start day is gone, it becomes unassigned
      };
    }));
  };

  const addLocation = async (lat: number, lng: number, name?: string, targetDayId?: string, targetSlot?: DaySection) => {
    const resolvedName = name || await reverseGeocode(lat, lng);
    
    let assignedDayId = undefined;
    let assignedSlot: DaySection = 'morning';

    if (targetDayId) {
      assignedDayId = targetDayId;
      if (targetSlot) assignedSlot = targetSlot;
    } else if (pendingAddToDay) {
      assignedDayId = pendingAddToDay.dayId;
      if (pendingAddToDay.slot) assignedSlot = pendingAddToDay.slot;
    } else if (days.length > 0) {
      assignedDayId = days[0].id;
    }

    const newLocation: Location = {
      id: uuidv4(),
      name: resolvedName.split(',')[0],
      lat,
      lng,
      notes: '',
      dayIds: [], // Deprecated
      startDayId: assignedDayId,
      startSlot: assignedSlot,
      duration: 1,
      order: locations.length,
    };
    setLocations([...locations, newLocation]);
    setPendingAddToDay(null); // Clear pending
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    const results = await searchPlace(searchQuery);
    setIsSearching(false);

    if (results && results.length > 0) {
      const first = results[0];
      await addLocation(parseFloat(first.lat), parseFloat(first.lon), first.display_name);
      setSearchQuery('');
    } else {
      alert('Place not found');
    }
  };

  const removeLocation = (id: string) => {
    setLocations(locations.filter(l => l.id !== id));
    // Also remove routes involving this location
    setRoutes(routes.filter(r => r.fromLocationId !== id && r.toLocationId !== id));
  };

  const updateLocation = (id: string, updates: Partial<Location>) => {
    setLocations(locations.map(l => l.id === id ? { ...l, ...updates } : l));
  };

  const handleReorderLocations = (activeId: string, overId: string | null, newDayId: string | null, newSlot: DaySection | null = null) => {
    setLocations(prev => {
      const activeLocation = prev.find(l => l.id === activeId);
      if (!activeLocation) return prev;

      let newLocations = [...prev];
      const activeIndex = newLocations.findIndex(l => l.id === activeId);

      // Update the day/slot assignment
      if (newDayId !== undefined) { // Allow null to mean unassigned
         newLocations[activeIndex] = { 
           ...newLocations[activeIndex], 
           startDayId: newDayId || undefined,
           startSlot: newSlot || newLocations[activeIndex].startSlot || 'morning'
         };
      }

      // If dropped on another location, reorder
      if (overId && overId !== activeId && overId !== 'unassigned-zone' && !overId.startsWith('slot-')) {
        const oldIndex = newLocations.findIndex(l => l.id === activeId);
        const newIndex = newLocations.findIndex(l => l.id === overId);

        if (oldIndex !== -1 && newIndex !== -1) {
          const [moved] = newLocations.splice(oldIndex, 1);
          newLocations.splice(newIndex, 0, moved);
        }
      }

      // Update order values
      return newLocations.map((loc, idx) => ({ ...loc, order: idx }));
    });
  };

  // Handle adding a new location to a specific day
  const handleAddToDay = (dayId: string, slot?: DaySection) => {
    setPendingAddToDay({ dayId, slot });
  };

  // Route editing
  const handleEditRoute = (fromId: string, toId: string) => {
    setEditingRoute({ fromId, toId });
  };

  const currentEditingRoute = useMemo(() => {
    if (!editingRoute) return null;

    const existing = routes.find(r =>
      (r.fromLocationId === editingRoute.fromId && r.toLocationId === editingRoute.toId) ||
      (r.fromLocationId === editingRoute.toId && r.toLocationId === editingRoute.fromId)
    );

    if (existing) return existing;

    // Create a new route template
    return {
      id: uuidv4(),
      fromLocationId: editingRoute.fromId,
      toLocationId: editingRoute.toId,
      transportType: 'car' as const,
    };
  }, [editingRoute, routes]);

  const handleSaveRoute = (route: Route) => {
    setRoutes(prev => {
      const existingIndex = prev.findIndex(r => r.id === route.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = route;
        return updated;
      }
      return [...prev, route];
    });
    setEditingRoute(null);
  };

  // Day assignment
  const handleSaveDayAssignment = (locationId: string, dayIds: string[]) => {
    updateLocation(locationId, { dayIds });
    setEditingDayAssignment(null);
  };

  const getLocationName = (id: string) => {
    return locations.find(l => l.id === id)?.name || 'Unknown';
  };

  return (
    <div className="container-fluid p-0">
      <Row className="g-0">
        {/* Sidebar */}
        <Col md={4} lg={3} className="sidebar d-flex flex-column">
          <div className="mb-3">
            <h3 className="d-flex align-items-center gap-2 mb-3">
              <MapIcon /> Itinerary
            </h3>

            {/* Date Range Picker */}
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onDateRangeChange={handleDateRangeChange}
            />

            <Form onSubmit={handleSearch} className="d-flex gap-2 mb-3">
              <Form.Control
                type="text"
                placeholder="Search place..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <Button type="submit" variant="primary" disabled={isSearching}>
                {isSearching ? '...' : <Search size={18} />}
              </Button>
            </Form>

            <p className="text-muted small">
              Search to add places. Drag items between days to reorder.
            </p>
          </div>

          <div className="flex-grow-1 overflow-auto">
            <DaySidebar
              days={days}
              locations={locations}
              routes={routes}
              onReorderLocations={handleReorderLocations}
              onRemoveLocation={removeLocation}
              onUpdateLocation={updateLocation}
              onEditRoute={handleEditRoute}
              onAddToDay={handleAddToDay}
            />
          </div>

          <div className="mt-3 pt-3 border-top">
            <div className="d-flex justify-content-between align-items-center">
              <strong>Total Stops: {locations.length}</strong>
              {locations.length > 0 && (
                <Button variant="outline-danger" size="sm" onClick={() => setLocations([])}>
                  <Trash2 size={16} className="me-1" /> Clear
                </Button>
              )}
            </div>
          </div>
        </Col>

        {/* Map */}
        <Col md={8} lg={9}>
          <MapDisplay
            locations={locations}
            routes={routes}
            onEditRoute={handleEditRoute}
          />
        </Col>
      </Row>

      {/* Route Editor Modal */}
      <RouteEditor
        show={!!editingRoute}
        route={currentEditingRoute}
        fromName={editingRoute ? getLocationName(editingRoute.fromId) : ''}
        toName={editingRoute ? getLocationName(editingRoute.toId) : ''}
        onSave={handleSaveRoute}
        onClose={() => setEditingRoute(null)}
      />

      {/* Day Assignment Modal */}
      <DayAssignmentModal
        show={!!editingDayAssignment}
        location={editingDayAssignment}
        days={days}
        onSave={handleSaveDayAssignment}
        onClose={() => setEditingDayAssignment(null)}
      />
    </div>
  );
}

export default App;
