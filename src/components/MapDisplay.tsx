import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, Tooltip } from 'react-leaflet';
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
  onHoverLocation?: (id: string | null) => void;
  onSelectLocation?: (id: string) => void;
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

// Component to fit bounds
function FitBounds({ locations }: { locations: Location[] }) {
  const map = useMap();

  useEffect(() => {
    if (locations.length > 0) {
      const bounds = L.latLngBounds(locations.map(l => [l.lat, l.lng]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [locations, map]);

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
              <span className="text-muted"> Click to add details</span>
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

export default function MapDisplay({ days, locations, routes, onEditRoute, hoveredLocationId, onHoverLocation, onSelectLocation }: MapDisplayProps) {
  const position: [number, number] = [51.505, -0.09]; // Default center (London)

  // Get ordered locations for drawing routes, matching sidebar chronological logic
  const sortedLocations = useMemo(() => {
    const dayRowMap = new Map<string, number>();
    days.forEach((d, i) => dayRowMap.set(d.id, i * 3 + 1));

    const SECTION_ORDER: DaySection[] = ['morning', 'afternoon', 'evening'];
    const getSectionIndex = (section?: DaySection) => {
        if (!section) return 0;
        return SECTION_ORDER.indexOf(section);
    };

    return [...locations].sort((a, b) => {
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
  }, [locations, days]);

  // Get route between two locations
  const getRoute = (fromId: string, toId: string): Route | undefined => {
    return routes.find(r =>
      (r.fromLocationId === fromId && r.toLocationId === toId) ||
      (r.fromLocationId === toId && r.toLocationId === fromId)
    );
  };

  return (
    <div className="map-container">
      <MapContainer center={position} zoom={13} scrollWheelZoom={true} className="leaflet-container">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />


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
                {loc.notes && <span className="text-muted">{loc.notes}</span>}
              </Popup>
            </Marker>
          );
        })}

        {/* Draw route segments between consecutive locations */}
        {sortedLocations.length > 1 && sortedLocations.map((loc, index) => {
          if (index === sortedLocations.length - 1) return null;

          const nextLoc = sortedLocations[index + 1];
          // Only draw lines between assigned locations
          if (!loc.startDayId || !nextLoc.startDayId) return null;

          const route = getRoute(loc.id, nextLoc.id);
          const isHovered = hoveredLocationId === loc.id || hoveredLocationId === nextLoc.id;

          return (
            <RouteSegment
              key={`route-${loc.id}-${nextLoc.id}`}
              from={loc}
              to={nextLoc}
              route={route}
              onEditRoute={() => onEditRoute(loc.id, nextLoc.id)}
              isHovered={isHovered}
            />
          );
        })}

        <FitBounds locations={locations} />
      </MapContainer>
    </div>
  );
}
