import { useState, useEffect } from 'react';

export type BasemapMode = 'local' | 'english';

const MAP_BASEMAP_STORAGE_KEY = 'itinerary-map-basemap';

export function useBasemapState() {
  const [basemap, setBasemap] = useState<BasemapMode>(() => {
    if (typeof window === 'undefined') return 'local';
    const saved = window.localStorage.getItem(MAP_BASEMAP_STORAGE_KEY);
    return saved === 'english' ? 'english' : 'local';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(MAP_BASEMAP_STORAGE_KEY, basemap);
  }, [basemap]);

  return [basemap, setBasemap] as const;
}
