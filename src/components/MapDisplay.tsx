import { useEffect, useMemo, useCallback, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents, Tooltip, ZoomControl } from 'react-leaflet';
import { Location, Route, TRANSPORT_COLORS, TRANSPORT_LABELS, Day, DaySection, LocationCategory, CATEGORY_COLORS, TransportType } from '../types';
import L from 'leaflet';
import { Map as SightseeingIcon, Utensils, Bed, Train, Globe, ChevronRight } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { fetchRouteGeometry, LatLngTuple } from '../utils/routing';

// Fix Leaflet default icon issue
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
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
        let offset = 0;
        const width = window.innerWidth;
        if (width > 768 && !isPanelCollapsed) {
          if (width >= 1600) offset = 500 / 2;
          else if (width >= 1200) offset = 450 / 2;
          else offset = 380 / 2;
        }
        const targetPoint = map.project([loc.lat, loc.lng], 16);
        const actualPoint = L.point(targetPoint.x + offset, targetPoint.y);
        const targetLatLng = map.unproject(actualPoint, 16);
        map.setView(targetLatLng, 16, { animate: true, duration: 1 });
      }
    }
  }, [selectedId, locations, map, isPanelCollapsed]);
  return null;
}

function MapClickHandler({ onSelect, isDrillDown }: { onSelect?: (id: string | null) => void, isDrillDown?: boolean }) {
  useMapEvents({ click: () => { if (!isDrillDown) onSelect?.(null); } });
  return null;
}

const CATEGORY_ICONS: Record<LocationCategory, any> = {
  sightseeing: SightseeingIcon, dining: Utensils, hotel: Bed, transit: Train, other: Globe
};

const createIcon = (loc: Location, index: number, isHovered: boolean) => {
  const IconComponent = CATEGORY_ICONS[loc.category || 'sightseeing'];
  const baseColor = CATEGORY_COLORS[loc.category || 'sightseeing'];
  return L.divIcon({
    className: 'custom-marker-wrapper',
    html: `
      <div class="map-marker-container ${isHovered ? 'hovered' : ''}">
        <div class="marker-circle" style="background-color: ${isHovered ? '#0d6efd' : baseColor}">
          ${renderToStaticMarkup(<IconComponent size={12} color="white" />)}
        </div>
        <div class="marker-number">${index + 1}</div>
      </div>
    `,
    iconSize: [30, 30], iconAnchor: [15, 15],
  });
};

const createAccommodationIcon = () => L.divIcon({
  className: 'custom-marker-wrapper accommodation-marker',
  html: `
    <div class="map-marker-container">
      <div class="marker-circle" style="background-color: #6610f2; width: 32px; height: 32px;">
        ${renderToStaticMarkup(<Bed size={16} color="white" />)}
      </div>
    </div>
  `,
  iconSize: [32, 32], iconAnchor: [16, 32],
});

function FitBounds({ locations, accommodations }: { locations: Location[], accommodations?: { lat: number, lng: number }[] }) {
  const map = useMap();
  useEffect(() => {
    const points: [number, number][] = locations.map(l => [l.lat, l.lng]);
    if (accommodations) accommodations.forEach(a => points.push([a.lat, a.lng]));
    if (points.length > 0) map.fitBounds(L.latLngBounds(points), { padding: [50, 50] });
  }, [locations, accommodations, map]);
  return null;
}

const distanceBetween = (a: LatLngTuple, b: LatLngTuple) => {
  const dLat = b[0] - a[0];
  const dLng = b[1] - a[1];
  return Math.sqrt((dLat * dLat) + (dLng * dLng));
};

const getPointAt = (positions: LatLngTuple[], t: number): LatLngTuple => {
  if (positions.length === 0) return [0, 0];
  if (positions.length === 1) return positions[0];
  if (t <= 0) return positions[0];
  if (t >= 1) return positions[positions.length - 1];

  const segmentDistances: number[] = [];
  let total = 0;
  for (let i = 0; i < positions.length - 1; i++) {
    const dist = distanceBetween(positions[i], positions[i + 1]);
    segmentDistances.push(dist);
    total += dist;
  }

  if (total === 0) return positions[0];

  let target = t * total;
  for (let i = 0; i < segmentDistances.length; i++) {
    const seg = segmentDistances[i];
    if (target > seg) {
      target -= seg;
      continue;
    }

    const ratio = seg === 0 ? 0 : target / seg;
    const start = positions[i];
    const end = positions[i + 1];
    return [
      start[0] + (end[0] - start[0]) * ratio,
      start[1] + (end[1] - start[1]) * ratio,
    ];
  }

  return positions[positions.length - 1];
};

const getAngleAt = (positions: LatLngTuple[], t: number) => {
  const before = getPointAt(positions, Math.max(0, t - 0.02));
  const after = getPointAt(positions, Math.min(1, t + 0.02));
  return Math.atan2(after[0] - before[0], after[1] - before[1]) * (180 / Math.PI);
};

