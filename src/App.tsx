import React, { useState, useEffect, useMemo } from 'react';
import { ActionIcon, Tooltip, Box, Paper } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { v4 as uuidv4 } from 'uuid';
import { ChevronLeft } from 'lucide-react';
import MapDisplay from './components/MapDisplay';
import { RouteEditor } from './components/RouteEditor';
import { DayAssignmentModal } from './components/DayAssignmentModal';
import { LocationDetailPanel } from './components/LocationDetailPanel';
import { CloudSyncModal } from './components/CloudSyncModal';
import { AuthModal } from './components/AuthModal';
import { HistoryModal } from './components/HistoryModal';
import { AIPlannerModal } from './components/AIPlannerModal';
import { SidebarContent } from './components/SidebarContent';
import { MobileBottomSheet } from './components/MobileBottomSheet';
import { Location, DaySection } from './types';
import { ItineraryProvider, useItinerary } from './context/ItineraryContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { searchPlace, reverseGeocode } from './utils/geocoding';
import { useItineraryDrillDown } from './hooks/useItineraryDrillDown';

import { usePlaceSearch } from './hooks/usePlaceSearch';
import { useImportExport } from './hooks/useImportExport';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { AppHeader } from './components/AppHeader';
import { trackError, trackEvent } from './services/telemetry';
import { SECTION_ORDER, DEFAULT_SECTION, DEFAULT_CATEGORY, UNASSIGNED_ZONE_ID, SLOT_PREFIX } from './constants/daySection';
import { useAppModals } from './hooks/useAppModals';

