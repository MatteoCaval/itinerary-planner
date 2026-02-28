import React, { useState, useEffect, useMemo } from 'react';
import { Box } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { v4 as uuidv4 } from 'uuid';
import { RouteEditor } from './components/RouteEditor';
import { DayAssignmentModal } from './components/DayAssignmentModal';
import { CloudSyncModal } from './components/CloudSyncModal';
import { AuthModal } from './components/AuthModal';
import { HistoryModal } from './components/HistoryModal';
import { AIPlannerModal } from './components/AIPlannerModal';
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
import { DEFAULT_SECTION, DEFAULT_CATEGORY } from './constants/daySection';
import { useAppModals } from './hooks/useAppModals';
import { PlannerPane, PlannerPaneProps } from './features/planner/PlannerPane';
import { MobilePlannerSheet } from './features/planner/MobilePlannerSheet';
import { MapPane, MapPaneProps } from './features/map/MapPane';
import { DesktopInspectorPane, MobileInspectorPanel } from './features/inspector/InspectorPane';
import { useTripActions } from './features/controllers/useTripActions';
import { useSelectionFlow } from './features/controllers/useSelectionFlow';
import { useSubItineraryActions } from './features/controllers/useSubItineraryActions';
import { TripActionDialogs } from './features/trips/TripActionDialogs';
import './features/shell/shell.css';

const SAMPLE_DEMO_QUERY_PARAM = 'demo';
const SAMPLE_DEMO_QUERY_VALUE = 'sample';

