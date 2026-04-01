import type { LegacyTripsStore, TripStore } from '@/domain/types';
import { LEGACY_STORAGE_KEY } from '@/domain/constants';
import { hybridTripToLegacy, legacyTripToHybrid, normalizeTrip } from '@/domain/migration';

export function loadStore(): TripStore {
  // 1. Try legacy format (primary storage)
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (raw) {
      const legacyStore: LegacyTripsStore = JSON.parse(raw);
      if (legacyStore?.trips?.length) {
        return {
          activeTripId: legacyStore.activeTripId,
          trips: legacyStore.trips.map((t, i) => legacyTripToHybrid(t, i * 8)),
        };
      }
    }
  } catch { /* ignore */ }
  // 2. Fall back to previous hybrid key (users who already used new app)
  try {
    const raw = localStorage.getItem('itinerary-hybrid-trips-v2');
    if (raw) {
      const parsed: TripStore = JSON.parse(raw);
      return { ...parsed, trips: parsed.trips.map(normalizeTrip) };
    }
  } catch { /* ignore */ }
  // 3. Oldest single-trip key
  try {
    const old = localStorage.getItem('itinerary-hybrid-v3');
    if (old) {
      const trip = normalizeTrip(JSON.parse(old));
      return { trips: [trip], activeTripId: trip.id };
    }
  } catch { /* ignore */ }
  return { trips: [], activeTripId: '' };
}

export function saveStore(store: TripStore) {
  const legacyStore: LegacyTripsStore = {
    activeTripId: store.activeTripId,
    trips: store.trips.map(hybridTripToLegacy),
  };
  localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(legacyStore));
}
