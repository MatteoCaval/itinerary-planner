import type { LegacyTripsStore, TripStore, V1HybridTrip } from '@/domain/types';
import { LEGACY_STORAGE_KEY } from '@/domain/constants';
import {
  migrateV1toV2,
  migrateV2toV3,
  needsMigrationToV2,
  needsMigrationToV3,
  normalizeTrip,
  legacyTripToHybrid,
  hybridTripToLegacy,
} from '@/domain/migration';

export function loadStore(): TripStore {
  // 1. Try v2 native format
  try {
    const raw = localStorage.getItem('itinerary-store-v2');
    if (raw) {
      const parsed: TripStore = JSON.parse(raw);
      return {
        ...parsed,
        trips: parsed.trips.map((t) => {
          let migrated = normalizeTrip(t);
          if (needsMigrationToV2(migrated)) {
            migrated = migrateV1toV2(migrated as unknown as V1HybridTrip);
          }
          if (needsMigrationToV3(migrated)) {
            migrated = migrateV2toV3(migrated);
          }
          return migrated;
        }),
      };
    }
  } catch {
    /* ignore */
  }

  // 2. Try legacy format (primary old storage)
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
  } catch {
    /* ignore */
  }

  // 3. Try previous hybrid keys and migrate to v2
  try {
    const raw = localStorage.getItem('itinerary-hybrid-trips-v2');
    if (raw) {
      const parsed: TripStore = JSON.parse(raw);
      return {
        ...parsed,
        trips: parsed.trips.map((t) => {
          let migrated = normalizeTrip(t);
          if (needsMigrationToV2(migrated)) {
            migrated = migrateV1toV2(migrated as unknown as V1HybridTrip);
          }
          if (needsMigrationToV3(migrated)) {
            migrated = migrateV2toV3(migrated);
          }
          return migrated;
        }),
      };
    }
  } catch {
    /* ignore */
  }

  // 4. Oldest single-trip key
  try {
    const old = localStorage.getItem('itinerary-hybrid-v3');
    if (old) {
      const parsed = JSON.parse(old);
      let trip = normalizeTrip(parsed);
      if (needsMigrationToV2(trip)) {
        trip = migrateV1toV2(trip as unknown as V1HybridTrip);
      }
      if (needsMigrationToV3(trip)) {
        trip = migrateV2toV3(trip);
      }
      return { trips: [trip], activeTripId: trip.id };
    }
  } catch {
    /* ignore */
  }

  return { trips: [], activeTripId: '' };
}

export function saveStore(store: TripStore) {
  // Save as v2 native format
  localStorage.setItem('itinerary-store-v2', JSON.stringify(store));
  // Also save to legacy key for backward compat
  const legacyStore: LegacyTripsStore = {
    activeTripId: store.activeTripId,
    trips: store.trips.map(hybridTripToLegacy),
  };
  localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(legacyStore));
}
