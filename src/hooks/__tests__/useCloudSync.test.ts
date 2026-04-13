import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useCloudSync } from '../useCloudSync';
import type { SyncService } from '@/services/sync/types';
import type { TripStore, HybridTrip } from '@/domain/types';

function makeTrip(id: string, updatedAt = 1000): HybridTrip {
  return {
    id,
    name: `Trip ${id}`,
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

function makeMockService(overrides: Partial<SyncService> = {}): SyncService {
  return {
    loadTrips: vi.fn().mockResolvedValue({ trips: [], activeTripId: '', source: 'empty' }),
    saveTrip: vi.fn().mockResolvedValue(undefined),
    deleteTrip: vi.fn().mockResolvedValue(undefined),
    saveActiveTripId: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockReturnValue(() => {}),
    ...overrides,
  };
}

const EMPTY_STORE: TripStore = { trips: [], activeTripId: '' };

describe('useCloudSync', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('does not load trips when user is null', () => {
    const service = makeMockService();
    const setStore = vi.fn();
    renderHook(() => useCloudSync(service, EMPTY_STORE, setStore, null));
    expect(service.loadTrips).not.toHaveBeenCalled();
  });

  it('loads trips on login and pulls cloud when local is empty', async () => {
    const cloudTrip = makeTrip('cloud-1');
    const service = makeMockService({
      loadTrips: vi.fn().mockResolvedValue({
        trips: [cloudTrip],
        activeTripId: 'cloud-1',
        source: 'cloud',
      }),
    });
    const setStore = vi.fn();
    const user = { uid: 'user-1' } as any;

    renderHook(() => useCloudSync(service, EMPTY_STORE, setStore, user));

    // Flush all microtasks so the async loadTrips effect resolves
    await act(async () => {
      await Promise.resolve();
    });

    expect(setStore).toHaveBeenCalled();
    const updater = setStore.mock.calls[0][0];
    const next = updater(EMPTY_STORE);
    expect(next.trips).toEqual([cloudTrip]);
    expect(next.activeTripId).toBe('cloud-1');
  });

  it('sets pendingMerge when both sides have unique trips', async () => {
    const localTrip = makeTrip('local-1');
    const cloudTrip = makeTrip('cloud-1');
    const store: TripStore = { trips: [localTrip], activeTripId: 'local-1' };
    const service = makeMockService({
      loadTrips: vi.fn().mockResolvedValue({
        trips: [cloudTrip],
        activeTripId: 'cloud-1',
        source: 'cloud',
      }),
    });
    const setStore = vi.fn();
    const user = { uid: 'user-1' } as any;

    const { result } = renderHook(() => useCloudSync(service, store, setStore, user));

    // Flush all microtasks so the async loadTrips effect resolves
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.pendingMerge).not.toBeNull();
    expect(result.current.pendingMerge?.allCloudTrips).toEqual([cloudTrip]);
    expect(result.current.pendingMerge?.cloudTrips).toEqual([cloudTrip]);
  });

  it('does not auto-save when store.trips is empty', async () => {
    const service = makeMockService();
    const setStore = vi.fn();
    const user = { uid: 'user-1' } as any;

    renderHook(() => useCloudSync(service, EMPTY_STORE, setStore, user));

    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(service.saveTrip).not.toHaveBeenCalled();
  });

  it('auto-saves changed trips after 2s debounce', async () => {
    const trip = makeTrip('trip-1');
    const store: TripStore = { trips: [trip], activeTripId: 'trip-1' };
    const service = makeMockService({
      loadTrips: vi.fn().mockResolvedValue({ trips: [], activeTripId: '', source: 'empty' }),
    });
    const setStore = vi.fn();
    const user = { uid: 'user-1' } as any;

    renderHook(() => useCloudSync(service, store, setStore, user));

    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(service.saveTrip).toHaveBeenCalled();
  });
});
