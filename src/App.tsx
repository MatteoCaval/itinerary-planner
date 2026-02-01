import React, { useState, useEffect, useMemo } from 'react';
import { AppShell, Burger, Group, Button, ActionIcon, TextInput, Tooltip, Text, Box, Paper, Stack, Slider, Menu } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { v4 as uuidv4 } from 'uuid';
import { Map as MapIcon, Search, Download, Upload, Trash2, Calendar as CalendarIcon, List as ListIcon, Cloud, FileText, MoreHorizontal, History, Undo, Redo, Sparkles } from 'lucide-react';
import MapDisplay from './components/MapDisplay';
import { DateRangePicker } from './components/DateRangePicker';
import { DaySidebar } from './components/DaySidebar';
import { RouteEditor } from './components/RouteEditor';
import { DayAssignmentModal } from './components/DayAssignmentModal';
import { LocationDetailPanel } from './components/LocationDetailPanel';
import { CalendarView } from './components/CalendarView';
import { CloudSyncModal } from './components/CloudSyncModal';
import { HistoryModal } from './components/HistoryModal';
import { AIPlannerModal } from './components/AIPlannerModal';
import { generateMarkdown, downloadMarkdown } from './markdownExporter';
import { Location, DaySection } from './types';
import { ItineraryProvider, useItinerary } from './context/ItineraryContext';
import { searchPlace, reverseGeocode } from './utils/geocoding';

