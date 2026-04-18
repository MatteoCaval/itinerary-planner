# Export to Code Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let logged-in users generate a share code for a trip, manage it (update/revoke/toggle mode), and let importers pull latest updates from the source.

**Architecture:** Reuse existing Firebase Realtime DB `itineraries/{code}` path. New `ShareCodeNode` wrapper around trip data with metadata. New `ShareTripDialog` modal for export/management. Top bar indicators for linked trips. `ImportFromCodeDialog` updated to store source metadata.

**Tech Stack:** React, TypeScript, Firebase Realtime DB, Vitest, Tailwind v4, shadcn/ui

---

## File Structure

| File                                             | Action | Responsibility                                                                                      |
| ------------------------------------------------ | ------ | --------------------------------------------------------------------------------------------------- |
| `src/domain/types.ts`                            | Modify | Add `shareCode`, `sourceShareCode`, `importedAt` to `HybridTrip`; add `ShareCodeNode` type          |
| `src/domain/shareCode.ts`                        | Create | Pure functions: `generateShareCode()`, `isShareCodeNode()` type guard                               |
| `src/domain/__tests__/shareCode.test.ts`         | Create | Tests for share code generation and type guard                                                      |
| `src/firebase.ts`                                | Modify | Update `saveItinerary` signature, add `checkShareCodeExists`, `deleteShareCode`, `getShareCodeMeta` |
| `src/hooks/useShareCode.ts`                      | Create | Hook: create/update/revoke share code, check for updates on linked trips                            |
| `src/hooks/__tests__/useShareCode.test.ts`       | Create | Tests for useShareCode hook                                                                         |
| `src/components/modals/ShareTripDialog.tsx`      | Create | Dialog: generate code, show existing code, copy, push update, revoke, toggle mode                   |
| `src/components/modals/ImportFromCodeDialog.tsx` | Modify | Store `sourceShareCode` and `importedAt` on imported trips                                          |
| `src/components/panels/ProfileMenu.tsx`          | Modify | Add "Share trip" menu item                                                                          |
| `src/App.tsx`                                    | Modify | Wire ShareTripDialog, add top bar share indicators, add pull-latest flow                            |

---

### Task 1: Add Types

**Files:**

- Modify: `src/domain/types.ts:60-71`

- [ ] **Step 1: Add share-related fields to HybridTrip and ShareCodeNode type**

In `src/domain/types.ts`, add optional fields to `HybridTrip` and the new `ShareCodeNode` type:

```typescript
// Add to HybridTrip (after the `routes` field):
  shareCode?: string;
  sourceShareCode?: string;
  importedAt?: number;
```

```typescript
// Add after HybridTrip type definition:
export type ShareCodeMode = 'readonly' | 'writable';

export type ShareCodeNode = {
  trip: HybridTrip;
  createdAt: number;
  updatedAt: number;
  ownerUid: string;
  mode: ShareCodeMode;
  lastUpdatedBy?: string;
};
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: Clean build, no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/domain/types.ts
git commit -m "feat(types): add ShareCodeNode and share metadata fields to HybridTrip"
```

---

### Task 2: Share Code Generation (Pure Domain Logic)

**Files:**

