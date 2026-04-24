import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({ name: 'mock-app' })),
  getApps: vi.fn(() => []),
  getApp: vi.fn(() => ({ name: 'mock-app' })),
}));

vi.mock('firebase/database', () => ({
  getDatabase: vi.fn(() => ({ __mock: 'db' })),
  ref: vi.fn((_db: unknown, path: string) => ({ path })),
  push: vi.fn().mockResolvedValue({ key: 'mock-id' }),
  serverTimestamp: vi.fn(() => 'SERVER_TS_SENTINEL'),
}));

vi.mock('@/services/telemetry', () => ({
  trackError: vi.fn(),
  trackEvent: vi.fn(),
}));

import * as firebaseDb from 'firebase/database';
import { submitFeedback } from './firebase';
import { trackError } from '@/services/telemetry';

describe('submitFeedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects empty text without hitting Firebase', async () => {
    const result = await submitFeedback('');
    expect(result).toEqual({ success: false, error: 'Feedback cannot be empty.' });
    expect(firebaseDb.push).not.toHaveBeenCalled();
  });

  it('rejects whitespace-only text without hitting Firebase', async () => {
    const result = await submitFeedback('   \n\t  ');
    expect(result).toEqual({ success: false, error: 'Feedback cannot be empty.' });
    expect(firebaseDb.push).not.toHaveBeenCalled();
  });

  it('rejects text longer than 2000 characters without hitting Firebase', async () => {
    const result = await submitFeedback('x'.repeat(2001));
    expect(result).toEqual({
      success: false,
      error: 'Feedback is too long (max 2000 characters).',
    });
    expect(firebaseDb.push).not.toHaveBeenCalled();
  });

  it('trims text and pushes { text, timestamp } to /feedback on success', async () => {
    const result = await submitFeedback('   Hello world   ');
    expect(result).toEqual({ success: true });
    expect(firebaseDb.ref).toHaveBeenCalledWith(expect.anything(), 'feedback');
    expect(firebaseDb.push).toHaveBeenCalledTimes(1);
    const pushedPayload = vi.mocked(firebaseDb.push).mock.calls[0][1];
    expect(pushedPayload).toEqual({
      text: 'Hello world',
      timestamp: 'SERVER_TS_SENTINEL',
    });
  });

  it('reports failure and records telemetry when push throws', async () => {
    vi.mocked(firebaseDb.push).mockRejectedValueOnce(new Error('network down'));
    const result = await submitFeedback('some real feedback');
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(trackError).toHaveBeenCalledWith(
      'feedback_submit_failed',
      expect.objectContaining({ message: 'network down' }),
    );
  });
});
