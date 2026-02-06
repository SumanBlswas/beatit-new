// services/lyricsCache.ts
// Cache synced lyrics locally for offline use

import AsyncStorage from "@react-native-async-storage/async-storage";

const LYRICS_CACHE_PREFIX = "lyrics_cache_";
const LYRICS_INDEX_KEY = "lyrics_cache_index";

interface CachedLyrics {
  lyrics: string;
  isSynced: boolean;
  songName: string;
  artistName: string;
  cachedAt: number;
}

interface LyricsIndex {
  [songId: string]: {
    songName: string;
    artistName: string;
    cachedAt: number;
    isSynced: boolean;
  };
}

/**
 * Get cached lyrics for a song
 */
export const getCachedLyrics = async (
  songId: string,
): Promise<CachedLyrics | null> => {
  try {
    const key = `${LYRICS_CACHE_PREFIX}${songId}`;
    const cached = await AsyncStorage.getItem(key);
    if (cached) {
      console.log(`[LyricsCache] Found cached lyrics for ${songId}`);
      return JSON.parse(cached);
    }
    return null;
  } catch (error) {
    console.warn("[LyricsCache] Error getting cached lyrics:", error);
    return null;
  }
};

/**
 * Save lyrics to cache
 */
export const cacheLyrics = async (
  songId: string,
  lyrics: string,
  isSynced: boolean,
  songName: string,
  artistName: string,
): Promise<void> => {
  try {
    const key = `${LYRICS_CACHE_PREFIX}${songId}`;
    const data: CachedLyrics = {
      lyrics,
      isSynced,
      songName,
      artistName,
      cachedAt: Date.now(),
    };

    await AsyncStorage.setItem(key, JSON.stringify(data));

    // Update index
    await updateLyricsIndex(songId, songName, artistName, isSynced);

    console.log(
      `[LyricsCache] Cached lyrics for "${songName}" (synced: ${isSynced})`,
    );
  } catch (error) {
    console.warn("[LyricsCache] Error caching lyrics:", error);
  }
};

/**
 * Update the lyrics index (for tracking what's cached)
 */
const updateLyricsIndex = async (
  songId: string,
  songName: string,
  artistName: string,
  isSynced: boolean,
): Promise<void> => {
  try {
    const indexData = await AsyncStorage.getItem(LYRICS_INDEX_KEY);
    const index: LyricsIndex = indexData ? JSON.parse(indexData) : {};

    index[songId] = {
      songName,
      artistName,
      cachedAt: Date.now(),
      isSynced,
    };

    await AsyncStorage.setItem(LYRICS_INDEX_KEY, JSON.stringify(index));
  } catch (error) {
    console.warn("[LyricsCache] Error updating index:", error);
  }
};

/**
 * Get list of all cached lyrics
 */
export const getCachedLyricsList = async (): Promise<LyricsIndex> => {
  try {
    const indexData = await AsyncStorage.getItem(LYRICS_INDEX_KEY);
    return indexData ? JSON.parse(indexData) : {};
  } catch (error) {
    console.warn("[LyricsCache] Error getting cached list:", error);
    return {};
  }
};

/**
 * Get count of cached lyrics
 */
export const getCachedLyricsCount = async (): Promise<number> => {
  try {
    const index = await getCachedLyricsList();
    return Object.keys(index).length;
  } catch (error) {
    return 0;
  }
};

/**
 * Clear all cached lyrics
 */
export const clearAllCachedLyrics = async (): Promise<void> => {
  try {
    const index = await getCachedLyricsList();
    const keys = Object.keys(index).map((id) => `${LYRICS_CACHE_PREFIX}${id}`);

    if (keys.length > 0) {
      await AsyncStorage.multiRemove(keys);
    }
    await AsyncStorage.removeItem(LYRICS_INDEX_KEY);

    console.log(`[LyricsCache] Cleared ${keys.length} cached lyrics`);
  } catch (error) {
    console.warn("[LyricsCache] Error clearing cache:", error);
  }
};

/**
 * Remove specific cached lyrics
 */
export const removeCachedLyrics = async (songId: string): Promise<void> => {
  try {
    const key = `${LYRICS_CACHE_PREFIX}${songId}`;
    await AsyncStorage.removeItem(key);

    // Update index
    const indexData = await AsyncStorage.getItem(LYRICS_INDEX_KEY);
    if (indexData) {
      const index: LyricsIndex = JSON.parse(indexData);
      delete index[songId];
      await AsyncStorage.setItem(LYRICS_INDEX_KEY, JSON.stringify(index));
    }
  } catch (error) {
    console.warn("[LyricsCache] Error removing cached lyrics:", error);
  }
};

/**
 * Export only SYNCED cached lyrics as a JSON object (for backup)
 * Plain lyrics are NOT exported, but remain cached for offline use
 */
export const exportAllCachedLyrics = async (): Promise<
  Record<string, CachedLyrics>
> => {
  try {
    const index = await getCachedLyricsList();
    const songIds = Object.keys(index);
    const result: Record<string, CachedLyrics> = {};

    for (const songId of songIds) {
      const cached = await getCachedLyrics(songId);
      // Only export synced (timestamped) lyrics
      if (cached && cached.isSynced) {
        result[songId] = cached;
      }
    }

    console.log(
      `[LyricsCache] Exporting ${Object.keys(result).length} synced lyrics`,
    );
    return result;
  } catch (error) {
    console.warn("[LyricsCache] Error exporting lyrics:", error);
    return {};
  }
};

/**
 * Get count of synced lyrics only
 */
export const getSyncedLyricsCount = async (): Promise<number> => {
  try {
    const index = await getCachedLyricsList();
    return Object.values(index).filter((l) => l.isSynced).length;
  } catch (error) {
    return 0;
  }
};
