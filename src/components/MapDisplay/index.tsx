import { useEffect, useMemo, useCallback, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, ZoomControl } from 'react-leaflet';
import { Paper, Group, Checkbox, Select, Button, Text, Box, Badge } from '@mantine/core';
import { Location, Route, TRANSPORT_COLORS, TRANSPORT_LABELS, Day, TransportType } from '../../types';
import { getSectionIndex } from '../../constants/daySection';
import L from 'leaflet';

import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

import { createAccommodationIcon } from './markerFactories';
import { ClusteredLocationMarkers } from './ClusteredLocationMarkers';
import { RouteSegment, PathPoint } from './RouteSegment';
import { useRouteGeometry } from '../../hooks/useRouteGeometry';

type BasemapMode = 'local' | 'english';

const MAP_BASEMAP_STORAGE_KEY = 'itinerary-map-basemap';

const BASEMAPS: Record<BasemapMode, { url: string; attribution: string }> = {
  local: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; CARTO',
  },
  english: {
    // ArcGIS world street tiles are generally English/romanized-first.
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom, 2012',
  },
};

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapDisplayProps {
  days: Day[];
  locations: Location[];
  routes: Route[];
  onEditRoute: (fromId: string, toId: string) => void;
  hoveredLocationId?: string | null;
  selectedLocationId?: string | null;
  onHoverLocation?: (id: string | null) => void;
  onSelectLocation?: (id: string | null) => void;
  hideControls?: boolean;
  isSubItinerary?: boolean;
  isPanelCollapsed?: boolean;
  allLocations?: Location[];
  activeParent?: Location | null;
  selectedDayId?: string | null;
}

function SelectedLocationHandler({ selectedId, locations, isPanelCollapsed }: { selectedId?: string | null, locations: Location[], isPanelCollapsed?: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (selectedId) {
      const loc = locations.find(l => l.id === selectedId);
      if (loc) {
        const currentZoom = map.getZoom();
        let offset = 0;
        const width = window.innerWidth;
        if (width > 768) {
          const leftPanel = document.querySelector('.floating-sidebar-container') as HTMLElement | null;
          const rightPanel = !isPanelCollapsed
            ? document.querySelector('.location-detail-panel-root') as HTMLElement | null
            : null;

          const leftOcclusion = leftPanel ? Math.max(0, leftPanel.getBoundingClientRect().right) : 0;
          const rightOcclusion = rightPanel ? Math.max(0, width - rightPanel.getBoundingClientRect().left) : 0;
          offset = (rightOcclusion - leftOcclusion) / 2;
        }
        const targetPoint = map.project([loc.lat, loc.lng], currentZoom);
        const actualPoint = L.point(targetPoint.x + offset, targetPoint.y);
        const targetLatLng = map.unproject(actualPoint, currentZoom);
        map.flyTo(targetLatLng, currentZoom, { animate: true, duration: 0.8 });
      }
    }
  }, [selectedId, locations, map, isPanelCollapsed]);
  return null;
}

function MapClickHandler({ onSelect, isDrillDown }: { onSelect?: (id: string | null) => void, isDrillDown?: boolean }) {
  useMapEvents({ click: () => { if (!isDrillDown) onSelect?.(null); } });
  return null;
}

function FitBounds({ locations, accommodations }: { locations: Location[], accommodations?: { lat: number, lng: number }[] }) {
  const map = useMap();
  useEffect(() => {
    const points: [number, number][] = locations.map(l => [l.lat, l.lng]);
    if (accommodations) accommodations.forEach(a => points.push([a.lat, a.lng]));
    if (points.length > 0) map.fitBounds(L.latLngBounds(points), { padding: [50, 50] });
  }, [locations, accommodations, map]);
  return null;
}

const containsLocation = (parent: Location, targetId: string): boolean => {
  if (parent.id === targetId) return true;
  return parent.subLocations?.some(sub => containsLocation(sub, targetId)) || false;
};

