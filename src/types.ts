export type TransportType = 'walk' | 'car' | 'bus' | 'train' | 'flight' | 'ferry' | 'other';
export type DaySection = 'morning' | 'afternoon' | 'evening';

export interface Route {
  id: string;
  fromLocationId: string;
  toLocationId: string;
  transportType: TransportType;
  duration?: string;      // e.g., "2h 30m"
  cost?: string;          // e.g., "$50"
  notes?: string;
}

export interface Day {
  id: string;
  date: string;           // ISO date string YYYY-MM-DD
  label?: string;         // Optional custom label like "Day 1 - Rome"
}

export interface Itinerary {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  days: Day[];
}

export interface Location {
  id: string;
  name: string;
  lat: number;
  lng: number;
  notes?: string;
  dayIds: string[];       // Deprecated: kept for backward compatibility if needed, but primary source of truth should be startDayId + duration
  startDayId?: string;    // The day this location/activity starts
  startSlot?: DaySection; // The section of the day it starts
  duration?: number;      // Duration in "slots" (1 slot = 1 section of a day). Default 1.
  order: number;          // Order within the itinerary (global or per slot?)
}

// Transport type colors for map routes
export const TRANSPORT_COLORS: Record<TransportType, string> = {
  walk: '#22c55e',    // green
  car: '#3b82f6',     // blue
  bus: '#f97316',     // orange
  train: '#a855f7',   // purple
  flight: '#ef4444',  // red
  ferry: '#06b6d4',   // cyan
  other: '#6b7280',   // gray
};

// Transport type labels
export const TRANSPORT_LABELS: Record<TransportType, string> = {
  walk: '🚶 Walk',
  car: '🚗 Car',
  bus: '🚌 Bus',
  train: '🚆 Train',
  flight: '✈️ Flight',
  ferry: '⛴️ Ferry',
  other: '📍 Other',
};
