import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { User } from 'firebase/auth';
import { saveStore } from '@/lib/persistence';
import type { HybridTrip, TripStore } from '@/domain/types';
import type { PendingMerge, SyncService, SyncStatus } from '@/services/sync/types';

export interface UseCloudSyncResult {
  syncStatus: SyncStatus;
  syncError: string | null;
  setSyncError: (e: string | null) => void;
  pendingMerge: PendingMerge | null;
  handleMergeDecision: (decision: 'merge' | 'keep-local' | 'use-cloud') => void;
  dismissMerge: () => void;
  remoteUpdateToast: { tripName: string } | null;
  dismissRemoteToast: () => void;
}

export function useCloudSync(
  service: SyncService,
  store: TripStore,
  setStore: Dispatch<SetStateAction<TripStore>>,
  user: User | null,
): UseCloudSyncResult {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [pendingMerge, setPendingMerge] = useState<PendingMerge | null>(null);
  const [remoteUpdateToast, setRemoteUpdateToast] = useState<{ tripName: string } | null>(null);

  const syncedUidRef = useRef<string | null>(null);
  const storeRef = useRef(store);
  useEffect(() => { storeRef.current = store; });

  const lastPushedRef = useRef<Record<string, HybridTrip>>({});
  const lastPushedAtRef = useRef<Record<string, number>>({});
  const hasPendingSaveRef = useRef(false);
  const activeTripIdRef = useRef(store.activeTripId);
  useEffect(() => { activeTripIdRef.current = store.activeTripId; });

  // True once the initial loadTrips call has completed. Suppresses toast for
  // the subscriber's first fire (which replays current state, not a new change).
  const initialLoadDoneRef = useRef(false);

  // Seed lastPushedRef/lastPushedAtRef for a set of trips, but only if the
  // subscriber hasn't already seeded a given trip (subscribe wins the race).
  const seedIfUnseen = useCallback((trips: HybridTrip[]) => {
    trips.forEach((t) => {
      if (!(t.id in lastPushedAtRef.current)) {
        lastPushedRef.current[t.id] = t;
        lastPushedAtRef.current[t.id] = t.updatedAt ?? 0;
      }
    });
  }, []);

  // ── Load on login ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) {
      setSyncStatus('local');
      setSyncError(null);
      setPendingMerge(null);
      setRemoteUpdateToast(null);
      syncedUidRef.current = null;
      lastPushedRef.current = {};
      lastPushedAtRef.current = {};
      initialLoadDoneRef.current = false;
      return;
    }

    if (syncedUidRef.current === user.uid) return;
    syncedUidRef.current = user.uid;

    (async () => {
      try {
        const result = await service.loadTrips(user.uid);
        const currentStore = storeRef.current;

        if (result.source === 'empty') {
          await Promise.all(currentStore.trips.map((t) => service.saveTrip(user.uid, t)));
          seedIfUnseen(currentStore.trips);
          if (currentStore.activeTripId) {
            await service.saveActiveTripId(user.uid, currentStore.activeTripId);
          }
          return;
        }

        const cloudTrips = result.trips;
        const localIds = new Set(currentStore.trips.map((t) => t.id));
        const cloudOnlyTrips = cloudTrips.filter((t) => !localIds.has(t.id));

        if (cloudOnlyTrips.length === 0) {
          // All cloud trips have matching local IDs. Pick winner per-trip by updatedAt.
          const cloudById = Object.fromEntries(cloudTrips.map((t) => [t.id, t]));
          const mergedTrips = currentStore.trips.map((local) => {
            const cloud = cloudById[local.id];
            if (!cloud) return local;
            return (cloud.updatedAt ?? 0) > (local.updatedAt ?? 0) ? cloud : local;
          });

          const hasCloudWins = mergedTrips.some((t, i) => t !== currentStore.trips[i]);
          if (hasCloudWins) {
            const next: TripStore = { ...currentStore, trips: mergedTrips };
            setStore(() => next);
            saveStore(next);
          }

          // Push locally-newer trips to cloud (saveTrip guards against overwriting newer cloud data)
          await Promise.all(mergedTrips.map((t) => service.saveTrip(user.uid, t)));
          seedIfUnseen(mergedTrips);
          return;
        }

        if (currentStore.trips.length === 0) {
          const next: TripStore = {
            trips: cloudTrips,
            activeTripId: result.activeTripId || (cloudTrips[0]?.id ?? ''),
          };
          setStore(() => next);
          saveStore(next);
          seedIfUnseen(cloudTrips);
          return;
        }

        setPendingMerge({
          cloudTrips: cloudOnlyTrips,
          allCloudTrips: cloudTrips,
          cloudActiveTripId: result.activeTripId,
        });
        seedIfUnseen(cloudTrips);
      } catch {
        setSyncError('Could not load your trips from the cloud. Your local trips are safe.');
      } finally {
        initialLoadDoneRef.current = true;
      }
    })();
  }, [user, service, setStore, seedIfUnseen]);

  // ── Real-time listener ────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const unsubscribe = service.subscribe(user.uid, {
      onTripUpdated: (trip) => {
        const lastAt = lastPushedAtRef.current[trip.id];
        if (lastAt !== undefined && trip.updatedAt !== undefined && trip.updatedAt <= lastAt) {
          return;
        }

        setStore((prev) => {
          const idx = prev.trips.findIndex((t) => t.id === trip.id);
          if (idx === -1) return { ...prev, trips: [...prev.trips, trip] };
          if ((trip.updatedAt ?? 0) <= (prev.trips[idx].updatedAt ?? 0)) return prev;
          const trips = [...prev.trips];
          trips[idx] = trip;
          return { ...prev, trips };
        });

        // Always seed — subscribe wins over load effect's deferred seeding
        lastPushedRef.current[trip.id] = trip;
        lastPushedAtRef.current[trip.id] = trip.updatedAt ?? 0;

        // Only toast after initial load — subscriber always fires once on connect
        // with current state, which is not a new change
        if (trip.id === activeTripIdRef.current && initialLoadDoneRef.current) {
          setRemoteUpdateToast({ tripName: trip.name });
        }
      },

      onTripDeleted: (tripId) => {
        // Clean up tracking refs so auto-save doesn't see this as a local deletion to propagate
        delete lastPushedRef.current[tripId];
        delete lastPushedAtRef.current[tripId];

        setStore((prev) => {
          const remaining = prev.trips.filter((t) => t.id !== tripId);
          const next = {
            ...prev,
            trips: remaining,
            activeTripId:
              prev.activeTripId === tripId ? (remaining[0]?.id ?? '') : prev.activeTripId,
          };
          saveStore(next);
          return next;
        });
      },

      onActiveTripIdChanged: (id) => {
        if (hasPendingSaveRef.current) return;
        setStore((prev) => {
          if (prev.activeTripId === id) return prev;
          return { ...prev, activeTripId: id };
        });
      },

      onError: (message) => {
        setSyncError(message);
      },
    });

    return unsubscribe;
  }, [user, service, setStore]);

  // ── Auto-save on trips change ─────────────────────────────────────────────
  useEffect(() => {
    if (!user || pendingMerge) {
      if (!user) setSyncStatus('local');
      return;
    }

    const changedTrips = store.trips.filter((t) => lastPushedRef.current[t.id] !== t);

    // Detect trips that were tracked but no longer exist locally → deleted
    const currentIds = new Set(store.trips.map((t) => t.id));
    const deletedIds = Object.keys(lastPushedRef.current).filter((id) => !currentIds.has(id));

    if (changedTrips.length === 0 && deletedIds.length === 0) return;

    setSyncStatus('saving');
    hasPendingSaveRef.current = true;

    const timer = setTimeout(async () => {
      try {
        const now = Date.now();

        // Save changed trips
        if (changedTrips.length > 0) {
          const stamped = changedTrips.map((t) => ({ ...t, updatedAt: now }));
          await Promise.all(stamped.map((t) => service.saveTrip(user.uid, t)));
          stamped.forEach((t) => { lastPushedAtRef.current[t.id] = now; });
        }

        // Delete removed trips from cloud
        if (deletedIds.length > 0) {
          await Promise.all(deletedIds.map((id) => service.deleteTrip(user.uid, id)));
          deletedIds.forEach((id) => {
            delete lastPushedRef.current[id];
            delete lastPushedAtRef.current[id];
          });
        }

        store.trips.forEach((t) => { lastPushedRef.current[t.id] = t; });

        setSyncStatus('saved');
      } catch {
        setSyncStatus('error');
      } finally {
        hasPendingSaveRef.current = false;
      }
    }, 2000);

    return () => {
      clearTimeout(timer);
      hasPendingSaveRef.current = false;
    };
  }, [store.trips, user, pendingMerge, service]);

  // ── Save activeTripId on change ───────────────────────────────────────────
  useEffect(() => {
    if (!user || !store.activeTripId) return;
    service.saveActiveTripId(user.uid, store.activeTripId);
  }, [store.activeTripId, user, service]);

  // ── Merge decision ────────────────────────────────────────────────────────
  const handleMergeDecision = useCallback(
    (decision: 'merge' | 'keep-local' | 'use-cloud') => {
      if (!pendingMerge || !user) {
        setPendingMerge(null);
        return;
      }

      const { cloudTrips, allCloudTrips, cloudActiveTripId } = pendingMerge;
      const currentStore = storeRef.current;
      let next: TripStore;

      if (decision === 'merge') {
        const merged = [...currentStore.trips, ...cloudTrips];
        next = { trips: merged, activeTripId: currentStore.activeTripId || (merged[0]?.id ?? '') };
      } else if (decision === 'keep-local') {
        next = currentStore;
      } else {
        next = {
          trips: allCloudTrips,
          activeTripId: cloudActiveTripId || (allCloudTrips[0]?.id ?? ''),
        };
      }

      setPendingMerge(null);
      setStore(() => next);
      saveStore(next);

      Promise.all(next.trips.map((t) => service.saveTrip(user.uid, t))).catch(() => {
        setSyncError('Could not sync your decision to the cloud. Changes saved locally.');
      });
    },
    [pendingMerge, user, service, setStore],
  );

  return {
    syncStatus,
    syncError,
    setSyncError,
    pendingMerge,
    handleMergeDecision,
    dismissMerge: useCallback(() => setPendingMerge(null), []),
    remoteUpdateToast,
    dismissRemoteToast: useCallback(() => setRemoteUpdateToast(null), []),
  };
}
