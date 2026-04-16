import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('firebase/database', () => ({
  ref: vi.fn((db, path) => ({ path })),
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
  child: vi.fn(),
}));

vi.mock('@/firebase', () => ({
  getDb: vi.fn().mockResolvedValue({}),
  sanitizeForFirebase: (x: unknown) => x,
  restoreArrays: (x: unknown) => x,
}));

vi.mock('@/services/telemetry', () => ({
  trackError: vi.fn(),
  trackEvent: vi.fn(),
}));

vi.mock('@/domain/migration', () => ({
  normalizeTrip: (x: unknown) => x,
  needsMigrationToV2: () => false,
  migrateV1toV2: (x: unknown) => x,
}));

import * as firebaseDb from 'firebase/database';
import { FirebaseSyncService } from '../firebase';
import type { HybridTrip } from '@/domain/types';

function makeTrip(id: string, updatedAt: number): HybridTrip {
  return {
    id,
    name: 'Test',
    startDate: '2025-01-01',
    totalDays: 3,
    version: 2,
    updatedAt,
    createdAt: updatedAt,
    stays: [],
    visits: [],
    routes: [],
  };
}

describe('FirebaseSyncService.saveTrip', () => {
  const service = new FirebaseSyncService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('saves trip when cloud has no updatedAt (first save)', async () => {
    vi.mocked(firebaseDb.get).mockResolvedValue({
      exists: () => true,
      val: () => ({ id: 'trip-1', name: 'Test', updatedAt: undefined }),
    } as any);

    const trip = makeTrip('trip-1', 1000);
    await service.saveTrip('uid-1', trip);

    expect(firebaseDb.set).toHaveBeenCalledOnce();
  });

  it('saves trip when local updatedAt is newer than cloud', async () => {
    vi.mocked(firebaseDb.get).mockResolvedValue({
      exists: () => true,
      val: () => ({ id: 'trip-1', updatedAt: 500 }),
    } as any);

    const trip = makeTrip('trip-1', 1000);
    await service.saveTrip('uid-1', trip);

    expect(firebaseDb.set).toHaveBeenCalledOnce();
  });

  it('skips save when cloud updatedAt is newer than local', async () => {
    vi.mocked(firebaseDb.get).mockResolvedValue({
      exists: () => true,
      val: () => ({ id: 'trip-1', updatedAt: 9999 }),
    } as any);

    const trip = makeTrip('trip-1', 1000);
    await service.saveTrip('uid-1', trip);

    expect(firebaseDb.set).not.toHaveBeenCalled();
  });

  it('saves trip when cloud node does not exist yet', async () => {
    vi.mocked(firebaseDb.get).mockResolvedValue({
      exists: () => false,
      val: () => null,
    } as any);

    const trip = makeTrip('trip-1', 1000);
    await service.saveTrip('uid-1', trip);

    expect(firebaseDb.set).toHaveBeenCalledOnce();
  });
});
