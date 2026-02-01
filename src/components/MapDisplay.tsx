import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents, Tooltip, ZoomControl } from 'react-leaflet';
import { Location, Route, TRANSPORT_COLORS, TRANSPORT_LABELS, Day, DaySection, LocationCategory } from '../types';
import L from 'leaflet';
import { Map as SightseeingIcon, Utensils, Bed, Train, Globe, ChevronRight } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';

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
}

function SelectedLocationHandler({ selectedId, locations }: { selectedId?: string | null, locations: Location[] }) {
  const map = useMap();

  useEffect(() => {
    if (selectedId) {
      const loc = locations.find(l => l.id === selectedId);
      if (loc) {
        map.setView([loc.lat, loc.lng], 16, {
          animate: true,
          duration: 1
        });
      }
    }
  }, [selectedId, locations, map]);

  return null;
}

function MapClickHandler({ onSelect, isDrillDown }: { onSelect?: (id: string | null) => void, isDrillDown?: boolean }) {
  useMapEvents({
    click: () => {
      if (!isDrillDown) {
        onSelect?.(null);
      }
    },
  });
  return null;
}

const CATEGORY_ICONS: Record<LocationCategory, any> = {
  sightseeing: SightseeingIcon,
  dining: Utensils,
  hotel: Bed,
  transit: Train,
  other: Globe
};

