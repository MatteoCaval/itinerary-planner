import React, { useState, useEffect, useMemo } from 'react';
import { AppShell, Burger, Group, Button, ActionIcon, Tooltip, Text, Box, Paper, Menu } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { v4 as uuidv4 } from 'uuid';
import { Map as MapIcon, Download, Upload, Cloud, FileText, MoreHorizontal, History, Undo, Redo, Sparkles, ChevronLeft } from 'lucide-react';
import MapDisplay from './components/MapDisplay';
import { RouteEditor } from './components/RouteEditor';
import { DayAssignmentModal } from './components/DayAssignmentModal';
import { LocationDetailPanel } from './components/LocationDetailPanel';
import { CloudSyncModal } from './components/CloudSyncModal';
import { HistoryModal } from './components/HistoryModal';
import { AIPlannerModal } from './components/AIPlannerModal';
import { SidebarContent } from './components/SidebarContent';
import { MobileBottomSheet } from './components/MobileBottomSheet';
import { Location, DaySection } from './types';
import { ItineraryProvider, useItinerary } from './context/ItineraryContext';
import { searchPlace, reverseGeocode } from './utils/geocoding';
import { useItineraryDrillDown } from './hooks/useItineraryDrillDown';
import { useSidebarResize } from './hooks/useSidebarResize';
import { usePlaceSearch } from './hooks/usePlaceSearch';
import { useImportExport } from './hooks/useImportExport';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { trackError, trackEvent } from './services/telemetry';
import { ACTION_LABELS } from './constants/actionLabels';

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
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const { sidebarWidth, startResizing } = useSidebarResize({ initialWidth: 500 });
  const { suggestions, setSuggestions, loading: suggestionLoading } = usePlaceSearch({ query: searchQuery, minLength: 3, debounceMs: 500 });

  // Clear selected day when location selection changes
  useEffect(() => {
    setSelectedDayId(null);
  }, [selectedLocationId]);

  const [editingRoute, setEditingRoute] = useState<{ fromId: string; toId: string } | null>(null);
  const [editingDayAssignment, setEditingDayAssignment] = useState<Location | null>(null);
  const [pendingAddToDay, setPendingAddToDay] = useState<{ dayId: string, slot?: DaySection } | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [sidebarView, setSidebarView] = useState<'timeline' | 'calendar' | 'budget'>('timeline');
  const [showCloudModal, setShowCloudModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const importFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const reorderShortcutHint = useMemo(() => {
    if (typeof navigator !== 'undefined' && /(Mac|iPhone|iPad|iPod)/i.test(navigator.platform)) {
      return '⌘ + Shift + ↑/↓';
    }
    return 'Alt + Shift + ↑/↓';
  }, []);

  const handleAddLocation = async (lat: number, lng: number, name?: string, targetDayId?: string, targetSlot?: DaySection) => {
    const resolvedName = name || await reverseGeocode(lat, lng);
    let assignedDayId = targetDayId || pendingAddToDay?.dayId || (days.length > 0 ? days[0].id : undefined);
    const assignedSlot = targetSlot || pendingAddToDay?.slot || 'morning';

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
    try {
      const results = await searchPlace(searchQuery);
      if (results.length > 0) {
        await handleAddLocationWrapped(parseFloat(results[0].lat), parseFloat(results[0].lon), results[0].display_name);
        setSearchQuery('');
        setSuggestions([]);
        trackEvent('location_search_add', { queryLength: searchQuery.length });
      }
    } catch (error) {
      trackError('location_search_submit_failed', error, { queryLength: searchQuery.length });
      notifications.show({ color: 'red', title: 'Search failed', message: 'Could not complete place search.' });
    } finally {
      setIsSearching(false);
    }
  };

  const openHistoryModal = () => setShowHistoryModal(true);
  const openAIModal = () => setShowAIModal(true);
  const openCloudModal = () => setShowCloudModal(true);
  const openImportPicker = () => importFileInputRef.current?.click();

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

  const { handleExport, handleImport, handleExportMarkdown } = useImportExport({
    days,
    locations,
    routes,
    startDate,
    endDate,
    getExportData,
    loadFromData,
    notifySuccess: message => notifications.show({ color: 'green', title: 'Success', message }),
    notifyError: message => notifications.show({ color: 'red', title: 'Import Error', message }),
  });

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

  const {
    activeParent,
    parentLocation,
    isSubItinerary,
    activeDays,
    mapLocations,
    sidebarLocations,
    isSlotBlocked
  } = useItineraryDrillDown({ locations, days, selectedLocationId, selectedDayId });

  // --- Specialized Handlers for Sub-Itinerary ---
  const handleSubReorder = (activeId: string, overId: string | null, newDayId: string | null, newSlot: DaySection | null) => {
    if (!activeParent) return;

    const newSubLocations = [...(activeParent.subLocations || [])];
    const activeIdx = newSubLocations.findIndex(s => s.id === activeId);
    if (activeIdx === -1) return;

    // Calculate new dayOffset
    let newDayOffset: number | undefined = undefined;
    if (newDayId && newDayId !== 'unassigned-zone') {
      const dayIdx = activeDays.findIndex(d => d.id === newDayId);
      if (dayIdx !== -1) newDayOffset = dayIdx;
    }

    // Update the item properties (do NOT create a new object if not needed to keep dnd-kit happy)
    const originalItem = newSubLocations[activeIdx];
    const updatedItem = {
      ...originalItem,
      dayOffset: newDayOffset,
      startSlot: newSlot || (newDayOffset !== undefined ? originalItem.startSlot || 'morning' : undefined)
    };

    // Handle reordering within the array
    if (overId && overId !== activeId && overId !== 'unassigned-zone' && !overId.startsWith('slot-')) {
       newSubLocations.splice(activeIdx, 1);
       const overIdx = newSubLocations.findIndex(s => s.id === overId);
       if (overIdx !== -1) {
         newSubLocations.splice(overIdx, 0, updatedItem);
       } else {
         newSubLocations.push(updatedItem);
       }
    } else {
      newSubLocations[activeIdx] = updatedItem;
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

  const handleNestLocation = (activeId: string, parentId: string) => {
    const itemToNest = locations.find(l => l.id === activeId);
    const parent = locations.find(l => l.id === parentId);

    if (itemToNest && parent && activeId !== parentId) {
      // 1. Remove from top-level
      const newLocations = locations.filter(l => l.id !== activeId);
      
      // 2. Prepare the item for nesting
      // We'll put it in the first available slot of the parent for now
      const nestedItem: Location = {
        ...itemToNest,
        dayOffset: 0,
        startDayId: undefined, // Sub-locations use dayOffset
        startSlot: 'morning',
        order: (parent.subLocations || []).length
      };

      // 3. Add to parent's subLocations
      const updatedLocations = newLocations.map(l => {
        if (l.id === parentId) {
          return {
            ...l,
            subLocations: [...(l.subLocations || []), nestedItem]
          }
        }
        return l;
      });

      // We need a bulk setLocations or multiple updates.
      // Since context only has updateLocation and removeLocation, 
      // let's use loadFromData for a atomic swap if possible, 
      // or just call both.
      
      // Actually, context has setLocations!
      const result = loadFromData({ ...getExportData(), locations: updatedLocations });
      if (!result.success) {
        notifications.show({ color: 'red', title: 'Update failed', message: result.error || 'Unable to nest location.' });
      }
      
      // If we were selecting the nested item, select the parent now
      if (selectedLocationId === activeId) {
        setSelectedLocationId(parentId);
      }
    }
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

  const findLocationById = (id: string): Location | null => {
    const top = locations.find(l => l.id === id);
    if (top) return top;
    for (const loc of locations) {
      if (loc.subLocations) {
        const sub = loc.subLocations.find(s => s.id === id);
        if (sub) return sub;
      }
    }
    return null;
  };

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: { base: '100%', sm: sidebarWidth },
        breakpoint: 'sm',
        collapsed: { mobile: true, desktop: false },
      }}
      padding={0}
    >
      <AppShell.Header style={{ zIndex: 1200 }}>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group wrap="nowrap">
            <Burger opened={opened} onClick={toggle} size="sm" color="blue" hiddenFrom="sm" />
            <Text fw={700} fz="lg" c="blue" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MapIcon size={20} /> <Box visibleFrom="xs">Itinerary Planner</Box>
            </Text>
          </Group>
          <Group gap="xs" visibleFrom="lg" wrap="nowrap">
            <ActionIcon variant="subtle" color="gray" onClick={() => navigateHistory(historyIndex - 1)} disabled={historyIndex <= 0}>
                <Undo size={18} />
            </ActionIcon>
            <ActionIcon variant="subtle" color="gray" onClick={() => navigateHistory(historyIndex + 1)} disabled={historyIndex >= historyLength - 1}>
                <Redo size={18} />
            </ActionIcon>
            <Button variant="default" size="xs" leftSection={<History size={16} />} onClick={openHistoryModal}>{ACTION_LABELS.history}</Button>
            <Button variant="light" color="blue" size="xs" leftSection={<Sparkles size={16} />} onClick={openAIModal}>{ACTION_LABELS.aiPlanner}</Button>
            <Button variant="default" size="xs" leftSection={<FileText size={16} />} onClick={handleExportMarkdown}>{ACTION_LABELS.exportMarkdown}</Button>
            <Button variant="default" size="xs" leftSection={<Upload size={16} />} onClick={openImportPicker}>{ACTION_LABELS.importJson}</Button>
            <Button variant="default" size="xs" leftSection={<Download size={16} />} onClick={handleExport}>{ACTION_LABELS.exportJson}</Button>
            <Button variant="filled" color="blue" size="xs" leftSection={<Cloud size={16} />} onClick={openCloudModal}>{ACTION_LABELS.cloudSync}</Button>
          </Group>

          <Box hiddenFrom="lg">
            <Menu
              shadow="md"
              width={220}
              position="bottom-end"
              withinPortal
              zIndex={4000}
            >
              <Menu.Target>
                <ActionIcon variant="light" size="lg">
                  <MoreHorizontal size={20} />
                </ActionIcon>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Label>Actions</Menu.Label>
                <Menu.Item leftSection={<History size={16} />} onClick={openHistoryModal}>{ACTION_LABELS.history}</Menu.Item>
                <Menu.Item leftSection={<Sparkles size={16} />} onClick={openAIModal} color="blue">{ACTION_LABELS.aiPlanner}</Menu.Item>
                <Menu.Item leftSection={<Cloud size={16} />} onClick={openCloudModal}>{ACTION_LABELS.cloudSync}</Menu.Item>
                <Menu.Item leftSection={<FileText size={16} />} onClick={handleExportMarkdown}>
                  {ACTION_LABELS.exportMarkdown}
                </Menu.Item>
                <Menu.Divider />
                <Menu.Label>Data</Menu.Label>
                <Menu.Item leftSection={<Upload size={16} />} onClick={openImportPicker}>
                  {ACTION_LABELS.importJson}
                </Menu.Item>
                <Menu.Item leftSection={<Download size={16} />} onClick={handleExport}>
                  {ACTION_LABELS.exportJson}
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Box>
          <input
            ref={importFileInputRef}
            type="file"
            style={{ display: 'none' }}
            onChange={handleImport}
            accept=".json"
          />
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p={0} style={{ zIndex: 1000 }}>
        {/* Resize Handle */}
        <div
          onMouseDown={startResizing}
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: 8,
            cursor: 'col-resize',
            zIndex: 1100,
            backgroundColor: 'transparent',
            transition: 'background-color 0.2s',
          }}
          className="sidebar-resize-handle"
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.1)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        />
        <Box visibleFrom="sm" h="100%">
            <SidebarContent
              startDate={startDate} endDate={endDate} updateDateRange={updateDateRange}
              sidebarView={sidebarView} setSidebarView={setSidebarView}
              pendingAddToDay={pendingAddToDay} setPendingAddToDay={setPendingAddToDay}
              searchQuery={searchQuery} setSearchQuery={setSearchQuery} isSearching={isSearching} handleSearch={handleSearch}
              suggestionLoading={suggestionLoading}
              reorderShortcutHint={reorderShortcutHint}
              suggestions={suggestions} handleAddLocationWrapped={handleAddLocationWrapped}
              zoomLevel={zoomLevel} setZoomLevel={setZoomLevel}
              activeParent={activeParent} setSelectedLocationId={setSelectedLocationId}
              days={days} activeDays={activeDays} sidebarLocations={sidebarLocations} routes={routes}
              handleSubReorder={handleSubReorder} handleSubRemove={handleSubRemove}
              handleSubUpdate={handleSubUpdate} setEditingRoute={setEditingRoute} handleSubAdd={handleSubAdd} updateDay={updateDay}
              hoveredLocationId={hoveredLocationId} setHoveredLocationId={setHoveredLocationId}
              selectedLocationId={selectedLocationId} reorderLocations={reorderLocations}
              removeLocation={removeLocation} updateLocation={updateLocation}
              selectedDayId={selectedDayId} setSelectedDayId={setSelectedDayId}
              isSlotBlocked={isSlotBlocked} handleNestLocation={handleNestLocation}
              handleScrollToLocation={handleScrollToLocation} locations={locations} clearAll={clearAll}
              setShowHistoryModal={setShowHistoryModal} setShowAIModal={setShowAIModal} setShowCloudModal={setShowCloudModal}
              handleExportMarkdown={handleExportMarkdown} handleExport={handleExport} handleImport={handleImport}
            />
        </Box>
      </AppShell.Navbar>

      <AppShell.Main h="100vh" style={{ position: 'relative', overflow: 'hidden' }}>
        <AppErrorBoundary title="Map rendering error" message="The map view crashed. You can retry or reload the app.">
          <MapDisplay
            days={days} locations={mapLocations} routes={routes}
            onEditRoute={(from, to) => setEditingRoute({ fromId: from, toId: to })}
            hoveredLocationId={hoveredLocationId}
            selectedLocationId={selectedLocationId}
            selectedDayId={selectedDayId}
            onHoverLocation={setHoveredLocationId}
            onSelectLocation={handleScrollToLocation}
            hideControls={opened}
            isSubItinerary={isSubItinerary}
            isPanelCollapsed={panelCollapsed}
            allLocations={locations}
            activeParent={activeParent}
          />
        </AppErrorBoundary>

        <MobileBottomSheet opened={opened}>
          <SidebarContent
            startDate={startDate} endDate={endDate} updateDateRange={updateDateRange}
            sidebarView={sidebarView} setSidebarView={setSidebarView}
            pendingAddToDay={pendingAddToDay} setPendingAddToDay={setPendingAddToDay}
            searchQuery={searchQuery} setSearchQuery={setSearchQuery} isSearching={isSearching} handleSearch={handleSearch}
            suggestionLoading={suggestionLoading}
            reorderShortcutHint={reorderShortcutHint}
            suggestions={suggestions} handleAddLocationWrapped={handleAddLocationWrapped}
            zoomLevel={zoomLevel} setZoomLevel={setZoomLevel}
            activeParent={activeParent} setSelectedLocationId={setSelectedLocationId}
            days={days} activeDays={activeDays} sidebarLocations={sidebarLocations} routes={routes}
            handleSubReorder={handleSubReorder} handleSubRemove={handleSubRemove}
            handleSubUpdate={handleSubUpdate} setEditingRoute={setEditingRoute} handleSubAdd={handleSubAdd} updateDay={updateDay}
            hoveredLocationId={hoveredLocationId} setHoveredLocationId={setHoveredLocationId}
            selectedLocationId={selectedLocationId} reorderLocations={reorderLocations}
            removeLocation={removeLocation} updateLocation={updateLocation}
            selectedDayId={selectedDayId} setSelectedDayId={setSelectedDayId}
            isSlotBlocked={isSlotBlocked} handleNestLocation={handleNestLocation}
            handleScrollToLocation={handleScrollToLocation} locations={locations} clearAll={clearAll}
            setShowHistoryModal={setShowHistoryModal} setShowAIModal={setShowAIModal} setShowCloudModal={setShowCloudModal}
            handleExportMarkdown={handleExportMarkdown} handleExport={handleExport} handleImport={handleImport}
          />
        </MobileBottomSheet>

        {selectedLocation && (
          <>
            <Paper
              shadow="xl"
              className="location-detail-panel-root"
              style={{ 
                transform: panelCollapsed ? 'translateX(100%)' : 'translateX(0)',
                visibility: panelCollapsed ? 'hidden' : 'visible'
              }}
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
                onEditRoute={(from, to) => setEditingRoute({ fromId: from, toId: to })}
                selectedDayId={selectedDayId}
                onSelectDay={setSelectedDayId}
                onCollapse={() => setPanelCollapsed(true)}
              />
            </Paper>

            {panelCollapsed && (
              <Box
                style={{
                  position: 'absolute',
                  top: '50%',
                  right: 0,
                  transform: 'translateY(-50%)',
                  zIndex: 1150
                }}
              >
                <Tooltip label="Expand Details" position="left">
                  <ActionIcon 
                    variant="filled" 
                    color="blue" 
                    size="xl" 
                    radius="md" 
                    onClick={() => setPanelCollapsed(false)}
                    style={{ 
                      borderRadius: '12px 0 0 12px',
                      height: 100,
                      width: 24,
                      boxShadow: 'var(--mantine-shadow-xl)'
                    }}
                  >
                    <ChevronLeft size={20} />
                  </ActionIcon>
                </Tooltip>
              </Box>
            )}
          </>
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

      <AppErrorBoundary title="AI planner error" message="The AI planner crashed. You can retry or reload the app.">
        <AIPlannerModal
          show={showAIModal}
          onClose={() => setShowAIModal(false)}
          days={days}
          currentLocations={locations}
          currentRoutes={routes}
          settings={aiSettings}
          onSettingsChange={setAiSettings}
          onApplyItinerary={(locs, rts, updatedDays) => {
               const result = loadFromData({ days: updatedDays || days, locations: locs, routes: rts, startDate, endDate });
               if (!result.success) {
                 notifications.show({ color: 'red', title: 'AI apply failed', message: result.error || 'Generated itinerary was invalid.' });
               }
          }}
        />
      </AppErrorBoundary>

      <RouteEditor
        show={!!editingRoute} route={routes.find(r => (r.fromLocationId === editingRoute?.fromId && r.toLocationId === editingRoute?.toId) || (r.fromLocationId === editingRoute?.toId && r.toLocationId === editingRoute?.fromId)) || (editingRoute ? { id: uuidv4(), fromLocationId: editingRoute.fromId, toLocationId: editingRoute.toId, transportType: 'car' } : null)}
        fromName={findLocationById(editingRoute?.fromId || '')?.name || ''} 
        toName={findLocationById(editingRoute?.toId || '')?.name || ''}
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