interface RouteSegmentProps {
  from: Location;
  to: Location;
  route?: Route;
  path?: LatLngTuple[] | null;
  onEditRoute: () => void;
  isHovered: boolean;
}

function RouteSegment({ from, to, route, path, onEditRoute, isHovered }: RouteSegmentProps) {
  const positions: LatLngTuple[] = (path && path.length > 1)
    ? path
    : [[from.lat, from.lng], [to.lat, to.lng]];
  const angle = getAngleAt(positions, 0.5);
  const color = route ? TRANSPORT_COLORS[route.transportType] : '#6b7280';
  const label = route ? TRANSPORT_LABELS[route.transportType].split(' ')[0] : '🔗';
  const buildTooltip = () => {
    const parts = [route ? TRANSPORT_LABELS[route.transportType] : '🔗'];
    if (route?.duration) parts.push(`⏱ ${route.duration}`);
    return parts.join(' • ');
  };
  return (
    <>
      <Polyline positions={positions} color={isHovered ? '#0d6efd' : color} weight={4} opacity={isHovered ? 1 : 0.6} dashArray={route ? undefined : "5, 10"} eventHandlers={{ click: (e) => { L.DomEvent.stopPropagation(e); onEditRoute(); } }}>
        <Tooltip permanent={false} direction="center" className="route-tooltip"><div className="route-tooltip-content">{buildTooltip()}</div></Tooltip>
      </Polyline>
      <Marker position={getPointAt(positions, 0.5)} icon={L.divIcon({ className: 'transport-midpoint-icon', html: `<div class="midpoint-badge ${isHovered ? 'hovered' : ''}">${label}</div>`, iconSize: [20, 20], iconAnchor: [10, 10] })} eventHandlers={{ click: onEditRoute }} />
      {[0.2, 0.4, 0.6, 0.8].map(offset => {
        const point = getPointAt(positions, offset);
        const segmentAngle = getAngleAt(positions, offset);
        return (
          <Marker
            key={offset}
            position={point}
            icon={L.divIcon({
              className: 'route-arrow-icon',
              html: `<div style="transform: rotate(${-segmentAngle}deg); color: ${isHovered ? '#0d6efd' : color}; display: flex; align-items: center; justify-content: center; opacity: 0.9;">${renderToStaticMarkup(<ChevronRight size={isHovered ? 24 : 20} strokeWidth={5} />)}</div>`,
              iconSize: [24, 24],
              iconAnchor: [12, 12]
            })}
            interactive={false}
          />
        );
      })}
    </>
  );
}

const SECTION_ORDER: DaySection[] = ['morning', 'afternoon', 'evening'];
const getSectionIndex = (section?: DaySection) => section ? SECTION_ORDER.indexOf(section) : 0;

const containsLocation = (parent: Location, targetId: string): boolean => {
  if (parent.id === targetId) return true;
  return parent.subLocations?.some(sub => containsLocation(sub, targetId)) || false;
};