- Create: `src/domain/shareCode.ts`
- Create: `src/domain/__tests__/shareCode.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/domain/__tests__/shareCode.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { generateShareCode, isShareCodeNode, SHARE_CODE_CHARSET } from '../shareCode';

describe('generateShareCode', () => {
  it('returns a string matching TRIP-XXXXXX format', () => {
    const code = generateShareCode();
    expect(code).toMatch(/^TRIP-[A-Z2-9]{6}$/);
  });

  it('uses only non-ambiguous characters', () => {
    const ambiguous = ['O', '0', 'I', '1', 'L'];
    for (let i = 0; i < 50; i++) {
      const code = generateShareCode();
      const suffix = code.replace('TRIP-', '');
      for (const ch of suffix) {
        expect(ambiguous).not.toContain(ch);
      }
    }
  });

  it('generates unique codes across multiple calls', () => {
    const codes = new Set(Array.from({ length: 100 }, () => generateShareCode()));
    expect(codes.size).toBe(100);
  });

  it('generates a longer code when length param is provided', () => {
    const code = generateShareCode(7);
    expect(code).toMatch(/^TRIP-[A-Z2-9]{7}$/);
  });
});

describe('isShareCodeNode', () => {
  it('returns true for valid ShareCodeNode', () => {
    const node = {
      trip: {
        id: '1',
        name: 'Test',
        startDate: '2025-01-01',
        totalDays: 3,
        stays: [],
        visits: [],
        routes: [],
      },
      createdAt: 1000,
      updatedAt: 1000,
      ownerUid: 'uid-123',
      mode: 'readonly',
    };
    expect(isShareCodeNode(node)).toBe(true);
  });

  it('returns false for raw HybridTrip (legacy format)', () => {
    const raw = {
      id: '1',
      name: 'Test',
      startDate: '2025-01-01',
      totalDays: 3,
      stays: [],
      visits: [],
      routes: [],
    };
    expect(isShareCodeNode(raw)).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(isShareCodeNode(null)).toBe(false);
    expect(isShareCodeNode(undefined)).toBe(false);
  });
});

describe('SHARE_CODE_CHARSET', () => {
  it('has 29 characters (no O, 0, I, 1, L)', () => {
    expect(SHARE_CODE_CHARSET).toHaveLength(29);
    expect(SHARE_CODE_CHARSET).not.toContain('O');
    expect(SHARE_CODE_CHARSET).not.toContain('0');
    expect(SHARE_CODE_CHARSET).not.toContain('I');
    expect(SHARE_CODE_CHARSET).not.toContain('1');
    expect(SHARE_CODE_CHARSET).not.toContain('L');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/domain/__tests__/shareCode.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement share code generation**

Create `src/domain/shareCode.ts`:

```typescript
import type { ShareCodeNode } from './types';

export const SHARE_CODE_CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateShareCode(length = 6): string {
  const chars = new Array(length);
  const values = crypto.getRandomValues(new Uint8Array(length));
  for (let i = 0; i < length; i++) {
    chars[i] = SHARE_CODE_CHARSET[values[i] % SHARE_CODE_CHARSET.length];
  }
  return `TRIP-${chars.join('')}`;
}

export function isShareCodeNode(data: unknown): data is ShareCodeNode {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.ownerUid === 'string' &&
    typeof obj.createdAt === 'number' &&
    typeof obj.updatedAt === 'number' &&
    typeof obj.mode === 'string' &&
    obj.trip != null &&
    typeof obj.trip === 'object'
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/domain/__tests__/shareCode.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/shareCode.ts src/domain/__tests__/shareCode.test.ts
git commit -m "feat(domain): add share code generation and ShareCodeNode type guard"
```

---

### Task 3: Firebase Functions

**Files:**

- Modify: `src/firebase.ts:103-135`

- [ ] **Step 1: Update saveItinerary to accept ShareCodeNode data**

The existing `saveItinerary` already accepts `(passcode: string, data: unknown)` — its signature doesn't change. Callers will now pass a `ShareCodeNode` object instead of raw trip data. No change needed to the function itself.

- [ ] **Step 2: Add checkShareCodeExists function**

Add to `src/firebase.ts` after the existing `loadItinerary` function:

```typescript
export const checkShareCodeExists = async (
  code: string,
): Promise<{ exists: boolean; error?: string }> => {
  try {
    const { ref, get, child } = await import('firebase/database');
    const db = await getDb();
    const snapshot = await get(child(ref(db), `itineraries/${code}/ownerUid`));
    return { exists: snapshot.exists() };
  } catch (error) {
    trackError('share_code_check_failed', error, { code });
    return { exists: false, error: formatErrorMessage(error) };
  }
};

export const deleteShareCode = async (
  code: string,
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { ref, remove } = await import('firebase/database');
    const db = await getDb();
    await remove(ref(db, `itineraries/${code}`));
    return { success: true };
  } catch (error) {
    trackError('share_code_delete_failed', error, { code });
    return { success: false, error: formatErrorMessage(error) };
  }
};

