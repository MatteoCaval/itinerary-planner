import { useEffect, useRef } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';

interface FitMapProps {
  points: [number, number][];
  expanded: boolean;
}

function fitPoints(map: ReturnType<typeof useMap>, pts: [number, number][], animate = true) {
  if (!pts.length) return;
  if (pts.length === 1) {
    map.setView(pts[0], 13, { animate });
  } else {
    map.fitBounds(pts, { padding: [40, 40], animate });
  }
}

export function FitMap({ points, expanded }: FitMapProps) {
  const map = useMap();
  // Keep a ref so the expand effect always uses the latest points without being a dep
  const pointsRef = useRef(points);
  pointsRef.current = points;

  // When the panel resizes (expand/collapse), wait for the CSS transition (300ms)
  // then invalidate + re-fit so tiles fill the full area and the view is centered.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      map.invalidateSize();
      fitPoints(map, pointsRef.current);
    }, 320);
    return () => window.clearTimeout(timer);
  }, [expanded, map]);

  // When the content changes (new stay, mode switch, day filter), re-center immediately.
  useEffect(() => {
    fitPoints(map, points);
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
