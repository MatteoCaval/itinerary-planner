import { useCallback, useRef, useState } from 'react';
import type { HybridTrip, ShareCodeMode, ShareCodeNode } from '@/domain/types';
import { generateShareCode } from '@/domain/shareCode';
import {
  saveItinerary,
  checkShareCodeExists,
  deleteShareCode,
  getShareCodeMeta,
  loadItinerary,
} from '@/firebase';
import { isShareCodeNode } from '@/domain/shareCode';
import { normalizeTrip } from '@/domain/migration';

export type ShareCodeStatus = 'idle' | 'loading' | 'success' | 'error';

export function useShareCode(
  trip: HybridTrip,
  setTrip: (updater: (prev: HybridTrip) => HybridTrip) => void,
) {
  const [status, setStatus] = useState<ShareCodeStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [remoteMode, setRemoteMode] = useState<ShareCodeMode | null>(null);
  const tripRef = useRef(trip);
  tripRef.current = trip;

  const createShareCode = useCallback(
    async (ownerUid: string, mode: ShareCodeMode): Promise<string | undefined> => {
      setStatus('loading');
      setError(null);

      // If trip already has a share code, return it
      if (tripRef.current.shareCode) {
        setStatus('success');
        return tripRef.current.shareCode;
      }

      let code: string | undefined;
      let length = 6;

      // Try generating a unique code
      for (let attempt = 0; attempt < 6; attempt++) {
        if (attempt === 3) length = 7;
        const candidate = generateShareCode(length);
        const { exists, error: checkErr } = await checkShareCodeExists(candidate);
        if (checkErr) {
          setStatus('error');
          setError(checkErr);
          return undefined;
        }
        if (!exists) {
          code = candidate;
          break;
        }
      }

      if (!code) {
        setStatus('error');
        setError('Failed to generate a unique share code. Please try again.');
        return undefined;
      }

      const now = Date.now();
      const node: ShareCodeNode = {
        trip: { ...tripRef.current, shareCode: code },
        createdAt: now,
        updatedAt: now,
        ownerUid,
        mode,
        lastUpdatedBy: ownerUid,
      };

      const result = await saveItinerary(code, node);
      if (!result.success) {
        setStatus('error');
        setError(result.error ?? 'Failed to save share code.');
        return undefined;
      }

      setTrip((prev) => ({ ...prev, shareCode: code! }));
      setStatus('success');
      return code;
    },
    [setTrip],
  );

  const pushUpdate = useCallback(
    async (uid: string | null): Promise<boolean> => {
      const shareCode = tripRef.current.shareCode;
      if (!shareCode) return false;

      setStatus('loading');
      setError(null);

      // Fetch existing node to preserve ownerUid and mode
      const existing = await loadItinerary(shareCode);
      if (!existing.success || !existing.data || !isShareCodeNode(existing.data)) {
        setStatus('error');
        setError('Share code no longer exists.');
        setTrip((prev) => ({ ...prev, shareCode: undefined }));
        return false;
      }

      const existingNode = existing.data as ShareCodeNode;
      const now = Date.now();
      const updatedNode: ShareCodeNode = {
        ...existingNode,
        trip: { ...tripRef.current },
        updatedAt: now,
        lastUpdatedBy: uid ?? undefined,
      };

      const result = await saveItinerary(shareCode, updatedNode);
      if (!result.success) {
        setStatus('error');
        setError(result.error ?? 'Failed to push update.');
        return false;
      }

      setStatus('success');
      return true;
    },
    [setTrip],
  );

  const pushToSource = useCallback(
    async (uid: string | null): Promise<boolean> => {
      const sourceCode = tripRef.current.sourceShareCode;
      if (!sourceCode) return false;

      setStatus('loading');
      setError(null);

      // Fetch existing node to preserve metadata
      const existing = await loadItinerary(sourceCode);
      if (!existing.success || !existing.data || !isShareCodeNode(existing.data)) {
        setStatus('error');
        setError('Share code no longer exists.');
        setTrip((prev) => ({ ...prev, sourceShareCode: undefined }));
        return false;
      }

      const existingNode = existing.data as ShareCodeNode;
      const now = Date.now();
      const updatedNode: ShareCodeNode = {
        ...existingNode,
        trip: {
          ...tripRef.current,
          sourceShareCode: undefined,
          importedAt: undefined,
          shareCode: undefined,
        },
        updatedAt: now,
        lastUpdatedBy: uid ?? undefined,
      };

      const result = await saveItinerary(sourceCode, updatedNode);
      if (!result.success) {
        setStatus('error');
        setError(result.error ?? 'Failed to push update.');
        return false;
      }

      setTrip((prev) => ({ ...prev, importedAt: now }));
      setStatus('success');
      return true;
    },
    [setTrip],
  );

  const revokeShareCode = useCallback(async (): Promise<boolean> => {
    const shareCode = tripRef.current.shareCode;
    if (!shareCode) return false;

    setStatus('loading');
    setError(null);

    const result = await deleteShareCode(shareCode);
    if (!result.success) {
      setStatus('error');
      setError(result.error ?? 'Failed to revoke share code.');
      return false;
    }

    setTrip((prev) => ({ ...prev, shareCode: undefined }));
    setStatus('success');
    return true;
  }, [setTrip]);

  const checkForUpdate = useCallback(async (): Promise<boolean> => {
    const sourceCode = tripRef.current.sourceShareCode;
    if (!sourceCode) return false;

    const meta = await getShareCodeMeta(sourceCode);
    if (!meta.success) {
      // Code was revoked or doesn't exist
      setTrip((prev) => ({ ...prev, sourceShareCode: undefined }));
      setUpdateAvailable(false);
      setRemoteMode(null);
      return false;
    }

    const importedAt = tripRef.current.importedAt ?? 0;
    const hasUpdate = (meta.updatedAt ?? 0) > importedAt;
    setUpdateAvailable(hasUpdate);
    setRemoteMode((meta.mode as ShareCodeMode) ?? null);
    return hasUpdate;
  }, [setTrip]);

  const pullLatest = useCallback(
    async (saveCopy: boolean, addTrip: (trip: HybridTrip) => void): Promise<boolean> => {
      const sourceCode = tripRef.current.sourceShareCode;
      if (!sourceCode) return false;

      setStatus('loading');
      setError(null);

      const result = await loadItinerary(sourceCode);
      if (!result.success || !result.data) {
        setStatus('error');
        setError('Share code no longer available.');
        setTrip((prev) => ({ ...prev, sourceShareCode: undefined }));
        setUpdateAvailable(false);
        return false;
      }

      const data = result.data;
      let remoteTrip: HybridTrip;
      if (isShareCodeNode(data)) {
        remoteTrip = data.trip;
      } else {
        remoteTrip = data as HybridTrip;
      }

      // Save copy of current trip if requested
      if (saveCopy) {
        const copy: HybridTrip = {
          ...tripRef.current,
          id: crypto.randomUUID(),
          name: `${tripRef.current.name} (before update)`,
          shareCode: undefined,
          sourceShareCode: undefined,
          importedAt: undefined,
        };
        addTrip(normalizeTrip(copy));
      }

      // Overwrite current trip with remote data, keep local ID and source link
      const now = Date.now();
      setTrip((prev) =>
        normalizeTrip({
          ...remoteTrip,
          id: prev.id,
          sourceShareCode: sourceCode,
          importedAt: now,
          shareCode: undefined,
        }),
      );

      setUpdateAvailable(false);
      setStatus('success');
      return true;
    },
    [setTrip],
  );

  return {
    status,
    error,
    updateAvailable,
    remoteMode,
    createShareCode,
    pushUpdate,
    pushToSource,
    revokeShareCode,
    checkForUpdate,
    pullLatest,
  };
}
