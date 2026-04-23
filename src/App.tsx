import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import {
  Bed,
  CalendarPlus,
  Check,
  ChevronDown,
  CloudOff,
  Hash,
  Compass,
  Database,
  History,
  Hotel,
  Layers,
  MapPin,
  Maximize2,
  Minimize2,
  Moon,
  Navigation,
  Pencil,
  Plus,
  Redo2,
  Search,
  Sparkles,
  Sun,
  Sunrise,
  PanelRightOpen,
  PanelRightClose,
  Shrink,
  Expand,
  Trash2,
  Undo2,
  X,
  Calendar,
  Link2,
  Upload,
} from 'lucide-react';
import type {
  AccommodationGroup,
  DayPart,
  DragState,
  HybridTrip,
  NightAccommodation,
  ShareCodeMode,
  Stay,
  TripStore,
  V1HybridTrip,
  VisitItem,
} from './domain/types';
import { createEmptyTrip, DAY_PARTS, STAY_COLORS, TRANSPORT_LABELS } from './domain/constants';
import { addDaysTo, fmt, safeDate } from './domain/dateUtils';
import { haversineKm, jitter } from './domain/geoUtils';
import {
  deriveAccommodationGroups,
  deriveStayDays,
  getOverlapIds,
  getStayNightCount,
} from './domain/stayLogic';
import { createVisit, normalizeVisitOrders, sortVisits } from './domain/visitLogic';
import { getVisitTypeBg, getVisitTypeColor, getVisitLabel } from './domain/visitTypeDisplay';
import { createSampleTrip } from './domain/sampleData';
import {
  applyTimelineDrag,
  demoteStay,
  extendTripAfter,
  extendTripBefore,
  promoteCandidateStay,
  shrinkTripAfter,
  shrinkTripBefore,
} from './domain/tripMutations';
import type { AccommodationRemoval } from './domain/accommodationAdjust';
import {
  hybridTripToLegacy,
  migrateV1toV2,
  needsMigrationToV2,
  normalizeTrip,
} from './domain/migration';
import { generateMarkdown, downloadMarkdown } from './markdownExporter';
import TripMap from './components/TripMap';
import DayFilterPills from './components/TripMap/DayFilterPills';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useCloudSync } from './hooks/useCloudSync';
import { createSyncService } from './services/sync';
import { searchPhoto } from './unsplash';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Kbd } from '@/components/ui/kbd';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import 'leaflet/dist/leaflet.css';

// ─── Extracted components ─────────────────────────────────────────────────────
import { useHistory } from './hooks/useHistory';
import { loadStore, saveStore } from './lib/persistence';
import TransportIcon, { getVisitTypeIcon } from './components/ui/TransportIcon';
import AccommodationEditorModal from './components/modals/AccommodationEditorModal';
import RouteEditorModal from './components/modals/RouteEditorModal';
import StayEditorModal from './components/modals/StayEditorModal';
import AddStayModal from './components/modals/AddStayModal';
import VisitFormModal from './components/modals/VisitFormModal';
import TripEditorModal from './components/modals/TripEditorModal';
import AIPlannerModal from './components/modals/AIPlannerModal';
import MergeDialog from './components/modals/MergeDialog';
import ImportFromCodeDialog from './components/modals/ImportFromCodeDialog';
import ShareTripDialog from './components/modals/ShareTripDialog';
import AuthModalSimple from './components/modals/AuthModalSimple';
import { useShareCode } from '@/hooks/useShareCode';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import TripSwitcherPanel from './components/panels/TripSwitcherPanel';
import HistoryPanel from './components/panels/HistoryPanel';
import StayOverviewPanel from './components/panels/StayOverviewPanel';
import VisitDetailDrawer from './components/panels/VisitDetailDrawer';
import ProfileMenu from './components/panels/ProfileMenu';
import DraggableInventoryCard from './components/cards/DraggableInventoryCard';
import DroppablePeriodSlot from './components/timeline/DroppablePeriodSlot';
import WelcomeScreen from './components/WelcomeScreen';
import ChronosErrorBoundary from './components/ChronosErrorBoundary';
import { SidebarSplit } from '@/components/layout/SidebarSplit';
import { MobileShell } from '@/components/mobile/MobileShell';
import { MapTab, type MapTabPeek } from '@/components/mobile/MapTab';
import { VisitPage } from '@/components/mobile/VisitPage';
import { StayPage } from '@/components/mobile/StayPage';
import { MoreTab } from '@/components/mobile/MoreTab';
import { useMediaQuery } from '@/hooks/useMediaQuery';

// ─── Constants ────────────────────────────────────────────────────────────────
const EMPTY_TRIP = createEmptyTrip();

