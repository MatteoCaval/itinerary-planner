import React, { useState, useEffect, useMemo } from 'react';
import { Row, Col, Button, Form, ButtonGroup } from 'react-bootstrap';
import { v4 as uuidv4 } from 'uuid';
import { Map as MapIcon, Search, Download, Upload, Trash2, Calendar as CalendarIcon, List as ListIcon, Cloud, Printer } from 'lucide-react';
import MapDisplay from './components/MapDisplay';
import { DateRangePicker } from './components/DateRangePicker';
import { DaySidebar } from './components/DaySidebar';
import { RouteEditor } from './components/RouteEditor';
import { DayAssignmentModal } from './components/DayAssignmentModal';
import { LocationDetailPanel } from './components/LocationDetailPanel';
import { CalendarView } from './components/CalendarView';
import { CloudSyncModal } from './components/CloudSyncModal';
import { PrintableItinerary } from './components/PrintableItinerary';
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
    targetTime: loc.targetTime || ''
  }));
};

const STORAGE_KEY_LOCATIONS = 'itinerary-locations';
const STORAGE_KEY_ROUTES = 'itinerary-routes';
const STORAGE_KEY_DATES = 'itinerary-dates';
const STORAGE_KEY_DAYS = 'itinerary-days';

function App() {
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

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [editingRoute, setEditingRoute] = useState<{ fromId: string; toId: string } | null>(null);
  const [editingDayAssignment, setEditingDayAssignment] = useState<Location | null>(null);
  const [pendingAddToDay, setPendingAddToDay] = useState<{ dayId: string, slot?: DaySection } | null>(null);
  const [hoveredLocationId, setHoveredLocationId] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [sidebarView, setSidebarView] = useState<'timeline' | 'calendar'>('timeline');
  const [mobileView, setMobileView] = useState<'timeline' | 'map'>('timeline');
  const [showCloudModal, setShowCloudModal] = useState(false);

  useEffect(() => { localStorage.setItem(STORAGE_KEY_LOCATIONS, JSON.stringify(locations)); }, [locations]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_ROUTES, JSON.stringify(routes)); }, [routes]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_DATES, JSON.stringify({ startDate, endDate })); }, [startDate, endDate]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_DAYS, JSON.stringify(days)); }, [days]);

  const handleDateRangeChange = (newStart: string, newEnd: string) => {
    setStartDate(newStart);
    setEndDate(newEnd);
    const newDays = generateDays(newStart, newEnd);
    const oldDateToId = new Map(days.map(d => [d.date, d.id]));
    const updatedDays = newDays.map(day => {
      const existingId = oldDateToId.get(day.date);
      return existingId ? { ...day, id: existingId } : day;
    });
    setDays(updatedDays);
    const newDayIds = new Set(updatedDays.map(d => d.id));
    setLocations(prev => prev.map(loc => ({
      ...loc,
      startDayId: loc.startDayId && newDayIds.has(loc.startDayId) ? loc.startDayId : undefined,
    })));
  };

  const addLocation = async (lat: number, lng: number, name?: string, targetDayId?: string, targetSlot?: DaySection) => {
    const resolvedName = name || await reverseGeocode(lat, lng);
    let assignedDayId = targetDayId || pendingAddToDay?.dayId || (days.length > 0 ? days[0].id : undefined);
    let assignedSlot = targetSlot || pendingAddToDay?.slot || 'morning';

    const newLocation: Location = {
      id: uuidv4(),
      name: resolvedName.split(',')[0],
      lat, lng, notes: '', dayIds: [],
      startDayId: assignedDayId,
      startSlot: assignedSlot,
      duration: 1,
      order: locations.length,
      category: 'sightseeing',
      checklist: [],
      links: [],
      cost: 0,
      targetTime: ''
    };
    setLocations([...locations, newLocation]);
    setPendingAddToDay(null);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    const results = await searchPlace(searchQuery);
    setIsSearching(false);
    if (results?.length > 0) {
      await addLocation(parseFloat(results[0].lat), parseFloat(results[0].lon), results[0].display_name);
      setSearchQuery('');
    }
  };

  const removeLocation = (id: string) => {
    setLocations(locations.filter(l => l.id !== id));
    setRoutes(routes.filter(r => r.fromLocationId !== id && r.toLocationId !== id));
    if (selectedLocationId === id) setSelectedLocationId(null);
  };

  const updateLocation = (id: string, updates: Partial<Location>) => {
    setLocations(locations.map(l => l.id === id ? { ...l, ...updates } : l));
  };

  const handleReorderLocations = (activeId: string, overId: string | null, newDayId: string | null, newSlot: DaySection | null = null) => {
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

  const handleScrollToLocation = (id: string) => {
    setSelectedLocationId(id);
    setTimeout(() => {
      const element = document.getElementById(`item-${id}`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const getExportData = () => ({
    startDate, endDate, days, locations, routes, version: '1.0'
  });

  const handleCloudLoad = (data: any) => {
    if (data.startDate) setStartDate(data.startDate);
    if (data.endDate) setEndDate(data.endDate);
    if (data.days) setDays(data.days);
    if (data.locations) setLocations(migrateLocations(data.locations));
    if (data.routes) setRoutes(data.routes);
  };

  const handleExport = () => {
    const data = getExportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `itinerary-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        handleCloudLoad(data);
        alert('Itinerary imported successfully!');
      } catch (err) {
        alert('Error importing file. Please ensure it is a valid JSON itinerary.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handlePrint = () => {
    window.print();
  };

  const selectedLocation = useMemo(() => locations.find(l => l.id === selectedLocationId) || null, [locations, selectedLocationId]);

  return (
    <div className="container-fluid p-0 h-100 overflow-hidden" style={{ height: '100vh', paddingBottom: '56px' }}>
      <PrintableItinerary days={days} locations={locations} routes={routes} startDate={startDate} endDate={endDate} />
      
      <Row className="g-0 h-100">
        <Col 
          md={5} lg={4} 
          className={`sidebar d-flex flex-column h-100 shadow-sm ${mobileView === 'map' ? 'd-none d-md-flex' : 'd-flex'}`}
          style={{ zIndex: 100 }}
        >
          <div className="p-3 border-bottom">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h3 className="d-flex align-items-center gap-2 mb-0"><MapIcon /> Itinerary</h3>
              <ButtonGroup size="sm">
                <Button variant={sidebarView === 'timeline' ? 'secondary' : 'outline-secondary'} onClick={() => setSidebarView('timeline')}><ListIcon size={16} /></Button>
                <Button variant={sidebarView === 'calendar' ? 'secondary' : 'outline-secondary'} onClick={() => setSidebarView('calendar')}><CalendarIcon size={16} /></Button>
              </ButtonGroup>
            </div>
            
            <DateRangePicker startDate={startDate} endDate={endDate} onDateRangeChange={handleDateRangeChange} />
            
            {pendingAddToDay && (
              <div className="alert alert-info py-2 px-3 small mb-2 d-flex justify-content-between align-items-center">
                <span>Adding to Day {days.findIndex(d => d.id === pendingAddToDay.dayId) + 1} ({pendingAddToDay.slot})</span>
                <Button variant="link" size="sm" className="p-0 text-decoration-none" onClick={() => setPendingAddToDay(null)}>Cancel</Button>
              </div>
            )}
            
            <Form onSubmit={handleSearch} className="d-flex gap-2 mb-2">
              <Form.Control type="text" placeholder={pendingAddToDay ? "Search place to add..." : "Search place..."} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} autoFocus={!!pendingAddToDay} />
              <Button type="submit" variant="primary" disabled={isSearching}>{isSearching ? '...' : <Search size={18} />}</Button>
            </Form>
            
            {sidebarView === 'timeline' && (
              <div className="d-flex align-items-center gap-2 mb-2 px-1">
                <span className="text-muted small fw-bold">Zoom:</span>
                <Form.Range min={0.5} max={2.5} step={0.1} value={zoomLevel} onChange={e => setZoomLevel(parseFloat(e.target.value))} className="flex-grow-1" />
                <span className="text-muted small" style={{ minWidth: '35px' }}>{Math.round(zoomLevel * 100)}%</span>
              </div>
            )}
          </div>

          <div className="flex-grow-1 overflow-auto bg-light">
            {sidebarView === 'timeline' ? (
              <DaySidebar 
                days={days} locations={locations} routes={routes} 
                onReorderLocations={handleReorderLocations} onRemoveLocation={removeLocation} 
                onUpdateLocation={updateLocation} onEditRoute={(from, to) => setEditingRoute({ fromId: from, toId: to })} 
                onAddToDay={(dayId, slot) => setPendingAddToDay({ dayId, slot })}
                hoveredLocationId={hoveredLocationId} onHoverLocation={setHoveredLocationId} zoomLevel={zoomLevel} 
                selectedLocationId={selectedLocationId} onSelectLocation={setSelectedLocationId}
              />
            ) : (
              <CalendarView days={days} locations={locations} onSelectLocation={handleScrollToLocation} />
            )}
          </div>

          <div className="p-3 border-top bg-white">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <strong className="small text-muted text-uppercase">Total Stops: {locations.length}</strong>
              <div className="d-flex gap-1">
                <Button variant="outline-danger" size="sm" className="py-0 px-2 small" onClick={() => {
                  if(confirm('Are you sure you want to clear all data?')) setLocations([]);
                }}>
                  <Trash2 size={14} /> Clear
                </Button>
              </div>
            </div>
            <div className="d-flex gap-2">
              <Button variant="outline-primary" size="sm" className="flex-grow-1 d-flex align-items-center justify-content-center gap-1" onClick={() => setShowCloudModal(true)}>
                <Cloud size={14} /> Cloud
              </Button>
              <Button variant="outline-secondary" size="sm" className="d-flex align-items-center justify-content-center gap-1" onClick={handlePrint} title="Print / Save as PDF">
                <Printer size={14} />
              </Button>
              <Button variant="outline-secondary" size="sm" className="d-flex align-items-center justify-content-center gap-1" onClick={handleExport} title="Download JSON">
                <Download size={14} />
              </Button>
              <label className="btn btn-outline-secondary btn-sm d-flex align-items-center justify-content-center gap-1 mb-0 cursor-pointer" title="Import JSON">
                <Upload size={14} />
                <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
              </label>
            </div>
          </div>
        </Col>

        <Col 
          md={7} lg={8} 
          className={`position-relative h-100 ${mobileView === 'timeline' ? 'd-none d-md-block' : 'd-block'}`}
        >
          <MapDisplay 
            days={days} locations={locations} routes={routes} 
            onEditRoute={(from, to) => setEditingRoute({ fromId: from, toId: to })}
            hoveredLocationId={hoveredLocationId} onHoverLocation={setHoveredLocationId} onSelectLocation={handleScrollToLocation} 
          />
        </Col>
      </Row>

      {/* Side Panel Overlay - Rendered outside grid to be visible on mobile regardless of view */}
      {selectedLocation && (
        <div className="location-detail-panel shadow-lg bg-white" style={{ zIndex: 1060 }}>
          <LocationDetailPanel 
            location={selectedLocation} 
            days={days}
            allLocations={locations}
            routes={routes}
            onUpdate={updateLocation} 
            onClose={() => setSelectedLocationId(null)} 
          />
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      <div className="d-md-none fixed-bottom bg-white border-top d-flex justify-content-around p-2 shadow-lg" style={{ zIndex: 1050 }}>
        <Button 
          variant={mobileView === 'timeline' ? 'primary' : 'link'} 
          className="flex-grow-1 text-decoration-none"
          onClick={() => setMobileView('timeline')}
        >
          Timeline
        </Button>
        <div className="vr my-2"></div>
        <Button 
          variant={mobileView === 'map' ? 'primary' : 'link'} 
          className="flex-grow-1 text-decoration-none"
          onClick={() => setMobileView('map')}
        >
          Map
        </Button>
      </div>

      <CloudSyncModal show={showCloudModal} onClose={() => setShowCloudModal(false)} getData={getExportData} onLoadData={handleCloudLoad} />

      <RouteEditor 
        show={!!editingRoute} route={routes.find(r => (r.fromLocationId === editingRoute?.fromId && r.toLocationId === editingRoute?.toId) || (r.fromLocationId === editingRoute?.toId && r.toLocationId === editingRoute?.fromId)) || (editingRoute ? { id: uuidv4(), fromLocationId: editingRoute.fromId, toLocationId: editingRoute.toId, transportType: 'car' } : null)} 
        fromName={locations.find(l => l.id === editingRoute?.fromId)?.name || ''} toName={locations.find(l => l.id === editingRoute?.toId)?.name || ''} 
        onSave={route => { setRoutes(prev => { const idx = prev.findIndex(r => r.id === route.id); if (idx >= 0) { const u = [...prev]; u[idx] = route; return u; } return [...prev, route]; }); setEditingRoute(null); }} 
        onClose={() => setEditingRoute(null)} 
      />
      <DayAssignmentModal show={!!editingDayAssignment} location={editingDayAssignment} days={days} onSave={(id, ids) => { updateLocation(id, { dayIds: ids }); setEditingDayAssignment(null); }} onClose={() => setEditingDayAssignment(null)} />
    </div>
  );
}

export default App;
