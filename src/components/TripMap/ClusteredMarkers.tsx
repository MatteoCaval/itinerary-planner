import { useMemo, useState } from 'react';
import { Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { createIcon, createClusterIcon } from './markerFactories';
import type { VisitType } from './markerFactories';

export interface VisitMarkerItem {
  id: string;
  name: string;
  type: VisitType;
  area: string;
  lat: number;
  lng: number;
}

type IndexedVisit = { visit: VisitMarkerItem; index: number };

type VisitCluster = {
  id: string;
  lat: number;
  lng: number;
  members: IndexedVisit[];
};

interface ClusteredMarkersProps {
  visits: VisitMarkerItem[];
  selectedVisitId: string | null;
  onSelectVisit: (id: string | null) => void;
  enableClustering?: boolean;
}

export function ClusteredMarkers({
  visits,
  selectedVisitId,
  onSelectVisit,
  enableClustering = true,
}: ClusteredMarkersProps) {
  const map = useMapEvents({
    zoomend: () => setZoom(map.getZoom()),
    moveend: () => setViewportTick((v) => v + 1),
  });
  const [zoom, setZoom] = useState(map.getZoom());
  const [viewportTick, setViewportTick] = useState(0);

  const indexedVisits = useMemo<IndexedVisit[]>(
    () => visits.map((visit, index) => ({ visit, index })),
    [visits],
  );

  const duplicateMeta = useMemo(() => {
    const groups = new Map<string, IndexedVisit[]>();
    indexedVisits.forEach((entry) => {
      const key = `${entry.visit.lat.toFixed(4)}:${entry.visit.lng.toFixed(4)}`;
      groups.set(key, [...(groups.get(key) || []), entry]);
    });
    const result = new Map<string, { indexInGroup: number; count: number }>();
    groups.forEach((group) => {
      group.forEach((entry, idx) => {
        result.set(entry.visit.id, { indexInGroup: idx, count: group.length });
      });
    });
    return result;
  }, [indexedVisits]);

  const clusters = useMemo<VisitCluster[]>(() => {
    if (indexedVisits.length === 0) return [];
    const shouldCluster = enableClustering && zoom <= 10;
    if (!shouldCluster) {
      return indexedVisits.map((entry) => ({
        id: `single-${entry.visit.id}`,
        lat: entry.visit.lat,
        lng: entry.visit.lng,
        members: [entry],
      }));
    }

    const thresholdPx = 44;
    const nextClusters: {
      lat: number;
      lng: number;
      members: IndexedVisit[];
      projected: L.Point;
    }[] = [];

    indexedVisits.forEach((entry) => {
      const point = map.project([entry.visit.lat, entry.visit.lng], zoom);
      const hit = nextClusters.find(
        (cluster) => cluster.projected.distanceTo(point) < thresholdPx,
      );

      if (!hit) {
        nextClusters.push({
          lat: entry.visit.lat,
          lng: entry.visit.lng,
          members: [entry],
          projected: point,
        });
        return;
      }

      hit.members.push(entry);
      const total = hit.members.length;
      hit.lat = (hit.lat * (total - 1) + entry.visit.lat) / total;
      hit.lng = (hit.lng * (total - 1) + entry.visit.lng) / total;
      hit.projected = map.project([hit.lat, hit.lng], zoom);
    });

    return nextClusters.map((cluster, index) => ({
      id: `cluster-${zoom}-${index}`,
      lat: cluster.lat,
      lng: cluster.lng,
      members: cluster.members,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indexedVisits, map, zoom, viewportTick, enableClustering]);

  const getJitteredPosition = (entry: IndexedVisit): [number, number] => {
    const meta = duplicateMeta.get(entry.visit.id);
    if (!meta || meta.count <= 1 || zoom <= 10) {
      return [entry.visit.lat, entry.visit.lng];
    }
    const angle = (2 * Math.PI * meta.indexInGroup) / meta.count;
    const radiusPx = 11 + Math.min(8, meta.count * 1.5);
    const projected = map.project([entry.visit.lat, entry.visit.lng], zoom);
    const jittered = projected.add([
      Math.cos(angle) * radiusPx,
      Math.sin(angle) * radiusPx,
    ]);
    const latLng = map.unproject(jittered, zoom);
    return [latLng.lat, latLng.lng];
  };

  return (
    <>
      {clusters.map((cluster) => {
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
        const v = entry.visit;
        return (
          <Marker
            key={v.id}
            position={getJitteredPosition(entry)}
            icon={createIcon(v.type, entry.index, selectedVisitId === v.id)}
            eventHandlers={{
              click: () => onSelectVisit(selectedVisitId === v.id ? null : v.id),
            }}
          >
            <Popup>
              <strong>
                {entry.index + 1}. {v.name}
              </strong>
              <br />
              <span style={{ color: '#6c757d' }}>{v.area}</span>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}
