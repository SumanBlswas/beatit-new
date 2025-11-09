// services/saavnService.ts
import {
    ApiAlbum,
    ApiArtist,
    ApiPlaylist,
    ApiSong,
    HomePageData
} from "./apiTypes";

// Base URL for your Saavn API proxy
const API_BASE_URL = "https://suman-api.vercel.app";

/**
 * Fetch homepage data from possible endpoints.
 * Tries multiple endpoints until one succeeds.
 */
export const getHomePageData = async (): Promise<HomePageData | null> => {
  try {
    const possibleEndpoints = [
      `${API_BASE_URL}/modules?language=hindi`,
      `${API_BASE_URL}/modules`,
      `${API_BASE_URL}/home`,
      `${API_BASE_URL}/featured`,
      `${API_BASE_URL}/trending`,
    ];

    let lastError: any = null;

    for (const endpoint of possibleEndpoints) {
      try {
        console.log(`Trying endpoint: ${endpoint}`);
        const response = await fetch(endpoint);

        if (response.ok) {
          const text = await response.text();

          try {
            const json = JSON.parse(text);

            if (json.success !== false && json.data) {
              console.log(`Success with endpoint: ${endpoint}`);
              return json.data as HomePageData;
            } else if (
              json.success !== false &&
              !json.data &&
              typeof json === "object"
            ) {
              console.log(`Success with endpoint (unwrapped): ${endpoint}`);
              return json as HomePageData;
            }
          } catch (parseError) {
            console.warn(`Parse error for ${endpoint}:`, parseError);
            continue;
          }
        } else {
          console.warn(`HTTP ${response.status} for ${endpoint}`);
          continue;
        }
      } catch (networkError) {
        console.warn(`Network error for ${endpoint}:`, networkError);
        lastError = networkError;
        continue;
      }
    }

    console.log("All homepage endpoints failed, trying search fallback...");
    return await getHomepageFallback();
  } catch (error) {
    console.error("Error in getHomePageData:", error);
    return null;
  }
};

/**
 * Fallback: Search some popular queries and construct a homepage-like structure.
 */
const getHomepageFallback = async (): Promise<HomePageData | null> => {
  try {
    const popularQueries = [
      "hindi songs",
      "bollywood",
      "trending",
      "arijit singh",
      "latest",
    ];

    for (const query of popularQueries) {
      try {
        const searchResult = await searchSongs(query, 1, 20);
        if (searchResult && searchResult.songs.length > 0) {
          return {
            trending: {
              data: searchResult.songs.map((song) => ({
                ...song,
                type: "song" as const,
              })),
              position: 1,
            },
          } as HomePageData;
        }
      } catch {
        // Ignore errors here, try next query
      }
    }
    return null;
  } catch (error) {
    console.error("Fallback failed:", error);
    return null;
  }
};

/**
 * Fetch song details by song ID.
 */
