import { fetchJson } from '../services/httpClient';
import { trackError } from '../services/telemetry';

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const NOMINATIM_CONTACT_EMAIL = import.meta.env.VITE_NOMINATIM_CONTACT_EMAIL;
const NOMINATIM_RATE_LIMIT_MS = 1100;
const CACHE_TTL_MS = 10 * 60 * 1000;

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export interface PlaceSearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
  importance?: number;
}

interface ReverseGeocodeResponse {
  display_name?: string;
}

let requestQueue: Promise<void> = Promise.resolve();
let lastRequestTs = 0;
const searchCache = new Map<string, CacheEntry<PlaceSearchResult[]>>();
const reverseCache = new Map<string, CacheEntry<string>>();

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getCached = <T>(cache: Map<string, CacheEntry<T>>, key: string): T | null => {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
};

const setCached = <T>(cache: Map<string, CacheEntry<T>>, key: string, value: T) => {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
};

const withRateLimit = async <T>(fn: () => Promise<T>): Promise<T> => {
  const run = async () => {
    const elapsed = Date.now() - lastRequestTs;
    const waitMs = Math.max(0, NOMINATIM_RATE_LIMIT_MS - elapsed);
    if (waitMs > 0) {
      await sleep(waitMs);
    }
    lastRequestTs = Date.now();
    return fn();
  };

  const next = requestQueue.then(run, run);
  requestQueue = next.then(() => undefined, () => undefined);
  return next;
};

const withContact = (url: URL) => {
  if (NOMINATIM_CONTACT_EMAIL) {
    url.searchParams.set('email', NOMINATIM_CONTACT_EMAIL);
  }
  return url;
};

export const searchPlace = async (query: string, options?: { signal?: AbortSignal }): Promise<PlaceSearchResult[]> => {
  const cleanedQuery = query.trim();
  if (!cleanedQuery) return [];

  const cacheKey = cleanedQuery.toLowerCase();
  const cached = getCached(searchCache, cacheKey);
  if (cached) return cached;

  try {
    const url = withContact(new URL(`${NOMINATIM_BASE}/search`));
    url.searchParams.set('format', 'json');
    url.searchParams.set('q', cleanedQuery);
    url.searchParams.set('addressdetails', '0');

    const data = await withRateLimit(() => fetchJson<PlaceSearchResult[]>(url.toString(), {
      signal: options?.signal,
      headers: { Accept: 'application/json', 'Accept-Language': 'en-US,en;q=0.9' },
      retries: 2,
      retryDelayMs: 600,
      timeoutMs: 10000,
    }));

    setCached(searchCache, cacheKey, data);
    return data;
  } catch (error) {
    trackError('nominatim_search_failed', error, { query: cleanedQuery });
    return [];
  }
};

export const reverseGeocode = async (lat: number, lng: number, options?: { signal?: AbortSignal }): Promise<string> => {
  const cacheKey = `${lat.toFixed(5)}:${lng.toFixed(5)}`;
  const cached = getCached(reverseCache, cacheKey);
  if (cached) return cached;

  try {
    const url = withContact(new URL(`${NOMINATIM_BASE}/reverse`));
    url.searchParams.set('format', 'json');
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lng));

    const data = await withRateLimit(() => fetchJson<ReverseGeocodeResponse>(url.toString(), {
      signal: options?.signal,
      headers: { Accept: 'application/json', 'Accept-Language': 'en-US,en;q=0.9' },
      retries: 2,
      retryDelayMs: 600,
      timeoutMs: 10000,
    }));

    const resolved = data.display_name || `Location at ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    setCached(reverseCache, cacheKey, resolved);
    return resolved;
  } catch (error) {
    trackError('nominatim_reverse_failed', error, { lat, lng });
    return `Location at ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
};
