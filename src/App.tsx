import React, { useState, useEffect, useMemo } from 'react';
import { AppShell, Burger, Group, Button, ActionIcon, TextInput, Tooltip, Text, Box, Paper, Stack, Slider, Menu } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { v4 as uuidv4 } from 'uuid';
import { Map as MapIcon, Search, Download, Upload, Trash2, Calendar as CalendarIcon, List as ListIcon, Cloud, Printer, MoreHorizontal } from 'lucide-react';
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
  const [opened, { toggle, close }] = useDisclosure();
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
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Debounced search for suggestions
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.trim().length > 2) {
        const results = await searchPlace(searchQuery);
        setSuggestions(results || []);
      } else {
        setSuggestions([]);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  const [editingRoute, setEditingRoute] = useState<{ fromId: string; toId: string } | null>(null);
  const [editingDayAssignment, setEditingDayAssignment] = useState<Location | null>(null);
  const [pendingAddToDay, setPendingAddToDay] = useState<{ dayId: string, slot?: DaySection } | null>(null);
  const [hoveredLocationId, setHoveredLocationId] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [sidebarView, setSidebarView] = useState<'timeline' | 'calendar'>('timeline');
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
      duration: 3,
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
      setSuggestions([]);
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

  const handleScrollToLocation = (id: string | null) => {
    setSelectedLocationId(id);
    if (id) {
      close(); // Close sidebar on mobile when selecting a location
      setTimeout(() => {
        const element = document.getElementById(`item-${id}`);
        element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
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
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 500,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      padding={0}
    >
      <PrintableItinerary days={days} locations={locations} routes={routes} startDate={startDate} endDate={endDate} />

      <AppShell.Header style={{ zIndex: 1200 }}>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={() => { toggle(); if (!opened) setSelectedLocationId(null); }} hiddenFrom="sm" size="sm" />
            <Text fw={700} fz="lg" c="blue" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MapIcon size={20} /> Itinerary Planner
            </Text>
          </Group>
          <Group gap="xs" visibleFrom="sm">
            <Button variant="default" size="xs" leftSection={<Printer size={16} />} onClick={handlePrint}>Print</Button>
            <Button variant="default" size="xs" leftSection={<Upload size={16} />} onClick={() => document.getElementById('import-file')?.click()}>Import</Button>
            <input type="file" id="import-file" style={{ display: 'none' }} onChange={handleImport} accept=".json" />
            <Button variant="default" size="xs" leftSection={<Download size={16} />} onClick={handleExport}>Export</Button>
            <Button variant="filled" color="blue" size="xs" leftSection={<Cloud size={16} />} onClick={() => setShowCloudModal(true)}>Sync</Button>
          </Group>

          <Box hiddenFrom="sm">
            <Menu shadow="md" width={200} position="bottom-end" withinPortal>
              <Menu.Target>
                <ActionIcon variant="light" size="lg">
                  <MoreHorizontal size={20} />
                </ActionIcon>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Label>Actions</Menu.Label>
                <Menu.Item leftSection={<Cloud size={16} />} onClick={() => setShowCloudModal(true)}>
                  Sync
                </Menu.Item>
                <Menu.Item leftSection={<Printer size={16} />} onClick={handlePrint}>
                  Print
                </Menu.Item>
                <Menu.Divider />
                <Menu.Label>Data</Menu.Label>
                <Menu.Item leftSection={<Upload size={16} />} onClick={() => document.getElementById('import-file')?.click()}>
                  Import JSON
                </Menu.Item>
                <Menu.Item leftSection={<Download size={16} />} onClick={handleExport}>
                  Export JSON
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Box>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p={0} style={{ zIndex: 1000 }}>
        <Stack h="100%" gap={0}>
          <Box p="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
            <DateRangePicker startDate={startDate} endDate={endDate} onDateRangeChange={handleDateRangeChange} />

            {/* View Toggle */}
            <Group grow mt="sm" mb="md">
              <Button
                variant={sidebarView === 'timeline' ? 'light' : 'subtle'}
                onClick={() => setSidebarView('timeline')}
                leftSection={<ListIcon size={16} />}
                size="xs"
              >
                Timeline
              </Button>
              <Button
                variant={sidebarView === 'calendar' ? 'light' : 'subtle'}
                onClick={() => setSidebarView('calendar')}
                leftSection={<CalendarIcon size={16} />}
                size="xs"
              >
                Calendar
              </Button>
            </Group>

            {pendingAddToDay && (
              <Paper withBorder p="xs" bg="blue.0" mt="sm" mb="xs">
                <Group justify="space-between">
                  <Text size="sm">Adding to Day {days.findIndex(d => d.id === pendingAddToDay.dayId) + 1} ({pendingAddToDay.slot})</Text>
                  <Button variant="subtle" size="xs" color="red" onClick={() => setPendingAddToDay(null)}>Cancel</Button>
                </Group>
              </Paper>
            )}

            <Box mb="xs" style={{ position: 'relative' }}>
              <form onSubmit={handleSearch}>
                <TextInput
                  placeholder={pendingAddToDay ? "Search place to add..." : "Search place..."}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  rightSection={
                    <ActionIcon size="sm" variant="transparent" type="submit" loading={isSearching}>
                      <Search size={16} />
                    </ActionIcon>
                  }
                />
              </form>
              {suggestions.length > 0 && (
                <Paper withBorder shadow="md" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000, maxHeight: 250, overflowY: 'auto' }}>
                  {suggestions.map((s, i) => (
                    <Box
                      key={i}
                      p="xs"
                      style={{ cursor: 'pointer', borderBottom: '1px solid var(--mantine-color-gray-2)' }}
                      className="hover-bg-light"
                      onClick={async () => {
                        await addLocation(parseFloat(s.lat), parseFloat(s.lon), s.display_name);
                        setSearchQuery('');
                        setSuggestions([]);
                      }}
                    >
                      <Text size="sm" fw={500}>{s.display_name.split(',')[0]}</Text>
                      <Text size="xs" c="dimmed" truncate>{s.display_name}</Text>
                    </Box>
                  ))}
                </Paper>
              )}
            </Box>

            {sidebarView === 'timeline' && (
              <Group gap="xs" align="center" mt="xs">
                <Text size="xs" fw={500} c="dimmed">Zoom:</Text>
                <Slider
                  flex={1}
                  size="sm"
                  min={0.5}
                  max={2.5}
                  step={0.1}
                  value={zoomLevel}
                  onChange={setZoomLevel}
                  label={(val) => `${Math.round(val * 100)}%`}
                  mb={4}
                />
                <Text size="xs" c="dimmed" w={35}>{Math.round(zoomLevel * 100)}%</Text>
              </Group>
            )}
          </Box>

          <Box style={{ flex: 1, overflow: 'hidden' }}>
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
          </Box>

          <Box p="md" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
            <Group justify="space-between" mb="xs">
              <Text size="xs" fw={700} tt="uppercase" c="dimmed">{locations.length} Stops</Text>
              <Button variant="subtle" color="red" size="xs" leftSection={<Trash2 size={14} />} onClick={() => {
                if (confirm('Are you sure you want to clear all data?')) setLocations([]);
              }}>
                Clear
              </Button>
            </Group>
            <Group gap="xs">
              <Button variant="light" size="xs" flex={1} leftSection={<Cloud size={14} />} onClick={() => setShowCloudModal(true)}>Cloud Sync</Button>
              <Tooltip label="Print / Save PDF">
                <ActionIcon variant="default" size="md" onClick={handlePrint}><Printer size={16} /></ActionIcon>
              </Tooltip>
              <Tooltip label="Download JSON">
                <ActionIcon variant="default" size="md" onClick={handleExport}><Download size={16} /></ActionIcon>
              </Tooltip>
              <Tooltip label="Import JSON">
                <ActionIcon variant="default" size="md" component="label" style={{ cursor: 'pointer' }}>
                  <Upload size={16} />
                  <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Box>
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main h="100vh" style={{ position: 'relative', overflow: 'hidden' }}>
        <MapDisplay
          days={days} locations={locations} routes={routes}
          onEditRoute={(from, to) => setEditingRoute({ fromId: from, toId: to })}
          hoveredLocationId={hoveredLocationId} onHoverLocation={setHoveredLocationId} onSelectLocation={handleScrollToLocation}
          hideControls={opened}
        />

        {selectedLocation && (
          <Paper
            shadow="xl"
            className="location-detail-panel-root"
          >
            <LocationDetailPanel
              location={selectedLocation}
              days={days}
              allLocations={locations}
              routes={routes}
              onUpdate={updateLocation}
              onClose={() => setSelectedLocationId(null)}
            />
          </Paper>
        )}
      </AppShell.Main>

      <CloudSyncModal show={showCloudModal} onClose={() => setShowCloudModal(false)} getData={getExportData} onLoadData={handleCloudLoad} />

      <RouteEditor
        show={!!editingRoute} route={routes.find(r => (r.fromLocationId === editingRoute?.fromId && r.toLocationId === editingRoute?.toId) || (r.fromLocationId === editingRoute?.toId && r.toLocationId === editingRoute?.fromId)) || (editingRoute ? { id: uuidv4(), fromLocationId: editingRoute.fromId, toLocationId: editingRoute.toId, transportType: 'car' } : null)}
        fromName={locations.find(l => l.id === editingRoute?.fromId)?.name || ''} toName={locations.find(l => l.id === editingRoute?.toId)?.name || ''}
        onSave={route => { setRoutes(prev => { const idx = prev.findIndex(r => r.id === route.id); if (idx >= 0) { const u = [...prev]; u[idx] = route; return u; } return [...prev, route]; }); setEditingRoute(null); }}
        onClose={() => setEditingRoute(null)}
      />
      <DayAssignmentModal show={!!editingDayAssignment} location={editingDayAssignment} days={days} onSave={(id, ids) => { updateLocation(id, { dayIds: ids }); setEditingDayAssignment(null); }} onClose={() => setEditingDayAssignment(null)} />
    </AppShell>
  );
}

export default App;
