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
