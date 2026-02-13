import { describe, expect, it, vi, beforeEach } from 'vitest';
import { generateAIItinerary } from './aiService';
import { ApiError } from './services/httpClient';

vi.mock('./services/telemetry', () => ({
  trackError: vi.fn(),
}));

vi.mock('./services/httpClient', () => ({
  ApiError: class ApiError extends Error {
    status: number | null;
    code: string;
    details?: unknown;
    constructor(message: string, opts?: { status?: number | null; code?: string; details?: unknown }) {
      super(message);
      this.name = 'ApiError';
      this.status = opts?.status ?? null;
      this.code = opts?.code ?? 'unknown_error';
      this.details = opts?.details;
    }
  },
  fetchJson: vi.fn(),
}));

const { fetchJson } = await import('./services/httpClient');
const mockFetchJson = vi.mocked(fetchJson);

const settings = { apiKey: 'test-key', model: 'gemini-test' };
const days = [{ id: 'd1', date: '2026-03-01' }];

describe('generateAIItinerary', () => {
  beforeEach(() => vi.clearAllMocks());

  it('parses a valid Gemini JSON response', async () => {
    const geminiResponse = {
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify({
              explanation: 'Here is your plan.',
              locations: [{ id: 'loc1', name: 'Tower', lat: 48.8, lng: 2.3 }],
              routes: [{ id: 'rt1', fromLocationId: 'loc1', toLocationId: 'loc1', transportType: 'walk' }],
              days: [{ id: 'd1', accommodation: { name: 'Hotel', lat: 48.85, lng: 2.35 } }],
            }),
          }],
        },
      }],
    };

    mockFetchJson.mockResolvedValueOnce(geminiResponse);

    const result = await generateAIItinerary('Plan a trip', settings, days, [], [], 'scratch');

    expect(result.explanation).toBe('Here is your plan.');
    expect(result.locations).toHaveLength(1);
    expect(result.locations[0].name).toBe('Tower');
    expect(result.routes).toHaveLength(1);
    expect(result.days).toHaveLength(1);
  });

  it('strips markdown code fences from response', async () => {
    const content = '```json\n{"locations":[],"routes":[]}\n```';
    mockFetchJson.mockResolvedValueOnce({
      candidates: [{ content: { parts: [{ text: content }] } }],
    });

    const result = await generateAIItinerary('Plan', settings, days, [], [], 'scratch');
    expect(result.locations).toEqual([]);
    expect(result.routes).toEqual([]);
  });

  it('throws on empty candidates', async () => {
    mockFetchJson.mockResolvedValueOnce({ candidates: [] });

    await expect(
      generateAIItinerary('Plan', settings, days, [], [], 'scratch'),
    ).rejects.toThrow('AI returned no results.');
  });

  it('throws a friendly message on invalid JSON response', async () => {
    mockFetchJson.mockResolvedValueOnce({
      candidates: [{ content: { parts: [{ text: 'not valid json' }] } }],
    });

    await expect(
      generateAIItinerary('Plan', settings, days, [], [], 'scratch'),
    ).rejects.toThrow('AI returned invalid JSON format.');
  });

  it('maps 401 status to auth error message', async () => {
    const error = new (ApiError as unknown as new (msg: string, opts: Record<string, unknown>) => Error)(
      'Unauthorized',
      { status: 401, code: 'http_error' }
    );
    mockFetchJson.mockRejectedValueOnce(error);

    await expect(
      generateAIItinerary('Plan', settings, days, [], [], 'scratch'),
    ).rejects.toThrow(/API key is invalid/);
  });

  it('maps 429 status to rate limit message', async () => {
    const error = new (ApiError as unknown as new (msg: string, opts: Record<string, unknown>) => Error)(
      'Too many requests',
      { status: 429, code: 'http_error' }
    );
    mockFetchJson.mockRejectedValueOnce(error);

    await expect(
      generateAIItinerary('Plan', settings, days, [], [], 'scratch'),
    ).rejects.toThrow(/rate limit/);
  });

  it('maps timeout to friendly message', async () => {
    const error = new (ApiError as unknown as new (msg: string, opts: Record<string, unknown>) => Error)(
      'Aborted',
      { code: 'request_aborted' }
    );
    mockFetchJson.mockRejectedValueOnce(error);

    await expect(
      generateAIItinerary('Plan', settings, days, [], [], 'scratch'),
    ).rejects.toThrow(/timed out/);
  });

  it('uses default model when settings.model is empty', async () => {
    mockFetchJson.mockResolvedValueOnce({
      candidates: [{ content: { parts: [{ text: '{"locations":[],"routes":[]}' }] } }],
    });

    await generateAIItinerary('Plan', { apiKey: 'key', model: '' }, days, [], [], 'scratch');

    const calledUrl = mockFetchJson.mock.calls[0][0] as string;
    expect(calledUrl).toContain('gemini-3-flash-preview');
  });
});