export const getShareCodeMeta = async (
  code: string,
): Promise<{ success: boolean; updatedAt?: number; mode?: string; error?: string }> => {
  try {
    const { ref, get, child } = await import('firebase/database');
    const db = await getDb();
    const dbRef = ref(db);

    const [updatedAtSnap, modeSnap] = await Promise.all([
      get(child(dbRef, `itineraries/${code}/updatedAt`)),
      get(child(dbRef, `itineraries/${code}/mode`)),
    ]);

    if (!updatedAtSnap.exists()) {
      return { success: false, error: 'Share code not found' };
    }

    return {
      success: true,
      updatedAt: updatedAtSnap.val() as number,
      mode: modeSnap.val() as string,
    };
  } catch (error) {
    trackError('share_code_meta_failed', error, { code });
    return { success: false, error: formatErrorMessage(error) };
  }
};
```

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 4: Commit**

```bash
git add src/firebase.ts
git commit -m "feat(firebase): add checkShareCodeExists, deleteShareCode, getShareCodeMeta"
```

---

### Task 4: useShareCode Hook

**Files:**

- Create: `src/hooks/useShareCode.ts`
- Create: `src/hooks/__tests__/useShareCode.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/hooks/__tests__/useShareCode.test.ts`:

```typescript
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
          lastUpdatedBy: null,
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/hooks/__tests__/useShareCode.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement useShareCode hook**

Create `src/hooks/useShareCode.ts`:

```typescript
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
import { sanitizeForFirebase } from '@/firebase';
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/hooks/__tests__/useShareCode.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Run full test suite**

Run: `npm run test`
Expected: All existing + new tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useShareCode.ts src/hooks/__tests__/useShareCode.test.ts
git commit -m "feat(hooks): add useShareCode hook for share code lifecycle"
```

---

### Task 5: ShareTripDialog Component

**Files:**

- Create: `src/components/modals/ShareTripDialog.tsx`

- [ ] **Step 1: Create ShareTripDialog**

Create `src/components/modals/ShareTripDialog.tsx`:

