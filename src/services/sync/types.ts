import type { HybridTrip } from '@/domain/types';

export type SyncStatus = 'local' | 'saving' | 'saved' | 'error';

export interface LoadResult {
  trips: HybridTrip[];
  activeTripId: string;
  /** 'cloud' = data came from Firebase. 'empty' = no cloud data existed (first login). */
  source: 'cloud' | 'empty';
}

export type Unsubscribe = () => void;

export interface SyncCallbacks {
  onTripUpdated: (trip: HybridTrip) => void;
  onTripDeleted: (tripId: string) => void;
  onActiveTripIdChanged: (id: string) => void;
  onError: (message: string) => void;
}

export interface SyncService {
  loadTrips(uid: string): Promise<LoadResult>;
  saveTrip(uid: string, trip: HybridTrip): Promise<void>;
  deleteTrip(uid: string, tripId: string): Promise<void>;
  saveActiveTripId(uid: string, id: string): Promise<void>;
  subscribe(uid: string, callbacks: SyncCallbacks): Unsubscribe;
}

export interface PendingMerge {
  /** Cloud-only trips (not in local) — used to build the merge result. */
  cloudTrips: HybridTrip[];
  /** Full cloud store — used when user picks "use cloud only". */
  allCloudTrips: HybridTrip[];
  cloudActiveTripId: string;
}
