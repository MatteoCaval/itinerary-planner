// Unsplash API Utility

import { fetchJson } from './services/httpClient';
import { trackError } from './services/telemetry';

const ACCESS_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;

interface UnsplashSearchResponse {
  results?: {
    urls?: {
      regular?: string;
    };
  }[];
}

export const searchPhoto = async (query: string): Promise<string | null> => {
  if (!ACCESS_KEY) {
    return null;
  }

  try {
    const data = await fetchJson<UnsplashSearchResponse>(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`,
      {
        headers: {
          Authorization: `Client-ID ${ACCESS_KEY}`
        },
        retries: 1,
        retryDelayMs: 500,
        timeoutMs: 12000,
      }
    );
    return data.results?.[0]?.urls?.regular || null;
  } catch (error) {
    trackError('unsplash_search_failed', error, { query });
    return null;
  }
};
