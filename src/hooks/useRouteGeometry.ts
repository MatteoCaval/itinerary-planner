import { useEffect, useRef, useState } from 'react';
import { fetchRouteGeometry, LatLngTuple } from '../utils/routing';
import { Route, TransportType } from '../types';

interface RouteSegmentInput {
  key: string;
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  route?: Route;
  transportType: TransportType;
}

export function useRouteGeometry(routeSegments: RouteSegmentInput[]) {
  const [routeShapes, setRouteShapes] = useState<Record<string, LatLngTuple[]>>({});
  const routeShapesRef = useRef<Record<string, LatLngTuple[]>>({});

  // Prune stale entries when segments change
  useEffect(() => {
    const activeKeys = new Set(routeSegments.map(segment => segment.key));
    const next: Record<string, LatLngTuple[]> = {};

    Object.entries(routeShapesRef.current).forEach(([key, value]) => {
      if (activeKeys.has(key)) next[key] = value;
    });

    routeShapesRef.current = next;
    setRouteShapes(next);
  }, [routeSegments]);

  // Fetch missing geometries
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const fetchRoutes = async () => {
      for (const segment of routeSegments) {
        if (routeShapesRef.current[segment.key]) continue;
        const geometry = await fetchRouteGeometry(
          [segment.from.lat, segment.from.lng],
          [segment.to.lat, segment.to.lng],
          segment.transportType,
          { signal: controller.signal }
        );
        if (cancelled || !geometry) continue;
        routeShapesRef.current = { ...routeShapesRef.current, [segment.key]: geometry };
        setRouteShapes(routeShapesRef.current);
      }
    };

    fetchRoutes();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [routeSegments]);

  return routeShapes;
}