// Custom Marker icons with category and number
const createIcon = (loc: Location, index: number, isHovered: boolean) => {
  const IconComponent = CATEGORY_ICONS[loc.category || 'sightseeing'];
  const iconHtml = renderToStaticMarkup(<IconComponent size={12} color="white" />);

  return L.divIcon({
    className: 'custom-marker-wrapper',
    html: `
      <div class="map-marker-container ${isHovered ? 'hovered' : ''}">
        <div class="marker-circle" style="background-color: ${isHovered ? '#0d6efd' : '#6c757d'}">
          ${iconHtml}
        </div>
        <div class="marker-number">${index + 1}</div>
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
};

// Route midpoint icon
const createTransportIcon = (route: Route | undefined, isHovered: boolean) => {
  const label = route ? TRANSPORT_LABELS[route.transportType].split(' ')[0] : '🔗';
  return L.divIcon({
    className: 'transport-midpoint-icon',
    html: `<div class="midpoint-badge ${isHovered ? 'hovered' : ''}">${label}</div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
};

// Directional Arrow Icon
const createArrowIcon = (angle: number, color: string, isHovered: boolean) => {
  return L.divIcon({
    className: 'route-arrow-icon',
    html: `<div style="transform: rotate(${angle}deg); color: ${color}; display: flex; align-items: center; justify-content: center; opacity: 0.9;">
      ${renderToStaticMarkup(<ChevronRight size={isHovered ? 24 : 20} strokeWidth={5} />)}
    </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

// Accommodation Icon
const createAccommodationIcon = () => {
  const iconHtml = renderToStaticMarkup(<Bed size={16} color="white" />);
  return L.divIcon({
    className: 'custom-marker-wrapper accommodation-marker',
    html: `
      <div class="map-marker-container">
        <div class="marker-circle" style="background-color: #6610f2; width: 32px; height: 32px;">
          ${iconHtml}
        </div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });
};

// Component to fit bounds
function FitBounds({ locations, accommodations }: { locations: Location[], accommodations?: { lat: number, lng: number }[] }) {
  const map = useMap();

  useEffect(() => {
    const points: [number, number][] = locations.map(l => [l.lat, l.lng]);
    if (accommodations) {
      accommodations.forEach(a => points.push([a.lat, a.lng]));
    }
    
    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [locations, accommodations, map]);

  return null;
}

// Route segment component with tooltip
interface RouteSegmentProps {
  from: Location;
  to: Location;
  route?: Route;
  onEditRoute: () => void;
  isHovered: boolean;
}

function RouteSegment({ from, to, route, onEditRoute, isHovered }: RouteSegmentProps) {
  const positions: [number, number][] = [
    [from.lat, from.lng],
    [to.lat, to.lng]
  ];

  const midpoint: [number, number] = [
    (from.lat + to.lat) / 2,
    (from.lng + to.lng) / 2
  ];

  // Multiple arrow positions for better visibility
  const arrowOffsets = [0.2, 0.4, 0.6, 0.8];
  const arrowPoints = arrowOffsets.map(offset => ({
    pos: [
      from.lat + (to.lat - from.lat) * offset,
      from.lng + (to.lng - from.lng) * offset
    ] as [number, number],
    id: offset
  }));

  // Calculate rotation angle
  const angle = Math.atan2(to.lat - from.lat, to.lng - from.lng) * (180 / Math.PI);

  const color = route ? TRANSPORT_COLORS[route.transportType] : '#6b7280';
  const transportLabel = route ? TRANSPORT_LABELS[route.transportType] : '🔗';

  // Build tooltip content
  const buildTooltipContent = () => {
    const parts: string[] = [transportLabel];
    if (route?.duration) parts.push(`⏱ ${route.duration}`);
    if (route?.cost) parts.push(`💰 ${route.cost}`);
    return parts.join(' • ');
  };

  return (
    <>
      <Polyline
        positions={positions}
        color={isHovered ? '#0d6efd' : color}
        weight={4}
        opacity={isHovered ? 1 : 0.6}
        dashArray={route ? undefined : "5, 10"}
        eventHandlers={{
          click: (e) => {
            L.DomEvent.stopPropagation(e);
            onEditRoute();
          },
        }}
      >
        <Tooltip permanent={false} direction="center" className="route-tooltip">
          <div className="route-tooltip-content" style={{ cursor: 'pointer' }}>
            {buildTooltipContent()}
            {(!route?.duration && !route?.cost) && (
              <span style={{ color: '#6c757d' }}> Click to add details</span>
            )}
          </div>
        </Tooltip>
      </Polyline>
      <Marker
        position={midpoint}
        icon={createTransportIcon(route, isHovered)}
        eventHandlers={{ click: onEditRoute }}
      />
      {arrowPoints.map(point => (
        <Marker
          key={point.id}
          position={point.pos}
          icon={createArrowIcon(-angle, isHovered ? '#0d6efd' : color, isHovered)}
          interactive={false}
        />
      ))}
    </>
  );
}

const SECTION_ORDER: DaySection[] = ['morning', 'afternoon', 'evening'];
const getSectionIndex = (section?: DaySection) => {
  if (!section) return 0;
  return SECTION_ORDER.indexOf(section);
};

export default function MapDisplay({ days, locations, routes, onEditRoute, hoveredLocationId, selectedLocationId, onHoverLocation, onSelectLocation, hideControls, isSubItinerary }: MapDisplayProps) {
  const position: [number, number] = [51.505, -0.09]; // Default center (London)

  // Get ordered locations for drawing routes, matching sidebar chronological logic
  const sortedLocations = useMemo(() => {
    const dayRowMap = new Map<string, number>();
    days.forEach((d, i) => dayRowMap.set(d.id, i * 3 + 1));

    return [...locations].sort((a, b) => {
      // Handle sub-itinerary sorting by dayOffset
      if (isSubItinerary) {
        if (a.dayOffset !== b.dayOffset) return (a.dayOffset || 0) - (b.dayOffset || 0);
        const slotA = getSectionIndex(a.startSlot);
        const slotB = getSectionIndex(b.startSlot);
        if (slotA !== slotB) return slotA - slotB;
        return a.order - b.order;
      }

      // Handle unassigned at the end
      if (!a.startDayId && b.startDayId) return 1;
      if (a.startDayId && !b.startDayId) return -1;
      if (!a.startDayId && !b.startDayId) return a.order - b.order;

      if (a.startDayId !== b.startDayId) {
        const rowA = dayRowMap.get(a.startDayId || '') || 9999;
        const rowB = dayRowMap.get(b.startDayId || '') || 9999;
        return rowA - rowB;
      }

      const slotA = getSectionIndex(a.startSlot);
      const slotB = getSectionIndex(b.startSlot);
      if (slotA !== slotB) return slotA - slotB;

      return a.order - b.order;
    });
  }, [locations, days, isSubItinerary]);

  // Get route between two locations
  const getRoute = (fromId: string, toId: string): Route | undefined => {
    return routes.find(r =>
      (r.fromLocationId === fromId && r.toLocationId === toId) ||
      (r.fromLocationId === toId && r.toLocationId === fromId)
    );
  };

  // Combine locations and accommodations into a single chronological path
  const pathPoints = useMemo(() => {
    const points: any[] = [];
    
    // Add all valid locations
    sortedLocations.forEach(loc => {
      if (isSubItinerary || loc.startDayId) {
        points.push({
          ...loc,
          isAccommodation: false,
          // Calculate a global sort value
          sortValue: isSubItinerary 
            ? (loc.dayOffset || 0) * 10 + getSectionIndex(loc.startSlot) + (loc.order * 0.01)
            : (days.findIndex(d => d.id === loc.startDayId) * 10) + getSectionIndex(loc.startSlot) + (loc.order * 0.01)
        });
      }
    });

    // Add accommodations as virtual points ONLY if in sub-itinerary mode
    if (isSubItinerary) {
      days.forEach((day, dayIdx) => {
        if (day.accommodation && day.accommodation.lat && day.accommodation.lng) {
          // 1. Is this the current day being viewed? (Shows the end-of-day return to hotel)
          const isCurrentDay = sortedLocations.some(l => l.dayOffset === dayIdx);
          
          // 2. Is this the PREVIOUS day relative to a single filtered day? 
          // (Shows the start-of-day departure from hotel)
          let isPreviousDayOfFilter = false;
          if (sortedLocations.length > 0) {
             const viewedDayIdx = sortedLocations[0].dayOffset || 0;
             // If we are looking at only ONE day, and this loop iteration is the day BEFORE that day
             const isFilteredToOneDay = new Set(sortedLocations.map(l => l.dayOffset)).size === 1;
             if (isFilteredToOneDay && dayIdx === viewedDayIdx - 1) {
                isPreviousDayOfFilter = true;
             }
          }

          if (isCurrentDay || isPreviousDayOfFilter) {
            points.push({
              id: `path-accom-${day.id}`,
              name: day.accommodation.name,
              lat: day.accommodation.lat,
              lng: day.accommodation.lng,
              isAccommodation: true,
              notes: day.accommodation.notes,
              // If it's the previous day's hotel, it needs to come BEFORE Day X Morning
              // So we give it a sort value at the very end of Day X-1
              sortValue: dayIdx * 10 + 2.5
            });
          }
        }
      });
    }

    return points.sort((a, b) => a.sortValue - b.sortValue);
  }, [sortedLocations, days, isSubItinerary]);

  // Extract accommodations with location data for markers (keep for FitBounds and standalone markers)
  const accommodations = useMemo(() => {
    return days
      .filter(d => d.accommodation && d.accommodation.lat && d.accommodation.lng)
      .map(d => ({
        id: `accom-${d.id}`,
        name: d.accommodation!.name,
        lat: d.accommodation!.lat!,
        lng: d.accommodation!.lng!,
        notes: d.accommodation!.notes
      }));
  }, [days]);

  return (
    <div className="map-container">
      <MapContainer center={position} zoom={13} scrollWheelZoom={true} className="leaflet-container" zoomControl={false}>
        {!hideControls && <ZoomControl position="topleft" />}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        {/* Accommodation Markers */}
        {accommodations.map(acc => (
          <Marker
            key={acc.id}
            position={[acc.lat, acc.lng]}
            icon={createAccommodationIcon()}
          >
            <Popup>
              <strong>🏨 {acc.name}</strong><br />
              {acc.notes && <span style={{ color: '#6c757d' }}>{acc.notes}</span>}
            </Popup>
          </Marker>
        ))}

        {sortedLocations.map((loc, index) => {
          const isHovered = hoveredLocationId === loc.id;
          return (
            <Marker
              key={loc.id}
              position={[loc.lat, loc.lng]}
              icon={createIcon(loc, index, isHovered)}
              eventHandlers={{
                mouseover: () => onHoverLocation?.(loc.id),
                mouseout: () => onHoverLocation?.(null),
                click: () => onSelectLocation?.(loc.id),
              }}
            >
              <Popup>
                <strong>{index + 1}. {loc.name}</strong><br />
                {loc.notes && <span style={{ color: '#6c757d' }}>{loc.notes}</span>}
              </Popup>
            </Marker>
          );
        })}

        {/* Draw route segments between consecutive points in the path */}
        {pathPoints.length > 1 && pathPoints.map((point, index) => {
          if (index === pathPoints.length - 1) return null;

          const nextPoint = pathPoints[index + 1];
          
          // Draw a line if at least one is NOT an accommodation, or if they are different accommodations
          // (to avoid lines if we have multiple points for the same thing somehow)
          if (point.lat === nextPoint.lat && point.lng === nextPoint.lng) return null;

          const route = getRoute(point.id, nextPoint.id);
          const isHovered = hoveredLocationId === point.id || hoveredLocationId === nextPoint.id;

          return (
            <RouteSegment
              key={`route-${point.id}-${nextPoint.id}`}
              from={point}
              to={nextPoint}
              route={route}
              onEditRoute={() => onEditRoute(point.id, nextPoint.id)}
              isHovered={isHovered}
            />
          );
        })}

        <FitBounds locations={locations} accommodations={accommodations} />
        <SelectedLocationHandler selectedId={selectedLocationId} locations={locations} />
        <MapClickHandler onSelect={onSelectLocation} isDrillDown={isSubItinerary} />
      </MapContainer>
    </div>
  );
}