function AppContent() {
  const {
    startDate, endDate, days, locations, routes, aiSettings,
    selectedLocationId, hoveredLocationId,
    historyIndex, historyLength, history,
    updateDateRange, updateDay,
    addLocation, removeLocation, updateLocation, reorderLocations,
    updateRoute,
    setAiSettings,
    setSelectedLocationId, setHoveredLocationId,
    navigateHistory,
    getExportData, loadFromData, clearAll
  } = useItinerary();

  const [opened, { toggle, close }] = useDisclosure();
  
  const [showAIModal, setShowAIModal] = useState(false);
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
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [sidebarView, setSidebarView] = useState<'timeline' | 'calendar'>('timeline');
  const [showCloudModal, setShowCloudModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const handleAddLocation = async (lat: number, lng: number, name?: string, targetDayId?: string, targetSlot?: DaySection) => {
    const resolvedName = name || await reverseGeocode(lat, lng);
    let assignedDayId = targetDayId || pendingAddToDay?.dayId || (days.length > 0 ? days[0].id : undefined);
    let assignedSlot = targetSlot || pendingAddToDay?.slot || 'morning';

    // Handle explicit 'unassigned' target
    if (assignedDayId === 'unassigned') {
      assignedDayId = undefined;
    }

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
    addLocation(newLocation);
    setPendingAddToDay(null);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    const results = await searchPlace(searchQuery);
    setIsSearching(false);
    if (results?.length > 0) {
      await handleAddLocationWrapped(parseFloat(results[0].lat), parseFloat(results[0].lon), results[0].display_name);
      setSearchQuery('');
      setSuggestions([]);
    }
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
        loadFromData(data);
        alert('Itinerary imported successfully!');
      } catch (err) {
        alert('Error importing file. Please ensure it is a valid JSON itinerary.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExportMarkdown = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    const md = generateMarkdown(days, locations, routes, startDate, endDate);
    downloadMarkdown(md, `travel-itinerary-${dateStr}.md`);
  };

  const selectedLocation = useMemo(() => {
    const top = locations.find(l => l.id === selectedLocationId);
    if (top) return top;
    for (const loc of locations) {
      if (loc.subLocations) {
        const sub = loc.subLocations.find(s => s.id === selectedLocationId);
        if (sub) return sub;
      }
    }
    return null;
  }, [locations, selectedLocationId]);

  // Determine locations to show on map (drill-down if sub-locations exist or are selected)
  const mapLocations = useMemo(() => {
    // 1. Is a top-level location selected?
    const parent = locations.find(l => l.id === selectedLocationId);
    if (parent && parent.subLocations && parent.subLocations.length > 0) {
      return parent.subLocations;
    }

    // 2. Is a sub-location selected? Find its parent and show siblings.
    for (const loc of locations) {
      if (loc.subLocations?.some(sub => sub.id === selectedLocationId)) {
        return loc.subLocations;
      }
    }

    // 3. Default to global
    return locations;
  }, [locations, selectedLocationId]);

  const isSubItinerary = mapLocations !== locations;

  // Derive which location is the "Active Parent" for the current view
  const activeParent = useMemo(() => {
    // Case 1: A top-level location with sub-locations is selected
    const top = locations.find(l => l.id === selectedLocationId);
    if (top && top.subLocations && top.subLocations.length > 0) return top;
    
    // Case 2: A sub-location is selected -> return its parent
    for (const loc of locations) {
      if (loc.subLocations?.some(sub => sub.id === selectedLocationId)) return loc;
    }
    return null;
  }, [locations, selectedLocationId]);

  // Derive days for the current view
  const activeDays = useMemo(() => {
    if (!activeParent || !activeParent.startDayId) return days;
    
    const startDayIdx = days.findIndex(d => d.id === activeParent.startDayId);
    if (startDayIdx === -1) return days;
    
    // Duration in slots (3 per day)
    const numDays = Math.ceil((activeParent.duration || 1) / 3);
    return days.slice(startDayIdx, startDayIdx + numDays);
  }, [days, activeParent]);

  // Derive locations for the sidebar (mapping dayOffset to startDayId)
  const sidebarLocations = useMemo(() => {
    if (!activeParent) return locations;

    return (activeParent.subLocations || []).map(sub => {
      const dayIdx = sub.dayOffset || 0;
      const targetDay = activeDays[dayIdx];
      return {
        ...sub,
        startDayId: targetDay ? targetDay.id : undefined
      };
    });
  }, [activeParent, activeDays, locations]);

  const parentLocation = useMemo(() => {
    for (const loc of locations) {
      if (loc.subLocations?.some(sub => sub.id === selectedLocationId)) {
        return loc;
      }
    }
    return null;
  }, [locations, selectedLocationId]);

  // --- Specialized Handlers for Sub-Itinerary ---
  const handleSubReorder = (activeId: string, overId: string | null, newDayId: string | null, newSlot: DaySection | null) => {
    if (!activeParent) return;

    const newSubLocations = [...(activeParent.subLocations || [])];
    const activeIdx = newSubLocations.findIndex(s => s.id === activeId);
    if (activeIdx === -1) return;

    // Calculate new dayOffset
    let newDayOffset = 0;
    if (newDayId) {
      const dayIdx = activeDays.findIndex(d => d.id === newDayId);
      if (dayIdx !== -1) newDayOffset = dayIdx;
    }

    // Update the item
    const updatedItem = {
      ...newSubLocations[activeIdx],
      dayOffset: newDayOffset,
      startSlot: newSlot || newSubLocations[activeIdx].startSlot || 'morning'
    };
    newSubLocations[activeIdx] = updatedItem;

    // Handle reordering within the same slot if overId is provided
    if (overId && overId !== activeId && overId !== 'unassigned-zone' && !overId.startsWith('slot-')) {
       const overIdx = newSubLocations.findIndex(s => s.id === overId);
       const [moved] = newSubLocations.splice(activeIdx, 1);
       newSubLocations.splice(overIdx, 0, moved);
    }

    updateLocation(activeParent.id, {
      subLocations: newSubLocations.map((s, idx) => ({ ...s, order: idx }))
    });
  };

  const handleSubAdd = async (dayId: string, slot?: DaySection) => {
    if (!activeParent) return;
    setPendingAddToDay({ dayId, slot });
  };

  const handleSubRemove = (id: string) => {
    if (!activeParent) return;
    updateLocation(activeParent.id, {
      subLocations: (activeParent.subLocations || []).filter(s => s.id !== id)
    });
    if (selectedLocationId === id) setSelectedLocationId(activeParent.id);
  };

  const handleSubUpdate = (id: string, updates: Partial<Location>) => {
    if (!activeParent) return;
    updateLocation(activeParent.id, {
      subLocations: (activeParent.subLocations || []).map(s => s.id === id ? { ...s, ...updates } : s)
    });
  };

  // Override handleAddLocation to handle sub-mode
  const handleAddLocationOriginal = handleAddLocation;
  const handleAddLocationWrapped = async (lat: number, lng: number, name?: string, targetDayId?: string, targetSlot?: DaySection) => {
    if (activeParent) {
      const resolvedName = name || await reverseGeocode(lat, lng);
      const dayId = targetDayId || pendingAddToDay?.dayId;
      const dayIdx = activeDays.findIndex(d => d.id === dayId);
      
      const newSub: Location = {
        id: uuidv4(),
        name: resolvedName.split(',')[0],
        lat, lng, order: (activeParent.subLocations || []).length,
        dayOffset: dayIdx === -1 ? 0 : dayIdx,
        startSlot: targetSlot || pendingAddToDay?.slot || 'morning',
        category: 'sightseeing',
        dayIds: []
      };
      
      updateLocation(activeParent.id, {
        subLocations: [...(activeParent.subLocations || []), newSub]
      });
      setPendingAddToDay(null);
    } else {
      await handleAddLocationOriginal(lat, lng, name, targetDayId, targetSlot);
    }
  };

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: { base: '100%', sm: 500, lg: 600, xl: 700 },
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      padding={0}
    >
      <AppShell.Header style={{ zIndex: 1200 }}>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={() => { toggle(); if (!opened) setSelectedLocationId(null); }} hiddenFrom="sm" size="sm" />
            <Text fw={700} fz="lg" c="blue" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MapIcon size={20} /> Itinerary Planner
            </Text>
          </Group>
          <Group gap="xs" visibleFrom="sm">
            <ActionIcon variant="subtle" color="gray" onClick={() => navigateHistory(historyIndex - 1)} disabled={historyIndex <= 0}>
                <Undo size={18} />
            </ActionIcon>
            <ActionIcon variant="subtle" color="gray" onClick={() => navigateHistory(historyIndex + 1)} disabled={historyIndex >= historyLength - 1}>
                <Redo size={18} />
            </ActionIcon>
            <Button variant="default" size="xs" leftSection={<History size={16} />} onClick={() => setShowHistoryModal(true)}>History</Button>
            <Button variant="light" color="blue" size="xs" leftSection={<Sparkles size={16} />} onClick={() => setShowAIModal(true)}>AI Planner</Button>
            <Button variant="default" size="xs" leftSection={<FileText size={16} />} onClick={handleExportMarkdown}>Markdown</Button>
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
                <Menu.Item leftSection={<History size={16} />} onClick={() => setShowHistoryModal(true)}>
                  Time Machine
                </Menu.Item>
                <Menu.Item leftSection={<Sparkles size={16} />} onClick={() => setShowAIModal(true)} color="blue">
                  AI Magic
                </Menu.Item>
                <Menu.Item leftSection={<Cloud size={16} />} onClick={() => setShowCloudModal(true)}>
                  Sync
                </Menu.Item>
                <Menu.Item leftSection={<FileText size={16} />} onClick={handleExportMarkdown}>
                  Export Markdown
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
            <DateRangePicker startDate={startDate} endDate={endDate} onDateRangeChange={updateDateRange} />

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
                  <Text size="sm">
                    {pendingAddToDay.dayId === 'unassigned'
                      ? 'Adding to Unassigned'
                      : `Adding to Day ${days.findIndex(d => d.id === pendingAddToDay.dayId) + 1}${pendingAddToDay.slot ? ` (${pendingAddToDay.slot})` : ''}`
                    }
                  </Text>
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
                        await handleAddLocationWrapped(parseFloat(s.lat), parseFloat(s.lon), s.display_name);
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
              <Stack h="100%" gap={0}>
                 {activeParent && (
                    <Paper p="xs" bg="blue.6" radius={0}>
                        <Group justify="space-between">
                            <Box>
                                <Text size="xs" c="blue.1" fw={700} tt="uppercase">Planning Sub-Itinerary</Text>
                                <Text size="sm" c="white" fw={700} truncate>{activeParent.name}</Text>
                            </Box>
                            <Button variant="white" size="compact-xs" onClick={() => setSelectedLocationId(null)}>Back to Main</Button>
                        </Group>
                    </Paper>
                 )}
                <Box flex={1} style={{ overflow: 'hidden' }}>
                    <DaySidebar
                        days={activeDays} locations={sidebarLocations} routes={routes}
                        onReorderLocations={activeParent ? handleSubReorder : reorderLocations} 
                        onRemoveLocation={activeParent ? handleSubRemove : removeLocation}
                        onUpdateLocation={activeParent ? handleSubUpdate : updateLocation} 
                        onEditRoute={(from, to) => setEditingRoute({ fromId: from, toId: to })}
                        onAddToDay={activeParent ? handleSubAdd : (dayId, slot) => setPendingAddToDay({ dayId, slot })}
                        onUpdateDay={updateDay}
                        hoveredLocationId={hoveredLocationId} onHoverLocation={setHoveredLocationId} zoomLevel={zoomLevel}
                        selectedLocationId={selectedLocationId} onSelectLocation={setSelectedLocationId}
                    />
                </Box>
              </Stack>
            ) : (
              <CalendarView days={days} locations={locations} onSelectLocation={handleScrollToLocation} />
            )}
          </Box>

          <Box p="md" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
            <Group justify="space-between" mb="xs">
              <Text size="xs" fw={700} tt="uppercase" c="dimmed">{locations.length} Stops</Text>
              <Button variant="subtle" color="red" size="xs" leftSection={<Trash2 size={14} />} onClick={() => {
                if (confirm('Are you sure you want to clear all data?')) clearAll();
              }}>
                Clear
              </Button>
            </Group>
            <Group gap="xs">
              <Button variant="light" size="xs" flex={1} leftSection={<History size={14} />} onClick={() => setShowHistoryModal(true)}>History</Button>
              <Button variant="light" color="blue" size="xs" flex={1} leftSection={<Sparkles size={14} />} onClick={() => setShowAIModal(true)}>AI Planner</Button>
              <Button variant="light" size="xs" flex={1} leftSection={<Cloud size={14} />} onClick={() => setShowCloudModal(true)}>Cloud Sync</Button>
            </Group>
            <Group gap="xs" mt="xs">
              <Tooltip label="Export Markdown">
                <ActionIcon variant="default" size="md" onClick={handleExportMarkdown}><FileText size={16} /></ActionIcon>
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
          days={days} locations={mapLocations} routes={routes}
          onEditRoute={(from, to) => setEditingRoute({ fromId: from, toId: to })}
          hoveredLocationId={hoveredLocationId} 
          selectedLocationId={selectedLocationId}
          onHoverLocation={setHoveredLocationId} 
          onSelectLocation={handleScrollToLocation}
          hideControls={opened}
          isSubItinerary={isSubItinerary}
        />

        {selectedLocation && (
          <Paper
            shadow="xl"
            className="location-detail-panel-root"
          >
            <LocationDetailPanel
              location={selectedLocation}
              parentLocation={parentLocation}
              days={days}
              allLocations={locations}
              routes={routes}
              onUpdate={updateLocation}
              onClose={() => setSelectedLocationId(null)}
              onSelectLocation={setSelectedLocationId}
            />
          </Paper>
        )}
      </AppShell.Main>

      <CloudSyncModal show={showCloudModal} onClose={() => setShowCloudModal(false)} getData={getExportData} onLoadData={loadFromData} />
      
      <HistoryModal 
        show={showHistoryModal} 
        onClose={() => setShowHistoryModal(false)} 
        currentIndex={historyIndex} 
        totalStates={historyLength}
        snapshots={history}
        onNavigate={navigateHistory} 
      />

      <AIPlannerModal
        show={showAIModal}
        onClose={() => setShowAIModal(false)}
        days={days}
        currentLocations={locations}
        currentRoutes={routes}
        settings={aiSettings}
        onSettingsChange={setAiSettings}
        onApplyItinerary={(locs, rts) => {
             // We need to handle this manually since context doesn't have a 'setAll' that takes both.
             // Or better, add a setItinerary to context.
             // For now:
             loadFromData({ days, locations: locs, routes: rts, startDate, endDate });
        }}
      />

      <RouteEditor
        show={!!editingRoute} route={routes.find(r => (r.fromLocationId === editingRoute?.fromId && r.toLocationId === editingRoute?.toId) || (r.fromLocationId === editingRoute?.toId && r.toLocationId === editingRoute?.fromId)) || (editingRoute ? { id: uuidv4(), fromLocationId: editingRoute.fromId, toLocationId: editingRoute.toId, transportType: 'car' } : null)}
        fromName={locations.find(l => l.id === editingRoute?.fromId)?.name || ''} toName={locations.find(l => l.id === editingRoute?.toId)?.name || ''}
        onSave={route => { updateRoute(route); setEditingRoute(null); }}
        onClose={() => setEditingRoute(null)}
      />
      <DayAssignmentModal show={!!editingDayAssignment} location={editingDayAssignment} days={days} onSave={(id, ids) => { updateLocation(id, { dayIds: ids }); setEditingDayAssignment(null); }} onClose={() => setEditingDayAssignment(null)} />
    </AppShell>
  );
}

function App() {
  return (
    <ItineraryProvider>
      <AppContent />
    </ItineraryProvider>
  );
}

export default App;