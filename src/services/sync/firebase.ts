import { trackError } from '@/services/telemetry';
import { normalizeTrip, needsMigrationToV2, migrateV1toV2 } from '@/domain/migration';
import type { HybridTrip, TripStore, V1HybridTrip } from '@/domain/types';
import { getDb, sanitizeForFirebase, restoreArrays } from '@/firebase';
import type { LoadResult, SyncCallbacks, SyncService, Unsubscribe } from './types';

function normalizeAndMigrate(raw: unknown): HybridTrip {
  const normalized = normalizeTrip(raw as HybridTrip);
  return needsMigrationToV2(normalized)
    ? migrateV1toV2(normalized as unknown as V1HybridTrip)
    : normalized;
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

  async saveTrip(_uid: string, _trip: HybridTrip): Promise<void> {
    throw new Error('Not implemented');
  }

  async deleteTrip(_uid: string, _tripId: string): Promise<void> {
    throw new Error('Not implemented');
  }

  async saveActiveTripId(_uid: string, _id: string): Promise<void> {
    throw new Error('Not implemented');
  }

  subscribe(_uid: string, _callbacks: SyncCallbacks): Unsubscribe {
    throw new Error('Not implemented');
  }
}
