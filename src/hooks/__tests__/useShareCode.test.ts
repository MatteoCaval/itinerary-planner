import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useShareCode } from '../useShareCode';
import type { HybridTrip } from '@/domain/types';
import * as firebase from '@/firebase';

vi.mock('@/firebase', () => ({
  saveItinerary: vi.fn(),
  loadItinerary: vi.fn(),
  checkShareCodeExists: vi.fn(),
  deleteShareCode: vi.fn(),
  getShareCodeMeta: vi.fn(),
}));

function makeTrip(overrides: Partial<HybridTrip> = {}): HybridTrip {
  return {
    id: 'trip-1',
    name: 'Test Trip',
    startDate: '2025-01-01',
    totalDays: 3,
    stays: [],
    visits: [],
    routes: [],
    ...overrides,
  };
}

describe('useShareCode', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('createShareCode', () => {
    it('generates a code, saves to Firebase, and returns the code', async () => {
      vi.mocked(firebase.checkShareCodeExists).mockResolvedValue({ exists: false });
      vi.mocked(firebase.saveItinerary).mockResolvedValue({ success: true });

      const trip = makeTrip();
      const setTrip = vi.fn();
      const { result } = renderHook(() => useShareCode(trip, setTrip));

      let code: string | undefined;
      await act(async () => {
        code = await result.current.createShareCode('uid-1', 'readonly');
      });

      expect(code).toMatch(/^TRIP-[A-Z2-9]{6}$/);
      expect(firebase.saveItinerary).toHaveBeenCalledWith(
        code,
        expect.objectContaining({
          trip: expect.objectContaining({ id: 'trip-1' }),
          ownerUid: 'uid-1',
          mode: 'readonly',
        }),
      );
      expect(setTrip).toHaveBeenCalled();
    });

    it('retries on collision up to 3 times then extends length', async () => {
      vi.mocked(firebase.checkShareCodeExists)
        .mockResolvedValueOnce({ exists: true })
        .mockResolvedValueOnce({ exists: true })
        .mockResolvedValueOnce({ exists: true })
        .mockResolvedValue({ exists: false });
      vi.mocked(firebase.saveItinerary).mockResolvedValue({ success: true });

      const trip = makeTrip();
      const setTrip = vi.fn();
      const { result } = renderHook(() => useShareCode(trip, setTrip));

      let code: string | undefined;
      await act(async () => {
        code = await result.current.createShareCode('uid-1', 'readonly');
      });

      // After 3 collisions at length 6, should try length 7
      expect(code).toMatch(/^TRIP-[A-Z2-9]{7}$/);
      expect(firebase.checkShareCodeExists).toHaveBeenCalledTimes(4);
    });
  });

  describe('pushUpdate', () => {
    it('saves current trip state to existing share code', async () => {
      vi.mocked(firebase.loadItinerary).mockResolvedValue({
        success: true,
        data: {
          trip: makeTrip({ shareCode: 'TRIP-ABC123' }),
          createdAt: 1000,
          updatedAt: 1000,
          ownerUid: 'uid-1',
          mode: 'readonly',
        },
      });
      vi.mocked(firebase.saveItinerary).mockResolvedValue({ success: true });

      const trip = makeTrip({ shareCode: 'TRIP-ABC123' });
      const setTrip = vi.fn();
      const { result } = renderHook(() => useShareCode(trip, setTrip));

      await act(async () => {
        await result.current.pushUpdate('uid-1');
      });

      expect(firebase.saveItinerary).toHaveBeenCalledWith(
        'TRIP-ABC123',
        expect.objectContaining({
          trip: expect.objectContaining({ id: 'trip-1' }),
          ownerUid: 'uid-1',
        }),
      );
    });

    it('allows anonymous push (no uid) for writable trips', async () => {
      vi.mocked(firebase.loadItinerary).mockResolvedValue({
        success: true,
        data: {
          trip: makeTrip({ sourceShareCode: 'TRIP-XYZ789' }),
          createdAt: 1000,
          updatedAt: 1000,
          ownerUid: 'uid-owner',
          mode: 'writable',
        },
      });
      vi.mocked(firebase.saveItinerary).mockResolvedValue({ success: true });

      const trip = makeTrip({ sourceShareCode: 'TRIP-XYZ789' });
      const setTrip = vi.fn();
      const { result } = renderHook(() => useShareCode(trip, setTrip));

      await act(async () => {
        await result.current.pushToSource(null);
      });

      expect(firebase.saveItinerary).toHaveBeenCalledWith(
        'TRIP-XYZ789',
        expect.objectContaining({
          lastUpdatedBy: undefined,
        }),
      );
    });
  });

  describe('revokeShareCode', () => {
    it('deletes Firebase node and clears local shareCode', async () => {
      vi.mocked(firebase.deleteShareCode).mockResolvedValue({ success: true });

      const trip = makeTrip({ shareCode: 'TRIP-ABC123' });
      const setTrip = vi.fn();
      const { result } = renderHook(() => useShareCode(trip, setTrip));

      await act(async () => {
        await result.current.revokeShareCode();
      });

      expect(firebase.deleteShareCode).toHaveBeenCalledWith('TRIP-ABC123');
      expect(setTrip).toHaveBeenCalled();
    });
  });

  describe('checkForUpdate', () => {
    it('returns true when remote updatedAt is newer than importedAt', async () => {
      vi.mocked(firebase.getShareCodeMeta).mockResolvedValue({
        success: true,
        updatedAt: 2000,
        mode: 'readonly',
      });

      const trip = makeTrip({ sourceShareCode: 'TRIP-ABC123', importedAt: 1000 });
      const setTrip = vi.fn();
      const { result } = renderHook(() => useShareCode(trip, setTrip));

      let hasUpdate: boolean | undefined;
      await act(async () => {
        hasUpdate = await result.current.checkForUpdate();
      });

      expect(hasUpdate).toBe(true);
    });

    it('returns false when remote updatedAt equals importedAt', async () => {
      vi.mocked(firebase.getShareCodeMeta).mockResolvedValue({
        success: true,
        updatedAt: 1000,
        mode: 'readonly',
      });

      const trip = makeTrip({ sourceShareCode: 'TRIP-ABC123', importedAt: 1000 });
      const setTrip = vi.fn();
      const { result } = renderHook(() => useShareCode(trip, setTrip));

      let hasUpdate: boolean | undefined;
      await act(async () => {
        hasUpdate = await result.current.checkForUpdate();
      });

      expect(hasUpdate).toBe(false);
    });

    it('returns false and clears sourceShareCode when code is revoked', async () => {
      vi.mocked(firebase.getShareCodeMeta).mockResolvedValue({
        success: false,
        error: 'Share code not found',
      });

      const trip = makeTrip({ sourceShareCode: 'TRIP-ABC123', importedAt: 1000 });
      const setTrip = vi.fn();
      const { result } = renderHook(() => useShareCode(trip, setTrip));

      let hasUpdate: boolean | undefined;
      await act(async () => {
        hasUpdate = await result.current.checkForUpdate();
      });

      expect(hasUpdate).toBe(false);
      expect(setTrip).toHaveBeenCalled();
    });
  });
});
