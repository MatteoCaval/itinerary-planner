import type { DayPart, HybridTrip, TravelMode, VisitType } from './types';

export const LEGACY_STORAGE_KEY = 'itinerary-trips-v1';

export const DAY_PARTS: DayPart[] = ['morning', 'afternoon', 'evening'];
export const TRAVEL_MODES: TravelMode[] = ['train', 'flight', 'drive', 'ferry', 'bus', 'walk'];
export const TRANSPORT_LABELS: Record<TravelMode, string> = {
  train: 'Train',
  flight: 'Flight',
  drive: 'Drive',
  ferry: 'Ferry',
  bus: 'Bus',
  walk: 'Walk',
};
export const STAY_COLORS = [
  '#b8304f', // Claret
  '#c15a2a', // Rust
  '#2e3f8a', // Indigo
  '#6b7a3a', // Olive
  '#7b3b6b', // Plum
  '#3a4a5a', // Slate
  '#a7772b', // Ochre
  '#3d6b4a', // Moss
];
export const VISIT_TYPES: VisitType[] = ['landmark', 'museum', 'food', 'walk', 'shopping'];

function getTomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

export function createEmptyTrip(): HybridTrip {
  return {
    id: `trip-${Date.now()}`,
    name: 'New Trip',
    stays: [],
    candidateStays: [],
    visits: [],
    routes: [],
    startDate: getTomorrow(),
    totalDays: 7,
    version: 3,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