// ─── CHRONOS App ──────────────────────────────────────────────────────────────
function ChronosApp() {
  // ── Responsive breakpoint ─────────────────────────────────────────────────
  const isMobile = useMediaQuery('(max-width: 767px)');

  // ── Store (multi-trip) ───────────────────────────────────────────────────
  const [store, setStore] = useState<TripStore>(() => loadStore());
  const [isDemoMode, setIsDemoMode] = useState(false);
  const storeRef = useRef(store);
  useEffect(() => {
    storeRef.current = store;
  }, [store]);

  const trip = useMemo(
    () => store.trips.find((t) => t.id === store.activeTripId) ?? store.trips[0] ?? EMPTY_TRIP,
    [store],
  );

  const updateTrip = useCallback(
    (updater: (t: HybridTrip) => HybridTrip) => {
      setStore((s) => {
        const updated = s.trips.map((t) => (t.id === trip.id ? updater(t) : t));
        const next = { ...s, trips: updated };
        saveStore(next);
        return next;
      });
    },
    [trip.id],
  );

  // ── Auto-fetch Unsplash photos ────────────────────────────────────────────
  const updateTripRef = useRef(updateTrip);
  useEffect(() => {
    updateTripRef.current = updateTrip;
  }, [updateTrip]);

  useEffect(() => {
    if (!import.meta.env.VITE_UNSPLASH_ACCESS_KEY) return;
    const staysNeedingImages = trip.stays.filter((s) => !s.imageUrl);
    if (staysNeedingImages.length === 0) return;
    let cancelled = false;
    staysNeedingImages.forEach(async (stay) => {
      try {
        const url = await searchPhoto(`${stay.name} city travel`);
        if (url && !cancelled)
          updateTripRef.current((t) => ({
            ...t,
            stays: t.stays.map((s) => (s.id === stay.id ? { ...s, imageUrl: url } : s)),
          }));
      } catch {
        /* search failed — skip silently */
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.stays.map((s) => `${s.id}:${s.imageUrl ?? ''}`).join('|')]);

  // Sync with history
  const hist = useHistory(trip);

  const notifyReversible = useCallback(
    (label: string, revert: () => void, description?: string) => {
      toast(label, {
        description,
        duration: 5000,
        action: {
          label: 'Undo',
          onClick: () => revert(),
        },
      });
    },
    [],
  );

  const setTrip = useCallback(
    (fn: ((t: HybridTrip) => HybridTrip) | HybridTrip) => {
      const next = typeof fn === 'function' ? fn(trip) : fn;
      hist.push(next);
      updateTrip(() => next);
    },
    [trip, hist, updateTrip],
  );

  // ── UI state ──────────────────────────────────────────────────────────────
  const [selectedStayId, setSelectedStayId] = useState<string>(trip.stays[0]?.id ?? '');
  const [hoveredStayId, setHoveredStayId] = useState<string | null>(null);
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null);
  const [hoveredVisitId, setHoveredVisitId] = useState<string | null>(null);
  const [locatedVisitId, setLocatedVisitId] = useState<string | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [promotingCandidateId, setPromotingCandidateId] = useState<string | null>(null);
  const [addingCandidate, setAddingCandidate] = useState(false);
  // Clear located visit when selection changes to something else
  useEffect(() => {
    if (locatedVisitId && selectedVisitId !== locatedVisitId) {
      setLocatedVisitId(null);
    }
  }, [selectedVisitId, locatedVisitId]);
  const [dragState, setDragState] = useState<DragState>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mapExpanded, setMapExpanded] = useState(
    () => localStorage.getItem('itinerary-map-expanded') === '1',
  );
  const [mapCollapsed, setMapCollapsed] = useState(
    () => localStorage.getItem('itinerary-map-collapsed') === '1',
  );
  const [mapMini, setMapMini] = useState(() => localStorage.getItem('itinerary-map-mini') === '1');
  useEffect(() => {
    localStorage.setItem('itinerary-map-expanded', mapExpanded ? '1' : '0');
  }, [mapExpanded]);
  useEffect(() => {
    localStorage.setItem('itinerary-map-collapsed', mapCollapsed ? '1' : '0');
  }, [mapCollapsed]);
  useEffect(() => {
    localStorage.setItem('itinerary-map-mini', mapMini ? '1' : '0');
  }, [mapMini]);
  const [mapAnimClass, setMapAnimClass] = useState('');
  const triggerMapAnim = useCallback((cls: string) => {
    setMapAnimClass(cls);
    const timer = setTimeout(() => setMapAnimClass(''), 500);
    return () => clearTimeout(timer);
  }, []);
  const [mapWidth, setMapWidth] = useState(() => {
    const saved = localStorage.getItem('itinerary-map-width');
    return saved ? Number(saved) : 500;
  });
  const mapResizingRef = useRef<{
    startX: number;
    startWidth: number;
    currentWidth: number;
  } | null>(null);
  const mapPanelRef = useRef<HTMLElement>(null);
  const startMapResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      mapResizingRef.current = { startX: e.clientX, startWidth: mapWidth, currentWidth: mapWidth };
      const onMove = (ev: MouseEvent) => {
        if (!mapResizingRef.current) return;
        const newWidth = Math.min(
          Math.round(window.innerWidth * 0.75),
          Math.max(
            280,
            mapResizingRef.current.startWidth + (mapResizingRef.current.startX - ev.clientX),
          ),
        );
        mapResizingRef.current.currentWidth = newWidth;
        setMapWidth(newWidth);
      };
      const onUp = () => {
        if (mapResizingRef.current) {
          localStorage.setItem('itinerary-map-width', String(mapResizingRef.current.currentWidth));
        }
        mapResizingRef.current = null;
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [mapWidth],
  );
  const [mapMode, setMapMode] = useState<'overview' | 'stay' | 'detail'>('overview');
  const [mapDayFilter, setMapDayFilter] = useState<number | null>(null);
  const [zoomDays, setZoomDays] = useState(() => {
    const saved = localStorage.getItem('itinerary-timeline-zoom');
    const v = saved ? Number(saved) : 0;
    // Clamp: if saved zoom exceeds trip length, fall back to ALL
    return v !== 0 && v > trip.totalDays ? 0 : v;
  });
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [editingRouteStayId, setEditingRouteStayId] = useState<string | null>(null);
  const [editingStayId, setEditingStayId] = useState<string | null>(null);
  const [addingVisitToSlot, setAddingVisitToSlot] = useState<{
    dayOffset: number;
    part: DayPart;
  } | null>(null);
  const [editingVisit, setEditingVisit] = useState<VisitItem | null>(null);
  const [addingToInbox, setAddingToInbox] = useState(false);
  const [editingAccommodation, setEditingAccommodation] = useState<
    { group: AccommodationGroup } | { dayOffset: number } | null
  >(null);
  const [showTripSwitcher, setShowTripSwitcher] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showTripEditor, setShowTripEditor] = useState(false);
  const [addingStay, setAddingStay] = useState(false);
  const [timelineHoverDay, setTimelineHoverDay] = useState<number | null>(null);
  const [timelineDragCreate, setTimelineDragCreate] = useState<{
    startSlot: number;
    currentSlot: number;
  } | null>(null);
  const [pendingTimelineSlot, setPendingTimelineSlot] = useState<{
    startSlot: number;
    days: number;
  } | null>(null);
  const timelineZoneRef = useRef<HTMLDivElement>(null);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobilePeek, setMobilePeek] = useState<
    ({ kind: 'visit' | 'stay'; id: string } & MapTabPeek) | null
  >(null);
  const mobileSearchRef = useRef<HTMLInputElement>(null);
  const [showAIPlanner, setShowAIPlanner] = useState(false);
  const [showImportCode, setShowImportCode] = useState(false);
  const [showShareTrip, setShowShareTrip] = useState(false);
  const [showPullConfirm, setShowPullConfirm] = useState(false);
  const [showMobileAuth, setShowMobileAuth] = useState(false);
  const mobileImportJsonRef = useRef<HTMLInputElement>(null);
  const [aiSettings, setAiSettings] = useState<{ apiKey: string; model: string }>(() => {
    const saved = localStorage.getItem('chronos-ai-settings');
    return saved ? JSON.parse(saved) : { apiKey: '', model: 'gemini-2.0-flash' };
  });

  const { user } = useAuth();
  const shareCodeState = useShareCode(trip, updateTrip);

  const handleCreateShareCode = useCallback(
    async (mode: ShareCodeMode) => {
      if (!user?.uid) return undefined;
      return shareCodeState.createShareCode(user.uid, mode);
    },
    [user?.uid, shareCodeState],
  );

  const handlePushUpdate = useCallback(async () => {
    return shareCodeState.pushUpdate(user?.uid ?? null);
  }, [user?.uid, shareCodeState]);

  const handleRevoke = useCallback(() => shareCodeState.revokeShareCode(), [shareCodeState]);

  const handlePullLatest = useCallback(async () => {
    await shareCodeState.pullLatest();
    setShowPullConfirm(false);
  }, [shareCodeState]);

  // Check for share code updates on trip load
  const { checkForUpdate } = shareCodeState;
  useEffect(() => {
    if (trip.sourceShareCode) {
      checkForUpdate();
    }
  }, [trip.id, trip.sourceShareCode, checkForUpdate]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 12 } }),
  );

  // Keyboard shortcuts (Ctrl+Z / Ctrl+Y)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        const prev = hist.undo();
        if (prev) updateTrip(() => prev);
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        const next = hist.redo();
        if (next) updateTrip(() => next);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [hist, updateTrip]);

  useEffect(() => {
    setMapDayFilter(null);
    setMapMode(selectedStayId ? 'stay' : 'overview');
  }, [selectedStayId]);

  // ── Cloud sync ────────────────────────────────────────────────────────────
  const syncService = useMemo(() => createSyncService(), []);
  const {
    syncStatus,
    syncError,
    setSyncError,
    pendingMerge,
    handleMergeDecision,
    dismissMerge,
    remoteUpdateToast,
    dismissRemoteToast,
  } = useCloudSync(syncService, store, setStore, user);

  // ── Derived values ────────────────────────────────────────────────────────
  const sortedStays = useMemo(
    () => [...trip.stays].sort((a, b) => a.startSlot - b.startSlot),
    [trip.stays],
  );
  const overlaps = useMemo(() => getOverlapIds(sortedStays), [sortedStays]);
  const selectedStay = useMemo(
    () => (selectedStayId ? (sortedStays.find((s) => s.id === selectedStayId) ?? null) : null),
    [selectedStayId, sortedStays],
  );
  const stayDays = useMemo(
    () => (selectedStay ? deriveStayDays(trip, selectedStay) : []),
    [selectedStay, trip],
  );
  const overviewStays = useMemo(
    () =>
      sortedStays.map((s) => {
        const route = trip.routes.find((r) => r.fromStayId === s.id);
        return {
          id: s.id,
          name: s.name,
          color: s.color,
          centerLat: s.centerLat,
          centerLng: s.centerLng,
          travelModeToNext: route?.mode ?? 'train',
          travelDurationToNext: route?.duration,
        };
      }),
    [sortedStays, trip.routes],
  );
  const dayFilterOptions = useMemo(
    () => stayDays.map((d) => ({ dayOffset: d.dayOffset, label: `Day ${d.dayOffset + 1}` })),
    [stayDays],
  );
  const accommodationGroups = useMemo(() => deriveAccommodationGroups(stayDays), [stayDays]);
  const todayOffset = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = safeDate(trip.startDate);
    start.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0 || diffDays >= trip.totalDays) return null;
    return diffDays;
  }, [trip.startDate, trip.totalDays]);
  const existingAccommodationNames = useMemo(() => {
    const names = new Set<string>();
    trip.stays.forEach((s) => {
      if (s.nightAccommodations)
        Object.values(s.nightAccommodations).forEach((a) => {
          if (a.name) names.add(a.name);
        });
    });
    return Array.from(names);
  }, [trip.stays]);
  const searchTerm = searchQuery.trim().toLowerCase();

  const inboxVisits = useMemo(() => {
    if (!selectedStay) return [];
    return trip.visits
      .filter((v) => v.stayId === selectedStay.id && (v.dayOffset === null || v.dayPart === null))
      .filter((v) => !searchTerm || v.name.toLowerCase().includes(searchTerm))
      .sort((a, b) => a.order - b.order);
  }, [selectedStay, trip.visits, searchTerm]);

  const mapVisits = useMemo(() => {
    if (!selectedStay) return [];
    let scheduled = trip.visits.filter(
      (v) => v.stayId === selectedStay.id && v.dayOffset !== null && v.dayPart !== null,
    );
    if (mapMode === 'detail' && mapDayFilter !== null) {
      scheduled = scheduled.filter((v) => v.dayOffset === mapDayFilter);
    }
    const sorted = sortVisits(scheduled);
    // Include a located unplanned visit so the map can show/fly to it
    if (locatedVisitId) {
      const located = trip.visits.find((v) => v.id === locatedVisitId);
      if (located && !sorted.some((v) => v.id === locatedVisitId)) {
        sorted.push(located);
      }
    }
    return sorted;
  }, [selectedStay, trip.visits, mapDayFilter, mapMode, locatedVisitId]);

  // ── Timeline drag ─────────────────────────────────────────────────────────
  // During drag, update stays directly (bypass history) to avoid flooding
  // the undo stack with intermediate positions. Push one snapshot on mouseup.
  useEffect(() => {
    if (!dragState) return;
    const zone = timelineZoneRef.current;
    const visibleDays = zoomDays > 0 ? zoomDays : trip.totalDays;
    const slotWidth = (zone?.clientWidth ?? visibleDays * 42) / (visibleDays * 3);

    let lastRemoved: AccommodationRemoval[] = [];

    const applyDelta = (clientX: number) => {
      const delta = Math.round((clientX - dragState.originX) / slotWidth);
      updateTrip((curr) => {
        const result = applyTimelineDrag(curr.stays, dragState, delta, curr.totalDays * 3);
        lastRemoved = result.removed;
        return { ...curr, stays: result.stays };
      });
    };
    const onMove = (e: MouseEvent) => applyDelta(e.clientX);
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      applyDelta(e.touches[0].clientX);
    };
    const preDragTrip = trip;
    const onUp = () => {
      // Push a single history snapshot for the entire drag operation
      hist.push(trip);
      if (lastRemoved.length > 0) {
        const uniqueStays = Array.from(new Set(lastRemoved.map((r) => r.stayLabel)));
        const label =
          lastRemoved.length === 1
            ? `${lastRemoved[0].name} removed from ${lastRemoved[0].stayLabel}`
            : uniqueStays.length === 1
              ? `${lastRemoved.length} accommodations removed from ${uniqueStays[0]}`
              : `${lastRemoved.length} accommodations removed`;
        notifyReversible(label, () => setTrip(preDragTrip));
      }
      setDragState(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- updateTrip/hist/setTrip/notifyReversible change on every trip update; including them would break mid-drag
  }, [dragState, zoomDays, trip.totalDays]);

  // ── Auto-fetch visit photos for selected stay ─────────────────────────────
  useEffect(() => {
    if (!import.meta.env.VITE_UNSPLASH_ACCESS_KEY || !selectedStay) return;
    const visitsNeedingImages = trip.visits.filter(
      (v) => v.stayId === selectedStay.id && !v.imageUrl,
    );
    if (visitsNeedingImages.length === 0) return;
    let cancelled = false;
    visitsNeedingImages.forEach(async (visit) => {
      try {
        const url = await searchPhoto(visit.name);
        if (url && !cancelled)
          updateTripRef.current((t) => ({
            ...t,
            visits: t.visits.map((v) => (v.id === visit.id ? { ...v, imageUrl: url } : v)),
          }));
      } catch {
        /* search failed — skip silently */
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStay?.id, trip.visits]);

  // ── Mutators ──────────────────────────────────────────────────────────────
  const updateSelectedStay = (fn: (s: Stay) => Stay) => {
    if (!selectedStay) return;
    setTrip((curr) => ({
      ...curr,
      stays: curr.stays.map((s) => (s.id === selectedStay.id ? fn(s) : s)),
    }));
  };

  const scheduleVisit = (
    visitId: string,
    targetDayOffset: number | null,
    targetPart: DayPart | null,
  ) => {
    setTrip((t) => ({
      ...t,
      visits: normalizeVisitOrders(
        t.visits.map((v) =>
          v.id === visitId
            ? { ...v, dayOffset: targetDayOffset, dayPart: targetPart, order: 9999 }
            : v,
        ),
      ),
    }));
  };

  const reorderVisits = (aId: string, bId: string) => {
    setTrip((t) => {
      const aVisit = t.visits.find((v) => v.id === aId);
      if (!aVisit) return t;
      const slotVisits = t.visits
        .filter(
          (v) =>
            v.stayId === aVisit.stayId &&
            v.dayOffset === aVisit.dayOffset &&
            v.dayPart === aVisit.dayPart,
        )
        .sort((a, b) => a.order - b.order);
      const fromIdx = slotVisits.findIndex((v) => v.id === aId);
      const toIdx = slotVisits.findIndex((v) => v.id === bId);
      if (fromIdx === -1 || toIdx === -1) return t;
      const reordered = arrayMove(slotVisits, fromIdx, toIdx);
      const newOrders = new Map(reordered.map((v, i) => [v.id, i]));
      return {
        ...t,
        visits: t.visits.map((v) =>
          newOrders.has(v.id) ? { ...v, order: newOrders.get(v.id)! } : v,
        ),
      };
    });
  };

  // ── DnD ───────────────────────────────────────────────────────────────────
  const handleDragStart = ({ active }: DragStartEvent) => setActiveId(active.id as string);

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over || !selectedStay) return;
    const aId = active.id as string;
    const oId = over.id as string;
    const visitId = aId.slice(6); // works for both 'inbox-' (6) and 'visit-' (6)

    // Dropped directly onto a slot container
    if (oId.startsWith('slot-')) {
      const parts = oId.split('-');
      scheduleVisit(visitId, parseInt(parts[1]), parts[2] as DayPart);
      return;
    }

    // Dropped onto another visit card (common when slot is populated)
    if (oId.startsWith('visit-')) {
      const targetVisitId = oId.slice(6);
      const targetVisit = trip.visits.find((v) => v.id === targetVisitId);
      if (!targetVisit) return;

      if (aId.startsWith('inbox-')) {
        // Unplanned card → place in target visit's slot
        if (targetVisit.dayOffset !== null && targetVisit.dayPart !== null) {
          scheduleVisit(visitId, targetVisit.dayOffset, targetVisit.dayPart);
        }
        return;
      }

      // Scheduled visit → another visit
      const activeVisit = trip.visits.find((v) => v.id === visitId);
      if (!activeVisit) return;
      if (
        activeVisit.dayOffset === targetVisit.dayOffset &&
        activeVisit.dayPart === targetVisit.dayPart
      ) {
        // Same slot → reorder
        reorderVisits(visitId, targetVisitId);
      } else {
        // Different slot → move there
        scheduleVisit(visitId, targetVisit.dayOffset, targetVisit.dayPart);
      }
    }
  };

  // ── Trip management ───────────────────────────────────────────────────────
  const handleNewTrip = () => {
    const sample: HybridTrip = {
      id: `trip-${Date.now()}`,
      name: 'New Trip',
      stays: [],
      candidateStays: [],
      visits: [],
      routes: [],
      startDate: '',
      totalDays: 7,
      version: 3,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setStore((s) => {
      const next = { trips: [...s.trips, sample], activeTripId: sample.id };
      saveStore(next);
      return next;
    });
    setSelectedStayId('');
  };

  const handleLoadDemo = () => {
    const sample = createSampleTrip();
    const next = { trips: [sample], activeTripId: sample.id };
    setStore(next); // intentionally NOT saved to localStorage
    setIsDemoMode(true);
    setSelectedStayId(sample.stays[0]?.id ?? '');
  };

  const handleMakeMine = () => {
    saveStore(store);
    setIsDemoMode(false);
  };

  const handleGoHome = () => {
    const empty: TripStore = { trips: [], activeTripId: '' };
    setStore(empty);
    saveStore(empty);
    setIsDemoMode(false);
    setSelectedStayId('');
  };

  const handleSignOut = () => {
    const empty: TripStore = { trips: [], activeTripId: '' };
    setStore(empty);
    saveStore(empty);
    setIsDemoMode(false);
    setSelectedStayId('');
  };

  const handleSwitchTrip = (id: string) => {
    setStore((s) => {
      const next = { ...s, activeTripId: id };
      saveStore(next);
      return next;
    });
    setSelectedStayId('');
  };

  const handleImportFromCode = (importedTrip: HybridTrip) => {
    setStore((s) => {
      const next = { trips: [...s.trips, importedTrip], activeTripId: importedTrip.id };
      saveStore(next);
      return next;
    });
    setSelectedStayId('');
  };

  // ── Mobile export/import helpers ──────────────────────────────────────────
  const handleMobileExportJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(trip, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${trip.name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [trip]);

  const handleMobileExportMarkdown = useCallback(() => {
    const start = trip.startDate || new Date().toISOString().split('T')[0];
    const legacy = hybridTripToLegacy({ ...trip, startDate: start });
    const endDate = addDaysTo(new Date(start), trip.totalDays - 1)
      .toISOString()
      .split('T')[0];
    const md = generateMarkdown(
      legacy.days,
      legacy.locations as unknown as Parameters<typeof generateMarkdown>[1],
      legacy.routes,
      start,
      endDate,
    );
    downloadMarkdown(
      md,
      `${trip.name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.md`,
    );
  }, [trip]);

  const handleMobileImportJsonFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(String(ev.target?.result || '{}'));
          if (!parsed.stays || !parsed.name) return;
          let imported = normalizeTrip({
            ...parsed,
            id: parsed.id || `trip-${Date.now()}`,
            startDate: parsed.startDate || '',
            totalDays: parsed.totalDays || 1,
          } as HybridTrip);
          if (needsMigrationToV2(imported))
            imported = migrateV1toV2(imported as unknown as V1HybridTrip);
          setStore((s) => {
            const next = { trips: [...s.trips, imported], activeTripId: imported.id };
            saveStore(next);
            return next;
          });
          setSelectedStayId('');
        } catch {
          // silently ignore parse errors on mobile
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    },
    [setStore],
  );

  // ── Render helpers ────────────────────────────────────────────────────────
  const numDays = trip.totalDays;

  // ── Timeline drag-to-create helpers ──────────────────────────────────────
  const numSlots = numDays * 3;

  const getSlotFromClientX = useCallback(
    (clientX: number): number => {
      const el = timelineZoneRef.current;
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      const innerLeft = rect.left + rect.width * 0.01;
      const innerWidth = rect.width * 0.98;
      const ratio = Math.max(0, Math.min(1, (clientX - innerLeft) / innerWidth));
      return Math.min(numSlots - 1, Math.floor(ratio * numSlots));
    },
    [numSlots],
  );

  const isSlotRangeEmpty = useCallback(
    (startSlot: number, endSlotExcl: number): boolean => {
      return !sortedStays.some((s) => s.startSlot < endSlotExcl && s.endSlot > startSlot);
    },
    [sortedStays],
  );

  useEffect(() => {
    const handleMouseUp = () => {
      if (!timelineDragCreate) return;
      const { startSlot, currentSlot } = timelineDragCreate;
      const minSlot = Math.min(startSlot, currentSlot);
      const maxSlot = Math.max(startSlot, currentSlot);
      if (isSlotRangeEmpty(minSlot, maxSlot + 1)) {
        setPendingTimelineSlot({
          startSlot: minSlot,
          days: Math.max(1, Math.ceil((maxSlot - minSlot + 1) / 3)),
        });
        setAddingStay(true);
      }
      setTimelineDragCreate(null);
    };
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [timelineDragCreate, isSlotRangeEmpty]);
  const dayLabels = Array.from({ length: numDays }, (_, i) => {
    const d = addDaysTo(safeDate(trip.startDate), i);
    return {
      date: fmt(d, { month: 'short', day: 'numeric' }),
      weekday: fmt(d, { weekday: 'short' }),
    };
  });
  const bufferBefore = (() => {
    const d = addDaysTo(safeDate(trip.startDate), -1);
    return {
      date: fmt(d, { month: 'short', day: 'numeric' }),
      weekday: fmt(d, { weekday: 'short' }),
    };
  })();
  const bufferAfter = (() => {
    const d = addDaysTo(safeDate(trip.startDate), trip.totalDays);
    return {
      date: fmt(d, { month: 'short', day: 'numeric' }),
      weekday: fmt(d, { weekday: 'short' }),
    };
  })();
  const handleExtendBefore = () => setTrip((t) => extendTripBefore(t));
  const handleExtendAfter = () => setTrip((t) => extendTripAfter(t));
  const canShrinkBefore = trip.totalDays > 1 && !sortedStays.some((s) => s.startSlot < 3);
  const canShrinkAfter =
    trip.totalDays > 1 && !sortedStays.some((s) => s.endSlot > (trip.totalDays - 1) * 3);
  const handleShrinkBefore = () => {
    const r = shrinkTripBefore(trip);
    if (r) setTrip(r);
  };
  const handleShrinkAfter = () => {
    const r = shrinkTripAfter(trip);
    if (r) setTrip(r);
  };

  const tripStartLabel = fmt(safeDate(trip.startDate), { month: 'short', day: 'numeric' });

  const editingRouteStay = editingRouteStayId
    ? (sortedStays.find((s) => s.id === editingRouteStayId) ?? null)
    : null;
  const editingRouteNextStay = editingRouteStay
    ? (sortedStays[sortedStays.indexOf(editingRouteStay) + 1] ?? null)
    : null;

  const activeInboxVisit = activeId?.startsWith('inbox-')
    ? inboxVisits.find((v) => `inbox-${v.id}` === activeId)
    : null;
  const activeScheduledVisit =
    activeId?.startsWith('visit-') && selectedStay
      ? trip.visits.find((v) => `visit-${v.id}` === activeId)
      : null;

  // ── Welcome screen for first-time users ──────────────────────────────────
  if (store.trips.length === 0) {
    return (
      <>
        <WelcomeScreen
          onCreateTrip={() => {
            handleNewTrip();
            setShowTripEditor(true);
          }}
          onLoadDemo={handleLoadDemo}
          onImportFromCode={() => setShowImportCode(true)}
        />
        {showImportCode && (
          <ImportFromCodeDialog
            onImport={handleImportFromCode}
            onClose={() => setShowImportCode(false)}
          />
        )}
      </>
    );
  }

  // ── Sidebar pane content ─────────────────────────────────────────────────
  const detailsPane = (
    <>
      {selectedStay &&
        selectedVisitId &&
        (() => {
          const visit = trip.visits.find((v) => v.id === selectedVisitId);
          if (!visit) return null;
          const dayLabel =
            visit.dayOffset !== null
              ? `Day ${visit.dayOffset + 1}${visit.dayPart ? ', ' + visit.dayPart.charAt(0).toUpperCase() + visit.dayPart.slice(1) : ''}`
              : 'Unplanned';
          return (
            <VisitDetailDrawer
              key={visit.id}
              visit={visit}
              dayLabel={dayLabel}
              onClose={() => setSelectedVisitId(null)}
              onEdit={() => {
                setEditingVisit(visit);
                setSelectedVisitId(null);
              }}
              onUnschedule={() => {
                setTrip((t) => ({
                  ...t,
                  visits: t.visits.map((v) =>
                    v.id === visit.id ? { ...v, dayOffset: null, dayPart: null } : v,
                  ),
                }));
                setSelectedVisitId(null);
              }}
              onDelete={() => {
                setTrip((t) => ({
                  ...t,
                  visits: t.visits.filter((v) => v.id !== visit.id),
                }));
                setSelectedVisitId(null);
              }}
              onUpdateVisit={(updates) => {
                setTrip((t) => ({
                  ...t,
                  visits: t.visits.map((v) => (v.id === visit.id ? { ...v, ...updates } : v)),
                }));
              }}
            />
          );
        })()}
      {selectedStay && !selectedVisitId && (
        <StayOverviewPanel
          key={selectedStay.id}
          stay={selectedStay}
          visitCount={trip.visits.filter((v) => v.stayId === selectedStay.id).length}
          stayDays={stayDays}
          accommodationGroups={accommodationGroups}
          onUpdate={(updates) => updateSelectedStay((s) => ({ ...s, ...updates }))}
        />
      )}
      {!selectedStay && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-3">
          <div className="size-10 rounded-xl bg-primary/8 flex items-center justify-center">
            <Navigation className="w-5 h-5 text-primary/40" />
          </div>
          <div className="text-center">
            <p className="text-[11px] font-bold text-foreground">Trip Overview</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {sortedStays.length} destination{sortedStays.length !== 1 ? 's' : ''} ·{' '}
              {trip.totalDays} days
            </p>
          </div>
          <p className="text-[9px] text-muted-foreground text-center leading-relaxed">
            Click a destination on the timeline to see its details and plan activities.
          </p>
        </div>
      )}
    </>
  );

  const inboxPane = (
    <div className="flex-1 overflow-y-auto p-4 space-y-3 scroll-hide">
      {selectedStay ? (
        <>
          {inboxVisits.map((v) => (
            <DraggableInventoryCard
              key={v.id}
              visit={v}
              onEdit={() => setEditingVisit(v)}
              onLocate={() => {
                setLocatedVisitId(v.id);
                setSelectedVisitId(v.id);
              }}
            />
          ))}
          {inboxVisits.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <div className="size-9 rounded-xl bg-muted flex items-center justify-center">
                {searchTerm ? (
                  <Search className="w-4 h-4 text-muted-foreground" />
                ) : selectedStay ? (
                  <Check className="w-4 h-4 text-success" />
                ) : (
                  <Compass className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
              <p className="text-[11px] font-bold text-muted-foreground">
                {searchTerm
                  ? 'No matching places'
                  : selectedStay
                    ? 'All scheduled!'
                    : 'No stay selected'}
              </p>
              <p className="text-[9px] text-muted-foreground text-center leading-relaxed">
                {searchTerm
                  ? 'Try a different search term.'
                  : selectedStay
                    ? 'Add more with the + button above.'
                    : 'Click a destination on the timeline.'}
              </p>
            </div>
          )}
        </>
      ) : (
        <>
          {trip.candidateStays.map((c) => (
            <div
              key={c.id}
              className="group rounded-xl border border-border bg-white p-3 cursor-pointer hover:shadow-sm transition-shadow"
              onClick={() => setSelectedCandidateId(c.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: c.color }}
                  />
                  <p className="text-xs font-bold text-foreground truncate">{c.name}</p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Promote ${c.name} to timeline`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPromotingCandidateId(c.id);
                      setAddingStay(true);
                    }}
                  >
                    <CalendarPlus className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete ${c.name} from inbox`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setTrip((t) => ({
                        ...t,
                        candidateStays: t.candidateStays.filter((s) => s.id !== c.id),
                        visits: t.visits.filter((v) => v.stayId !== c.id),
                      }));
                      if (selectedCandidateId === c.id) {
                        setSelectedCandidateId(null);
                      }
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {trip.candidateStays.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <div className="size-9 rounded-xl bg-muted flex items-center justify-center">
                <Compass className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-[11px] font-bold text-muted-foreground">
                No destinations in inbox yet
              </p>
              <p className="text-[11px] text-muted-foreground text-center max-w-[220px]">
                Add places you&apos;re considering, then move them to the timeline when ready.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );

  const inboxHeader = (
    <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40">
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-semibold tracking-wide uppercase text-muted-foreground">
          Inbox
        </span>
        {inboxVisits.length > 0 && (
          <Badge variant="secondary" className="h-4 px-1.5 rounded-full text-[9px] font-bold">
            {inboxVisits.length}
          </Badge>
        )}
      </div>
      <button
        onClick={() => {
          if (selectedStay) {
            setAddingToInbox(true);
          } else {
            setAddingCandidate(true);
          }
        }}
        className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-white transition-colors"
        aria-label="Add new place"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );

  // ── Mobile shell ─────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <MobileShell
        trip={trip}
        tripName={trip.name}
        tripDateRange={`${fmt(safeDate(trip.startDate), { month: 'short', day: 'numeric' })} → ${fmt(addDaysTo(safeDate(trip.startDate), trip.totalDays - 1), { month: 'short', day: 'numeric' })}`}
        sortedStays={sortedStays}
        selectedStay={selectedStay}
        stayDays={stayDays}
        accommodationGroups={accommodationGroups}
        todayOffset={todayOffset}
        inboxCount={inboxVisits.length}
        onSelectStay={(id) => setSelectedStayId(id)}
        onOpenStay={(nav) => {
          if (selectedStay) nav.push({ kind: 'stay', id: selectedStay.id });
        }}
        onOpenVisit={(id, nav) => {
          setSelectedVisitId(id);
          nav.push({ kind: 'visit', id });
        }}
        renderCurrentPage={(nav) => {
          const page = nav.currentPage;
          if (!page) return null;
          if (page.kind === 'visit') {
            const visit = trip.visits.find((v) => v.id === page.id);
            const parentStay = visit ? sortedStays.find((s) => s.id === visit.stayId) : null;
            if (!visit || !parentStay) return null;
            const dayLabel =
              visit.dayOffset !== null
                ? `Day ${visit.dayOffset + 1}${
                    visit.dayPart
                      ? ' · ' + visit.dayPart[0].toUpperCase() + visit.dayPart.slice(1)
                      : ''
                  }`
                : 'Unplanned';
            return (
              <VisitPage
                visit={visit}
                stayName={parentStay.name}
                dayLabel={dayLabel}
                onBack={() => nav.pop()}
                onUpdateVisit={(updates) => {
                  setTrip((t) => ({
                    ...t,
                    visits: t.visits.map((v) => (v.id === visit.id ? { ...v, ...updates } : v)),
                  }));
                }}
                onDelete={() => {
                  setTrip((t) => ({
                    ...t,
                    visits: t.visits.filter((v) => v.id !== visit.id),
                  }));
                  nav.pop();
                }}
              />
            );
          }
          if (page.kind === 'stay') {
            const stay = sortedStays.find((s) => s.id === page.id);
            if (!stay) return null;
            const visitCount = trip.visits.filter((v) => v.stayId === stay.id).length;
            const totalDays = Math.ceil((stay.endSlot - stay.startSlot) / 3);
            return (
              <StayPage
                stay={stay}
                visitCount={visitCount}
                totalDays={totalDays}
                totalNights={Math.max(0, totalDays - 1)}
                accommodationGroups={accommodationGroups}
                onBack={() => nav.pop()}
                onUpdateStay={(updates) => {
                  setTrip((t) => ({
                    ...t,
                    stays: t.stays.map((s) => (s.id === stay.id ? { ...s, ...updates } : s)),
                  }));
                }}
              />
            );
          }
          return null;
        }}
        renderMapTab={(nav) => (
          <MapTab
            renderMap={() => (
              <TripMap
                data={{
                  visits: mapVisits,
                  stay: selectedStay,
                  overviewStays,
                  overviewCandidates: trip.candidateStays.map((c) => ({
                    id: c.id,
                    name: c.name,
                    color: c.color,
                    centerLat: c.centerLat,
                    centerLng: c.centerLng,
                  })),
                }}
                selection={{
                  selectedVisitId,
                  highlightedVisitId: null,
                  selectedDayOffset: null,
                  highlightedStayId: null,
                  highlightedCandidateId: null,
                }}
                mode={selectedStay ? 'stay' : 'overview'}
                expanded={false}
                callbacks={{
                  onSelectVisit: (id) => {
                    if (!id) {
                      setMobilePeek(null);
                      return;
                    }
                    const v = trip.visits.find((x) => x.id === id);
                    if (!v) return;
                    const parentStay = sortedStays.find((s) => s.id === v.stayId);
                    setMobilePeek({
                      kind: 'visit',
                      id,
                      name: v.name,
                      subtitle: v.type ? v.type : undefined,
                      stripeColor: parentStay?.color,
                    });
                  },
                  onSelectStay: (stayId) => {
                    const s = sortedStays.find((x) => x.id === stayId);
                    if (!s) return;
                    setMobilePeek({
                      kind: 'stay',
                      id: stayId,
                      name: s.name,
                      subtitle: 'Destination',
                      stripeColor: s.color,
                    });
                  },
                  onBackToOverview: () => {
                    setSelectedStayId('');
                    setMobilePeek(null);
                  },
                }}
              />
            )}
            peek={
              mobilePeek
                ? {
                    name: mobilePeek.name,
                    subtitle: mobilePeek.subtitle,
                    stripeColor: mobilePeek.stripeColor,
                    openLabel: 'Open',
                  }
                : null
            }
            onOpenPeek={() => {
              if (!mobilePeek) return;
              if (mobilePeek.kind === 'visit') {
                setSelectedVisitId(mobilePeek.id);
                nav.push({ kind: 'visit', id: mobilePeek.id });
              } else {
                setSelectedStayId(mobilePeek.id);
                nav.push({ kind: 'stay', id: mobilePeek.id });
              }
              setMobilePeek(null);
            }}
            onDismissPeek={() => setMobilePeek(null)}
          />
        )}
        renderMoreTab={(_nav) => (
          <>
            <input
              ref={mobileImportJsonRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleMobileImportJsonFile}
            />
            <MoreTab
              activeTripName={trip.name}
              activeTripDates={`${fmt(safeDate(trip.startDate), { month: 'short', day: 'numeric' })} → ${fmt(addDaysTo(safeDate(trip.startDate), trip.totalDays - 1), { month: 'short', day: 'numeric' })} · ${trip.totalDays} ${trip.totalDays === 1 ? 'day' : 'days'}`}
              inboxCount={inboxVisits.length}
              onSwitchTrip={() => setShowTripSwitcher(true)}
              onEditTrip={() => setShowTripEditor(true)}
              onOpenHistory={() => setShowHistory(true)}
              onImportCode={() => setShowImportCode(true)}
              onExportMarkdown={handleMobileExportMarkdown}
              onExportJson={handleMobileExportJson}
              onImportJson={() => mobileImportJsonRef.current?.click()}
              onOpenAIPlanner={() => setShowAIPlanner(true)}
              onOpenShare={() => setShowShareTrip(true)}
              onOpenAuth={() => setShowMobileAuth(true)}
              isAuthenticated={!!user}
              authEmail={user?.email ?? null}
              syncStatus={syncStatus}
              version="v1.0.0"
              renderInbox={() => (
                <div className="flex flex-col gap-2 p-3">
                  {inboxVisits.length === 0 && trip.candidateStays.length === 0 && (
                    <div className="text-xs text-muted-foreground text-center py-4">
                      No unscheduled items.
                    </div>
                  )}
                  {inboxVisits.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        setSelectedVisitId(v.id);
                        _nav.push({ kind: 'visit', id: v.id });
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 bg-white border border-border rounded-md text-left hover:bg-muted/50"
                    >
                      <span className="text-sm font-medium truncate">{v.name}</span>
                    </button>
                  ))}
                  {trip.candidateStays.map((c) => (
                    <div
                      key={c.id}
                      className="w-full flex items-center gap-2 px-3 py-2 bg-white border border-border border-dashed rounded-md"
                    >
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: c.color }}
                      />
                      <span className="text-sm font-medium truncate">{c.name}</span>
                      <span className="ml-auto text-[10px] text-muted-foreground">candidate</span>
                    </div>
                  ))}
                </div>
              )}
            />
            {showMobileAuth && <AuthModalSimple onClose={() => setShowMobileAuth(false)} />}
          </>
        )}
      />
    );
  }

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex h-dvh w-full flex-col overflow-hidden bg-background-light text-foreground font-sans">
        {/* ── Header ── */}
        <header className="relative flex h-11 items-center justify-between border-b border-border-neutral px-4 bg-white/80 backdrop-blur-md z-50 flex-shrink-0 gap-2">
          {/* ── Mobile search overlay ── */}
          {mobileSearchOpen && (
            <div className="md:hidden absolute inset-0 bg-white/95 backdrop-blur-md z-10 flex items-center px-3 gap-2 animate-search-reveal">
              <Search className="w-4 h-4 text-primary flex-shrink-0" />
              <Input
                ref={mobileSearchRef}
                autoFocus
                className="flex-1 text-sm bg-transparent border-none shadow-none focus-visible:ring-0 min-w-0"
                placeholder="Search places..."
                aria-label="Search places"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  setMobileSearchOpen(false);
                  setSearchQuery('');
                }}
                className="text-muted-foreground hover:text-foreground flex-shrink-0"
                aria-label="Close search"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}

          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2.5 text-primary flex-shrink-0">
              <img
                src={`${import.meta.env.BASE_URL}logo.svg`}
                alt=""
                aria-hidden="true"
                className="size-7 rounded-full shadow-sm"
              />
              <span className="text-xs font-extrabold tracking-tight hidden sm:block">
                Tappa
              </span>
            </div>
            <div className="h-5 w-px bg-border flex-shrink-0" />
            {/* Trip selector */}
            <button
              onClick={() => setShowTripSwitcher(true)}
              className="flex items-center gap-2 min-w-0 hover:bg-muted rounded-lg px-2.5 py-1.5 -ml-1 transition-colors group"
            >
              <span className="text-xs font-bold text-foreground truncate max-w-[120px] sm:max-w-none">
                {trip.name}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 group-hover:text-foreground transition-colors" />
            </button>
            {/* Date range — full on desktop, compact on mobile */}
            <button
              onClick={() => setShowTripEditor(true)}
              className="hidden md:flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted border border-border/60 px-2.5 py-1 rounded-lg transition-colors flex-shrink-0"
            >
              <span className="font-bold text-foreground">{tripStartLabel}</span>
              <span className="text-muted-foreground/40">–</span>
              <span className="font-bold text-foreground">
                {fmt(addDaysTo(safeDate(trip.startDate), trip.totalDays - 1), {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
              <Badge
                variant="secondary"
                className="ml-0.5 text-[9px] font-extrabold text-primary bg-primary/8 px-1.5 py-0.5"
              >
                {trip.totalDays}d
              </Badge>
            </button>
            <button
              onClick={() => setShowTripEditor(true)}
              className="md:hidden flex items-center gap-1 text-[9px] font-bold text-primary bg-primary/8 px-2 py-1 rounded-lg transition-colors flex-shrink-0"
            >
              <Calendar className="w-3 h-3" />
              {trip.totalDays}d
            </button>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {isDemoMode && (
              <div className="flex items-center gap-1.5 bg-muted border border-border rounded-lg pl-2.5 pr-1 py-1 text-[11px] font-bold text-muted-foreground mr-1">
                <span className="hidden sm:inline">Demo</span>
                <button
                  onClick={handleMakeMine}
                  aria-label="Save demo trip to your trips"
                  className="px-2 py-0.5 bg-primary text-white rounded-md text-[11px] font-bold hover:bg-primary/90 transition-colors whitespace-nowrap"
                >
                  <span className="hidden sm:inline">Make it mine</span>
                  <span className="sm:hidden">Save</span>
                </button>
                <button
                  onClick={handleGoHome}
                  aria-label="Discard demo and start fresh"
                  className="hidden sm:block px-2 py-0.5 rounded-md text-[11px] font-semibold hover:bg-muted transition-colors"
                >
                  Start fresh
                </button>
              </div>
            )}
            {overlaps.size > 0 && (
              <Badge
                variant="outline"
                className="text-warning bg-warning/10 border-warning/30 gap-1.5 px-2 py-1 text-[11px] font-bold"
              >
                <X className="w-3 h-3 flex-shrink-0" />
                <span className="hidden sm:inline">
                  {overlaps.size} conflict{overlaps.size > 1 ? 's' : ''}
                </span>
              </Badge>
            )}

            {/* Search — icon on mobile, input on desktop */}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setMobileSearchOpen(true)}
              className="md:hidden text-muted-foreground hover:text-primary"
              aria-label="Search"
            >
              <Search className="w-4 h-4" />
            </Button>
            <div className="hidden md:flex relative items-center group">
              <Search className="absolute left-2.5 text-muted-foreground w-3.5 h-3.5 group-focus-within:text-primary transition-colors" />
              <Input
                className="bg-muted pl-8 pr-3 py-1.5 text-xs w-48"
                placeholder="Search places, flights..."
                aria-label="Search places"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-1.5 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="w-3 h-3" />
                </Button>
              )}
            </div>

            <div className="h-5 w-px bg-border mx-1" />

            {/* Undo/Redo cluster */}
            <div className="flex items-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      const p = hist.undo();
                      if (p) updateTrip(() => p);
                    }}
                    disabled={!hist.canUndo}
                    aria-label="Undo"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Undo2 className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Undo <Kbd>Ctrl+Z</Kbd>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      const n = hist.redo();
                      if (n) updateTrip(() => n);
                    }}
                    disabled={!hist.canRedo}
                    aria-label="Redo"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Redo2 className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Redo <Kbd>Ctrl+Y</Kbd>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setShowHistory(true)}
                    disabled={!hist.canUndo && !hist.canRedo}
                    className="hidden sm:flex text-muted-foreground hover:text-foreground"
                  >
                    <History className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>View history</TooltipContent>
              </Tooltip>
            </div>

            <div className="hidden sm:block h-5 w-px bg-border mx-1" />

            {/* AI Planner */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  onClick={() => setShowAIPlanner(true)}
                  className="text-[11px] font-bold shadow-sm shadow-primary/20"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="hidden sm:block">AI</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>AI Planner</TooltipContent>
            </Tooltip>
            {/* Mobile sync dot — md:hidden */}
            <div
              className={`md:hidden size-1.5 rounded-full ${
                syncStatus === 'saved'
                  ? 'bg-success'
                  : syncStatus === 'saving'
                    ? 'bg-warning animate-pulse'
                    : syncStatus === 'error'
                      ? 'bg-destructive'
                      : 'bg-muted-foreground'
              }`}
              title={
                syncStatus === 'saved'
                  ? 'Synced'
                  : syncStatus === 'saving'
                    ? 'Saving...'
                    : syncStatus === 'error'
                      ? 'Sync error'
                      : 'Local only'
              }
            />
            {/* Profile menu */}
            <ProfileMenu
              trip={trip}
              onImport={(data) => setTrip(() => data)}
              onImportFromCode={() => setShowImportCode(true)}
              onShareTrip={() => setShowShareTrip(true)}
              onGoHome={handleGoHome}
              onSignOut={handleSignOut}
            />
          </div>
        </header>

        {/* ── Sync error banner ── */}
        {syncError && (
          <div className="flex items-center gap-2 px-4 py-2 bg-destructive/10 border-b border-destructive/20 text-xs text-destructive flex-shrink-0 z-40">
            <CloudOff className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="flex-1">{syncError}</span>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setSyncError(null)}
              className="hover:bg-destructive/20"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        )}

        {/* ── Share status bar ── */}
        {trip.shareCode && (
          <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 border-b border-border/50 text-xs flex-shrink-0 z-40">
            <Link2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            <span className="font-semibold text-foreground">
              Shared as <span className="font-mono font-bold tracking-wider">{trip.shareCode}</span>
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground font-medium">Read only</span>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => shareCodeState.pushUpdate(user?.uid ?? null)}
              className="text-xs font-semibold h-6 px-2"
            >
              <Upload className="w-3 h-3 mr-1" />
              Push changes
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowShareTrip(true)}
              className="text-xs font-semibold h-6 px-2"
            >
              Manage
            </Button>
          </div>
        )}
        {shareCodeState.sourceRevoked && (
          <div className="flex items-center gap-2 px-4 py-2 bg-warning/10 border-b border-warning/20 text-xs flex-shrink-0 z-40">
            <Link2 className="w-3.5 h-3.5 text-warning flex-shrink-0" />
            <span className="font-semibold text-warning">
              This share code is no longer available
            </span>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={shareCodeState.dismissRevoked}
              className="text-xs font-semibold h-6 px-2 text-warning hover:text-warning"
            >
              Dismiss
            </Button>
          </div>
        )}
        {trip.sourceShareCode && !shareCodeState.sourceRevoked && (
          <div
            className={`flex items-center gap-2 px-4 py-2 border-b text-xs flex-shrink-0 z-40 ${
              shareCodeState.updateAvailable
                ? 'bg-info/10 border-info/20'
                : 'bg-muted/30 border-border/50'
            }`}
          >
            <Link2
              className={`w-3.5 h-3.5 flex-shrink-0 ${shareCodeState.updateAvailable ? 'text-info' : 'text-muted-foreground'}`}
            />
            <span
              className={`font-semibold ${shareCodeState.updateAvailable ? 'text-info' : 'text-foreground'}`}
            >
              {shareCodeState.updateAvailable ? 'Update available for' : 'Linked to'}{' '}
              <span className="font-mono font-bold tracking-wider">{trip.sourceShareCode}</span>
            </span>
            <div className="flex-1" />
            {shareCodeState.remoteMode === 'writable' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => shareCodeState.pushToSource(user?.uid ?? null)}
                className="text-xs font-semibold h-6 px-2"
              >
                <Upload className="w-3 h-3 mr-1" />
                Push changes
              </Button>
            )}
            <Button
              variant={shareCodeState.updateAvailable ? 'default' : 'ghost'}
              size="sm"
              onClick={() =>
                shareCodeState.updateAvailable ? setShowPullConfirm(true) : undefined
              }
              disabled={!shareCodeState.updateAvailable}
              className={`text-xs font-semibold h-6 px-2 ${!shareCodeState.updateAvailable ? 'text-muted-foreground' : ''}`}
            >
              {shareCodeState.updateAvailable ? 'Pull latest' : 'Up to date'}
            </Button>
          </div>
        )}

        <main className="flex-1 flex flex-col min-h-0 isolate">
          {/* ── Timeline ── */}
          <section
            className="border-b border-border-neutral flex flex-col bg-white flex-shrink-0 z-40"
            style={{ height: 140 }}
          >
            <div className="flex items-center justify-between px-6 border-b border-border-neutral bg-muted/30 py-1.5">
              <div className="flex items-center gap-4">
                <span className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-muted-foreground">
                  Timeline
                </span>
                <ToggleGroup
                  type="single"
                  value={String(zoomDays)}
                  onValueChange={(v) => {
                    if (v) {
                      const d = Number(v);
                      setZoomDays(d);
                      localStorage.setItem('itinerary-timeline-zoom', String(d));
                    }
                  }}
                  variant="outline"
                  size="sm"
                  className="overflow-x-auto scroll-hide"
                >
                  {([5, 10, 15, 30, 0] as const)
                    .filter((d) => d === 0 || d <= trip.totalDays)
                    .map((d) => (
                      <ToggleGroupItem
                        key={d}
                        value={String(d)}
                        className="px-3 text-[9px] font-bold whitespace-nowrap data-[state=on]:bg-primary data-[state=on]:text-white"
                      >
                        {d === 0 ? 'ALL' : `${d} DAYS`}
                      </ToggleGroupItem>
                    ))}
                </ToggleGroup>
              </div>
              <Button size="icon-sm" onClick={() => setAddingStay(true)} aria-label="Add stay">
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>

            <div className="flex-1 relative overflow-x-auto overflow-y-hidden scroll-hide">
              <div
                data-timeline-track
                className="h-full"
                style={{
                  width:
                    zoomDays === 0
                      ? '100%'
                      : `${Math.max(100, Math.round((numDays / zoomDays) * 100))}%`,
                  display: 'grid',
                  gridTemplateColumns:
                    zoomDays === 0 ? `1fr repeat(${numDays}, 1fr) 1fr` : `repeat(${numDays}, 1fr)`,
                  gridTemplateRows: '28px 1fr',
                }}
              >
                {/* Day labels — buffer before (ALL view only) */}
                {zoomDays === 0 && (
                  <div className="flex flex-col bg-muted/80 border-b border-r border-border-neutral">
                    <div className="flex-1 flex items-center justify-center gap-1 text-[9px] font-bold text-muted-foreground/40 uppercase tracking-tighter border-b border-border">
                      <span className="text-muted-foreground/20">{bufferBefore.weekday}</span>
                      <span className="font-num text-muted-foreground/40">{bufferBefore.date}</span>
                    </div>
                    <div className="flex h-3 divide-x divide-border">
                      {['M', 'A', 'E'].map((p) => (
                        <div
                          key={p}
                          className="flex-1 flex items-center justify-center text-[9px] font-semibold text-muted-foreground/20"
                        >
                          {p}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Day labels — trip days */}
                {dayLabels.map(({ date, weekday }, i) => (
                  <div
                    key={i}
                    className="flex flex-col border-b border-r border-border-neutral bg-muted/20"
                  >
                    <div className="flex-1 flex items-center justify-center gap-1 text-[9px] font-bold text-muted-foreground uppercase tracking-tighter border-b border-border">
                      <span className="text-muted-foreground/50">{weekday}</span>
                      <span className="font-num">{date}</span>
                    </div>
                    <div className="flex h-3 divide-x divide-border">
                      {['M', 'A', 'E'].map((p) => (
                        <div
                          key={p}
                          className="flex-1 flex items-center justify-center text-[9px] font-semibold text-muted-foreground/40"
                        >
                          {p}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {/* Day labels — buffer after (ALL view only) */}
                {zoomDays === 0 && (
                  <div className="flex flex-col bg-muted/80 border-b border-border-neutral">
                    <div className="flex-1 flex items-center justify-center gap-1 text-[9px] font-bold text-muted-foreground/40 uppercase tracking-tighter border-b border-border">
                      <span className="text-muted-foreground/20">{bufferAfter.weekday}</span>
                      <span className="font-num text-muted-foreground/40">{bufferAfter.date}</span>
                    </div>
                    <div className="flex h-3 divide-x divide-border">
                      {['M', 'A', 'E'].map((p) => (
                        <div
                          key={p}
                          className="flex-1 flex items-center justify-center text-[9px] font-semibold text-muted-foreground/20"
                        >
                          {p}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Stay zone — buffer before (ALL view only) */}
                {zoomDays === 0 && (
                  <button
                    onClick={handleExtendBefore}
                    className="group/buf relative flex items-center justify-center border-r border-border-neutral transition-colors hover:bg-muted/60"
                    style={{
                      background:
                        'repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(148,163,184,0.13) 4px, rgba(148,163,184,0.13) 8px), rgba(241,245,249,0.8)',
                    }}
                    title="Extend trip one day earlier"
                  >
                    <div className="flex flex-col items-center gap-0.5 opacity-0 group-hover/buf:opacity-100 transition-opacity">
                      <Plus className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-[9px] font-bold text-muted-foreground uppercase">
                        Extend
                      </span>
                    </div>
                  </button>
                )}
                {/* Stay zone — main (spans all trip day columns) */}
                <div
                  ref={timelineZoneRef}
                  className="relative overflow-x-clip"
                  style={{
                    gridColumn: zoomDays === 0 ? `2 / ${numDays + 2}` : `1 / ${numDays + 1}`,
                    backgroundImage:
                      'linear-gradient(to right, rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(to right, rgba(0,0,0,0.02) 1px, transparent 1px)',
                    backgroundSize: `calc(100% / ${numDays}) 100%, calc(100% / ${numDays * 3}) 100%`,
                    cursor:
                      timelineHoverDay !== null || timelineDragCreate ? 'crosshair' : undefined,
                  }}
                  onMouseMove={(e) => {
                    if (dragState) return;
                    const slot = getSlotFromClientX(e.clientX);
                    if (timelineDragCreate) {
                      setTimelineDragCreate((prev) =>
                        prev ? { ...prev, currentSlot: slot } : null,
                      );
                    } else if (isSlotRangeEmpty(slot, slot + 1)) {
                      setTimelineHoverDay(slot);
                    } else {
                      setTimelineHoverDay(null);
                    }
                  }}
                  onMouseDown={(e) => {
                    if (dragState) return;
                    const slot = getSlotFromClientX(e.clientX);
                    if (!isSlotRangeEmpty(slot, slot + 1)) return;
                    e.preventDefault();
                    setTimelineDragCreate({ startSlot: slot, currentSlot: slot });
                    setTimelineHoverDay(null);
                  }}
                  onMouseLeave={() => setTimelineHoverDay(null)}
                  onTouchStart={(e) => {
                    if (dragState) return;
                    const touch = e.touches[0];
                    const slot = getSlotFromClientX(touch.clientX);
                    if (!isSlotRangeEmpty(slot, slot + 1)) return;
                    setTimelineDragCreate({ startSlot: slot, currentSlot: slot });
                    setTimelineHoverDay(null);
                  }}
                  onTouchMove={(e) => {
                    if (!timelineDragCreate) return;
                    const touch = e.touches[0];
                    const slot = getSlotFromClientX(touch.clientX);
                    setTimelineDragCreate((prev) => (prev ? { ...prev, currentSlot: slot } : null));
                  }}
                  onTouchEnd={() => {
                    if (!timelineDragCreate) return;
                    const { startSlot, currentSlot } = timelineDragCreate;
                    const minSlot = Math.min(startSlot, currentSlot);
                    const maxSlot = Math.max(startSlot, currentSlot);
                    if (isSlotRangeEmpty(minSlot, maxSlot + 1)) {
                      setPendingTimelineSlot({
                        startSlot: minSlot,
                        days: Math.max(1, Math.ceil((maxSlot - minSlot + 1) / 3)),
                      });
                      setAddingStay(true);
                    }
                    setTimelineDragCreate(null);
                  }}
                >
                  <div className="absolute inset-0 flex items-center">
                    {sortedStays.length === 0 ? (
                      <Button
                        variant="outline"
                        onClick={() => setAddingStay(true)}
                        className="w-full h-10 border-2 border-dashed border-border text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span className="text-[11px] font-bold">Add your first destination</span>
                      </Button>
                    ) : (
                      <div className="relative w-full" style={{ height: 42 }}>
                        {/* Drag-to-create: hover highlight */}
                        {timelineHoverDay !== null && !timelineDragCreate && (
                          <div
                            className="absolute top-0.5 bottom-0.5 rounded-md pointer-events-none bg-primary/10 border border-dashed border-primary/40 flex items-center justify-center z-20"
                            style={{
                              left: `${(timelineHoverDay / numSlots) * 100}%`,
                              width: `${(1 / numSlots) * 100}%`,
                            }}
                          >
                            <Plus className="w-3 h-3 text-primary/50" />
                          </div>
                        )}
                        {/* Drag-to-create: drag range highlight */}
                        {timelineDragCreate &&
                          (() => {
                            const minSlot = Math.min(
                              timelineDragCreate.startSlot,
                              timelineDragCreate.currentSlot,
                            );
                            const maxSlot = Math.max(
                              timelineDragCreate.startSlot,
                              timelineDragCreate.currentSlot,
                            );
                            const span = maxSlot - minSlot + 1;
                            const empty = isSlotRangeEmpty(minSlot, maxSlot + 1);
                            const days = Math.max(1, Math.ceil(span / 3));
                            return (
                              <div
                                className={`absolute top-0.5 bottom-0.5 rounded-md pointer-events-none border z-20 flex items-center justify-center ${
                                  empty
                                    ? 'bg-primary/15 border-primary/60'
                                    : 'bg-red-100/60 border-red-400/60'
                                }`}
                                style={{
                                  left: `${(minSlot / numSlots) * 100}%`,
                                  width: `${(span / numSlots) * 100}%`,
                                }}
                              >
                                <span
                                  className={`text-[9px] font-bold ${empty ? 'text-primary/70' : 'text-red-500/70'}`}
                                >
                                  {empty ? `${days} day${days > 1 ? 's' : ''}` : 'conflict'}
                                </span>
                              </div>
                            );
                          })()}
                        {sortedStays.map((stay, index) => {
                          const isSelected = selectedStay?.id === stay.id;
                          const isOverlapping = overlaps.has(stay.id);
                          const left = (stay.startSlot / (numDays * 3)) * 100;
                          const width = ((stay.endSlot - stay.startSlot) / (numDays * 3)) * 100;
                          const nextStay = sortedStays[index + 1];

                          return (
                            <React.Fragment key={stay.id}>
                              <div
                                role="button"
                                tabIndex={0}
                                aria-label={`${stay.name}, ${getStayNightCount(stay)} days${isOverlapping ? ', has scheduling conflict' : ''}`}
                                aria-selected={isSelected}
                                className={`absolute rounded-lg flex items-center select-none transition-all duration-150 cursor-grab active:cursor-grabbing group border focus-visible:ring-2 focus-visible:ring-offset-2 ${
                                  isSelected ? 'z-10' : 'z-0 hover:shadow-md'
                                } ${isOverlapping ? 'ring-2 ring-amber-400' : ''}`}
                                style={{
                                  left: `calc(${left}% + 6px)`,
                                  width: `calc(${Math.max(width, 2)}% - 12px)`,
                                  height: 42,
                                  background: isSelected
                                    ? `linear-gradient(135deg, ${stay.color}, color-mix(in srgb, ${stay.color} 80%, #ffffff))`
                                    : `color-mix(in srgb, ${stay.color} 8%, white)`,
                                  borderColor: isSelected
                                    ? stay.color
                                    : `color-mix(in srgb, ${stay.color} 35%, transparent)`,
                                  boxShadow: isSelected
                                    ? `0 0 0 2px white, 0 0 0 4px ${stay.color}, 0 4px 12px color-mix(in srgb, ${stay.color} 25%, transparent)`
                                    : undefined,
                                }}
                                onClick={() => {
                                  if (selectedStay?.id === stay.id) {
                                    setSelectedStayId('');
                                  } else {
                                    setSelectedStayId(stay.id);
                                  }
                                }}
                                onMouseEnter={() => setHoveredStayId(stay.id)}
                                onMouseLeave={() => setHoveredStayId(null)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    setSelectedStayId(stay.id);
                                  }
                                }}
                                onMouseDown={(e) => {
                                  // Only start move drag from the body (not resize handles)
                                  if ((e.target as HTMLElement).dataset.handle) return;
                                  setDragState({
                                    stayId: stay.id,
                                    mode: 'move',
                                    originX: e.clientX,
                                    originalStart: stay.startSlot,
                                    originalEnd: stay.endSlot,
                                    originalNightAccommodations: stay.nightAccommodations,
                                  });
                                }}
                              >
                                {/* Photo background */}
                                {stay.imageUrl && (
                                  <div className="absolute inset-0 rounded-lg overflow-hidden pointer-events-none">
                                    <img
                                      src={stay.imageUrl}
                                      alt=""
                                      className="w-full h-full object-cover"
                                      style={{ opacity: isSelected ? 0.18 : 0.12 }}
                                    />
                                  </div>
                                )}
                                {/* Colored left accent bar */}
                                <div
                                  className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-full transition-opacity"
                                  style={{ background: stay.color, opacity: isSelected ? 0 : 1 }}
                                />
                                {/* Left resize */}
                                <div
                                  data-handle="resize-start"
                                  className="absolute -left-1.5 top-0 bottom-0 w-5 cursor-ew-resize z-20 flex items-center justify-center"
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                    setSelectedStayId(stay.id);
                                    setDragState({
                                      stayId: stay.id,
                                      mode: 'resize-start',
                                      originX: e.clientX,
                                      originalStart: stay.startSlot,
                                      originalEnd: stay.endSlot,
                                      originalNightAccommodations: stay.nightAccommodations,
                                    });
                                  }}
                                >
                                  <div
                                    className="w-0.5 h-4 rounded-full bg-current opacity-15 group-hover:opacity-40 transition-opacity pointer-events-none"
                                    style={{ color: isSelected ? 'white' : stay.color }}
                                  />
                                </div>
                                {/* Content */}
                                {(() => {
                                  const staySlots = stay.endSlot - stay.startSlot;
                                  const isNarrow = staySlots < 6; // less than 2 days
                                  const isVeryNarrow = staySlots < 3; // less than 1 day
                                  return (
                                    <div className="flex flex-col overflow-hidden flex-1 pointer-events-none pl-3.5 pr-2">
                                      <div className="flex items-center gap-1.5">
                                        {!isVeryNarrow && (
                                          <Bed
                                            className="w-3 h-3 flex-shrink-0"
                                            style={{
                                              color: isSelected
                                                ? 'rgba(255,255,255,0.85)'
                                                : stay.color,
                                            }}
                                          />
                                        )}
                                        <span
                                          className="text-[11px] font-bold truncate"
                                          style={{ color: isSelected ? 'white' : stay.color }}
                                        >
                                          {stay.name}
                                        </span>
                                        {isOverlapping && (
                                          <span className="flex-shrink-0 text-[9px] font-extrabold px-1 py-0.5 rounded-md bg-amber-400 text-white leading-none">
                                            !
                                          </span>
                                        )}
                                      </div>
                                      {(() => {
                                        // Show first accommodation name if available
                                        const firstAccom = stay.nightAccommodations
                                          ? Object.values(stay.nightAccommodations)[0]?.name
                                          : undefined;
                                        return firstAccom && !isNarrow ? (
                                          <span
                                            className="text-[9px] font-semibold truncate mt-px"
                                            style={{
                                              color: isSelected
                                                ? 'rgba(255,255,255,0.6)'
                                                : `color-mix(in srgb, ${stay.color} 60%, #64748b)`,
                                            }}
                                          >
                                            {firstAccom}
                                          </span>
                                        ) : null;
                                      })()}
                                    </div>
                                  );
                                })()}
                                {/* Edit button — visible on hover or when selected */}
                                <button
                                  aria-label={`Edit ${stay.name}`}
                                  className={`absolute right-2 top-1/2 -translate-y-1/2 z-20 p-1.5 rounded-md transition-all focus-visible:ring-2 ${
                                    isSelected
                                      ? 'opacity-100 text-white/70 hover:text-white hover:bg-white/15'
                                      : 'opacity-0 group-hover:opacity-60 hover:!opacity-100 pointer-events-none group-hover:pointer-events-auto'
                                  }`}
                                  style={{ color: isSelected ? undefined : stay.color }}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingStayId(stay.id);
                                  }}
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                                {/* Right resize */}
                                <div
                                  data-handle="resize-end"
                                  className="absolute -right-1.5 top-0 bottom-0 w-5 cursor-ew-resize z-20 flex items-center justify-center"
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                    setSelectedStayId(stay.id);
                                    setDragState({
                                      stayId: stay.id,
                                      mode: 'resize-end',
                                      originX: e.clientX,
                                      originalStart: stay.startSlot,
                                      originalEnd: stay.endSlot,
                                      originalNightAccommodations: stay.nightAccommodations,
                                    });
                                  }}
                                >
                                  <div
                                    className="w-0.5 h-4 rounded-full bg-current opacity-15 group-hover:opacity-40 transition-opacity pointer-events-none"
                                    style={{ color: isSelected ? 'white' : stay.color }}
                                  />
                                </div>
                              </div>

                              {/* Transit chip — centered in gap between the two stays */}
                              {nextStay &&
                                (() => {
                                  const route = trip.routes.find((r) => r.fromStayId === stay.id);
                                  const gapStart = (stay.endSlot / (numDays * 3)) * 100;
                                  const gapEnd = (nextStay.startSlot / (numDays * 3)) * 100;
                                  const chipLeft = (gapStart + gapEnd) / 2;
                                  return (
                                    <button
                                      aria-label={`Route: ${TRANSPORT_LABELS[route?.mode ?? 'train']}${route?.duration ? `, ${route.duration}` : ''}`}
                                      onClick={() => setEditingRouteStayId(stay.id)}
                                      className="group/chip absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-30 size-8 bg-white border border-border rounded-full flex items-center justify-center cursor-pointer hover:border-primary/40 hover:shadow-md transition-all shadow-sm"
                                      style={{ left: `${chipLeft}%` }}
                                    >
                                      <TransportIcon
                                        mode={route?.mode ?? 'train'}
                                        className="w-3.5 h-3.5 text-muted-foreground"
                                      />
                                      {route?.duration && (
                                        <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-foreground text-white text-[11px] font-bold rounded-md whitespace-nowrap opacity-0 group-hover/chip:opacity-100 transition-opacity shadow-lg z-40">
                                          {route.duration}
                                        </div>
                                      )}
                                    </button>
                                  );
                                })()}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {/* Shrink strip — empty first day (bottom edge) */}
                  {canShrinkBefore && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShrinkBefore();
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="absolute bottom-0 left-0 z-30 h-5 flex items-center justify-center gap-1 rounded-tr-md transition-all opacity-0 hover:opacity-100 bg-muted/80 hover:bg-red-50 border-t border-r border-border/60"
                      style={{ width: `${(1 / numDays) * 100}%` }}
                      title="Remove empty first day"
                    >
                      <Trash2 className="w-2.5 h-2.5 text-red-400" />
                      <span className="text-[9px] font-bold text-red-400 uppercase">
                        Remove day
                      </span>
                    </button>
                  )}
                  {/* Shrink strip — empty last day (bottom edge) */}
                  {canShrinkAfter && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShrinkAfter();
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="absolute bottom-0 right-0 z-30 h-5 flex items-center justify-center gap-1 rounded-tl-md transition-all opacity-0 hover:opacity-100 bg-muted/80 hover:bg-red-50 border-t border-l border-border/60"
                      style={{ width: `${(1 / numDays) * 100}%` }}
                      title="Remove empty last day"
                    >
                      <Trash2 className="w-2.5 h-2.5 text-red-400" />
                      <span className="text-[9px] font-bold text-red-400 uppercase">
                        Remove day
                      </span>
                    </button>
                  )}
                </div>
                {/* Stay zone — buffer after (ALL view only) */}
                {zoomDays === 0 && (
                  <button
                    onClick={handleExtendAfter}
                    className="group/buf relative flex items-center justify-center border-l border-border-neutral transition-colors hover:bg-muted/60"
                    style={{
                      background:
                        'repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(148,163,184,0.13) 4px, rgba(148,163,184,0.13) 8px), rgba(241,245,249,0.8)',
                    }}
                    title="Extend trip one day later"
                  >
                    <div className="flex flex-col items-center gap-0.5 opacity-0 group-hover/buf:opacity-100 transition-opacity">
                      <Plus className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-[9px] font-bold text-muted-foreground uppercase">
                        Extend
                      </span>
                    </div>
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* ── Main content ── */}
          <section className="flex-1 flex min-h-0 relative overflow-hidden">
            {/* Inventory */}
            <aside
              className={`border-r border-border-neutral flex flex-col bg-white transition-all duration-300 ${mapExpanded ? 'w-0 overflow-hidden opacity-0' : 'w-64 hidden md:flex'}`}
            >
              <SidebarSplit top={detailsPane} bottomHeader={inboxHeader} bottom={inboxPane} />
            </aside>

            {/* Day columns */}
            <div
              data-day-columns
              className={`flex-1 overflow-x-auto overflow-y-auto flex p-5 gap-5 min-w-0 bg-muted/30 scroll-hide transition-all duration-300 max-md:snap-x max-md:snap-mandatory max-md:scroll-pl-5 ${mapExpanded ? 'w-0 overflow-hidden opacity-0 p-0' : ''}`}
              style={mapExpanded ? undefined : { paddingRight: mapWidth + 20 }}
            >
              {sortedStays.length === 0 && (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center space-y-3">
                    <div className="size-12 rounded-xl bg-muted flex items-center justify-center mx-auto">
                      <MapPin className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-bold text-foreground text-sm">No destinations yet</p>
                      <p className="text-muted-foreground text-xs mt-1 leading-relaxed">
                        Add a stay in the timeline above
                        <br />
                        to start planning your days.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => setAddingStay(true)}
                      className="text-primary border-primary/20 hover:bg-primary/5 mx-auto"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add first stay
                    </Button>
                  </div>
                </div>
              )}
              {stayDays.map((day) => {
                const dayVisits = selectedStay
                  ? sortVisits(
                      trip.visits.filter(
                        (v) =>
                          v.stayId === selectedStay.id &&
                          v.dayOffset === day.dayOffset &&
                          (!searchTerm || v.name.toLowerCase().includes(searchTerm)),
                      ),
                    )
                  : [];
                return (
                  <div
                    key={day.dayOffset}
                    className={`flex-none w-72 max-md:w-[85vw] max-md:snap-start flex flex-col gap-4 rounded-xl transition-colors ${mapMode === 'detail' && mapDayFilter === day.dayOffset ? 'ring-2 ring-primary/40 bg-primary/[0.03] p-2 -m-2' : ''}`}
                  >
                    <button
                      className={`flex items-center justify-between w-full cursor-pointer group rounded-lg px-2 py-1 -mx-2 transition-colors ${mapMode === 'detail' && mapDayFilter === day.dayOffset ? 'bg-primary/8' : 'hover:bg-muted'}`}
                      onClick={() => {
                        if (mapDayFilter === day.dayOffset) {
                          setMapDayFilter(null);
                          setMapMode('stay');
                        } else {
                          setMapDayFilter(day.dayOffset);
                          setMapMode('detail');
                        }
                      }}
                      title="Click to show this day on the map"
                    >
                      <h4 className="font-extrabold text-sm tracking-tight group-hover:text-primary transition-colors">
                        Day {(day.dayOffset + 1).toString().padStart(2, '0')}
                        <span className="text-muted-foreground font-medium ml-1.5">
                          {fmt(day.date, { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                      </h4>
                      <MapPin
                        className={`w-3 h-3 transition-colors ${mapMode === 'detail' && mapDayFilter === day.dayOffset ? 'text-primary' : 'text-muted-foreground/30 group-hover:text-primary/50'}`}
                      />
                    </button>
                    {/* Accommodation bar — rendered on the first day of each accommodation group */}
                    {(() => {
                      const group = accommodationGroups.find(
                        (g) => g.startDayOffset === day.dayOffset,
                      );
                      const isNightDay = day.hasNight;
                      const hasAnyGroup = accommodationGroups.some(
                        (g) =>
                          day.dayOffset >= g.startDayOffset &&
                          day.dayOffset < g.startDayOffset + g.nights,
                      );
                      // Reserve space on days covered by a group but not the start
                      if (!group && hasAnyGroup)
                        return <div className="h-12 flex-shrink-0 -mb-2" />;
                      // Day with a night but no accommodation set — show "add" prompt
                      if (!group && isNightDay)
                        return (
                          <div className="h-12 flex-shrink-0 -mb-2">
                            <button
                              onClick={() => setEditingAccommodation({ dayOffset: day.dayOffset })}
                              className="h-full w-full border-2 border-dashed border-border rounded-lg flex items-center justify-center gap-2 text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all"
                            >
                              <Hotel className="w-4 h-4" />
                              <span className="text-[11px] font-bold">Set Accommodation</span>
                            </button>
                          </div>
                        );
                      // No night on this day (e.g., checkout morning only) — no bar
                      if (!group) return null;
                      // Render the spanning bar for this group
                      return (
                        <div className="relative h-12 flex-shrink-0 -mb-2">
                          <div
                            className="absolute inset-y-0 left-0 z-10"
                            style={{
                              width: `calc(${group.nights} * var(--day-col-width, 288px) + ${group.nights - 1} * var(--day-col-gap, 20px))`,
                            }}
                          >
                            <button
                              onClick={() => setEditingAccommodation({ group })}
                              className="group/accom h-full w-full bg-white border border-primary/30 rounded-lg shadow-sm flex items-center px-4 gap-3 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer text-left"
                            >
                              <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                                <Hotel className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-extrabold text-primary uppercase tracking-tighter">
                                    {group.nights > 1 ? 'Continuous Stay' : 'Overnight'}
                                  </span>
                                  <span className="text-[11px] font-medium text-muted-foreground tracking-tight">
                                    • {group.nights} {group.nights === 1 ? 'Night' : 'Nights'}
                                  </span>
                                </div>
                                <p className="text-xs font-extrabold text-foreground truncate">
                                  {group.name}
                                </p>
                              </div>
                              {group.accommodation.notes && (
                                <span className="text-[11px] font-medium text-muted-foreground bg-muted border border-border px-2.5 py-1 rounded-full flex items-center gap-1.5 flex-shrink-0 max-w-[180px] truncate">
                                  <Hash className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                                  {group.accommodation.notes}
                                </span>
                              )}
                              <Pencil className="w-3.5 h-3.5 text-border group-hover/accom:text-primary/60 transition-colors flex-shrink-0" />
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                    <div className="space-y-4 pt-2">
                      {DAY_PARTS.filter((p) => day.enabledParts.includes(p)).map((period) => (
                        <DroppablePeriodSlot
                          key={period}
                          dayOffset={day.dayOffset}
                          period={period}
                          visits={dayVisits.filter((v) => v.dayPart === period)}
                          selectedVisitId={selectedVisitId}
                          onSelectVisit={(id) => {
                            const next = id === selectedVisitId ? null : id;
                            setSelectedVisitId(next);
                          }}
                          onEditVisit={(v) => setEditingVisit(v)}
                          onAddVisit={(d, p) => setAddingVisitToSlot({ dayOffset: d, part: p })}
                          onHoverVisit={(id) => setHoveredVisitId(id)}
                          onHoverVisitEnd={() => setHoveredVisitId(null)}
                          highlightedVisitId={hoveredVisitId}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
              {!selectedStay && sortedStays.length > 0 && (
                <>
                  {sortedStays.map((stay) => {
                    const days = deriveStayDays(trip, stay);
                    if (days.length === 0) return null;
                    return (
                      <React.Fragment key={stay.id}>
                        {/* Stay header */}
                        <div className="flex-none flex flex-col items-center justify-center gap-2 py-4 px-2 min-w-[60px]">
                          <div
                            className="w-1 h-8 rounded-full"
                            style={{ background: stay.color }}
                          />
                          <button
                            onClick={() => {
                              setSelectedStayId(stay.id);
                            }}
                            className="text-[11px] font-extrabold text-foreground hover:text-primary transition-colors writing-mode-vertical"
                            style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                          >
                            {stay.name}
                          </button>
                        </div>
                        {/* Days for this stay */}
                        {days.map((day) => {
                          const dayVisits = sortVisits(
                            trip.visits.filter(
                              (v) => v.stayId === stay.id && v.dayOffset === day.dayOffset,
                            ),
                          );
                          return (
                            <div
                              key={`${stay.id}-${day.dayOffset}`}
                              className="flex-none w-72 max-md:w-[85vw] max-md:snap-start flex flex-col gap-4 rounded-xl"
                            >
                              <button
                                className="flex items-center justify-between w-full cursor-pointer group rounded-lg px-2 py-1 -mx-2 transition-colors hover:bg-muted"
                                onClick={() => {
                                  setSelectedStayId(stay.id);
                                }}
                                title="Click to view this stay"
                              >
                                <h4 className="font-extrabold text-sm tracking-tight group-hover:text-primary transition-colors">
                                  Day {(day.dayOffset + 1).toString().padStart(2, '0')}
                                  <span className="text-muted-foreground font-medium ml-1.5">
                                    {fmt(day.date, {
                                      weekday: 'short',
                                      month: 'short',
                                      day: 'numeric',
                                    })}
                                  </span>
                                </h4>
                                <div
                                  className="w-2 h-2 rounded-full"
                                  style={{ background: stay.color }}
                                />
                              </button>
                              <div className="space-y-4 pt-2">
                                {DAY_PARTS.filter((p) => day.enabledParts.includes(p)).map(
                                  (period) => {
                                    const periodVisits = dayVisits.filter(
                                      (v) => v.dayPart === period,
                                    );
                                    const PeriodIcon =
                                      period === 'morning'
                                        ? Sunrise
                                        : period === 'afternoon'
                                          ? Sun
                                          : Moon;
                                    const label =
                                      period === 'morning'
                                        ? 'Morning'
                                        : period === 'afternoon'
                                          ? 'Afternoon'
                                          : 'Evening';
                                    return (
                                      <div
                                        key={period}
                                        className="p-1.5 rounded-xl border bg-muted/40 border-muted/80"
                                      >
                                        <div className="flex items-center gap-1.5 px-2 py-1.5 mb-1">
                                          <PeriodIcon className="w-3 h-3 text-muted-foreground" />
                                          <span className="text-[9px] font-extrabold uppercase tracking-widest text-muted-foreground">
                                            {label}
                                          </span>
                                        </div>
                                        <div className="space-y-2">
                                          {periodVisits.map((v) => (
                                            <button
                                              key={v.id}
                                              onClick={() => {
                                                setSelectedStayId(stay.id);
                                                setSelectedVisitId(v.id);
                                              }}
                                              className="relative w-full text-left pl-[18px] pr-3.5 py-2.5 bg-white rounded-lg border border-border hover:border-primary/30 hover:shadow-sm transition-all group/visit"
                                            >
                                              <div
                                                className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg ${getVisitTypeBg(v.type)}`}
                                              />
                                              <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0 flex-1">
                                                  <div className="flex items-center gap-2 mb-1">
                                                    <Badge
                                                      variant="outline"
                                                      className={`text-[9px] h-auto px-1.5 py-0 font-bold uppercase tracking-tighter ${getVisitTypeColor(v.type)}`}
                                                    >
                                                      {getVisitLabel(v.type)}
                                                    </Badge>
                                                    {v.durationHint && (
                                                      <span className="text-[11px] text-muted-foreground">
                                                        {v.durationHint}
                                                      </span>
                                                    )}
                                                  </div>
                                                  <p className="text-xs font-bold text-foreground truncate group-hover/visit:text-primary transition-colors">
                                                    {v.name}
                                                  </p>
                                                  {v.notes && (
                                                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1 italic">
                                                      {v.notes}
                                                    </p>
                                                  )}
                                                </div>
                                                {v.imageUrl && (
                                                  <div className="size-9 rounded-md overflow-hidden flex-shrink-0 border border-border">
                                                    <img
                                                      src={v.imageUrl}
                                                      alt=""
                                                      className="w-full h-full object-cover"
                                                      loading="lazy"
                                                    />
                                                  </div>
                                                )}
                                              </div>
                                            </button>
                                          ))}
                                          {periodVisits.length === 0 && (
                                            <div className="h-8 border-2 border-dashed border-border rounded-lg flex items-center justify-center">
                                              <span className="text-[9px] text-muted-foreground">
                                                Empty
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  },
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </>
              )}
            </div>

            {/* Map — Collapsed tab */}
            {mapCollapsed && !mapExpanded && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => {
                      setMapCollapsed(false);
                      triggerMapAnim('map-anim-reveal');
                    }}
                    className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-30 items-center gap-1 px-1.5 py-3 bg-white border border-r-0 border-border rounded-l-xl shadow-lg hover:bg-muted transition-colors"
                    aria-label="Show map"
                  >
                    <PanelRightOpen className="w-4 h-4 text-muted-foreground" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left">Show map</TooltipContent>
              </Tooltip>
            )}

            {/* Map — Floating Panel */}
            <aside
              ref={mapPanelRef}
              className={`map-panel-container hidden md:flex flex-col overflow-hidden z-30 bg-white ${mapAnimClass} ${
                mapCollapsed && !mapExpanded
                  ? 'absolute pointer-events-none'
                  : mapExpanded
                    ? 'absolute rounded-none'
                    : 'absolute rounded-2xl shadow-[0_0_50px_-12px_rgba(0,0,0,0.25)] border border-border/60'
              }`}
              style={
                mapCollapsed && !mapExpanded
                  ? { top: 16, bottom: 16, right: -mapWidth, width: mapWidth, opacity: 0 }
                  : mapExpanded
                    ? { top: 0, bottom: 0, right: 0, left: 0 }
                    : mapMini
                      ? {
                          bottom: 16,
                          right: 16,
                          width: 'clamp(320px, 40vw, 800px)',
                          height: 'clamp(240px, 35vh, 600px)',
                        }
                      : { top: 16, bottom: 16, right: 16, width: mapWidth }
              }
            >
              {/* Resize handle — left edge */}
              {!mapExpanded && !mapCollapsed && !mapMini && (
                <div
                  onMouseDown={startMapResize}
                  className="absolute left-0 top-0 bottom-0 w-3 -ml-1.5 cursor-col-resize z-50 group flex items-center justify-center"
                  title="Drag to resize"
                >
                  <div className="w-1 h-8 rounded-full bg-muted-foreground/30 group-hover:bg-primary/50 group-hover:h-12 transition-all motion-reduce:transition-none" />
                </div>
              )}
              {/* Map panel header */}
              <div
                className={`${mapMini ? 'h-9 px-2.5' : 'h-11 px-4'} border-b border-border flex items-center gap-3 bg-white/80 backdrop-blur-md flex-shrink-0`}
              >
                {/* Left: mode icon + title */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="size-5 bg-primary/10 rounded-md flex items-center justify-center">
                    <MapPin className="w-3 h-3 text-primary" />
                  </div>
                  {!mapMini && (
                    <span className="text-[11px] font-extrabold text-foreground tracking-tight uppercase">
                      {mapMode === 'overview'
                        ? 'Overview'
                        : mapMode === 'stay'
                          ? 'All spots'
                          : 'Day route'}
                    </span>
                  )}
                </div>
                {/* Middle: day filter pills — scrollable, only in detail mode */}
                <div className="flex-1 overflow-x-auto scroll-hide min-w-0">
                  {!mapMini &&
                    (mapMode === 'stay' || mapMode === 'detail') &&
                    dayFilterOptions.length >= 2 && (
                      <DayFilterPills
                        options={dayFilterOptions}
                        selectedDayOffset={mapDayFilter}
                        onChange={(d) => {
                          setMapDayFilter(d);
                          setMapMode(d !== null ? 'detail' : 'stay');
                        }}
                      />
                    )}
                </div>
                {/* Right: action buttons */}
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  {!mapMini && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          aria-label={
                            mapMode === 'overview' ? 'Show stay spots' : 'Show trip overview'
                          }
                          onClick={() => {
                            if (mapMode === 'overview') {
                              // Re-select first stay to go back to stay mode
                              if (sortedStays.length > 0) setSelectedStayId(sortedStays[0].id);
                              setMapMode('stay');
                            } else {
                              setSelectedStayId('');
                              setMapMode('overview');
                              setMapDayFilter(null);
                            }
                          }}
                          className={`p-1.5 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-primary/50 ${
                            mapMode === 'overview'
                              ? 'text-primary bg-primary/10'
                              : 'text-muted-foreground hover:text-primary hover:bg-muted'
                          }`}
                        >
                          <Layers className="w-4 h-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {mapMode === 'overview' ? 'Show stay spots' : 'Show trip overview'}
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {/* Mini / restore toggle */}
                  {!mapExpanded && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => {
                            triggerMapAnim(mapMini ? 'map-anim-restore' : 'map-anim-mini');
                            setMapMini((m) => !m);
                          }}
                          aria-label={mapMini ? 'Restore map' : 'Shrink map'}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted transition-colors focus-visible:ring-2 focus-visible:ring-primary/50"
                        >
                          {mapMini ? (
                            <Expand className="w-4 h-4" />
                          ) : (
                            <Shrink className="w-4 h-4" />
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{mapMini ? 'Restore map' : 'Shrink map'}</TooltipContent>
                    </Tooltip>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => {
                          triggerMapAnim(mapExpanded ? 'map-anim-shrink' : 'map-anim-expand');
                          setMapExpanded(!mapExpanded);
                          if (mapMini) setMapMini(false);
                        }}
                        aria-label={mapExpanded ? 'Exit fullscreen' : 'Fullscreen map'}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted transition-colors focus-visible:ring-2 focus-visible:ring-primary/50"
                      >
                        {mapExpanded ? (
                          <Minimize2 className="w-4 h-4" />
                        ) : (
                          <Maximize2 className="w-4 h-4" />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {mapExpanded ? 'Exit fullscreen' : 'Fullscreen map'}
                    </TooltipContent>
                  </Tooltip>
                  {!mapExpanded && !mapMini && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => {
                            triggerMapAnim('map-anim-collapse');
                            setTimeout(() => setMapCollapsed(true), 350);
                          }}
                          aria-label="Hide map"
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted transition-colors focus-visible:ring-2 focus-visible:ring-primary/50"
                        >
                          <PanelRightClose className="w-4 h-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Hide map</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-hidden relative">
                {mapMode === 'overview' ||
                mapMode === 'stay' ||
                mapVisits.length > 0 ||
                mapDayFilter !== null ? (
                  <TripMap
                    data={{
                      visits: mapVisits,
                      stay: mapMode !== 'overview' ? selectedStay : null,
                      overviewStays,
                      overviewCandidates: trip.candidateStays.map((c) => ({
                        id: c.id,
                        name: c.name,
                        color: c.color,
                        centerLat: c.centerLat,
                        centerLng: c.centerLng,
                      })),
                    }}
                    selection={{
                      selectedVisitId: mapMode !== 'overview' ? selectedVisitId : null,
                      highlightedVisitId: mapMode !== 'overview' ? hoveredVisitId : null,
                      selectedDayOffset: mapDayFilter,
                      highlightedStayId: mapMode === 'overview' ? hoveredStayId : null,
                      highlightedCandidateId: selectedCandidateId,
                    }}
                    mode={mapMode}
                    expanded={mapExpanded}
                    callbacks={{
                      onSelectVisit: (id) => setSelectedVisitId(id),
                      onSelectStay: (stayId) => setSelectedStayId(stayId),
                      onSelectCandidate: (id) => setSelectedCandidateId(id),
                      onBackToOverview: () => {
                        setSelectedStayId('');
                        setMapMode('overview');
                        setMapDayFilter(null);
                      },
                    }}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted">
                    <div className="text-center text-muted-foreground">
                      <MapPin className="w-10 h-10 mx-auto mb-2 opacity-20" />
                      <p className="text-xs font-medium">Schedule activities to see the map</p>
                    </div>
                  </div>
                )}

                {selectedVisitId &&
                  (() => {
                    const visit = mapVisits.find((v) => v.id === selectedVisitId);
                    if (!visit) return null;
                    return (
                      <div className="absolute bottom-5 left-5 right-5 z-20 pointer-events-none">
                        <div className="bg-white/95 backdrop-blur-xl p-4 rounded-xl shadow-2xl border border-primary/20 flex gap-3 pointer-events-auto">
                          <div
                            className={`size-10 rounded-lg flex items-center justify-center flex-shrink-0 border ${getVisitTypeColor(visit.type)}`}
                          >
                            {getVisitTypeIcon(visit.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                              <div>
                                {visit.dayOffset !== null && visit.dayPart && (
                                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide mb-0.5">
                                    {visit.dayPart === 'morning'
                                      ? 'Morning'
                                      : visit.dayPart === 'afternoon'
                                        ? 'Afternoon'
                                        : 'Evening'}
                                    , Day {(visit.dayOffset ?? 0) + 1}
                                  </p>
                                )}
                                <h5 className="text-sm font-extrabold text-foreground truncate">
                                  {visit.name}
                                </h5>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => setSelectedVisitId(null)}
                                className="text-muted-foreground hover:text-foreground flex-shrink-0 ml-2"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                            <div className="flex gap-2 mt-2 flex-wrap">
                              <span
                                className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${getVisitTypeColor(visit.type)}`}
                              >
                                {getVisitLabel(visit.type).toUpperCase()}
                              </span>
                              {selectedStay && (
                                <span className="text-[9px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-md border border-border">
                                  {haversineKm(
                                    selectedStay.centerLat,
                                    selectedStay.centerLng,
                                    visit.lat,
                                    visit.lng,
                                  ).toFixed(1)}{' '}
                                  km from hotel
                                </span>
                              )}
                              {visit.durationHint && (
                                <span className="text-[9px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-md border border-border">
                                  {visit.durationHint}
                                </span>
                              )}
                              <Button
                                variant="outline"
                                size="xs"
                                onClick={() => setEditingVisit(visit)}
                                className="text-[9px] font-bold text-muted-foreground bg-muted border-border hover:border-primary/40 hover:text-primary"
                              >
                                <Pencil className="w-2.5 h-2.5" /> Edit
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
              </div>

              {/* Map panel footer */}
              <div className="px-5 py-3 bg-white/80 backdrop-blur-md border-t border-border flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div
                    className={`size-8 rounded-full flex items-center justify-center flex-shrink-0 ${mapMode === 'overview' ? 'bg-foreground' : 'bg-primary'}`}
                  >
                    <Navigation className="text-white w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">
                      {mapMode === 'overview' ? 'Trip Route' : 'Active Route'}
                    </span>
                    <span className="text-xs font-extrabold text-foreground">
                      {mapMode === 'overview'
                        ? `${sortedStays.length} destinations`
                        : selectedStay
                          ? mapDayFilter !== null
                            ? `${selectedStay.name} · Day ${String(mapDayFilter + 1).padStart(2, '0')}`
                            : `${selectedStay.name} · All Days`
                          : 'No stay selected'}
                    </span>
                  </div>
                </div>
                <div className="text-right font-num">
                  {mapMode === 'overview' ? (
                    <>
                      <span className="text-xs font-black text-foreground">
                        {(() => {
                          let totalKm = 0;
                          for (let i = 0; i < sortedStays.length - 1; i++) {
                            totalKm += haversineKm(
                              sortedStays[i].centerLat,
                              sortedStays[i].centerLng,
                              sortedStays[i + 1].centerLat,
                              sortedStays[i + 1].centerLng,
                            );
                          }
                          return `${totalKm.toFixed(0)} km`;
                        })()}
                      </span>
                      <p className="text-[9px] font-bold text-muted-foreground">
                        {sortedStays.length} cities
                      </p>
                    </>
                  ) : (
                    <>
                      <span className="text-xs font-black text-foreground">
                        {selectedStay
                          ? (() => {
                              let totalKm = 0;
                              for (let i = 1; i < mapVisits.length; i++) {
                                totalKm += haversineKm(
                                  mapVisits[i - 1].lat,
                                  mapVisits[i - 1].lng,
                                  mapVisits[i].lat,
                                  mapVisits[i].lng,
                                );
                              }
                              return `${totalKm.toFixed(1)} km`;
                            })()
                          : '—'}
                      </span>
                      <p className="text-[9px] font-bold text-muted-foreground">
                        {mapVisits.length} stops
                      </p>
                    </>
                  )}
                </div>
              </div>
            </aside>
          </section>
        </main>

        {/* ── Footer ── */}
        <footer className="hidden md:flex bg-white text-muted-foreground px-6 py-1.5 text-[11px] font-bold justify-between items-center border-t border-border-neutral flex-shrink-0">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div
                className={`size-1.5 rounded-full ${
                  syncStatus === 'saved'
                    ? 'bg-success'
                    : syncStatus === 'saving'
                      ? 'bg-warning animate-pulse'
                      : syncStatus === 'error'
                        ? 'bg-destructive'
                        : 'bg-muted-foreground'
                }`}
              />
              <span className="uppercase tracking-widest text-muted-foreground">
                {syncStatus === 'saved'
                  ? 'Synced'
                  : syncStatus === 'saving'
                    ? 'Saving…'
                    : syncStatus === 'error'
                      ? 'Sync error'
                      : 'Local only'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Database className="w-3 h-3" />
              <span className="uppercase tracking-widest truncate max-w-[200px]">{trip.name}</span>
            </div>
          </div>
          <div className="flex items-center gap-4 tracking-widest text-muted-foreground">
            <span>
              {trip.totalDays} DAYS · {sortedStays.length} STAYS
            </span>
          </div>
        </footer>

        {/* ── Drag overlay ── */}
        <DragOverlay>
          {(activeInboxVisit ?? activeScheduledVisit) &&
            (() => {
              const v = activeInboxVisit ?? activeScheduledVisit!;
              return (
                <div className="p-3 bg-white rounded-lg border border-primary shadow-xl opacity-90 w-56 pointer-events-none">
                  <p className="text-xs font-bold text-foreground">{v.name}</p>
                </div>
              );
            })()}
        </DragOverlay>

        {/* ── Modals ── */}

        {/* Route editor */}
        {editingRouteStay && editingRouteNextStay && (
          <RouteEditorModal
            route={trip.routes.find((r) => r.fromStayId === editingRouteStay.id) ?? null}
            fromStayName={editingRouteStay.name}
            toStayName={editingRouteNextStay.name}
            onClose={() => setEditingRouteStayId(null)}
            onSave={(mode, duration, notes) => {
              setTrip((t) => {
                const existingRoute = t.routes.find((r) => r.fromStayId === editingRouteStay.id);
                if (existingRoute) {
                  return {
                    ...t,
                    routes: t.routes.map((r) =>
                      r.fromStayId === editingRouteStay.id ? { ...r, mode, duration, notes } : r,
                    ),
                  };
                }
                return {
                  ...t,
                  routes: [
                    ...t.routes,
                    {
                      fromStayId: editingRouteStay.id,
                      toStayId: editingRouteNextStay.id,
                      mode,
                      duration,
                      notes,
                    },
                  ],
                };
              });
            }}
          />
        )}

        {/* Stay editor */}
        {editingStayId &&
          (() => {
            const stay = trip.stays.find((s) => s.id === editingStayId);
            if (!stay) return null;
            return (
              <StayEditorModal
                stay={stay}
                visitCount={trip.visits.filter((v) => v.stayId === editingStayId).length}
                onClose={() => setEditingStayId(null)}
                onSave={(updates) => {
                  setTrip((t) => ({
                    ...t,
                    stays: t.stays.map((s) => (s.id === editingStayId ? { ...s, ...updates } : s)),
                  }));
                }}
                onDelete={() => {
                  setTrip((t) => ({
                    ...t,
                    stays: t.stays.filter((s) => s.id !== editingStayId),
                    visits: t.visits.filter((v) => v.stayId !== editingStayId),
                    routes: t.routes.filter(
                      (r) => r.fromStayId !== editingStayId && r.toStayId !== editingStayId,
                    ),
                  }));
                  setSelectedStayId(trip.stays[0]?.id ?? '');
                }}
                onDemote={() => {
                  setTrip((t) => demoteStay(t, editingStayId!));
                  if (selectedStayId === editingStayId) {
                    setSelectedStayId('');
                  }
                }}
              />
            );
          })()}

        {/* Add stay */}
        {(addingStay || addingCandidate) && (
          <AddStayModal
            mode={addingCandidate ? 'candidate' : 'schedule'}
            candidates={trip.candidateStays}
            initialCandidateId={promotingCandidateId ?? undefined}
            onClose={() => {
              setAddingStay(false);
              setAddingCandidate(false);
              setPendingTimelineSlot(null);
              setPromotingCandidateId(null);
            }}
            stayColor={STAY_COLORS[trip.stays.length % STAY_COLORS.length]}
            initialDays={pendingTimelineSlot?.days}
            existingStayCoords={trip.stays
              .filter((s) => s.centerLat != null && s.centerLng != null)
              .map((s) => ({ lat: s.centerLat, lng: s.centerLng }))}
            onSave={({ name, days, lat, lng }) => {
              const startSlot =
                pendingTimelineSlot?.startSlot ??
                (sortedStays.length > 0 ? sortedStays[sortedStays.length - 1].endSlot : 0);
              const newStay: Stay = {
                id: `stay-${Date.now()}`,
                name,
                color: STAY_COLORS[trip.stays.length % STAY_COLORS.length],
                startSlot,
                endSlot: Math.min(startSlot + days * 3, trip.totalDays * 3),
                centerLat: lat ?? jitter(35.6762, 5),
                centerLng: lng ?? jitter(139.6503, 5),
              };
              setTrip((t) => ({ ...t, stays: [...t.stays, newStay] }));
              setSelectedStayId(newStay.id);
              setAddingStay(false);
              setPendingTimelineSlot(null);
            }}
            onSavePromote={({ candidateId, days }) => {
              const startSlot =
                pendingTimelineSlot?.startSlot ??
                (sortedStays.length > 0 ? sortedStays[sortedStays.length - 1].endSlot : 0);
              const endSlot = Math.min(startSlot + days * 3, trip.totalDays * 3);
              setTrip((t) => promoteCandidateStay(t, candidateId, startSlot, endSlot));
              setSelectedStayId(candidateId);
              if (selectedCandidateId === candidateId) {
                setSelectedCandidateId(null);
              }
              setAddingStay(false);
              setPendingTimelineSlot(null);
              setPromotingCandidateId(null);
            }}
            onSaveCandidate={({ name, lat, lng }) => {
              const newCandidate: Stay = {
                id: `stay-${Date.now()}`,
                name,
                color:
                  STAY_COLORS[
                    (trip.stays.length + trip.candidateStays.length) % STAY_COLORS.length
                  ],
                startSlot: 0,
                endSlot: 0,
                centerLat: lat ?? jitter(35.6762, 5),
                centerLng: lng ?? jitter(139.6503, 5),
              };
              setTrip((t) => ({
                ...t,
                candidateStays: [...t.candidateStays, newCandidate],
              }));
              setAddingCandidate(false);
              setAddingStay(false);
            }}
          />
        )}

        {/* Edit / Add accommodation */}
        {editingAccommodation &&
          selectedStay &&
          (() => {
            const isGroup = 'group' in editingAccommodation;
            const group = isGroup ? editingAccommodation.group : undefined;
            const dayOffset = isGroup
              ? editingAccommodation.group.startDayOffset
              : editingAccommodation.dayOffset;
            const nightCount = group ? group.nights : 1;
            const initial = group ? group.accommodation : undefined;
            const initialNights = Array.from({ length: nightCount }, (_, i) => dayOffset + i);
            const allNights = stayDays
              .filter((d) => d.hasNight)
              .map((d) => ({ dayOffset: d.dayOffset, date: d.date }));

            const handleSave = (accom: NightAccommodation, newNights: number[]) => {
              setTrip((curr) => ({
                ...curr,
                stays: curr.stays.map((s) => {
                  if (s.id !== selectedStay.id) return s;
                  const updated = { ...s.nightAccommodations };
                  // Remove from nights that were in the old group but not the new selection
                  for (const n of initialNights) {
                    if (!newNights.includes(n)) delete updated[n];
                  }
                  // Apply to newly selected nights
                  for (const n of newNights) {
                    updated[n] = accom;
                  }
                  return {
                    ...s,
                    nightAccommodations: Object.keys(updated).length > 0 ? updated : undefined,
                  };
                }),
              }));
            };

            const handleRemove = group
              ? () => {
                  setTrip((curr) => ({
                    ...curr,
                    stays: curr.stays.map((s) => {
                      if (s.id !== selectedStay.id) return s;
                      const updated = { ...s.nightAccommodations };
                      for (let i = 0; i < nightCount; i++) {
                        delete updated[dayOffset + i];
                      }
                      return {
                        ...s,
                        nightAccommodations: Object.keys(updated).length > 0 ? updated : undefined,
                      };
                    }),
                  }));
                }
              : undefined;

            return (
              <AccommodationEditorModal
                initial={initial}
                allNights={allNights}
                initialNights={initialNights}
                existingNames={existingAccommodationNames}
                onClose={() => setEditingAccommodation(null)}
                onSave={handleSave}
                onRemove={handleRemove}
              />
            );
          })()}

        {/* Add visit to inbox */}
        {addingToInbox && selectedStay && (
          <VisitFormModal
            title={`Add Place to ${selectedStay.name}`}
            onClose={() => setAddingToInbox(false)}
            onSave={({ name, type, durationHint, lat, lng }) => {
              setTrip((t) => ({
                ...t,
                visits: [
                  ...t.visits,
                  createVisit(
                    `visit-${Date.now()}`,
                    name,
                    type,
                    selectedStay.id,
                    lat ?? jitter(selectedStay.centerLat, 0.08),
                    lng ?? jitter(selectedStay.centerLng, 0.08),
                    null,
                    null,
                    t.visits.filter(
                      (v) =>
                        v.stayId === selectedStay.id &&
                        (v.dayOffset === null || v.dayPart === null),
                    ).length,
                    durationHint || undefined,
                  ),
                ],
              }));
            }}
            stayCenter={{ lat: selectedStay.centerLat, lng: selectedStay.centerLng }}
          />
        )}

        {/* Add visit to slot */}
        {addingVisitToSlot && selectedStay && (
          <VisitFormModal
            title={`Add to Day ${addingVisitToSlot.dayOffset + 1} · ${addingVisitToSlot.part}`}
            onClose={() => setAddingVisitToSlot(null)}
            onSave={({ name, type, durationHint, notes, lat, lng }) => {
              const { dayOffset, part } = addingVisitToSlot;
              setTrip((t) => {
                const bucketSize = t.visits.filter(
                  (v) =>
                    v.stayId === selectedStay.id && v.dayOffset === dayOffset && v.dayPart === part,
                ).length;
                return {
                  ...t,
                  visits: [
                    ...t.visits,
                    {
                      ...createVisit(
                        `visit-${Date.now()}`,
                        name,
                        type,
                        selectedStay.id,
                        lat ?? jitter(selectedStay.centerLat, 0.05),
                        lng ?? jitter(selectedStay.centerLng, 0.05),
                        dayOffset,
                        part,
                        bucketSize,
                        durationHint || undefined,
                      ),
                      notes,
                    },
                  ],
                };
              });
            }}
            stayCenter={{ lat: selectedStay.centerLat, lng: selectedStay.centerLng }}
          />
        )}

        {/* Edit visit */}
        {editingVisit && selectedStay && (
          <VisitFormModal
            title="Edit Place"
            initial={editingVisit}
            onClose={() => setEditingVisit(null)}
            onSave={({ name, type, durationHint, notes, checklist, links }) => {
              setTrip((t) => ({
                ...t,
                visits: t.visits.map((v) =>
                  v.id === editingVisit.id
                    ? {
                        ...v,
                        name,
                        type,
                        durationHint: durationHint || undefined,
                        notes,
                        checklist: checklist.length > 0 ? checklist : undefined,
                        links: links.length > 0 ? links : undefined,
                      }
                    : v,
                ),
              }));
            }}
            onDelete={() => {
              setTrip((t) => ({
                ...t,
                visits: normalizeVisitOrders(t.visits.filter((v) => v.id !== editingVisit.id)),
              }));
              setEditingVisit(null);
            }}
            onUnschedule={
              editingVisit.dayOffset !== null
                ? () => scheduleVisit(editingVisit.id, null, null)
                : undefined
            }
            currentStayId={selectedStay.id}
            availableStays={sortedStays.map((s) => ({ id: s.id, name: s.name, color: s.color }))}
            onMoveToStay={(targetStayId) => {
              setTrip((t) => ({
                ...t,
                visits: t.visits.map((v) =>
                  v.id === editingVisit!.id
                    ? {
                        ...v,
                        stayId: targetStayId,
                        dayOffset: null,
                        dayPart: null,
                        order: t.visits.filter((vv) => vv.stayId === targetStayId).length,
                      }
                    : v,
                ),
              }));
              setEditingVisit(null);
            }}
            stayCenter={{ lat: selectedStay.centerLat, lng: selectedStay.centerLng }}
          />
        )}

        {/* Trip editor */}
        {showTripEditor && (
          <TripEditorModal
            trip={trip}
            onClose={() => setShowTripEditor(false)}
            onSave={(updates) => setTrip((t) => ({ ...t, ...updates }))}
            onDelete={() => {
              if (store.trips.length > 1) {
                setStore((s) => {
                  const remaining = s.trips.filter((t) => t.id !== trip.id);
                  const next = { trips: remaining, activeTripId: remaining[0].id };
                  saveStore(next);
                  return next;
                });
                setSelectedStayId('');
              } else {
                handleGoHome();
              }
              setShowTripEditor(false);
            }}
          />
        )}

        {/* Trip switcher */}
        {showTripSwitcher && (
          <TripSwitcherPanel
            store={store}
            onSwitch={handleSwitchTrip}
            onNew={handleNewTrip}
            onClose={() => setShowTripSwitcher(false)}
            notifyReversible={notifyReversible}
          />
        )}

        {/* History */}
        {showHistory && (
          <HistoryPanel
            history={hist.history}
            index={hist.historyIndex}
            onNavigate={(i) => {
              const snap = hist.history[i];
              if (snap) updateTrip(() => snap.trip);
            }}
            onClose={() => setShowHistory(false)}
            notifyReversible={notifyReversible}
          />
        )}

        {/* AI Planner */}
        {showAIPlanner && (
          <AIPlannerModal
            trip={trip}
            settings={aiSettings}
            onSettingsChange={(s) => {
              setAiSettings(s);
              localStorage.setItem('chronos-ai-settings', JSON.stringify(s));
            }}
            onClose={() => setShowAIPlanner(false)}
            onApply={(result) => {
              updateTrip((t) => ({
                ...t,
                stays: result.stays,
                visits: result.visits,
                routes: result.routes,
              }));
            }}
          />
        )}

        {/* Cloud merge dialog */}
        {pendingMerge && (
          <MergeDialog
            localCount={store.trips.length}
            cloudCount={pendingMerge.allCloudTrips.length}
            mergeCount={store.trips.length + pendingMerge.cloudTrips.length}
            localTripNames={store.trips.map((t) => t.name)}
            cloudTripNames={pendingMerge.allCloudTrips.map((t) => t.name)}
            onMerge={() => handleMergeDecision('merge')}
            onKeepLocal={() => handleMergeDecision('keep-local')}
            onUseCloud={() => handleMergeDecision('use-cloud')}
            onDismiss={dismissMerge}
          />
        )}

        {remoteUpdateToast && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-popover border border-border rounded-xl shadow-lg px-4 py-3 text-sm">
            <span className="text-foreground">
              <strong>"{remoteUpdateToast.tripName}"</strong> was updated on another device.
            </span>
            <button
              onClick={dismissRemoteToast}
              className="text-muted-foreground hover:text-foreground text-xs font-medium"
            >
              Dismiss
            </button>
          </div>
        )}

        {showImportCode && (
          <ImportFromCodeDialog
            onImport={handleImportFromCode}
            onClose={() => setShowImportCode(false)}
          />
        )}

        {showShareTrip &&
          (user ? (
            <ShareTripDialog
              shareCode={trip.shareCode}
              status={shareCodeState.status}
              error={shareCodeState.error}
              onCreateCode={handleCreateShareCode}
              onPushUpdate={handlePushUpdate}
              onRevoke={handleRevoke}
              onClose={() => setShowShareTrip(false)}
            />
          ) : (
            <AuthModalSimple onClose={() => setShowShareTrip(false)} />
          ))}

        {showPullConfirm && (
          <Dialog
            open
            onOpenChange={(open) => {
              if (!open) setShowPullConfirm(false);
            }}
          >
            <DialogContent className="sm:max-w-sm p-5">
              <DialogDescription className="sr-only">
                Pull latest version of this trip
              </DialogDescription>
              <DialogHeader>
                <DialogTitle className="font-extrabold text-foreground text-sm">
                  Pull latest version?
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  This will replace your current trip data with the latest version from the shared
                  code.
                </p>
              </DialogHeader>
              <div className="flex gap-2 mt-3">
                <Button
                  variant="outline"
                  onClick={() => setShowPullConfirm(false)}
                  className="flex-1 text-xs font-semibold"
                >
                  Cancel
                </Button>
                <Button onClick={handlePullLatest} className="flex-1 text-xs font-bold">
                  Pull latest
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </DndContext>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <ChronosErrorBoundary>
      <AuthProvider>
        <TooltipProvider delayDuration={300}>
          <ChronosApp />
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </ChronosErrorBoundary>
  );
}
