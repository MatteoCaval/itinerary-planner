import { useMemo, useState } from 'react';
import { Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Location } from '../../types';
import { createIcon, createClusterIcon } from './markerFactories';

type IndexedLocation = {
  location: Location;
  index: number;
};

type LocationCluster = {
  id: string;
  lat: number;
  lng: number;
  members: IndexedLocation[];
};

interface ClusteredLocationMarkersProps {
  locations: Location[];
  hoveredLocationId?: string | null;
  onHoverLocation?: (id: string | null) => void;
  onSelectLocation?: (id: string | null) => void;
  enableGrouping?: boolean;
}

export function ClusteredLocationMarkers({
  locations,
  hoveredLocationId,
  onHoverLocation,
  onSelectLocation,
  enableGrouping = true,
}: ClusteredLocationMarkersProps) {
  const map = useMapEvents({
    zoomend: () => setZoom(map.getZoom()),
    moveend: () => setViewportTick(value => value + 1),
  });
  const [zoom, setZoom] = useState(map.getZoom());
  const [viewportTick, setViewportTick] = useState(0);

  const indexedLocations = useMemo<IndexedLocation[]>(
    () => locations.map((location, index) => ({ location, index })),
    [locations],
  );

  const duplicateMeta = useMemo(() => {
    const groups = new Map<string, IndexedLocation[]>();
    indexedLocations.forEach(entry => {
      const key = `${entry.location.lat.toFixed(4)}:${entry.location.lng.toFixed(4)}`;
      groups.set(key, [...(groups.get(key) || []), entry]);
    });

    const result = new Map<string, { indexInGroup: number; count: number }>();
    groups.forEach(group => {
      group.forEach((entry, idx) => {
        result.set(entry.location.id, { indexInGroup: idx, count: group.length });
      });
    });
    return result;
  }, [indexedLocations]);

  const clusters = useMemo<LocationCluster[]>(() => {
    if (indexedLocations.length === 0) return [];
    const shouldCluster = enableGrouping && zoom <= 10;
    if (!shouldCluster) {
      return indexedLocations.map(entry => ({
        id: `single-${entry.location.id}`,
        lat: entry.location.lat,
        lng: entry.location.lng,
        members: [entry],
      }));
    }

    const thresholdPx = 44;
    const nextClusters: {
      lat: number;
      lng: number;
      members: IndexedLocation[];
      projected: L.Point;
    }[] = [];

    indexedLocations.forEach(entry => {
      const point = map.project([entry.location.lat, entry.location.lng], zoom);
      const hit = nextClusters.find(cluster => cluster.projected.distanceTo(point) < thresholdPx);

      if (!hit) {
        nextClusters.push({
          lat: entry.location.lat,
          lng: entry.location.lng,
          members: [entry],
          projected: point,
        });
        return;
      }

      hit.members.push(entry);
      const total = hit.members.length;
      hit.lat = ((hit.lat * (total - 1)) + entry.location.lat) / total;
      hit.lng = ((hit.lng * (total - 1)) + entry.location.lng) / total;
      hit.projected = map.project([hit.lat, hit.lng], zoom);
    });

    return nextClusters.map((cluster, index) => ({
      id: `cluster-${zoom}-${index}`,
      lat: cluster.lat,
      lng: cluster.lng,
      members: cluster.members,
    }));
  }, [indexedLocations, map, zoom, viewportTick, enableGrouping]);

  const getJitteredPosition = (entry: IndexedLocation): [number, number] => {
    const meta = duplicateMeta.get(entry.location.id);
    if (!meta || meta.count <= 1 || zoom <= 10) {
      return [entry.location.lat, entry.location.lng];
    }

    const angle = (2 * Math.PI * meta.indexInGroup) / meta.count;
    const radiusPx = 11 + Math.min(8, meta.count * 1.5);
    const projected = map.project([entry.location.lat, entry.location.lng], zoom);
    const jittered = projected.add([Math.cos(angle) * radiusPx, Math.sin(angle) * radiusPx]);
    const latLng = map.unproject(jittered, zoom);
    return [latLng.lat, latLng.lng];
  };

  return (
    <>
      {clusters.map(cluster => {
        if (cluster.members.length > 1) {
          return (
            <Marker
              key={cluster.id}
              position={[cluster.lat, cluster.lng]}
              icon={createClusterIcon(cluster.members.length)}
              eventHandlers={{
                click: () => {
                  map.flyTo([cluster.lat, cluster.lng], Math.min(map.getZoom() + 2, 16), {
                    duration: 0.4,
                  });
                },
              }}
            >
              <Popup>
                <strong>{cluster.members.length} stops in this area</strong>
              </Popup>
            </Marker>
          );
        }

        const entry = cluster.members[0];
        const loc = entry.location;
        return (
          <Marker
            key={loc.id}
            position={getJitteredPosition(entry)}
            icon={createIcon(loc, entry.index, hoveredLocationId === loc.id)}
            eventHandlers={{
              mouseover: () => onHoverLocation?.(loc.id),
              mouseout: () => onHoverLocation?.(null),
              click: () => onSelectLocation?.(loc.id),
            }}
          >
            <Popup>
              <strong>{entry.index + 1}. {loc.name}</strong>
              <br />
              {loc.notes && <span style={{ color: '#6c757d' }}>{loc.notes}</span>}
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}
