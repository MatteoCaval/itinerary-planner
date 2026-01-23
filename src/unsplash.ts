// Unsplash API Utility

const ACCESS_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;

export const searchPhoto = async (query: string): Promise<string | null> => {
  if (!ACCESS_KEY) {
    console.warn("Unsplash API Key missing. Skipping image fetch.");
    return null;
  }

  try {
    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`,
      {
        headers: {
          Authorization: `Client-ID ${ACCESS_KEY}`
        }
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    if (data.results && data.results.length > 0) {
      return data.results[0].urls.regular;
    }
    return null;
  } catch (error) {
    console.error("Error fetching image:", error);
    return null;
  }
};