export default function MapDisplay({ days, locations, routes, onEditRoute, hoveredLocationId, selectedLocationId, onHoverLocation, onSelectLocation, hideControls, isSubItinerary, isPanelCollapsed, allLocations, activeParent, selectedDayId }: MapDisplayProps) {
  const position: [number, number] = [51.505, -0.09];
  const [routeShapes, setRouteShapes] = useState<Record<string, LatLngTuple[]>>({});
  const routeShapesRef = useRef<Record<string, LatLngTuple[]>>({});

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
    const points: any[] = [];
    sortedLocations.forEach(loc => {
      const gIdx = getAbsDayIdx(loc);
      if (gIdx !== -1) points.push({ ...loc, isAccommodation: false, sortValue: gIdx * 100 + getSectionIndex(loc.startSlot) * 30 + (loc.order * 0.001) });

    });

    const focusedGIdx = selectedDayId ? days.findIndex(d => d.id === selectedDayId) : -1;
    if (focusedGIdx !== -1) {
      days.forEach((day, gIdx) => {
        if (!day.accommodation?.lat) return;
        let show = false;
        if (gIdx === focusedGIdx - 1) { // Departure from yesterday's hotel
          const pStart = activeParent ? days.findIndex(d => d.id === activeParent.startDayId) : 0;
          if (gIdx >= pStart && hasActivityOnDay(focusedGIdx)) show = true;
        }
        if (gIdx === focusedGIdx) { // Return to today's hotel
          if (hasActivityOnDay(gIdx) && !isEveningOccupied(gIdx)) show = true;
        }
        if (show) points.push({ id: `path-acc-${gIdx === focusedGIdx ? 'end' : 'start'}-${day.id}`, name: day.accommodation.name, lat: day.accommodation.lat, lng: day.accommodation.lng, isAccommodation: true, sortValue: gIdx * 100 + 99 });
      });
    }
    return points.sort((a, b) => a.sortValue - b.sortValue);
  }, [sortedLocations, days, selectedDayId, getAbsDayIdx, hasActivityOnDay, isEveningOccupied, activeParent]);

  useEffect(() => {
    if (selectedDayId && pathPoints.length > 0) {
      const idx = days.findIndex(d => d.id === selectedDayId);
      console.log(`%c--- Day ${idx + 1} Path ---`, 'font-weight: bold; background: #0d6efd; color: white; padding: 2px 5px;');
      pathPoints.forEach((p, i) => {
        if (i > 0) console.log('      ↓      ');
        console.log(`${i + 1}. [Day ${Math.floor(p.sortValue / 100) + 1}] ${p.isAccommodation ? '🏨' : '📍'} ${p.name} (${p.sortValue.toFixed(1)})`);
      });
    }
  }, [pathPoints, selectedDayId, days]);

  const routeSegments = useMemo(() => {
    if (pathPoints.length < 2) return [];
    const segments: {
      key: string;
      from: Location;
      to: Location;
      route?: Route;
      transportType: TransportType;
    }[] = [];

    for (let i = 0; i < pathPoints.length - 1; i++) {
      const from = pathPoints[i] as Location;
      const to = pathPoints[i + 1] as Location;
      if (from.lat === to.lat && from.lng === to.lng) continue;
      const route = routes.find(r => (r.fromLocationId === from.id && r.toLocationId === to.id) || (r.fromLocationId === to.id && r.toLocationId === from.id));
      const transportType = (route?.transportType || 'other') as TransportType;
      const key = `${from.id}|${to.id}|${transportType}`;
      segments.push({ key, from, to, route, transportType });
    }

    return segments;
  }, [pathPoints, routes]);

  useEffect(() => {
    const activeKeys = new Set(routeSegments.map(segment => segment.key));
    const next: Record<string, LatLngTuple[]> = {};

    Object.entries(routeShapesRef.current).forEach(([key, value]) => {
      if (activeKeys.has(key)) next[key] = value;
    });

    routeShapesRef.current = next;
    setRouteShapes(next);
  }, [routeSegments]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const fetchRoutes = async () => {
      for (const segment of routeSegments) {
        if (routeShapesRef.current[segment.key]) continue;
        const geometry = await fetchRouteGeometry(
          [segment.from.lat, segment.from.lng],
          [segment.to.lat, segment.to.lng],
          segment.transportType,
          { signal: controller.signal }
        );
        if (cancelled || !geometry) continue;
        routeShapesRef.current = { ...routeShapesRef.current, [segment.key]: geometry };
        setRouteShapes(routeShapesRef.current);
      }
    };

    fetchRoutes();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [routeSegments]);

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

        // If the itinerary ends before the evening slot (index 2), 
        // the accommodation for that night belongs to the next destination.
        // So we exclude it from this view.
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

      // Show current day's accommodation OR previous night's accommodation
      // BUT only if they fall within the valid "accommodation range" for this trip leg.
      return (gIdx === focusedGIdx || gIdx === focusedGIdx - 1) && inRange;
    }).map(d => ({ id: `accom-${d.id}`, name: d.accommodation!.name, lat: d.accommodation!.lat!, lng: d.accommodation!.lng!, notes: d.accommodation!.notes }));
  }, [days, selectedDayId, activeParent]);

  return (
    <div className="map-container">
      <MapContainer center={position} zoom={13} scrollWheelZoom={true} className="leaflet-container" zoomControl={false}>
        {!hideControls && <ZoomControl position="topleft" />}
        <TileLayer attribution='&copy; CARTO' url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
        {accommodations.map(acc => <Marker key={acc.id} position={[acc.lat, acc.lng]} icon={createAccommodationIcon()}><Popup><strong>🏨 {acc.name}</strong><br />{acc.notes && <span style={{ color: '#6c757d' }}>{acc.notes}</span>}</Popup></Marker>)}
        {sortedLocations.map((loc, index) => <Marker key={loc.id} position={[loc.lat, loc.lng]} icon={createIcon(loc, index, hoveredLocationId === loc.id)} eventHandlers={{ mouseover: () => onHoverLocation?.(loc.id), mouseout: () => onHoverLocation?.(null), click: () => onSelectLocation?.(loc.id) }}><Popup><strong>{index + 1}. {loc.name}</strong><br />{loc.notes && <span style={{ color: '#6c757d' }}>{loc.notes}</span>}</Popup></Marker>)}
        {routeSegments.map(segment => (
          <RouteSegment
            key={`route-${segment.key}`}
            from={segment.from}
            to={segment.to}
            route={segment.route}
            path={routeShapes[segment.key]}
            onEditRoute={() => onEditRoute(segment.from.id, segment.to.id)}
            isHovered={hoveredLocationId === segment.from.id || hoveredLocationId === segment.to.id}
          />
        ))}
        <FitBounds locations={locations} accommodations={accommodations} />
        <SelectedLocationHandler selectedId={selectedLocationId} locations={locations} isPanelCollapsed={isPanelCollapsed} />
        <MapClickHandler onSelect={onSelectLocation} isDrillDown={isSubItinerary} />
      </MapContainer>
    </div>
  );
}
