import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import { Location } from '../types';
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
  onAddLocation: (lat: number, lng: number) => void;
}

// Component to handle map clicks
function AddMarkerOnClick({ onAdd }: { onAdd: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onAdd(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

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

export default function MapDisplay({ locations, onAddLocation }: MapDisplayProps) {
  const position: [number, number] = [51.505, -0.09]; // Default center (London)

  const polylinePositions = locations.map(l => [l.lat, l.lng] as [number, number]);

  return (
    <div className="map-container">
      <MapContainer center={position} zoom={13} scrollWheelZoom={true} className="leaflet-container">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <AddMarkerOnClick onAdd={onAddLocation} />
        
        {locations.map((loc, index) => (
          <Marker key={loc.id} position={[loc.lat, loc.lng]}>
            <Popup>
              <strong>{index + 1}. {loc.name}</strong><br />
              {loc.notes}
            </Popup>
          </Marker>
        ))}

        {locations.length > 1 && (
          <Polyline 
            positions={polylinePositions} 
            color="blue" 
            weight={4}
            opacity={0.6}
            dashArray="10, 10" 
          />
        )}

        <FitBounds locations={locations} />
      </MapContainer>
    </div>
  );
}
