import { trackError } from '@/services/telemetry';
import {
  normalizeTrip,
  needsMigrationToV2,
  migrateV1toV2,
  needsMigrationToV3,
  migrateV2toV3,
} from '@/domain/migration';
import type { HybridTrip, TripStore, V1HybridTrip } from '@/domain/types';
import { getDb, sanitizeForFirebase, restoreArrays } from '@/firebase';
import type { LoadResult, SyncCallbacks, SyncService, Unsubscribe } from './types';

function normalizeAndMigrate(raw: unknown): HybridTrip {
  let trip = normalizeTrip(raw as HybridTrip);
  if (needsMigrationToV2(trip)) {
    trip = migrateV1toV2(trip as unknown as V1HybridTrip);
  }
  if (needsMigrationToV3(trip)) {
    trip = migrateV2toV3(trip);
  }
  return trip;
}

export class FirebaseSyncService implements SyncService {
  async loadTrips(uid: string): Promise<LoadResult> {
    try {
      const { ref, get, child } = await import('firebase/database');
      const db = await getDb();
      const dbRef = ref(db);

      // Check for per-trip nodes (already migrated)
      const tripsSnapshot = await get(child(dbRef, `users/${uid}/trips`));
      if (tripsSnapshot.exists()) {
        const raw = restoreArrays(tripsSnapshot.val()) as Record<string, unknown>;
        const trips = Object.values(raw).map(normalizeAndMigrate);
        const activeSnap = await get(child(dbRef, `users/${uid}/activeTripId`));
        const activeTripId = activeSnap.exists() ? String(activeSnap.val()) : (trips[0]?.id ?? '');
        return { trips, activeTripId, source: 'cloud' };
      }

      // Check for legacy blob and migrate
      const legacySnap = await get(child(dbRef, `users/${uid}/tripStore`));
      if (legacySnap.exists()) {
        return this._migrateLegacyBlob(uid, legacySnap.val());
      }

      return { trips: [], activeTripId: '', source: 'empty' };
    } catch (error) {
      trackError('sync_load_failed', error, { uid });
      throw error;
    }
  }

  private async _migrateLegacyBlob(uid: string, raw: unknown): Promise<LoadResult> {
    const { ref, set, remove } = await import('firebase/database');
    const db = await getDb();

    const blob = raw as Partial<TripStore>;
    const trips = (blob.trips ?? []).map(normalizeAndMigrate);
    const activeTripId = blob.activeTripId ?? trips[0]?.id ?? '';

    // Write each trip to its own node (idempotent — safe to retry)
    await Promise.all(
      trips.map((trip) => set(ref(db, `users/${uid}/trips/${trip.id}`), sanitizeForFirebase(trip))),
    );
    await set(ref(db, `users/${uid}/activeTripId`), activeTripId);

    // Only delete legacy blob after all writes succeed
    await remove(ref(db, `users/${uid}/tripStore`));

    return { trips, activeTripId, source: 'cloud' };
  }

  async saveTrip(uid: string, trip: HybridTrip): Promise<void> {
    try {
      const { ref, get, set } = await import('firebase/database');
      const db = await getDb();
      const tripRef = ref(db, `users/${uid}/trips/${trip.id}`);

      const snapshot = await get(tripRef);
      if (snapshot.exists()) {
        const cloud = snapshot.val() as { updatedAt?: number };
        const cloudUpdatedAt = cloud.updatedAt ?? 0;
        const localUpdatedAt = trip.updatedAt ?? 0;
        if (localUpdatedAt < cloudUpdatedAt) return; // cloud is newer — don't overwrite
      }

      await set(tripRef, sanitizeForFirebase(trip));
    } catch (error) {
      trackError('sync_save_trip_failed', error, { uid, tripId: trip.id });
      throw error;
    }
  }

  async deleteTrip(uid: string, tripId: string): Promise<void> {
    try {
      const { ref, remove } = await import('firebase/database');
      const db = await getDb();
      await remove(ref(db, `users/${uid}/trips/${tripId}`));
    } catch (error) {
      trackError('sync_delete_trip_failed', error, { uid, tripId });
      throw error;
    }
  }

  async saveActiveTripId(uid: string, id: string): Promise<void> {
    try {
      const { ref, set } = await import('firebase/database');
      const db = await getDb();
      await set(ref(db, `users/${uid}/activeTripId`), id);
    } catch (error) {
      trackError('sync_save_active_trip_id_failed', error, { uid });
      // Non-critical — don't rethrow
    }
  }

  subscribe(uid: string, callbacks: SyncCallbacks): Unsubscribe {
    let unsubFns: Array<() => void> = [];
    let cancelled = false;

    (async () => {
      try {
        const [{ ref, onValue }, db] = await Promise.all([
          import('firebase/database'),
          getDb(),
        ]);

        if (cancelled) return;

        // Listen to per-trip nodes
        const tripsRef = ref(db, `users/${uid}/trips`);
        let previousKeys = new Set<string>();

        const unsubTrips = onValue(
          tripsRef,
          (snapshot) => {
            if (!snapshot.exists()) {
              previousKeys.forEach((k) => callbacks.onTripDeleted(k));
              previousKeys.clear();
              return;
            }
            const raw = restoreArrays(snapshot.val()) as Record<string, unknown>;
            const currentKeys = new Set(Object.keys(raw));

            // Detect deletions
            previousKeys.forEach((k) => {
              if (!currentKeys.has(k)) callbacks.onTripDeleted(k);
            });

            // Notify updates
            Object.values(raw).forEach((t) => {
              callbacks.onTripUpdated(normalizeAndMigrate(t));
            });

            previousKeys = currentKeys;
          },
          (error) => callbacks.onError(error instanceof Error ? error.message : 'Sync listener failed'),
        );

        // Listen to activeTripId
        const activeRef = ref(db, `users/${uid}/activeTripId`);
        const unsubActive = onValue(
          activeRef,
          (snapshot) => {
            if (snapshot.exists()) {
              callbacks.onActiveTripIdChanged(String(snapshot.val()));
            }
          },
          (error) => callbacks.onError(error instanceof Error ? error.message : 'Sync listener failed'),
        );

        unsubFns = [unsubTrips, unsubActive];
      } catch (error) {
        callbacks.onError(error instanceof Error ? error.message : 'Sync listener failed');
      }
    })();

    return () => {
      cancelled = true;
      unsubFns.forEach((fn) => fn());
    };
  }
}
