import { useState, useEffect } from 'react';

export type BasemapMode = 'voyager' | 'osm' | 'satellite' | 'minimal';

const MAP_BASEMAP_STORAGE_KEY = 'itinerary-map-basemap';
const VALID: BasemapMode[] = ['voyager', 'osm', 'satellite', 'minimal'];

export function useBasemapState() {
  const [basemap, setBasemap] = useState<BasemapMode>(() => {
    if (typeof window === 'undefined') return 'voyager';
    const saved = window.localStorage.getItem(MAP_BASEMAP_STORAGE_KEY);
    return VALID.includes(saved as BasemapMode) ? (saved as BasemapMode) : 'voyager';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(MAP_BASEMAP_STORAGE_KEY, basemap);
  }, [basemap]);

  return [basemap, setBasemap] as const;
}
