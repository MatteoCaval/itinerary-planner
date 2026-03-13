import { useEffect } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';

interface FitMapProps {
  points: [number, number][];
  expanded: boolean;
}

export function FitMap({ points, expanded }: FitMapProps) {
  const map = useMap();
  useEffect(() => {
    window.setTimeout(() => map.invalidateSize(), 50);
  }, [expanded, map]);
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.setView(points[0], 13, { animate: true });
      return;
    }
    map.fitBounds(points, { padding: [40, 40], animate: true });
  }, [map, points]);
  return null;
}

interface SelectedVisitHandlerProps {
  selectedVisitId: string | null;
  visits: { id: string; lat: number; lng: number }[];
}

export function SelectedVisitHandler({ selectedVisitId, visits }: SelectedVisitHandlerProps) {
  const map = useMap();
  useEffect(() => {
    if (!selectedVisitId) return;
    const frameId = window.requestAnimationFrame(() => {
      const visit = visits.find((v) => v.id === selectedVisitId);
      if (!visit) return;
      const currentZoom = map.getZoom();
      map.stop();
      map.flyTo([visit.lat, visit.lng], currentZoom, { animate: true, duration: 0.55 });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [selectedVisitId, visits, map]);
  return null;
}

interface MapClickHandlerProps {
  onDeselect: () => void;
}

export function MapClickHandler({ onDeselect }: MapClickHandlerProps) {
  useMapEvents({ click: () => onDeselect() });
  return null;
}