export const getSongDetails = async (
  songId: string
): Promise<ApiSong | null> => {
  if (!songId) {
    console.error("getSongDetails: songId is required.");
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/songs/${songId}`);

    if (!response.ok) {
      console.error(
        `HTTP error! status: ${response.status} for song ${songId}`
      );
      return null;
    }

    const text = await response.text();

    try {
      const json = JSON.parse(text);

      if (json.success !== false && json.data) {
        return Array.isArray(json.data) ? json.data[0] : json.data;
      } else if (json.success !== false && !json.data && json.id) {
        return json as ApiSong;
      }

      console.error(`No song data found for ID ${songId}`);
      return null;
    } catch (parseError) {
      console.error(`Error parsing JSON for song ${songId}:`, parseError);
      return null;
    }
  } catch (networkError) {
    console.error(`Network error for song ${songId}:`, networkError);
    return null;
  }
};

/**
 * Search songs by query, with optional pagination.
 */
export const searchSongs = async (
  query: string,
  page: number = 1,
  limit: number = 20
): Promise<{ songs: ApiSong[]; total: number } | null> => {
  if (!query) {
    console.error("searchSongs: query is required.");
    return null;
  }

  try {
    let url = `${API_BASE_URL}/search/songs?query=${encodeURIComponent(query)}`;
    if (page > 1) url += `&page=${page}`;
    if (limit !== 20) url += `&limit=${limit}`;

    const response = await fetch(url);

    if (!response.ok) {
      console.error(
        `HTTP error! status: ${response.status} for search: ${query}`
      );
      return null;
    }

    const text = await response.text();

    try {
      const json = JSON.parse(text);

      if (json.success !== false && json.data) {
        const data = json.data;
        return {
          songs: data.results || data || [],
          total: data.total || data.length || 0,
        };
      } else if (Array.isArray(json)) {
        return {
          songs: json,
          total: json.length,
        };
      }

      console.error(`Search songs failed for query "${query}"`);
      return null;
    } catch (parseError) {
      console.error(`Error parsing JSON for search "${query}":`, parseError);
      return null;
    }
  } catch (networkError) {
    console.error(`Network error for search "${query}":`, networkError);
    return null;
  }
};

/**
 * General search across all types (songs, albums, artists, playlists).
 */
export interface GeneralSearchResultItem {
  id: string;
  title: string;
  name?: string;
  type: "song" | "album" | "artist" | "playlist" | string;
  image: string | any[];
  description?: string;
  url?: string;
}

export interface GeneralSearchResponseData {
  topQuery?: { results: GeneralSearchResultItem[]; label: string };
  songs?: { results: ApiSong[]; position: number; label: string };
  albums?: { results: ApiAlbum[]; position: number; label: string };
  artists?: { results: ApiArtist[]; position: number; label: string };
  playlists?: { results: ApiPlaylist[]; position: number; label: string };
}

export const searchAllTypes = async (
  query: string
): Promise<GeneralSearchResponseData | null> => {
  if (!query) {
    console.error("searchAllTypes: query is required.");
    return null;
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/search?query=${encodeURIComponent(query)}`
    );

    if (!response.ok) {
      console.error(
        `HTTP error! status: ${response.status} for general search: ${query}`
      );
      return null;
    }

    const text = await response.text();

    try {
      const json = JSON.parse(text);

      if (json.success !== false && json.data) {
        return json.data as GeneralSearchResponseData;
      } else if (json.success !== false && typeof json === "object") {
        return json as GeneralSearchResponseData;
      }

      console.error(`General search failed for query "${query}"`);
      return null;
    } catch (parseError) {
      console.error(
        `Error parsing JSON for general search "${query}":`,
        parseError
      );
      return null;
    }
  } catch (networkError) {
    console.error(`Network error for general search "${query}":`, networkError);
    return null;
  }
};

/**
 * Search albums by query.
 */
export const searchAlbums = async (
  query: string,
  page: number = 1,
  limit: number = 20
): Promise<{ albums: ApiAlbum[]; total: number } | null> => {
  if (!query) {
    console.error("searchAlbums: query is required.");
    return null;
  }

  try {
    let url = `${API_BASE_URL}/search/albums?query=${encodeURIComponent(
      query
    )}`;
    if (page > 1) url += `&page=${page}`;
    if (limit !== 20) url += `&limit=${limit}`;

    const response = await fetch(url);

    if (!response.ok) {
      console.error(
        `HTTP error! status: ${response.status} for album search: ${query}`
      );
      return null;
    }

    const text = await response.text();

    try {
      const json = JSON.parse(text);

      if (json.success !== false && json.data) {
        const data = json.data;
        return {
          albums: data.results || data || [],
          total: data.total || data.length || 0,
        };
      }

      return null;
    } catch (parseError) {
      console.error(
        `Error parsing JSON for album search "${query}":`,
        parseError
      );
      return null;
    }
  } catch (networkError) {
    console.error(`Network error for album search "${query}":`, networkError);
    return null;
  }
};

/**
 * Search artists by query.
 */