```tsx
import { useState } from 'react';
import { Share2, Copy, Check, RefreshCw, Trash2, AlertCircle, Globe, Lock } from 'lucide-react';
import type { ShareCodeMode } from '@/domain/types';
import type { ShareCodeStatus } from '@/hooks/useShareCode';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type ShareTripDialogProps = {
  shareCode: string | undefined;
  status: ShareCodeStatus;
  error: string | null;
  onCreateCode: (mode: ShareCodeMode) => Promise<string | undefined>;
  onPushUpdate: () => Promise<boolean>;
  onRevoke: () => Promise<boolean>;
  onClose: () => void;
};

function ShareTripDialog({
  shareCode,
  status,
  error,
  onCreateCode,
  onPushUpdate,
  onRevoke,
  onClose,
}: ShareTripDialogProps) {
  const [mode, setMode] = useState<ShareCodeMode>('readonly');
  const [copied, setCopied] = useState(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);

  const handleCopy = async () => {
    if (!shareCode) return;
    await navigator.clipboard.writeText(shareCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreate = async () => {
    await onCreateCode(mode);
  };

  const handleRevoke = async () => {
    const ok = await onRevoke();
    if (ok) {
      setShowRevokeConfirm(false);
    }
  };

  const isLoading = status === 'loading';

  // ── Management view: existing share code ──
  if (shareCode) {
    return (
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <DialogContent className="sm:max-w-sm p-5">
          <DialogDescription className="sr-only">Manage your trip share code</DialogDescription>
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Share2 className="w-4 h-4 text-primary" />
              </div>
              <div>
                <DialogTitle className="font-extrabold text-foreground text-sm">
                  Trip shared
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Anyone with this code can import your trip.
                </p>
              </div>
            </div>
          </DialogHeader>

          {/* Share code display */}
          <button
            onClick={handleCopy}
            className="w-full mt-1 flex items-center justify-center gap-2 px-4 py-3 bg-muted rounded-lg border border-border hover:bg-muted/80 transition-colors group"
          >
            <span className="text-lg font-mono font-extrabold tracking-[0.2em] text-foreground">
              {shareCode}
            </span>
            {copied ? (
              <Check className="w-4 h-4 text-success flex-shrink-0" />
            ) : (
              <Copy className="w-4 h-4 text-muted-foreground group-hover:text-foreground flex-shrink-0 transition-colors" />
            )}
          </button>
          {copied && (
            <p className="text-[11px] font-semibold text-success text-center -mt-1">
              Copied to clipboard
            </p>
          )}

          {error && (
            <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-destructive/10 text-red-600">
              <AlertCircle className="w-3.5 h-3.5" />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onPushUpdate}
              disabled={isLoading}
              className="w-full text-xs font-bold gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Push latest changes
            </Button>

            {showRevokeConfirm ? (
              <div className="flex flex-col gap-2 p-3 bg-destructive/5 rounded-lg border border-destructive/20">
                <p className="text-xs text-destructive font-semibold">
                  This will permanently disable the share code. Anyone who has it won't be able to
                  import or pull updates.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowRevokeConfirm(false)}
                    className="flex-1 text-xs font-bold"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleRevoke}
                    disabled={isLoading}
                    className="flex-1 text-xs font-bold gap-1.5"
                  >
                    <Trash2 className="w-3 h-3" />
                    Revoke
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowRevokeConfirm(true)}
                className="w-full text-xs font-semibold text-destructive hover:text-destructive hover:bg-destructive/10 gap-2"
              >
                <Trash2 className="w-3 h-3" />
                Revoke share code
              </Button>
            )}
          </div>

          <div className="flex gap-2 mt-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-xs font-semibold"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Create view: no share code yet ──
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-sm p-5">
        <DialogDescription className="sr-only">
          Generate a share code for your trip
        </DialogDescription>
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Share2 className="w-4 h-4 text-primary" />
            </div>
            <div>
              <DialogTitle className="font-extrabold text-foreground text-sm">
                Share trip
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Generate a code that anyone can use to import this trip.
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Mode picker */}
        <div className="flex flex-col gap-2 mt-1">
          <button
            onClick={() => setMode('readonly')}
            className={`flex items-start gap-3 p-3 rounded-lg border transition-colors text-left ${
              mode === 'readonly'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-border/80'
            }`}
          >
            <Lock
              className={`w-4 h-4 mt-0.5 flex-shrink-0 ${mode === 'readonly' ? 'text-primary' : 'text-muted-foreground'}`}
            />
            <div>
              <p className="text-xs font-bold text-foreground">Read only</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Only you can push updates. Others can import and pull.
              </p>
            </div>
          </button>
          <button
            onClick={() => setMode('writable')}
            className={`flex items-start gap-3 p-3 rounded-lg border transition-colors text-left ${
              mode === 'writable'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-border/80'
            }`}
          >
            <Globe
              className={`w-4 h-4 mt-0.5 flex-shrink-0 ${mode === 'writable' ? 'text-primary' : 'text-muted-foreground'}`}
            />
            <div>
              <p className="text-xs font-bold text-foreground">Anyone can update</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Anyone with the code can push changes.
              </p>
            </div>
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-destructive/10 text-red-600 mt-1">
            <AlertCircle className="w-3.5 h-3.5" />
            {error}
          </div>
        )}

        <div className="flex gap-2 mt-3">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 text-xs font-semibold"
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 text-xs font-bold gap-2"
          >
            {isLoading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Share2 className="w-3.5 h-3.5" />
            )}
            Generate code
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ShareTripDialog;
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 3: Commit**

```bash
git add src/components/modals/ShareTripDialog.tsx
git commit -m "feat(ui): add ShareTripDialog for code generation and management"
```

---

### Task 6: Update ImportFromCodeDialog

**Files:**

- Modify: `src/components/modals/ImportFromCodeDialog.tsx`

- [ ] **Step 1: Update onImport to include source metadata**

In `src/components/modals/ImportFromCodeDialog.tsx`, update the import handling to store `sourceShareCode` and `importedAt`. Modify lines 82-89:

Replace:

```typescript
// Ensure unique ID
trip = normalizeTrip({ ...trip, id: crypto.randomUUID() });
setStatus({ type: 'success', message: `Loaded "${trip.name}"!` });
setTimeout(() => {
  onImport(trip);
  onClose();
}, 800);
```

With:

```typescript
// Ensure unique ID and store source metadata for pull-latest
trip = normalizeTrip({
  ...trip,
  id: crypto.randomUUID(),
  sourceShareCode: trimmed,
  importedAt: Date.now(),
  shareCode: undefined, // don't inherit owner's share code
});
setStatus({ type: 'success', message: `Loaded "${trip.name}"!` });
setTimeout(() => {
  onImport(trip);
  onClose();
}, 800);
```

Also update the data extraction to handle the new wrapped format. Import `isShareCodeNode` and update lines 50-76.

Add import at top:

```typescript
import { isShareCodeNode } from '@/domain/shareCode';
```

Replace the data handling block (lines 51-76):

```typescript
const raw = result.data;
// Unwrap ShareCodeNode if present (new format), otherwise treat as raw trip (legacy)
const data = (isShareCodeNode(raw) ? raw.trip : raw) as Record<string, unknown>;
```

This replaces `const data = result.data as Record<string, unknown>;` at line 51.

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 3: Commit**

```bash
git add src/components/modals/ImportFromCodeDialog.tsx
git commit -m "feat(import): store source metadata and handle ShareCodeNode wrapper"
```

---

### Task 7: Add "Share trip" to ProfileMenu

**Files:**

- Modify: `src/components/panels/ProfileMenu.tsx`

- [ ] **Step 1: Add Share trip menu item and onShareTrip prop**

In `src/components/panels/ProfileMenu.tsx`:

Add `Share2` to the lucide import:

```typescript
import { Download, Upload, User, LogIn, LogOut, Lock, Check, Compass, Share2 } from 'lucide-react';
```

Add `onShareTrip` to the component props:

```typescript
function ProfileMenu({
  trip,
  onImport,
  onImportFromCode,
  onShareTrip,
  onGoHome,
  onSignOut,
}: {
  trip: HybridTrip;
  onImport: (data: HybridTrip) => void;
  onImportFromCode: () => void;
  onShareTrip: () => void;
  onGoHome: () => void;
  onSignOut: () => void;
}) {
```

Add the "Share trip" menu item after the "Import from code" item (after line 180):

```tsx
<DropdownMenuItem onClick={onShareTrip}>
  <div className="size-6 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
    <Share2 className="w-3 h-3 text-primary" />
  </div>
  Share trip
</DropdownMenuItem>
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 3: Commit**

```bash
git add src/components/panels/ProfileMenu.tsx
git commit -m "feat(menu): add Share trip item to ProfileMenu"
```

---

### Task 8: Wire Everything in App.tsx

**Files:**

- Modify: `src/App.tsx`

This task integrates all the pieces. Changes are grouped by area.

- [ ] **Step 1: Add imports and state**

Add imports near the top of App.tsx (with other imports):

```typescript
import ShareTripDialog from '@/components/modals/ShareTripDialog';
import { useShareCode } from '@/hooks/useShareCode';
import { Link2, Upload } from 'lucide-react';
```

Add state variables near the other modal states (around line 303 area where `showImportCode` is):

```typescript
const [showShareDialog, setShowShareDialog] = useState(false);
const [showPullConfirm, setShowPullConfirm] = useState(false);
```

- [ ] **Step 2: Initialize useShareCode hook**

After the `useCloudSync` hook call (around line 349), add:

```typescript
const {
  status: shareStatus,
  error: shareError,
  updateAvailable,
  remoteMode,
  createShareCode,
  pushUpdate,
  pushToSource,
  revokeShareCode,
  checkForUpdate,
  pullLatest,
} = useShareCode(trip, (updater) => {
  setStore((s) => {
    const updated = updater(s.trips.find((t) => t.id === s.activeTripId)!);
    const next = {
      ...s,
      trips: s.trips.map((t) => (t.id === updated.id ? updated : t)),
    };
    saveStore(next);
    return next;
  });
});
```

- [ ] **Step 3: Add check-for-update effect**

After the hook initialization, add an effect that checks for updates when the active trip changes:

```typescript
// Check for share code updates on trip load
useEffect(() => {
  if (trip.sourceShareCode) {
    checkForUpdate();
  }
}, [trip.id, trip.sourceShareCode, checkForUpdate]);
```

- [ ] **Step 4: Add handleShareTrip with auth gate**

Near the other handler functions (around line 641 area), add:

```typescript
const handleShareTrip = () => {
  if (!user) {
    // Show auth modal, then after login open share dialog
    // We use a ref to track pending action
    setShowShareDialog(true);
    return;
  }
  setShowShareDialog(true);
};

const handlePullLatest = async (saveCopy: boolean) => {
  const addTrip = (newTrip: HybridTrip) => {
    setStore((s) => {
      const next = { ...s, trips: [...s.trips, newTrip] };
      saveStore(next);
      return next;
    });
  };
  await pullLatest(saveCopy, addTrip);
  setShowPullConfirm(false);
};
```

- [ ] **Step 5: Add top bar share indicators**

In the header area, between the mobile sync dot (line 980) and the ProfileMenu (line 987), add the share code indicators:

```tsx
{
  /* Share code indicators */
}
{
  trip.shareCode && (
    <button
      onClick={() => setShowShareDialog(true)}
      className="hidden sm:flex items-center gap-1.5 text-[11px] font-bold text-primary bg-primary/8 px-2.5 py-1 rounded-lg transition-colors hover:bg-primary/15 flex-shrink-0"
      title="This trip has an active share code"
    >
      <Share2 className="w-3 h-3" />
      <span className="font-mono tracking-wider">{trip.shareCode}</span>
    </button>
  );
}
{
  trip.sourceShareCode && (
    <button
      onClick={() => (updateAvailable ? setShowPullConfirm(true) : undefined)}
      className={`hidden sm:flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-lg transition-colors flex-shrink-0 ${
        updateAvailable
          ? 'text-info bg-info/10 hover:bg-info/20 cursor-pointer'
          : 'text-muted-foreground bg-muted/50'
      }`}
      title={
        updateAvailable ? 'Update available — click to pull latest' : 'Linked to a shared trip'
      }
    >
      <Link2 className="w-3 h-3" />
      {updateAvailable && <span className="size-1.5 rounded-full bg-info animate-pulse" />}
    </button>
  );
}
{
  trip.sourceShareCode && remoteMode === 'writable' && (
    <button
      onClick={() => pushToSource(user?.uid ?? null)}
      className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground bg-muted/50 px-2 py-1 rounded-lg transition-colors hover:bg-muted flex-shrink-0"
      title="Push your changes to the shared trip"
    >
      <Upload className="w-3 h-3" />
    </button>
  );
}
```

- [ ] **Step 6: Update ProfileMenu to pass onShareTrip**

Find the existing ProfileMenu rendering (around line 987) and add the `onShareTrip` prop:

```tsx
<ProfileMenu
  trip={trip}
  onImport={(data) => setTrip(() => data)}
  onImportFromCode={() => setShowImportCode(true)}
  onShareTrip={handleShareTrip}
  onGoHome={handleGoHome}
  onSignOut={handleSignOut}
/>
```

- [ ] **Step 7: Render ShareTripDialog and PullConfirm dialog**

Near the other dialog renderings (around line 3014 where ImportFromCodeDialog is rendered), add:

```tsx
{
  showShareDialog &&
    (user ? (
      <ShareTripDialog
        shareCode={trip.shareCode}
        status={shareStatus}
        error={shareError}
        onCreateCode={(mode) => createShareCode(user.uid, mode)}
        onPushUpdate={() => pushUpdate(user.uid)}
        onRevoke={revokeShareCode}
        onClose={() => setShowShareDialog(false)}
      />
    ) : (
      <AuthModalSimple onClose={() => setShowShareDialog(false)} />
    ));
}

{
  showPullConfirm && (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) setShowPullConfirm(false);
      }}
    >
      <DialogContent className="sm:max-w-sm p-5">
        <DialogDescription className="sr-only">Pull latest version of this trip</DialogDescription>
        <DialogHeader>
          <DialogTitle className="font-extrabold text-foreground text-sm">
            Update available
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            A newer version of this trip is available. Would you like to save a copy of your current
            version before updating?
          </p>
        </DialogHeader>
        <div className="flex flex-col gap-2 mt-3">
          <Button onClick={() => handlePullLatest(true)} className="w-full text-xs font-bold">
            Save copy & update
          </Button>
          <Button
            variant="outline"
            onClick={() => handlePullLatest(false)}
            className="w-full text-xs font-semibold"
          >
            Update without saving
          </Button>
          <Button
            variant="ghost"
            onClick={() => setShowPullConfirm(false)}
            className="w-full text-xs font-semibold text-muted-foreground"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

Note: The pull confirm dialog uses the same Dialog/DialogContent/DialogHeader imports already present in App.tsx. If they're not imported yet, add the necessary shadcn imports.

- [ ] **Step 8: Verify build passes**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 9: Run full test suite**

Run: `npm run test`
Expected: All tests pass.

- [ ] **Step 10: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire share code flow — dialog, top bar indicators, pull-latest"
```

---

### Task 9: Update PRD and Docs

**Files:**

- Modify: `docs/PRD.md`

- [ ] **Step 1: Update PRD with export-to-code feature**

Add "Share via Code" to the Features section and Feature Status table in `docs/PRD.md`. Update the Data Model section to mention `shareCode`, `sourceShareCode`, and `importedAt` fields on HybridTrip.

- [ ] **Step 2: Commit**

```bash
git add docs/PRD.md
git commit -m "docs: add share-via-code feature to PRD"
```

---

### Task 10: Manual QA Checklist

No code changes — this is a verification task.

- [ ] **Step 1: Test the full share flow**

1. Log in
2. Open ProfileMenu → "Share trip"
3. Select "Read only" → "Generate code"
4. Verify code appears in dialog and top bar
5. Copy code

- [ ] **Step 2: Test import flow**

1. Open another browser/incognito
2. Import from code using copied code
3. Verify trip loads correctly
4. Verify top bar shows link icon

- [ ] **Step 3: Test push update**

1. On owner's browser: make changes, open share dialog, push update
2. On importer's browser: reload, verify update indicator appears
3. Click indicator → "Save copy & update"
4. Verify old trip is preserved, new data loaded

- [ ] **Step 4: Test revoke**

1. Open share dialog → Revoke
2. Confirm revocation
3. Verify code disappears from top bar
4. On importer side: verify "no longer available" on next check

- [ ] **Step 5: Test writable mode**

1. Share a trip with "Anyone can update" mode
2. Import on another browser
3. Verify push button appears in top bar
4. Push changes from importer side
5. Verify owner can pull the changes

- [ ] **Step 6: Test auth gate**

1. Log out
2. Try "Share trip" from ProfileMenu
3. Verify auth modal appears
4. Log in → verify share dialog opens

- [ ] **Step 7: Test edge cases**

1. Import from a code that doesn't exist → verify error message
2. Try sharing a trip that already has a code → verify existing code shown
3. Delete shared node from Firebase console → verify graceful handling on both sides