const isSampleDemoRequest = () => {
  if (typeof window === 'undefined') return false;
  const pathname = window.location.pathname.replace(/\/+$/, '');
  if (pathname.endsWith('/sample')) return true;
  const params = new URLSearchParams(window.location.search);
  return params.get(SAMPLE_DEMO_QUERY_PARAM) === SAMPLE_DEMO_QUERY_VALUE;
};

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
  const [tripDialog, setTripDialog] = useState<'none' | 'create' | 'rename' | 'delete' | 'signout'>('none');
  const [tripNameDraft, setTripNameDraft] = useState('');
  const importFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const sampleDemoLoadedRef = React.useRef(false);
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

  const openHistoryModal = () => setShowHistoryModal(true);
  const openAIModal = () => setShowAIModal(true);
  const openCloudModal = () => setShowCloudModal(true);
  const openAuthModal = () => setShowAuthModal(true);

  const resetUiForTripChange = () => {
    setSelectedDayId(null);
    setDrillDownParentId(null);
    setSearchQuery('');
    setSuggestions([]);
    setPendingAddToDay(null);
    setPanelCollapsed(false);
    setTripDialog('none');
    close();
  };

  const {
    activeTrip,
    suggestedTripName,
    executeSignOut,
    executeSwitchTrip,
    executeCreateTrip,
    executeRenameActiveTrip,
    executeDeleteActiveTrip,
  } = useTripActions({
    trips,
    activeTripId,
    switchTrip,
    createTrip,
    renameTrip,
    deleteTrip,
    signOutUser,
    onResetUiForTripChange: resetUiForTripChange,
  });

  const closeTripDialog = () => setTripDialog('none');
  const openCreateTripDialog = () => {
    setTripNameDraft(suggestedTripName);
    setTripDialog('create');
  };
  const openRenameTripDialog = () => {
    if (!activeTrip) return;
    setTripNameDraft(activeTrip.name);
    setTripDialog('rename');
  };
  const openDeleteTripDialog = () => {
    if (!activeTrip) return;
    setTripDialog('delete');
  };
  const openSignOutDialog = () => setTripDialog('signout');

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

  useEffect(() => {
    if (sampleDemoLoadedRef.current || !isSampleDemoRequest()) return;
    sampleDemoLoadedRef.current = true;

    const loadSampleDemo = async () => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}sample-trip.json`, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`sample_demo_http_${response.status}`);
        }

        const sampleTrip = await response.json();

        const result = loadFromData(sampleTrip);
        if (!result.success) {
          notifications.show({
            color: 'red',
            title: 'Sample demo unavailable',
            message: result.error || 'Unable to load sample itinerary data.',
          });
          return;
        }

        const params = new URLSearchParams(window.location.search);
        const shouldNormalizePath = params.get(SAMPLE_DEMO_QUERY_PARAM) === SAMPLE_DEMO_QUERY_VALUE;
        if (shouldNormalizePath) {
          params.delete(SAMPLE_DEMO_QUERY_PARAM);
          const nextPath = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/sample`;
          const nextSearch = params.toString();
          const nextUrl = nextSearch ? `${nextPath}?${nextSearch}` : nextPath;
          window.history.replaceState({}, '', nextUrl);
        }

        notifications.show({
          color: 'blue',
          title: 'Sample demo loaded',
          message: 'Preloaded demo trip is ready to explore.',
        });
      } catch (error) {
        trackError('sample_demo_load_failed', error);
        notifications.show({
          color: 'red',
          title: 'Sample demo unavailable',
          message: 'Could not load the demo itinerary.',
        });
      }
    };

    void loadSampleDemo();
  }, [loadFromData]);

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

  const {
    handleSelectLocation,
    handleEnterSubItinerary,
    handleExitSubItinerary,
    handleScrollToLocation,
  } = useSelectionFlow({
    locations,
    activeParent,
    setSelectedLocationId,
    setDrillDownParentId,
    onCloseMobilePlanner: close,
  });

  const {
    handleSubReorder,
    handleSubAdd,
    handleSubRemove,
    handleSubUpdate,
    handleNestLocation,
    handleAddLocationWrapped,
  } = useSubItineraryActions({
    activeParent,
    activeDays,
    locations,
    selectedLocationId,
    pendingAddToDay,
    setPendingAddToDay,
    setSelectedLocationId,
    updateLocation,
    loadFromData,
    getExportData,
    handleAddLocationMain: handleAddLocation,
  });

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

  const plannerPaneProps: PlannerPaneProps = {
    sidebarView, setSidebarView,
    pendingAddToDay, setPendingAddToDay,
    searchQuery, setSearchQuery, isSearching, handleSearch,
    suggestionLoading,
    reorderShortcutHint,
    suggestions, handleAddLocationWrapped,
    zoomLevel, setZoomLevel,
    activeParent, onSelectLocation: handleSelectLocation, exitSubItinerary: handleExitSubItinerary,
    activeDays, sidebarLocations,
    handleSubReorder, handleSubRemove,
    handleSubUpdate, setEditingRoute, handleSubAdd,
    selectedDayId, setSelectedDayId,
    isSlotBlocked, handleNestLocation,
    openSubItinerary: handleEnterSubItinerary,
    handleScrollToLocation,
    setShowHistoryModal, setShowAIModal, setShowCloudModal,
    handleExportMarkdown, handleExport, handleImport,
  };

  const mapPaneProps: MapPaneProps = {
    days,
    locations: mapLocations,
    routes,
    onEditRoute: (from, to) => setEditingRoute({ fromId: from, toId: to }),
    hoveredLocationId,
    selectedLocationId,
    selectedDayId,
    onHoverLocation: setHoveredLocationId,
    onSelectLocation: handleScrollToLocation,
    hideControls: opened,
    isSubItinerary,
    isPanelCollapsed: panelCollapsed,
    allLocations: locations,
    activeParent,
  };

  const detailPanelProps = {
    location: selectedLocation,
    parentLocation,
    days,
    allLocations: locations,
    routes,
    onUpdate: updateLocation,
    onClose: () => handleSelectLocation(null),
    onSelectLocation: handleSelectLocation,
    onEditRoute: (from: string, to: string) => setEditingRoute({ fromId: from, toId: to }),
    selectedDayId,
    onSelectDay: setSelectedDayId,
    onEnterSubItinerary: handleEnterSubItinerary,
    onExitSubItinerary: handleExitSubItinerary,
    isSubItineraryActive: activeParent?.id === selectedLocation?.id,
  };

  return (
    <>
      <Box className="app-root-shell">
        <Box h={60} w="100%" className="app-topbar">
          <AppHeader
            opened={opened}
            toggle={toggle}
            trips={trips}
            activeTripId={activeTripId}
            onSwitchTrip={executeSwitchTrip}
            onCreateTrip={openCreateTripDialog}
            onRenameTrip={openRenameTripDialog}
            onDeleteTrip={openDeleteTripDialog}
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
            onSignOut={openSignOutDialog}
            onExportMarkdown={handleExportMarkdown}
            onImport={handleImport}
            onExport={handleExport}
            importFileInputRef={importFileInputRef}
          />
        </Box>

        <Box className="app-main-layout">
          <Box className="app-pane app-pane-left" visibleFrom="sm">
            <PlannerPane {...plannerPaneProps} />
          </Box>

          <Box className="app-pane app-pane-center">
            <MapPane {...mapPaneProps} />
            <DesktopInspectorPane
              panelCollapsed={panelCollapsed}
              onExpand={() => setPanelCollapsed(false)}
              onCollapse={() => setPanelCollapsed(true)}
              detailPanelProps={detailPanelProps}
            />
          </Box>
        </Box>
      </Box>

      <MobilePlannerSheet opened={opened} {...plannerPaneProps} />

      <MobileInspectorPanel
        detailPanelProps={detailPanelProps}
        onDismiss={() => handleSelectLocation(null)}
      />

      <TripActionDialogs
        createOpened={tripDialog === 'create'}
        renameOpened={tripDialog === 'rename'}
        deleteOpened={tripDialog === 'delete'}
        signOutOpened={tripDialog === 'signout'}
        activeTripName={activeTrip?.name || 'this trip'}
        nameDraft={tripNameDraft}
        onNameDraftChange={setTripNameDraft}
        onCloseCreate={closeTripDialog}
        onCloseRename={closeTripDialog}
        onCloseDelete={closeTripDialog}
        onCloseSignOut={closeTripDialog}
        onConfirmCreate={() => {
          if (executeCreateTrip(tripNameDraft)) {
            closeTripDialog();
          }
        }}
        onConfirmRename={() => {
          if (executeRenameActiveTrip(tripNameDraft)) {
            closeTripDialog();
          }
        }}
        onConfirmDelete={() => {
          if (executeDeleteActiveTrip()) {
            closeTripDialog();
          }
        }}
        onConfirmSignOut={async () => {
          const signedOut = await executeSignOut();
          if (signedOut) {
            closeTripDialog();
          }
        }}
      />

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
