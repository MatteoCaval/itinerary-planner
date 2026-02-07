import { useEffect, useRef, useState } from 'react';
import { PlaceSearchResult, searchPlace } from '../utils/geocoding';
import { trackError } from '../services/telemetry';

interface UsePlaceSearchOptions {
  query: string;
  enabled?: boolean;
  minLength?: number;
  debounceMs?: number;
}

export const usePlaceSearch = ({
  query,
  enabled = true,
  minLength = 3,
  debounceMs = 500,
}: UsePlaceSearchOptions) => {
  const [suggestions, setSuggestions] = useState<PlaceSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const activeRequestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled || query.trim().length < minLength) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      activeRequestRef.current?.abort();
      const controller = new AbortController();
      activeRequestRef.current = controller;

      try {
        setLoading(true);
        const results = await searchPlace(query, { signal: controller.signal });
        setSuggestions(results);
      } catch (error) {
        trackError('place_search_failed', error, { queryLength: query.length });
        setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, debounceMs);

    return () => {
      clearTimeout(timer);
    };
  }, [query, enabled, minLength, debounceMs]);

  useEffect(() => {
    return () => {
      activeRequestRef.current?.abort();
    };
  }, []);

  return { suggestions, loading, setSuggestions };
};
