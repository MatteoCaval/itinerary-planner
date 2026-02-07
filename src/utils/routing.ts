import { TransportType } from '../types';
import { fetchJson } from '../services/httpClient';
import { trackError } from '../services/telemetry';

export type LatLngTuple = [number, number];

const routeCache = new Map<string, LatLngTuple[]>();

const formatCoord = (value: number) => value.toFixed(5);

const getCacheKey = (profile: string, from: LatLngTuple, to: LatLngTuple) => (
  `osrm:${profile}:${formatCoord(from[0])},${formatCoord(from[1])}:${formatCoord(to[0])},${formatCoord(to[1])}`
);

const osrmProfileForTransport = (transportType: TransportType) => {
  if (transportType === 'walk') return 'foot';
  return 'driving';
};

const requestOsrmRoute = async (from: LatLngTuple, to: LatLngTuple, transportType: TransportType, signal?: AbortSignal) => {
  const profile = osrmProfileForTransport(transportType);
  const buildUrl = (p: string) => (
    `https://router.project-osrm.org/route/v1/${p}/${from[1]},${from[0]};${to[1]},${to[0]}?geometries=geojson&overview=full`
  );

  try {
    const data = await fetchJson<{ routes?: { geometry?: { coordinates?: [number, number][] } }[] }>(buildUrl(profile), {
      signal,
      retries: 1,
      retryDelayMs: 500,
      timeoutMs: 12000,
    });
    const coords = data?.routes?.[0]?.geometry?.coordinates;
    if (!coords || coords.length < 2) return null;
    return coords.map((coord: [number, number]) => [coord[1], coord[0]] as LatLngTuple);
  } catch (error) {
    if (profile !== 'driving') {
      const fallback = await fetchJson<{ routes?: { geometry?: { coordinates?: [number, number][] } }[] }>(buildUrl('driving'), {
        signal,
        retries: 1,
        retryDelayMs: 500,
        timeoutMs: 12000,
      });
      const coords = fallback?.routes?.[0]?.geometry?.coordinates;
      if (!coords || coords.length < 2) return null;
      return coords.map((coord: [number, number]) => [coord[1], coord[0]] as LatLngTuple);
    }
    throw error;
  }
};

export const fetchRouteGeometry = async (
  from: LatLngTuple,
  to: LatLngTuple,
  transportType: TransportType,
  options?: { signal?: AbortSignal }
): Promise<LatLngTuple[] | null> => {
  const profile = osrmProfileForTransport(transportType);
  const cacheKey = getCacheKey(profile, from, to);

  if (routeCache.has(cacheKey)) {
    return routeCache.get(cacheKey) || null;
  }

  try {
    const geometry = await requestOsrmRoute(from, to, transportType, options?.signal);

    if (geometry && geometry.length > 1) {
      routeCache.set(cacheKey, geometry);
      return geometry;
    }
  } catch (error) {
    trackError('routing_geometry_failed', error, { from, to, transportType });
  }

  return null;
};
