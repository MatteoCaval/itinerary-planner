import { FirebaseSyncService } from './firebase';
import type { SyncService } from './types';

export type {
  SyncService,
  SyncCallbacks,
  LoadResult,
  PendingMerge,
  SyncStatus,
} from './types';

let instance: SyncService | null = null;

/** Returns a shared SyncService instance (singleton per app session). */
export function createSyncService(): SyncService {
  if (!instance) {
    instance = new FirebaseSyncService();
  }
  return instance;
}
