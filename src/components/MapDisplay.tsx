import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, Tooltip } from 'react-leaflet';
import { Location, Route, TRANSPORT_COLORS, TRANSPORT_LABELS } from '../types';
import L from 'leaflet';

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
  locations: Location[];
  routes: Route[];
  onEditRoute: (fromId: string, toId: string) => void;
  hoveredLocationId?: string | null;
  onHoverLocation?: (id: string | null) => void;
}

// Custom Marker icons
const createIcon = (color: string, isHovered: boolean) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background-color: ${color}; 
      width: ${isHovered ? '24px' : '18px'}; 
      height: ${isHovered ? '24px' : '18px'}; 
      border-radius: 50%; 
      border: 3px solid white; 
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      transition: all 0.2s;
      ${isHovered ? 'transform: scale(1.3); border-color: #0d6efd;' : ''}
    "></div>`,
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
}

function RouteSegment({ from, to, route, onEditRoute }: RouteSegmentProps) {
  const positions: [number, number][] = [
    [from.lat, from.lng],
    [to.lat, to.lng]
  ];

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
    <Polyline
      positions={positions}
      color={color}
      weight={4}
      opacity={0.8}
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
  );
}

export default function MapDisplay({ locations, routes, onEditRoute, hoveredLocationId, onHoverLocation }: MapDisplayProps) {
  const position: [number, number] = [51.505, -0.09]; // Default center (London)

  // Get ordered locations for drawing routes
  const sortedLocations = [...locations].sort((a, b) => a.order - b.order);

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
              icon={createIcon(isHovered ? '#0d6efd' : '#6c757d', isHovered)}
              eventHandlers={{
                mouseover: () => onHoverLocation?.(loc.id),
                mouseout: () => onHoverLocation?.(null),
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
          const route = getRoute(loc.id, nextLoc.id);

          return (
            <RouteSegment
              key={`route-${loc.id}-${nextLoc.id}`}
              from={loc}
              to={nextLoc}
              route={route}
              onEditRoute={() => onEditRoute(loc.id, nextLoc.id)}
            />
          );
        })}

        <FitBounds locations={locations} />
      </MapContainer>
    </div>
  );
}