import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, X } from 'lucide-react';
import { Input } from './input';
import { Button } from './button';

// Orange circle pin — avoids default Leaflet icon URL issues with Vite
const pinIcon = L.divIcon({
  className: '',
  html: '<div style="width:16px;height:16px;background:#0f766e;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

// ── Inner map components (must live inside MapContainer) ──────────────────────

function MapController({
  fitBounds,
  hasValue,
  onMapClick,
}: {
  fitBounds?: [number, number][];
  hasValue: boolean;
  onMapClick: (lat: number, lng: number) => void;
}) {
  const map = useMap();
  const didFit = useRef(false);

  useEffect(() => {
    map.invalidateSize();
    // Skip fitBounds if a value is already set — the map opened centered on that value instead
    if (didFit.current || hasValue) return;
    if (fitBounds && fitBounds.length > 1) {
      map.fitBounds(fitBounds as L.LatLngBoundsExpression, { padding: [30, 30], maxZoom: 10 });
      didFit.current = true;
    } else if (fitBounds && fitBounds.length === 1) {
      map.setView(fitBounds[0], 10);
      didFit.current = true;
    }
  }, [map, fitBounds, hasValue]);

  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });

  return null;
}

// Stores the Leaflet map instance so we can pan to coords typed in the inputs
function MapRefCapture({ mapRef }: { mapRef: React.MutableRefObject<L.Map | null> }) {
  const map = useMap();
  useEffect(() => {
    mapRef.current = map;
    return () => {
      mapRef.current = null;
    };
  }, [map, mapRef]);
  return null;
}

// ── Public component ──────────────────────────────────────────────────────────

export interface LocationPickerProps {
  value: { lat: number; lng: number } | null;
  onChange: (coords: { lat: number; lng: number } | null) => void;
  /** Center the map here on open (e.g. parent stay coords). */
  defaultCenter?: { lat: number; lng: number; zoom?: number };
  /** Fit the map to these coords on open (e.g. all existing stay coords). */
  fitBounds?: [number, number][];
}

export function LocationPicker({ value, onChange, defaultCenter, fitBounds }: LocationPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [latText, setLatText] = useState(value ? value.lat.toFixed(5) : '');
  const [lngText, setLngText] = useState(value ? value.lng.toFixed(5) : '');
  const [latError, setLatError] = useState(false);
  const [lngError, setLngError] = useState(false);
  const mapRef = useRef<L.Map | null>(null);

  // Sync inputs and pan map when value changes (e.g. Nominatim pick or map click)
  useEffect(() => {
    if (value) {
      setLatText(value.lat.toFixed(5));
      setLngText(value.lng.toFixed(5));
      mapRef.current?.panTo([value.lat, value.lng]);
    } else {
      setLatText('');
      setLngText('');
    }
  }, [value]);

  const handleMapClick = (lat: number, lng: number) => {
    setLatError(false);
    setLngError(false);
    onChange({ lat, lng });
  };

  const handleLatBlur = () => {
    const parsed = parseFloat(latText);
    if (isNaN(parsed) || parsed < -90 || parsed > 90) {
      setLatError(true);
      return;
    }
    setLatError(false);
    const lngParsed = parseFloat(lngText);
    if (!isNaN(lngParsed) && lngParsed >= -180 && lngParsed <= 180) {
      onChange({ lat: parsed, lng: lngParsed });
      mapRef.current?.panTo([parsed, lngParsed]);
    }
  };

  const handleLngBlur = () => {
    const parsed = parseFloat(lngText);
    if (isNaN(parsed) || parsed < -180 || parsed > 180) {
      setLngError(true);
      return;
    }
    setLngError(false);
    const latParsed = parseFloat(latText);
    if (!isNaN(latParsed) && latParsed >= -90 && latParsed <= 90) {
      onChange({ lat: latParsed, lng: parsed });
      mapRef.current?.panTo([latParsed, parsed]);
    }
  };

  const handleClear = () => {
    onChange(null);
    setLatError(false);
    setLngError(false);
  };

  // If a value is already set (e.g. from a prior Nominatim pick), open the map there
  const mapCenter: [number, number] = value
    ? [value.lat, value.lng]
    : defaultCenter
      ? [defaultCenter.lat, defaultCenter.lng]
      : [20, 0];
  const mapZoom = value ? 14 : (defaultCenter?.zoom ?? 2);

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors mt-1"
        aria-label={isOpen ? 'Close map' : 'Pick on map'}
        aria-expanded={isOpen}
      >
        <MapPin className="w-3 h-3" />
        {isOpen ? 'Close map' : 'Pick on map'}
      </button>

      <span className="sr-only" aria-live="polite">
        {value
          ? `Location set at ${value.lat.toFixed(4)}, ${value.lng.toFixed(4)}.`
          : ''}
      </span>

      {isOpen && (
        <div className="mt-2 space-y-2">
          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            style={{ height: 220, borderRadius: 8 }}
            zoomControl
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
            />
            <MapController fitBounds={fitBounds} hasValue={!!value} onMapClick={handleMapClick} />
            <MapRefCapture mapRef={mapRef} />
            {value && <Marker position={[value.lat, value.lng]} icon={pinIcon} />}
          </MapContainer>

          <div className="flex gap-2 items-center">
            <div className="flex-1">
              <Input
                value={latText}
                onChange={(e) => setLatText(e.target.value)}
                onBlur={handleLatBlur}
                placeholder="Lat"
                className={`text-xs h-8 ${latError ? 'border-destructive' : ''}`}
                aria-label="Latitude"
              />
            </div>
            <div className="flex-1">
              <Input
                value={lngText}
                onChange={(e) => setLngText(e.target.value)}
                onBlur={handleLngBlur}
                placeholder="Lng"
                className={`text-xs h-8 ${lngError ? 'border-destructive' : ''}`}
                aria-label="Longitude"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleClear}
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              aria-label="Clear"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Click the map to place a pin, or type coordinates directly.
          </p>
        </div>
      )}
    </div>
  );
}
