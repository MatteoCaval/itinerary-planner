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
          if (currentStore.activeTripId) {
            await service.saveActiveTripId(user.uid, currentStore.activeTripId);
          }
          return;
        }

        const cloudTrips = result.trips;
        const localIds = new Set(currentStore.trips.map((t) => t.id));
        const cloudOnlyTrips = cloudTrips.filter((t) => !localIds.has(t.id));

        if (cloudOnlyTrips.length === 0) {
          if (currentStore.trips.length > 0) {
            await Promise.all(currentStore.trips.map((t) => service.saveTrip(user.uid, t)));
          }
          return;
        }

        if (currentStore.trips.length === 0) {
          const next: TripStore = {
            trips: cloudTrips,
            activeTripId: result.activeTripId || (cloudTrips[0]?.id ?? ''),
          };
          setStore(() => next);
          saveStore(next);
          return;
        }

        setPendingMerge({
          cloudTrips: cloudOnlyTrips,
          allCloudTrips: cloudTrips,
          cloudActiveTripId: result.activeTripId,
        });
      } catch {
        setSyncError('Could not load your trips from the cloud. Your local trips are safe.');
      }
    })();
  }, [user, service, setStore]);

  // ── Real-time listener ────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const unsubscribe = service.subscribe(user.uid, {
      onTripUpdated: (trip) => {
        const lastAt = lastPushedAtRef.current[trip.id];
        if (lastAt !== undefined && trip.updatedAt !== undefined && trip.updatedAt <= lastAt) {
          return;
        }

        if (trip.id === activeTripIdRef.current) {
          setRemoteUpdateToast({ tripName: trip.name });
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
      },

      onTripDeleted: (tripId) => {
        setStore((prev) => ({
          ...prev,
          trips: prev.trips.filter((t) => t.id !== tripId),
          activeTripId:
            prev.activeTripId === tripId ? (prev.trips[0]?.id ?? '') : prev.activeTripId,
        }));
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
    if (!user || store.trips.length === 0 || pendingMerge) {
      if (!user) setSyncStatus('local');
      return;
    }

    const changedTrips = store.trips.filter((t) => lastPushedRef.current[t.id] !== t);
    if (changedTrips.length === 0) return;

    setSyncStatus('saving');
    hasPendingSaveRef.current = true;

    const timer = setTimeout(async () => {
      try {
        const now = Date.now();
        const stamped = changedTrips.map((t) => ({ ...t, updatedAt: now }));
        await Promise.all(stamped.map((t) => service.saveTrip(user.uid, t)));

        stamped.forEach((t) => { lastPushedAtRef.current[t.id] = now; });
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