export default function MapDisplay({ days, locations, routes, onEditRoute, hoveredLocationId, selectedLocationId, onHoverLocation, onSelectLocation, hideControls, isSubItinerary, isPanelCollapsed, allLocations, activeParent, selectedDayId }: MapDisplayProps) {
  const position: [number, number] = [51.505, -0.09];
  const [showRouteArrows, setShowRouteArrows] = useState(true);
  const [enableMapGrouping, setEnableMapGrouping] = useState(false);
  const [showRouteLegend, setShowRouteLegend] = useState(true);
  const [basemapMode, setBasemapMode] = useState<BasemapMode>(() => {
    if (typeof window === 'undefined') return 'local';
    const saved = window.localStorage.getItem(MAP_BASEMAP_STORAGE_KEY);
    return saved === 'english' ? 'english' : 'local';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(MAP_BASEMAP_STORAGE_KEY, basemapMode);
  }, [basemapMode]);

  const getAbsDayIdx = useCallback((loc: Location): number => {
    if (activeParent && loc.dayOffset !== undefined) {
      const pIdx = days.findIndex(d => d.id === activeParent.startDayId);
      if (pIdx !== -1) return pIdx + loc.dayOffset;
    }
    if (loc.startDayId) return days.findIndex(d => d.id === loc.startDayId);
    return -1;
  }, [days, activeParent]);

  const sortedLocations = useMemo(() => {
    return [...locations].sort((a, b) => {
      const idxA = getAbsDayIdx(a), idxB = getAbsDayIdx(b);
      if (idxA !== idxB) return idxA - idxB;
      const slotA = getSectionIndex(a.startSlot), slotB = getSectionIndex(b.startSlot);
      if (slotA !== slotB) return slotA - slotB;
      return a.order - b.order;
    });
  }, [locations, getAbsDayIdx]);

  const hasActivityOnDay = useCallback((gIdx: number) => {
    const source = activeParent?.subLocations || (isSubItinerary ? [] : allLocations) || [];
    return source.some(l => getAbsDayIdx(l) === gIdx);
  }, [activeParent, isSubItinerary, allLocations, getAbsDayIdx]);

  const isEveningOccupied = useCallback((gIdx: number) => {
    if (!allLocations || gIdx < 0) return false;
    const targetRow = gIdx * 3 + 2;
    return allLocations.some(l => {
      if (activeParent && containsLocation(l, activeParent.id)) return false;
      const lIdx = days.findIndex(d => d.id === l.startDayId);
      if (lIdx === -1) return false;
      const start = lIdx * 3 + getSectionIndex(l.startSlot);
      const end = start + (l.duration || 1) - 1;
      return targetRow >= start && targetRow <= end;
    });
  }, [allLocations, days, activeParent]);

  const pathPoints = useMemo(() => {
    const points: PathPoint[] = [];
    sortedLocations.forEach(loc => {
      const gIdx = getAbsDayIdx(loc);
      if (gIdx !== -1) {
        points.push({
          id: loc.id,
          name: loc.name,
          lat: loc.lat,
          lng: loc.lng,
          isAccommodation: false,
          sortValue: gIdx * 100 + getSectionIndex(loc.startSlot) * 30 + (loc.order * 0.001),
        });
      }

    });

    const focusedGIdx = selectedDayId ? days.findIndex(d => d.id === selectedDayId) : -1;
    if (focusedGIdx !== -1) {
      days.forEach((day, gIdx) => {
        if (!day.accommodation?.lat) return;
        let show = false;
        if (gIdx === focusedGIdx - 1) {
          const pStart = activeParent ? days.findIndex(d => d.id === activeParent.startDayId) : 0;
          if (gIdx >= pStart && hasActivityOnDay(focusedGIdx)) show = true;
        }
        if (gIdx === focusedGIdx) {
          if (hasActivityOnDay(gIdx) && !isEveningOccupied(gIdx)) show = true;
        }
        if (show && day.accommodation.lat !== undefined && day.accommodation.lng !== undefined) {
          points.push({
            id: `path-acc-${gIdx === focusedGIdx ? 'end' : 'start'}-${day.id}`,
            name: day.accommodation.name,
            lat: day.accommodation.lat,
            lng: day.accommodation.lng,
            isAccommodation: true,
            sortValue: gIdx * 100 + 99,
          });
        }
      });
    }
    return points.sort((a, b) => a.sortValue - b.sortValue);
  }, [sortedLocations, days, selectedDayId, getAbsDayIdx, hasActivityOnDay, isEveningOccupied, activeParent]);

  const routeSegments = useMemo(() => {
    if (pathPoints.length < 2) return [];
    const segments: {
      key: string;
      from: PathPoint;
      to: PathPoint;
      route?: Route;
      transportType: TransportType;
    }[] = [];

    for (let i = 0; i < pathPoints.length - 1; i++) {
      const from = pathPoints[i];
      const to = pathPoints[i + 1];
      if (from.lat === to.lat && from.lng === to.lng) continue;
      const route = routes.find(r => (r.fromLocationId === from.id && r.toLocationId === to.id) || (r.fromLocationId === to.id && r.toLocationId === from.id));
      const transportType = (route?.transportType || 'other') as TransportType;
      const key = `${from.id}|${to.id}|${transportType}`;
      segments.push({ key, from, to, route, transportType });
    }

    return segments;
  }, [pathPoints, routes]);

  const focusedDayIdx = selectedDayId ? days.findIndex(day => day.id === selectedDayId) : -1;

  const transportLegendItems = useMemo(() => {
    const transportTypes = new Set<TransportType>();
    routeSegments.forEach(segment => {
      if (segment.route) {
        transportTypes.add(segment.route.transportType);
      } else {
        transportTypes.add('other');
      }
    });
    return Array.from(transportTypes);
  }, [routeSegments]);

  const routeShapes = useRouteGeometry(routeSegments);
  const activeBasemap = BASEMAPS[basemapMode];

  const accommodations = useMemo(() => {
    const focusedGIdx = selectedDayId ? days.findIndex(day => day.id === selectedDayId) : -1;

    let filterStart = 0;
    let filterEnd = days.length - 1;

    if (activeParent) {
      const pStart = days.findIndex(d => d.id === activeParent.startDayId);
      if (pStart !== -1) {
        filterStart = pStart;

        const sSlot = getSectionIndex(activeParent.startSlot);
        const dur = activeParent.duration || 1;
        const absEnd = pStart * 3 + sSlot + dur - 1;

        filterEnd = Math.floor(absEnd / 3);

        if (absEnd % 3 < 2) {
          filterEnd--;
        }
      }
    }

    return days.filter((d, gIdx) => {
      if (!d.accommodation?.lat) return false;

      const inRange = gIdx >= filterStart && gIdx <= filterEnd;

      if (focusedGIdx === -1) {
        return inRange;
      }

      return (gIdx === focusedGIdx || gIdx === focusedGIdx - 1) && inRange;
    }).map(d => ({ id: `accom-${d.id}`, name: d.accommodation!.name, lat: d.accommodation!.lat!, lng: d.accommodation!.lng!, notes: d.accommodation!.notes }));
  }, [days, selectedDayId, activeParent]);

  return (
    <div className="map-container">
      <MapContainer center={position} zoom={13} scrollWheelZoom={true} className="leaflet-container" zoomControl={false}>
        {!hideControls && <ZoomControl position="bottomright" />}
        <TileLayer key={basemapMode} attribution={activeBasemap.attribution} url={activeBasemap.url} />
        {accommodations.map(acc => <Marker key={acc.id} position={[acc.lat, acc.lng]} icon={createAccommodationIcon()}><Popup><strong>{'\u{1F3E8}'} {acc.name}</strong><br />{acc.notes && <span style={{ color: '#6c757d' }}>{acc.notes}</span>}</Popup></Marker>)}
        <ClusteredLocationMarkers
          locations={sortedLocations}
          hoveredLocationId={hoveredLocationId}
          onHoverLocation={onHoverLocation}
          onSelectLocation={onSelectLocation}
          enableGrouping={enableMapGrouping}
        />
        {routeSegments.map(segment => (
          <RouteSegment
            key={`route-${segment.key}`}
            from={segment.from}
            to={segment.to}
            route={segment.route}
            path={routeShapes[segment.key]}
            onEditRoute={() => onEditRoute(segment.from.id, segment.to.id)}
            isHovered={hoveredLocationId === segment.from.id || hoveredLocationId === segment.to.id}
            showArrows={showRouteArrows}
          />
        ))}
        <FitBounds locations={locations} accommodations={accommodations} />
        <SelectedLocationHandler selectedId={selectedLocationId} locations={locations} isPanelCollapsed={isPanelCollapsed} />
        <MapClickHandler onSelect={onSelectLocation} isDrillDown={isSubItinerary} />
      </MapContainer>
      {!hideControls && (
        <Paper
          className="map-route-controls"
          role="region"
          aria-label="Map route controls"
          radius="md"
          p="sm"
          withBorder
          shadow="sm"
          style={{
            position: 'absolute',
            top: 72, // 60px header + 12px margin. Less 'low'.
            right: (selectedLocationId && !isPanelCollapsed) ? 460 : 20,
            transition: 'right 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)',
            zIndex: 1100,
            maxWidth: 'min(500px, calc(100vw - 40px))',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(8px)',
            borderColor: 'var(--mantine-color-neutral-3)',
            boxShadow: '0 8px 30px rgba(0,0,0,0.1)'
          }}
        >
          <Group gap="sm" wrap="wrap">
            <Checkbox
              size="xs"
              label="Route arrows"
              checked={showRouteArrows}
              onChange={event => setShowRouteArrows(event.currentTarget.checked)}
              color="brand"
            />
            <Checkbox
              size="xs"
              label="Marker grouping"
              checked={enableMapGrouping}
              onChange={event => setEnableMapGrouping(event.currentTarget.checked)}
              color="brand"
            />
            <Select
              size="xs"
              data={[
                { value: 'local', label: 'Local Labels' },
                { value: 'english', label: 'English Labels' }
              ]}
              value={basemapMode}
              onChange={val => setBasemapMode((val as BasemapMode) || 'local')}
              allowDeselect={false}
              w={140}
            />
            <Button
              variant="subtle"
              size="compact-xs"
              color="neutral.6"
              onClick={() => setShowRouteLegend(v => !v)}
            >
              {showRouteLegend ? 'Hide Legend' : 'Legend'}
            </Button>
          </Group>

          {focusedDayIdx !== -1 && (
            <Text size="xs" fw={700} c="brand.8" mt="xs">
              Day {focusedDayIdx + 1} selected
            </Text>
          )}

          {showRouteLegend && (
            <Group gap="xs" mt="xs" wrap="wrap">
              {transportLegendItems.length === 0 ? (
                <Text size="xs" c="dimmed">No route segments yet</Text>
              ) : (
                transportLegendItems.map(type => (
                  <Badge
                    key={type}
                    variant="outline"
                    color="neutral.5"
                    size="sm"
                    styles={{
                      root: { paddingLeft: 4, paddingRight: 8, borderColor: 'var(--mantine-color-neutral-3)', backgroundColor: 'var(--mantine-color-neutral-0)' }
                    }}
                    leftSection={
                      <Box
                        w={8}
                        h={8}
                        style={{ borderRadius: '50%', backgroundColor: TRANSPORT_COLORS[type], marginLeft: 4 }}
                      />
                    }
                  >
                    {TRANSPORT_LABELS[type].replace(/^[^\s]+\s/, '')}
                  </Badge>
                ))
              )}
            </Group>
          )}
        </Paper>
      )}
    </div>
  );
}