function AppContent() {
  const {
    trips, activeTripId,
    startDate, endDate, days, locations, routes, aiSettings,
    selectedLocationId, hoveredLocationId,
    historyIndex, historyLength, history,
    addLocation, updateLocation,
    updateRoute,
    switchTrip, createTrip, renameTrip, deleteTrip,
    setAiSettings,
    setSelectedLocationId, setHoveredLocationId,
    navigateHistory,
    getExportData, loadFromData
  } = useItinerary();
  const { user, isLoading: isAuthLoading, signOutUser } = useAuth();

  const [opened, { toggle, close }] = useDisclosure();
  const {
    showAIModal, setShowAIModal,
    showCloudModal, setShowCloudModal,
    showHistoryModal, setShowHistoryModal,
    editingRoute, setEditingRoute,
    editingDayAssignment, setEditingDayAssignment,
    panelCollapsed, setPanelCollapsed,
    pendingAddToDay, setPendingAddToDay,
  } = useAppModals();

  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [drillDownParentId, setDrillDownParentId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  // useSidebarResize is cleanly removed since the sidebar is now absolute/floating
  const { suggestions, setSuggestions, loading: suggestionLoading } = usePlaceSearch({ query: searchQuery, minLength: 3, debounceMs: 500 });

  // Clear selected day when location selection changes
  useEffect(() => {
    setSelectedDayId(null);
  }, [selectedLocationId]);

  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [sidebarView, setSidebarView] = useState<'timeline' | 'calendar' | 'budget'>('timeline');
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
    const assignedSlot = targetSlot || pendingAddToDay?.slot || DEFAULT_SECTION;

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
      category: DEFAULT_CATEGORY,
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
  const openAuthModal = () => setShowAuthModal(true);

  const handleSignOut = async () => {
    const shouldSignOut = window.confirm('Sign out from this account? Your local guest data will remain on this device.');
    if (!shouldSignOut) return;

    const result = await signOutUser();
    if (!result.success) {
      notifications.show({
        color: 'red',
        title: 'Sign out failed',
        message: result.error || 'Unable to sign out right now.',
      });
      return;
    }

    notifications.show({
      color: 'blue',
      title: 'Signed out',
      message: 'You are now in guest mode.',
    });
  };

  const resetUiForTripChange = () => {
    setSelectedDayId(null);
    setDrillDownParentId(null);
    setSearchQuery('');
    setSuggestions([]);
    setPendingAddToDay(null);
    setPanelCollapsed(false);
    close();
  };

  const handleSwitchTrip = (tripId: string) => {
    if (tripId === activeTripId) return;
    switchTrip(tripId);
    resetUiForTripChange();
    notifications.show({ color: 'blue', title: 'Trip switched', message: 'Active trip changed successfully.' });
  };

  const handleCreateTrip = () => {
    const suggestedName = `Trip ${trips.length + 1}`;
    const requestedName = window.prompt('Name for the new trip:', suggestedName);
    if (requestedName === null) return;
    const tripName = requestedName.trim() || suggestedName;
    createTrip(tripName);
    resetUiForTripChange();
    notifications.show({ color: 'green', title: 'Trip created', message: `Now editing "${tripName}".` });
  };

  const handleRenameActiveTrip = () => {
    const activeTrip = trips.find((trip) => trip.id === activeTripId);
    if (!activeTrip) return;
    const requestedName = window.prompt('Rename trip:', activeTrip.name);
    if (requestedName === null) return;
    const tripName = requestedName.trim();
    if (!tripName) return;
    renameTrip(activeTrip.id, tripName);
    notifications.show({ color: 'green', title: 'Trip renamed', message: `Renamed to "${tripName}".` });
  };

  const handleDeleteActiveTrip = () => {
    const activeTrip = trips.find((trip) => trip.id === activeTripId);
    if (!activeTrip) return;
    const shouldDelete = window.confirm(`Delete "${activeTrip.name}"? This cannot be undone.`);
    if (!shouldDelete) return;

    const deleted = deleteTrip(activeTrip.id);
    if (!deleted) {
      notifications.show({
        color: 'yellow',
        title: 'Trip not deleted',
        message: 'At least one trip must remain. Create another trip first.',
      });
      return;
    }

    resetUiForTripChange();
    notifications.show({ color: 'green', title: 'Trip deleted', message: 'Trip removed successfully.' });
  };

  const handleSelectLocation = (id: string | null) => {
    setSelectedLocationId(id);
    if (!id) {
      setDrillDownParentId(null);
      return;
    }

    const topLevel = locations.find(location => location.id === id);
    if (topLevel) {
      // Clicking a main destination should focus/select it without entering sub-itinerary mode.
      setDrillDownParentId(null);
      return;
    }

    const parent = locations.find(location => location.subLocations?.some(sub => sub.id === id));
    if (parent) {
      setDrillDownParentId(parent.id);
    }
  };

  const handleEnterSubItinerary = (parentId: string) => {
    const parent = locations.find(location => location.id === parentId);
    const firstSub = [...(parent?.subLocations || [])].sort((a, b) => {
      const dayA = a.dayOffset ?? Number.MAX_SAFE_INTEGER;
      const dayB = b.dayOffset ?? Number.MAX_SAFE_INTEGER;
      if (dayA !== dayB) return dayA - dayB;
      const slotA = SECTION_ORDER.indexOf(a.startSlot || DEFAULT_SECTION);
      const slotB = SECTION_ORDER.indexOf(b.startSlot || DEFAULT_SECTION);
      if (slotA !== slotB) return slotA - slotB;
      return (a.order || 0) - (b.order || 0);
    })[0];

    setDrillDownParentId(parentId);
    setSelectedLocationId(firstSub?.id || parentId);
  };

  const handleExitSubItinerary = () => {
    if (activeParent) {
      setSelectedLocationId(activeParent.id);
    }
    setDrillDownParentId(null);
  };

  const handleScrollToLocation = (id: string | null) => {
    handleSelectLocation(id);
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
  } = useItineraryDrillDown({ locations, days, selectedLocationId, selectedDayId, drillDownParentId });

  // --- Specialized Handlers for Sub-Itinerary ---
  const handleSubReorder = (activeId: string, overId: string | null, newDayId: string | null, newSlot: DaySection | null) => {
    if (!activeParent) return;

    const newSubLocations = [...(activeParent.subLocations || [])];
    const activeIdx = newSubLocations.findIndex(s => s.id === activeId);
    if (activeIdx === -1) return;

    // Calculate new dayOffset
    let newDayOffset: number | undefined = undefined;
    if (newDayId && newDayId !== UNASSIGNED_ZONE_ID) {
      const dayIdx = activeDays.findIndex(d => d.id === newDayId);
      if (dayIdx !== -1) newDayOffset = dayIdx;
    }

    // Update the item properties (do NOT create a new object if not needed to keep dnd-kit happy)
    const originalItem = newSubLocations[activeIdx];
    const updatedItem = {
      ...originalItem,
      dayOffset: newDayOffset,
      startSlot: newSlot || (newDayOffset !== undefined ? originalItem.startSlot || DEFAULT_SECTION : undefined)
    };

    // Handle reordering within the array
    if (overId && overId !== activeId && overId !== UNASSIGNED_ZONE_ID && !overId.startsWith(SLOT_PREFIX)) {
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
        startSlot: DEFAULT_SECTION,
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
        startSlot: targetSlot || pendingAddToDay?.slot || DEFAULT_SECTION,
        category: DEFAULT_CATEGORY,
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
    <>
      <Box h={60} w="100%" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1200, borderBottom: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(20px)' }}>
        <AppHeader
          opened={opened}
          toggle={toggle}
          trips={trips}
          activeTripId={activeTripId}
          onSwitchTrip={handleSwitchTrip}
          onCreateTrip={handleCreateTrip}
          onRenameTrip={handleRenameActiveTrip}
          onDeleteTrip={handleDeleteActiveTrip}
          historyIndex={historyIndex}
          historyLength={historyLength}
          navigateHistory={navigateHistory}
          onOpenHistory={openHistoryModal}
          onOpenAI={openAIModal}
          onOpenCloud={openCloudModal}
          isAuthLoading={isAuthLoading}
          isAuthenticated={Boolean(user)}
          authEmail={user?.email || null}
          onOpenAuth={openAuthModal}
          onSignOut={handleSignOut}
          onExportMarkdown={handleExportMarkdown}
          onImport={handleImport}
          onExport={handleExport}
          importFileInputRef={importFileInputRef}
        />
      </Box>

      {/* Floating Sidebar Content */}
      <Box className="floating-sidebar-container" visibleFrom="sm" style={{ display: 'flex', flexDirection: 'column' }}>
        <AppErrorBoundary title="Sidebar error" message="The sidebar crashed. You can retry or reload the app.">
          <SidebarContent
            sidebarView={sidebarView} setSidebarView={setSidebarView}
            pendingAddToDay={pendingAddToDay} setPendingAddToDay={setPendingAddToDay}
            searchQuery={searchQuery} setSearchQuery={setSearchQuery} isSearching={isSearching} handleSearch={handleSearch}
            suggestionLoading={suggestionLoading}
            reorderShortcutHint={reorderShortcutHint}
            suggestions={suggestions} handleAddLocationWrapped={handleAddLocationWrapped}
            zoomLevel={zoomLevel} setZoomLevel={setZoomLevel}
            activeParent={activeParent} onSelectLocation={handleSelectLocation} exitSubItinerary={handleExitSubItinerary}
            activeDays={activeDays} sidebarLocations={sidebarLocations}
            handleSubReorder={handleSubReorder} handleSubRemove={handleSubRemove}
            handleSubUpdate={handleSubUpdate} setEditingRoute={setEditingRoute} handleSubAdd={handleSubAdd}
            selectedDayId={selectedDayId} setSelectedDayId={setSelectedDayId}
            isSlotBlocked={isSlotBlocked} handleNestLocation={handleNestLocation}
            openSubItinerary={handleEnterSubItinerary}
            handleScrollToLocation={handleScrollToLocation}
            setShowHistoryModal={setShowHistoryModal} setShowAIModal={setShowAIModal} setShowCloudModal={setShowCloudModal}
            handleExportMarkdown={handleExportMarkdown} handleExport={handleExport} handleImport={handleImport}
          />
        </AppErrorBoundary>
      </Box>

      <Box style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', zIndex: 1 }}>
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
          <AppErrorBoundary title="Sidebar error" message="The sidebar crashed. You can retry or reload the app.">
            <SidebarContent
              sidebarView={sidebarView} setSidebarView={setSidebarView}
              pendingAddToDay={pendingAddToDay} setPendingAddToDay={setPendingAddToDay}
              searchQuery={searchQuery} setSearchQuery={setSearchQuery} isSearching={isSearching} handleSearch={handleSearch}
              suggestionLoading={suggestionLoading}
              reorderShortcutHint={reorderShortcutHint}
              suggestions={suggestions} handleAddLocationWrapped={handleAddLocationWrapped}
              zoomLevel={zoomLevel} setZoomLevel={setZoomLevel}
              activeParent={activeParent} onSelectLocation={handleSelectLocation} exitSubItinerary={handleExitSubItinerary}
              activeDays={activeDays} sidebarLocations={sidebarLocations}
              handleSubReorder={handleSubReorder} handleSubRemove={handleSubRemove}
              handleSubUpdate={handleSubUpdate} setEditingRoute={setEditingRoute} handleSubAdd={handleSubAdd}
              selectedDayId={selectedDayId} setSelectedDayId={setSelectedDayId}
              isSlotBlocked={isSlotBlocked} handleNestLocation={handleNestLocation}
              openSubItinerary={handleEnterSubItinerary}
              handleScrollToLocation={handleScrollToLocation}
              setShowHistoryModal={setShowHistoryModal} setShowAIModal={setShowAIModal} setShowCloudModal={setShowCloudModal}
              handleExportMarkdown={handleExportMarkdown} handleExport={handleExport} handleImport={handleImport}
            />
          </AppErrorBoundary>
        </MobileBottomSheet>

        {selectedLocation && (
          <>
            <Paper
              shadow="xl"
              className="location-detail-panel-root"
              radius="lg"
              style={{
                position: 'absolute',
                top: 'calc(var(--app-shell-header-height, 60px) + 20px)',
                right: '20px',
                bottom: '20px',
                width: 'min(420px, calc(100vw - 40px))',
                zIndex: 1150,
                transform: panelCollapsed ? 'translateX(120%)' : 'translateX(0)',
                visibility: panelCollapsed ? 'hidden' : 'visible',
                transition: 'transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1), visibility 0.4s',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.4)',
              }}
            >
              <AppErrorBoundary title="Detail panel error" message="The detail panel crashed. You can retry or reload the app.">
                <LocationDetailPanel
                  location={selectedLocation}
                  parentLocation={parentLocation}
                  days={days}
                  allLocations={locations}
                  routes={routes}
                  onUpdate={updateLocation}
                  onClose={() => handleSelectLocation(null)}
                  onSelectLocation={handleSelectLocation}
                  onEditRoute={(from, to) => setEditingRoute({ fromId: from, toId: to })}
                  selectedDayId={selectedDayId}
                  onSelectDay={setSelectedDayId}
                  onCollapse={() => setPanelCollapsed(true)}
                  onEnterSubItinerary={handleEnterSubItinerary}
                  onExitSubItinerary={handleExitSubItinerary}
                  isSubItineraryActive={activeParent?.id === selectedLocation.id}
                />
              </AppErrorBoundary>
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
      </Box> {/* This closing Box corresponds to the Map container Box. */}

      <AppErrorBoundary title="Cloud sync error" message="Cloud sync crashed. You can retry or reload the app.">
        <CloudSyncModal show={showCloudModal} onClose={() => setShowCloudModal(false)} getData={getExportData} onLoadData={loadFromData} />
      </AppErrorBoundary>

      <AuthModal show={showAuthModal} onClose={() => setShowAuthModal(false)} />

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
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <ItineraryProvider>
        <AppContent />
      </ItineraryProvider>
    </AuthProvider>
  );
}

export default App;
