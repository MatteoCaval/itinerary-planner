import { useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, ZoomControl } from 'react-leaflet';
import { createAccommodationIcon } from './markerFactories';
import { ClusteredMarkers } from './ClusteredMarkers';
import { RouteSegments } from './RouteSegments';
import { FitMap, SelectedVisitHandler, MapClickHandler } from './MapHandlers';
import { MapControlsPanel } from './MapControlsPanel';
import { useBasemapState } from './useBasemapState';
import type { BasemapMode } from './useBasemapState';
import StayOverviewLayer from './StayOverviewLayer';
import type { OverviewStay } from './StayOverviewLayer';

type VisitType = 'area' | 'landmark' | 'museum' | 'food' | 'walk' | 'hotel' | 'shopping';

type VisitItem = {
  id: string;
  name: string;
  type: VisitType;
  area: string;
  lat: number;
  lng: number;
  dayOffset: number | null;
  dayPart: string | null;
  order: number;
  durationHint?: string;
  notes?: string;
};

type NightAccommodation = {
  name: string;
  lat?: number;
  lng?: number;
  cost?: number;
  notes?: string;
  link?: string;
};

type Stay = {
  id: string;
  name: string;
  centerLat: number;
  centerLng: number;
  nightAccommodations?: Record<number, NightAccommodation>;
  visits: VisitItem[];
};

interface TripMapProps {
  visits: VisitItem[];
  selectedVisitId: string | null;
  onSelectVisit: (id: string | null) => void;
  expanded: boolean;
  stay: Stay | null;
  mode: 'overview' | 'stay' | 'detail';
  overviewStays?: OverviewStay[];
  onSelectStay?: (stayId: string) => void;
  selectedDayOffset?: number | null;
  highlightedStayId?: string | null;
}

const BASEMAPS: Record<BasemapMode, { url: string; attribution: string }> = {
  local: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
  },
  english: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ',
  },
};

export default function TripMap({
  visits, selectedVisitId, onSelectVisit, expanded, stay,
  mode, overviewStays, onSelectStay, selectedDayOffset, highlightedStayId,
}: TripMapProps) {
  const [basemap, setBasemap] = useBasemapState();
  const [showArrows, setShowArrows] = useState(true);
  const [showRouteIcons, setShowRouteIcons] = useState(false);
  const [enableClustering, setEnableClustering] = useState(false);

  const activeBasemap = BASEMAPS[basemap];

  const accommodations = useMemo(() => {
    if (mode === 'overview' || !stay?.nightAccommodations) return [];
    if (mode === 'stay') {
      // In stay mode, show all accommodations (no day filter)
      return Object.entries(stay.nightAccommodations)
        .filter(([, acc]) => acc.lat != null && acc.lng != null)
        .map(([offset, acc]) => ({
          id: `accom-${stay.id}-${offset}`,
          name: acc.name,
          lat: acc.lat!,
          lng: acc.lng!,
          notes: acc.notes,
        }));
    }
    return Object.entries(stay.nightAccommodations)
      .filter(([, acc]) => acc.lat != null && acc.lng != null)
      .filter(([offset]) => {
        if (selectedDayOffset == null) return true;
        const o = parseInt(offset);
        return o === selectedDayOffset || o === selectedDayOffset - 1;
      })
      .map(([offset, acc]) => ({
        id: `accom-${stay.id}-${offset}`,
        name: acc.name,
        lat: acc.lat!,
        lng: acc.lng!,
        notes: acc.notes,
      }));
  }, [stay, mode, selectedDayOffset]);

  // Primary accommodation for route segments (first with coords, or stay center)
  const primaryAccommodation = useMemo(() => {
    if (accommodations.length > 0) {
      return { lat: accommodations[0].lat, lng: accommodations[0].lng };
    }
    if (stay) {
      return { lat: stay.centerLat, lng: stay.centerLng };
    }
    return null;
  }, [accommodations, stay]);

  const allPoints = useMemo(() => {
    if (mode === 'overview') {
      return (overviewStays ?? []).map((s): [number, number] => [s.centerLat, s.centerLng]);
    }
    const pts: [number, number][] = visits.map((v) => [v.lat, v.lng]);
    accommodations.forEach((a) => pts.push([a.lat, a.lng]));
    return pts;
  }, [visits, accommodations, mode, overviewStays]);

  const center: [number, number] = allPoints.length ? allPoints[0] : [35.6762, 139.6503];

  return (
    <div className="w-full h-full relative">
      <MapContainer
        center={center}
        zoom={11}
        zoomControl={false}
        className="w-full h-full"
        style={{ background: '#f1f5f9' }}
      >
        <TileLayer
          key={basemap}
          attribution={activeBasemap.attribution}
          url={activeBasemap.url}
        />
        <ZoomControl position="bottomright" />

        {mode === 'overview' ? (
          <StayOverviewLayer
            stays={overviewStays ?? []}
            onSelectStay={onSelectStay ?? (() => {})}
            expanded={expanded}
            highlightedStayId={highlightedStayId}
            showRouteIcons={showRouteIcons}
          />
        ) : (
          <>
            <ClusteredMarkers
              visits={visits}
              selectedVisitId={selectedVisitId}
              onSelectVisit={onSelectVisit}
              enableClustering={enableClustering}
            />

            {accommodations.map((acc) => (
              <Marker key={acc.id} position={[acc.lat, acc.lng]} icon={createAccommodationIcon()}>
                <Popup>
                  <strong>🏨 {acc.name}</strong>
                  {acc.notes && (
                    <>
                      <br />
                      <span style={{ color: '#6c757d' }}>{acc.notes}</span>
                    </>
                  )}
                </Popup>
              </Marker>
            ))}

            {/* Only show route lines in detail mode (specific day selected) */}
            {mode === 'detail' && (
              <RouteSegments
                visits={visits}
                accommodation={primaryAccommodation}
                showArrows={showArrows}
              />
            )}

            <SelectedVisitHandler selectedVisitId={selectedVisitId} visits={visits} />
            <MapClickHandler onDeselect={() => onSelectVisit(null)} />
          </>
        )}

        <FitMap points={allPoints} expanded={expanded} />
      </MapContainer>

      <MapControlsPanel
        basemap={basemap}
        onBasemapChange={setBasemap}
        showArrows={showArrows}
        onShowArrowsChange={setShowArrows}
        showRouteIcons={showRouteIcons}
        onShowRouteIconsChange={setShowRouteIcons}
        enableClustering={enableClustering}
        onEnableClusteringChange={setEnableClustering}
      />
    </div>
  );
}