export const searchArtists = async (
  query: string,
  page: number = 1,
  limit: number = 20
): Promise<{ artists: ApiArtist[]; total: number } | null> => {
  if (!query) {
    console.error("searchArtists: query is required.");
    return null;
  }

  try {
    let url = `${API_BASE_URL}/search/artists?query=${encodeURIComponent(
      query
    )}`;
    if (page > 1) url += `&page=${page}`;
    if (limit !== 20) url += `&limit=${limit}`;

    const response = await fetch(url);

    if (!response.ok) {
      console.error(
        `HTTP error! status: ${response.status} for artist search: ${query}`
      );
      return null;
    }

    const text = await response.text();

    try {
      const json = JSON.parse(text);

      if (json.success !== false && json.data) {
        const data = json.data;
        return {
          artists: data.results || data || [],
          total: data.total || data.length || 0,
        };
      }

      return null;
    } catch (parseError) {
      console.error(
        `Error parsing JSON for artist search "${query}":`,
        parseError
      );
      return null;
    }
  } catch (networkError) {
    console.error(`Network error for artist search "${query}":`, networkError);
    return null;
  }
};

/**
 * Search playlists by query.
 */
export const searchPlaylists = async (
  query: string,
  page: number = 1,
  limit: number = 20
): Promise<{ playlists: ApiPlaylist[]; total: number } | null> => {
  if (!query) {
    console.error("searchPlaylists: query is required.");
    return null;
  }

  try {
    let url = `${API_BASE_URL}/search/playlists?query=${encodeURIComponent(
      query
    )}`;
    if (page > 1) url += `&page=${page}`;
    if (limit !== 20) url += `&limit=${limit}`;

    const response = await fetch(url);

    if (!response.ok) {
      console.error(
        `HTTP error! status: ${response.status} for playlist search: ${query}`
      );
      return null;
    }

    const text = await response.text();

    try {
      const json = JSON.parse(text);

      if (json.success !== false && json.data) {
        const data = json.data;
        return {
          playlists: data.results || data || [],
          total: data.total || data.length || 0,
        };
      }

      return null;
    } catch (parseError) {
      console.error(
        `Error parsing JSON for playlist search "${query}":`,
        parseError
      );
      return null;
    }
  } catch (networkError) {
    console.error(
      `Network error for playlist search "${query}":`,
      networkError
    );
    return null;
  }
};

/**
 * Fetch lyrics for a song by lyricsId or song name and artist.
 */
export const getSongLyrics = async (
  songId: string,
  songName?: string,
  artistName?: string
): Promise<string | null> => {
  if (!songId) {
    console.error("getSongLyrics: songId is required.");
    return null;
  }

  try {
    // First try to get lyrics using lyricsId if available
    const response = await fetch(`${API_BASE_URL}/lyrics?id=${songId}`);

    if (response.ok) {
      const text = await response.text();
      try {
        const json = JSON.parse(text);
        if (json.success !== false && json.data?.lyrics) {
          return json.data.lyrics;
        }
      } catch (parseError) {
        console.warn(`Error parsing lyrics JSON for song ${songId}:`, parseError);
      }
    }

    // Fallback: try to get lyrics using song name and artist
    if (songName && artistName) {
      const searchQuery = `${songName} ${artistName} lyrics`;
      const searchResponse = await fetch(
        `${API_BASE_URL}/search/lyrics?query=${encodeURIComponent(searchQuery)}`
      );

      if (searchResponse.ok) {
        const searchText = await searchResponse.text();
        try {
          const searchJson = JSON.parse(searchText);
          if (searchJson.success !== false && searchJson.data?.lyrics) {
            return searchJson.data.lyrics;
          }
        } catch (parseError) {
          console.warn(`Error parsing lyrics search JSON:`, parseError);
        }
      }
    }

    console.warn(`No lyrics found for song ${songId}`);
    return null;
  } catch (networkError) {
    console.error(`Network error fetching lyrics for song ${songId}:`, networkError);
    return null;
  }
};
