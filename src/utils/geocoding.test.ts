import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../services/telemetry', () => ({
  trackError: vi.fn(),
}));

vi.mock('../services/httpClient', () => ({
  fetchJson: vi.fn(),
}));

const { fetchJson } = await import('../services/httpClient');
const mockFetchJson = vi.mocked(fetchJson);

// Dynamically import after mocking
const { searchPlace, reverseGeocode } = await import('./geocoding');

describe('searchPlace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array for blank query', async () => {
    const result = await searchPlace('');
    expect(result).toEqual([]);
    expect(mockFetchJson).not.toHaveBeenCalled();
  });

  it('returns empty array for whitespace-only query', async () => {
    const result = await searchPlace('   ');
    expect(result).toEqual([]);
    expect(mockFetchJson).not.toHaveBeenCalled();
  });

  it('returns results from Nominatim API', async () => {
    const mockResults = [
      { place_id: 1, display_name: 'Paris, France', lat: '48.85', lon: '2.35' },
    ];
    mockFetchJson.mockResolvedValueOnce(mockResults);

    const result = await searchPlace('Paris');

    expect(result).toEqual(mockResults);
    expect(mockFetchJson).toHaveBeenCalledTimes(1);

    const calledUrl = mockFetchJson.mock.calls[0][0] as string;
    expect(calledUrl).toContain('nominatim.openstreetmap.org/search');
    expect(calledUrl).toContain('q=Paris');
  });

  it('returns cached results on second call', async () => {
    const mockResults = [
      { place_id: 2, display_name: 'Tokyo, Japan', lat: '35.68', lon: '139.69' },
    ];
    mockFetchJson.mockResolvedValueOnce(mockResults);

    const first = await searchPlace('Tokyo');
    const second = await searchPlace('Tokyo');

    expect(first).toEqual(mockResults);
    expect(second).toEqual(mockResults);
    // Only one fetch call because second was cached
    expect(mockFetchJson).toHaveBeenCalledTimes(1);
  });

  it('returns empty array on network error', async () => {
    mockFetchJson.mockRejectedValueOnce(new Error('Network error'));

    const result = await searchPlace('FailCity');
    expect(result).toEqual([]);
  });
});

describe('reverseGeocode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns display_name from API response', async () => {
    mockFetchJson.mockResolvedValueOnce({ display_name: 'Eiffel Tower, Paris' });

    const result = await reverseGeocode(48.8584, 2.2945);
    expect(result).toBe('Eiffel Tower, Paris');
  });

  it('returns fallback string on error', async () => {
    mockFetchJson.mockRejectedValueOnce(new Error('fail'));

    const result = await reverseGeocode(40.0, -74.0);
    expect(result).toContain('Location at');
    expect(result).toContain('40.0000');
  });

  it('returns fallback when display_name is empty', async () => {
    mockFetchJson.mockResolvedValueOnce({});

    const result = await reverseGeocode(51.5, -0.12);
    expect(result).toContain('Location at');
    expect(result).toContain('51.5000');
  });
});
