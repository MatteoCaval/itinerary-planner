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
  '#2167d7',
  '#615cf6',
  '#2db6ab',
  '#d78035',
  '#20b5a8',
  '#3b6dd8',
  '#c45c99',
  '#4c9463',
];
export const VISIT_TYPES: VisitType[] = ['landmark', 'museum', 'food', 'walk', 'shopping'];

function getTomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

export function createEmptyTrip(): HybridTrip {
  return {
    id: '_empty',
    name: 'New Trip',
    startDate: getTomorrow(),
    totalDays: 7,
    stays: [],
  };
}
