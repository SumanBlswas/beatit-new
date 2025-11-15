// app/(tabs)/player.tsx
import VideoPlayer from "@/components/VideoPlayer";
import { useGlobalAlert } from "@/context/GlobalAlertContext";
import { ApiSong } from "@/services/apiTypes";
import { initEqualizer, releaseEqualizer, setEqualizerGains } from "@/services/audioEq";
import {
    getBatteryOptimizationInstructions,
    getPlaybackInterruptionMessage,
    markPlaybackInterruptionAlertShown,
    openBatteryOptimizationSettings,
    shouldShowPlaybackInterruptionAlert
} from "@/services/batteryOptimizationService";
import { copyContentUriToCache } from "@/services/contentUriCopy";
import * as downloadService from "@/services/downloadService";
import { searchSongs } from "@/services/saavnService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import * as ScreenOrientation from "expo-screen-orientation";
import { useVideoPlayer, VideoView } from "expo-video";
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { AppState, AppStateStatus, Linking, Platform } from "react-native";

// --- UTILITIES & CONSTANTS ---
function shuffleArray<T>(array: T[]): T[] {
  if (!array || array.length === 0) return [];
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export const EQ_BANDS = [
  { freq: "60Hz" },
  { freq: "170Hz" },
  { freq: "310Hz" },
  { freq: "600Hz" },
  { freq: "1kHz" },
  { freq: "3kHz" },
  { freq: "6kHz" },
  { freq: "12kHz" },
];

export const EQ_PROFILES = {
  Flat: [0, 0, 0, 0, 0, 0, 0, 0],
  BassBoost: [8, 6, 4, 2, 0, -2, -4, -6],
  TrebleBoost: [-6, -4, -2, 0, 2, 4, 6, 8],
  VocalBoost: [-2, 0, 4, 6, 6, 4, 0, -2],
  Custom: [0, 0, 0, 0, 0, 0, 0, 0],
  // Additional presets
  Rock: [6, 4, 2, 0, 1, 3, 5, 6],
  Pop: [4, 2, 0, 0, 1, 3, 4, 4],
  Jazz: [3, 2, 0, 0, 2, 3, 2, 1],
  Classical: [-2, -1, 0, 1, 2, 2, 1, 0],
  HipHop: [8, 6, 3, 0, -1, -2, 0, 2],
  Electronic: [7, 5, 3, 0, 1, 3, 5, 6],
  Dance: [6, 5, 4, 2, 1, 3, 5, 6],
  Acoustic: [2, 1, 0, 0, 2, 3, 2, 1],
  // Signature preset (studio-curated)
  Signature: [5, 4, 2, 0, 1, 3, 5, 6],
};

// Metadata for the app's signature sound mode
export const EQ_SIGNATURE = {
  key: "Signature",
  name: "Suman Signature",
  tagline: "Studio-tuned signature sound",
  description:
    "Warm lows, clear mids and sparkling highs — a balanced signature tuned for modern listening across genres.",
};

// --- INTERFACES & TYPES ---
export type PlaybackMode = "normal" | "shuffle" | "repeat" | "repeat_one";
export type AudioOutput = "speaker" | "earpiece";
export type SongQuality = "48kbps" | "96kbps" | "160kbps" | "320kbps";

interface EqSettings {
  profile: string;
  customGains: number[];
}

interface ProgressContextType {
  playbackPosition: number;
  playbackDuration: number;
  seekBy: (seconds: number) => void;
}

interface PlayerContextType {
  seekBy: (seconds: number) => void;
  currentSong: ApiSong | null;
  isPlaying: boolean;
  isLoading: boolean;
  queue: ApiSong[];
  playbackMode: PlaybackMode;
  eqGains: number[];
  activeEqProfile: string;
  audioOutput: AudioOutput;
  setAudioOutput: (output: AudioOutput) => Promise<void>;
  songQuality: SongQuality;
  favorites: string[];
  playSong: (song: ApiSong) => Promise<void>;
  togglePlayPause: () => void;
  nextSong: () => Promise<void>;
  previousSong: () => Promise<void>;
  seekTo: (position: number) => Promise<void>;
  setQueue: (songs: ApiSong[], startIndex?: number) => void;
  togglePlaybackMode: () => void;
  applyEqProfile: (profile: string) => void;
  updateCustomGain: (index: number, value: number) => void;
  setSongQuality: (quality: SongQuality) => void;
  toggleFavorite: () => Promise<boolean>;
  savePlaybackState: (song: ApiSong | null, position: number) => Promise<void>;
  resumeLastPlayback: () => Promise<void>;
  lastPlayedSong: ApiSong | null;
  lastPlayedPosition: number;
}

interface FullPlayerContextType
  extends PlayerContextType,
    ProgressContextType {}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);
const ProgressContext = createContext<ProgressContextType | undefined>(
  undefined
);

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { showAlert } = useGlobalAlert();
  // Import updateMusicWidget
  const updateMusicWidget = require('@/utils/updateMusicWidget').updateMusicWidget;
  const [currentSong, setCurrentSong] = useState<ApiSong | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [queue, setQueueState] = useState<ApiSong[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>("normal");
  const [activeEqProfile, setActiveEqProfileState] = useState<string>("Flat");
  const [eqGains, setEqGainsState] = useState<number[]>(EQ_PROFILES.Flat);
  const [customEqGains, setCustomEqGains] = useState<number[]>(
    EQ_PROFILES.Custom
  );
  const [audioOutput, setAudioOutputState] = useState<AudioOutput>("speaker");
  const [songQuality, setSongQualityState] = useState<SongQuality>("320kbps");
  const [lastPlayedSong, setLastPlayedSong] = useState<ApiSong | null>(null);
  const [lastPlayedPosition, setLastPlayedPosition] = useState<number>(0);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [videoModal, setVideoModal] = useState<{
    visible: boolean;
    uri: string | null;
    title?: string;
    width?: number;
    height?: number;
  }>({ visible: false, uri: null });

  const openVideoPlayer = useCallback((uri: string, title?: string, width?: number, height?: number) => {
    setVideoModal({ visible: true, uri, title, width, height });
  }, []);

  const closeVideoPlayer = useCallback(() => {
    setVideoModal({ visible: false, uri: null });
  }, []);

  // Refs to prevent re-renders and track state
  const shuffledQueue = useRef<ApiSong[]>([]);
  const suppressCurrentSongRef = useRef(false);
  const appState = useRef(AppState.currentState);
  const wasPlayingBeforeBackground = useRef<boolean>(false); // Track if was playing before background
  const hasCheckedEndOfSong = useRef<boolean>(false); // Prevent multiple next song calls
  const lastKnownPosition = useRef<number>(0); // Track position for background detection
  const positionStuckCount = useRef<number>(0); // Count how many times position hasn't changed
  const userPausedManually = useRef<boolean>(false); // Track if user manually paused
  const intervalsRef = useRef<{
    playing?: ReturnType<typeof setInterval>;
    timeUpdate?: ReturnType<typeof setInterval>;
    status?: ReturnType<typeof setInterval>;
    playbackEnd?: ReturnType<typeof setInterval>;
  }>({});

  const player = useVideoPlayer(null, (playerInstance) => {
    playerInstance.muted = false;
    playerInstance.showNowPlayingNotification = true;
    playerInstance.staysActiveInBackground = true;
  });
  // Prevent concurrent playSong executions which can race against player lifecycle
  const playSongLockRef = useRef(false);

  const pauseIfPlaying = useCallback(() => {
    try {
      if (player && (player as any).playing) {
        player.pause?.();
      }
    } catch (err) {
      // ignore
    }
    setIsPlaying(false);
  }, [player]);

  // Memoize EQ saving to prevent unnecessary re-renders
  const saveEqSettings = useCallback(
    async (profile: string, customGains: number[]) => {
      try {
        await AsyncStorage.setItem(
          "eq_settings",
          JSON.stringify({ profile, customGains })
        );
      } catch (error) {
        console.error("Failed to save EQ settings:", error);
      }
    },
    []
  );

  // Per-song EQ persistence helpers
  const saveSongEqSettings = useCallback(
    async (songId: string, profile: string, customGains: number[]) => {
      try {
        await AsyncStorage.setItem(
          `eq_song_${songId}`,
          JSON.stringify({ profile, customGains })
        );
      } catch (error) {
        console.error(`Failed to save EQ for song ${songId}:`, error);
      }
    },
    []
  );

  const loadSongEqSettings = useCallback(async (songId: string) => {
    try {
      const json = await AsyncStorage.getItem(`eq_song_${songId}`);
      if (!json) return null;
      return JSON.parse(json) as { profile: string; customGains: number[] };
    } catch (error) {
      console.error(`Failed to load EQ for song ${songId}:`, error);
      return null;
    }
  }, []);

  // --- Playback Control Callbacks (Declared First to avoid 'used before declaration' errors) ---
  
  // Save playback state function - must be declared before playSong
  const savePlaybackState = useCallback(
    async (song: ApiSong | null, pos: number, currentQueue?: ApiSong[], index?: number) => {
      if (song) {
        try {
          await AsyncStorage.setItem("last_played_song", JSON.stringify(song));
          await AsyncStorage.setItem("last_played_position", pos.toString());
          
          // Save queue and current index for full context restoration
          if (currentQueue && currentQueue.length > 0) {
            await AsyncStorage.setItem("last_played_queue", JSON.stringify(currentQueue));
            await AsyncStorage.setItem("last_played_index", String(index ?? 0));
          }
          
          setLastPlayedSong(song);
          setLastPlayedPosition(pos);
        } catch (error) {
          console.error("Failed to save playback state:", error);
        }
      }
    },
    []
  );
  
  const stop = useCallback(() => {
    try {
      player.pause();
      player.currentTime = 0;
    } catch (e) {
      console.warn("stop() encountered error on player operations:", e);
    }
    setIsPlaying(false);
    setCurrentSong(null);
    setPosition(0);
    setDuration(0);
    hasCheckedEndOfSong.current = false; // Reset end check
    positionStuckCount.current = 0; // Reset stuck counter
    lastKnownPosition.current = 0; // Reset position tracking
  }, [player]);

  const seekTo = useCallback(
    async (positionMs: number) => {
      player.currentTime = positionMs / 1000;
    },
    [player]
  );

  const playSong = useCallback(
    async (song: ApiSong) => {
      if (!song) return;
      // prevent re-entrancy
      if (playSongLockRef.current) {
        console.log("playSong: already running, skipping duplicate call");
        return;
      }
      playSongLockRef.current = true;
      setIsLoading(true);
      hasCheckedEndOfSong.current = false; // Reset end check for new song
      positionStuckCount.current = 0; // Reset stuck counter for new song
      lastKnownPosition.current = 0; // Reset position tracking
      userPausedManually.current = false; // Reset manual pause flag for new song
  let songData = { ...song };
  let finalUrl: string | undefined;

      try {
        // First, check if song is downloaded for offline playback
        const downloadedSongs = await downloadService.getDownloadedSongs();
        const downloadedSong = downloadedSongs.find((s) => s.id === song.id);

        if (downloadedSong) {
          // Use decrypted offline file
          finalUrl = await downloadService.getDecryptedFileUri(downloadedSong);
          console.log("Playing from offline storage:", finalUrl);
          // Use the downloaded song data
          songData = { ...downloadedSong };
        } else {
          // Online playback - fetch from API
          if (!Array.isArray(song.downloadUrl) || song.downloadUrl.length === 0) {
            const res = await fetch(
              `https://suman-api.vercel.app/songs?id=${song.id}`
            );
            const apiData = await res.json();
            if (apiData.status === "SUCCESS" && apiData.data?.[0]) {
              songData = apiData.data[0];
            } else {
              throw new Error("Could not fetch song details.");
            }
          }

          if (Array.isArray(songData.downloadUrl)) {
            const preferred = songData.downloadUrl.find(
              (q) => q.quality === songQuality
            );
            const fallback =
              songData.downloadUrl.find((q) => q.quality === "320kbps") ||
              songData.downloadUrl[0];
            finalUrl = (preferred || fallback)?.link;
          }
        }

        if (!finalUrl) {
          throw new Error("No playable URL found.");
        }

        const cleanSongName = (songData.name || songData.title || "Unknown")
          .split("(")[0]
          .trim();
        let cleanedSongData: any = { ...songData, name: cleanSongName };

        // Helper: detect video URLs by extension
        const isVideoUrl = (u: string | undefined) => {
          if (!u) return false;
          try {
            const lower = u.split("?")[0].toLowerCase();
            return !!lower.match(/\.(mp4|m4v|mov|webm|mkv|avi)$/);
          } catch {
            return false;
          }
        };

        // If the URL looks like a video by extension, probe its Content-Type first.
        // Some audio streams use .mp4 container but are audio-only; check headers and only
        // open the VideoPlayer when the server reports a video/* Content-Type.
        if (isVideoUrl(finalUrl)) {
          // For local file URIs (file:, content: or cache/document paths) treat by extension
          const isLocalUri = typeof finalUrl === 'string' && (
            finalUrl.startsWith('file:') || finalUrl.startsWith('file://') || finalUrl.startsWith('content:') || finalUrl.startsWith('asset:') || finalUrl.startsWith(FileSystem.cacheDirectory || '') || finalUrl.startsWith(FileSystem.documentDirectory || '')
          );

          let treatAsVideo = !!isLocalUri;

          if (!treatAsVideo) {
            try {
              // Try HEAD first
              const headResp = await fetch(finalUrl, { method: "HEAD" });
              const contentType = headResp.headers.get("content-type") || "";
              if (!contentType.startsWith("video/")) {
                // Try a range GET to get headers if HEAD isn't supported
                try {
                  const getResp = await fetch(finalUrl, {
                    method: "GET",
                    headers: { Range: "bytes=0-0" },
                  });
                  const contentType2 = getResp.headers.get("content-type") || "";
                  if (!contentType2.startsWith("video/")) treatAsVideo = false;
                  else treatAsVideo = true;
                } catch (e) {
                  // If range GET fails, assume it's not a video to avoid opening video player for audio mp4
                  treatAsVideo = false;
                }
              } else {
                treatAsVideo = true;
              }
            } catch (e) {
              // Network/HEAD failed; default to audio (avoid false-positive video UI)
              console.warn("Could not determine remote content-type, defaulting to audio:", e);
              treatAsVideo = false;
            }
          }

          if (treatAsVideo) {
            try {
                // Prevent the music player UI from briefly showing while we open the
                // VideoPlayer modal for externally opened local videos.
                suppressCurrentSongRef.current = true;
                pauseIfPlaying();
                try {
                  await ScreenOrientation.unlockAsync();
                } catch {
                  // ignore orientation unlock failures
                }
                openVideoPlayer(finalUrl, cleanSongName);
                setTimeout(() => {
                  savePlaybackState(cleanedSongData, 0, queue, currentIndex);
                }, 500);
                // Re-enable setting currentSong after the modal is shown
                setTimeout(() => {
                  suppressCurrentSongRef.current = false;
                }, 800);
            } catch (err) {
              console.warn("Failed to open video player:", err);
            } finally {
              setIsLoading(false);
              playSongLockRef.current = false;
            }
            return;
          }
          // else fallthrough to audio player flow
        }

        // If metadata like image or primary artists is missing for a local/downloaded file,
        // try a remote lookup (by song name) and merge returned metadata to improve UI.
        try {
          const missingImage = !cleanedSongData.image || (Array.isArray(cleanedSongData.image) && cleanedSongData.image.length === 0);
          const missingArtist = !cleanedSongData.primaryArtists;
          if (missingImage || missingArtist) {
            const query = cleanedSongData.name || cleanedSongData.title || "";
            if (query) {
              console.log("Attempting remote metadata lookup for local song:", query);
              const searchRes = await searchSongs(query, 1, 1);
              if (searchRes && searchRes.songs && searchRes.songs.length > 0) {
                const top = searchRes.songs[0];
                // Merge but prefer existing local fields (e.g., keep local downloadUrl)
                cleanedSongData = {
                  ...top,
                  ...cleanedSongData,
                  // ensure downloadUrl points to local file for playback
                  downloadUrl: cleanedSongData.downloadUrl && cleanedSongData.downloadUrl.length > 0 ? cleanedSongData.downloadUrl : top.downloadUrl,
                };
                console.log("Merged remote metadata into local song:", cleanedSongData.id || cleanedSongData.name);
              }
            }
          }
        } catch (err) {
          console.warn("Remote metadata lookup failed for local song:", err);
        }

        if (!suppressCurrentSongRef.current) {
          setCurrentSong(cleanedSongData);
        }

        // Load per-song EQ settings (if any) and apply
        try {
          const perSong = await loadSongEqSettings(cleanedSongData.id);
          if (perSong) {
            setCustomEqGains(perSong.customGains || EQ_PROFILES.Custom);
            setActiveEqProfileState(perSong.profile || "Custom");
            const gainsToApply =
              perSong.profile === "Custom"
                ? perSong.customGains || EQ_PROFILES.Custom
                : EQ_PROFILES[perSong.profile as keyof typeof EQ_PROFILES] ||
                  EQ_PROFILES.Flat;
            setEqGainsState(gainsToApply);
          }
        } catch (e) {
          // ignore per-song EQ load errors
          console.warn("Failed to load per-song EQ settings:", e);
        }

        let artistString = "";
        if (typeof songData.primaryArtists === "string") {
          artistString = songData.primaryArtists;
        } else if (Array.isArray(songData.primaryArtists)) {
          artistString = songData.primaryArtists
            .map((a: any) => a.name || a)
            .join(", ");
        }

        let pictureUri = "";
        if (Array.isArray(songData.image)) {
          const preferredImage = songData.image.find(
            (img) => img.quality === "500x500"
          );
          pictureUri = preferredImage?.link || songData.image[0]?.link || "";
        } else if (typeof songData.image === "string") {
          pictureUri = songData.image;
        }

        console.log("Attempting to play URL:", finalUrl);
        // Pause any existing playback before starting the new audio
        try {
          pauseIfPlaying();
        } catch {
          // ignore
        }
        // Prefer async replace if available to avoid main-thread blocking on iOS
        if ((player as any)?.replaceAsync) {
          try {
            await (player as any).replaceAsync({
              uri: finalUrl,
              metadata: {
                title: cleanSongName,
                artist: artistString,
                artwork: pictureUri,
              },
            });
          } catch (e) {
            // Fall back to sync replace if async fails for any reason
            console.warn('replaceAsync failed, falling back to replace()', e);
            try {
              (player as any).replace({
                uri: finalUrl,
                metadata: {
                  title: cleanSongName,
                  artist: artistString,
                  artwork: pictureUri,
                },
              });
            } catch (err) {
              console.error('replace fallback failed', err);
              throw err;
            }
          }
        } else {
          // older API: synchronous replace
          (player as any).replace({
            uri: finalUrl,
            metadata: {
              title: cleanSongName,
              artist: artistString,
              artwork: pictureUri,
            },
          });
        }

        // Start playback (defensive)
        try {
          if (!player) throw new Error('Player instance not available');
          player.play();
        } catch (e) {
          console.error('player.play() failed', e);
          throw e;
        }
        // Initialize native equalizer (if available) and apply current gains
        try {
          // Try to initialize with sessionId 0 (global output). Native module may ignore or use it.
          await initEqualizer(0);
          setEqualizerGains(eqGains);
        } catch (e) {
          // Not fatal — native equalizer is optional
        }
        
        // Automatically save this song as the last played
        setTimeout(() => {
          savePlaybackState(cleanedSongData, 0, queue, currentIndex);
        }, 1000);
      } catch (error) {
        console.error("Error in playSong:", error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        alert(`Error playing ${song.name}: ${errorMessage}`);
        stop();
      } finally {
        setIsLoading(false);
        playSongLockRef.current = false;
      }
    },
    [player, songQuality, stop, savePlaybackState, queue, currentIndex, eqGains, loadSongEqSettings, openVideoPlayer, pauseIfPlaying]
  );

  const nextSong = useCallback(async () => {
    const activeQueue =
      playbackMode === "shuffle" ? shuffledQueue.current : queue;
    if (activeQueue.length === 0) return stop();

    let nextIndex = currentIndex + 1;
    if (nextIndex >= activeQueue.length) {
      if (playbackMode === "repeat") {
        nextIndex = 0;
      } else {
        return stop();
      }
    }
    const songToPlay = activeQueue[nextIndex];
    if (songToPlay) {
      setCurrentIndex(nextIndex);
      await playSong(songToPlay);
    }
  }, [currentIndex, playbackMode, playSong, queue, stop]);

  const previousSong = useCallback(async () => {
    const activeQueue =
      playbackMode === "shuffle" ? shuffledQueue.current : queue;
    if (activeQueue.length === 0) return stop();

    let prevIndex = currentIndex - 1;
    if (prevIndex < 0) {
      prevIndex = activeQueue.length - 1;
    }
    const songToPlay = activeQueue[prevIndex];
    if (songToPlay) {
      setCurrentIndex(prevIndex);
      await playSong(songToPlay);
    }
  }, [currentIndex, playbackMode, playSong, queue, stop]);

  // --- End Playback Control Callbacks ---

  // Clean up intervals on unmount (initial cleanup)
  useEffect(() => {
    return () => {
      Object.values(intervalsRef.current).forEach((intervalId) => {
        if (intervalId !== undefined) clearInterval(intervalId);
      });
      intervalsRef.current = {};
    };
  }, []);

  // Player event listeners using native events + intervals
  useEffect(() => {
    if (!player) return;

    // Clear any existing intervals before setting new ones
    Object.values(intervalsRef.current).forEach((intervalId) => {
      if (intervalId !== undefined) clearInterval(intervalId);
    });
    intervalsRef.current = {};

    // --- LISTENER FUNCTIONS ---

    const playingListener = () => {
      if (player && isPlaying !== player.playing) {
        setIsPlaying(player.playing);
      }
    };

    const timeUpdateListener = () => {
      if (!player) return;
      const currentTime = (player.currentTime || 0) * 1000;
      const playerDuration = (player.duration || 0) * 1000;

      setPosition((pos) =>
        Math.abs(pos - currentTime) > 500 ? currentTime : pos
      );
      setDuration((dur) => (dur !== playerDuration ? playerDuration : dur));

      // --- Sync widget ---
      // Get album art path (local file only)
      let albumArtPath = '';
      if (Array.isArray(currentSong?.image)) {
        albumArtPath = currentSong.image[0]?.link || '';
      } else if (typeof currentSong?.image === 'string') {
        albumArtPath = currentSong.image;
      }
      updateMusicWidget({
        songTitle: currentSong?.title || currentSong?.name,
        artist: typeof currentSong?.primaryArtists === 'string'
          ? currentSong.primaryArtists
          : Array.isArray(currentSong?.primaryArtists)
            ? currentSong.primaryArtists.map((a: any) => a.name || a).join(', ')
            : '',
        albumArtPath,
        isPlaying,
        progress: playerDuration > 0 ? currentTime / playerDuration : 0,
      });
    };

    const statusChangeListener = () => {
      if (!player?.status) return;

      const status = player.status;
      if (status === "loading" && !isLoading) {
        setIsLoading(true);
      } else if (status === "readyToPlay" && isLoading) {
        setIsLoading(false);
        setDuration((player.duration || 0) * 1000);
      } else if (status === "error") {
        setIsLoading(false);
        try {
          const info: any = {
            status: (player as any).status,
            duration: (player as any).duration,
            currentTime: (player as any).currentTime,
            playing: (player as any).playing,
            // some player implementations attach an error object
            error: (player as any).error || (player as any).lastError || null,
          };
          console.error("Player status error:", info);
        } catch (err) {
          console.error("Player status error (could not serialize player):", err);
          console.error("Raw player object:", player);
        }
        // Optionally notify user
        try {
          showAlert({
            type: 'error',
            title: 'Playback Error',
            message: 'An error occurred while trying to play media. Skipping to next item.',
            buttons: [{ text: 'OK', style: 'default' }],
          });
        } catch {}
        nextSong();
      }
    };

    // FIXED: More aggressive playback end detection for background
    const playbackEndListener = () => {
      if (!player || isLoading || !player.duration) return;

      // More aggressive end detection for background reliability
      const currentTime = player.currentTime;
      const duration = player.duration;
      const timeRemaining = duration - currentTime;

      // Multiple checks for better reliability
      const nearEnd = timeRemaining <= 2 || currentTime >= duration - 0.1;
      const atEnd = currentTime >= duration || timeRemaining <= 0.1;

      // Check if player has stopped playing and we're at the end
      const playerStopped = !player.playing && currentTime > 0;
      const likelyEnded = playerStopped && (atEnd || timeRemaining <= 1);

      // Additional check: if position hasn't changed for several checks and we're near the end
      const positionStuck =
        Math.abs(currentTime - lastKnownPosition.current) < 0.1;
      if (positionStuck && nearEnd) {
        positionStuckCount.current++;
      } else {
        positionStuckCount.current = 0;
        lastKnownPosition.current = currentTime;
      }

      const stuckAtEnd = positionStuckCount.current > 5 && nearEnd; // Position stuck for 5+ checks

      if (
        (nearEnd || likelyEnded || stuckAtEnd) &&
        !hasCheckedEndOfSong.current
      ) {
        console.log(
          `[Background] Song ending detected. Time: ${currentTime}/${duration}, Playing: ${player.playing}, Stuck: ${stuckAtEnd}`
        );
        hasCheckedEndOfSong.current = true;

        if (playbackMode === "repeat_one") {
          console.log("[Background] Repeating current song");
          player.currentTime = 0;
          player.play();
          setTimeout(() => {
            hasCheckedEndOfSong.current = false;
            positionStuckCount.current = 0;
          }, 1000);
        } else {
          console.log("[Background] Moving to next song");
          nextSong();
        }
      }

      // Reset the flag if we're not near the end
      if (timeRemaining > 3 && hasCheckedEndOfSong.current) {
        hasCheckedEndOfSong.current = false;
        positionStuckCount.current = 0;
      }
    };

    // --- NATIVE EVENT LISTENERS FOR BETTER BACKGROUND SUPPORT ---
    // Note: expo-video may not have specific playback events, so we'll rely mainly on intervals
    // but attempt to use any available events as backup
  const statusListeners: { name: string; ref: any }[] = [];

    try {
      // Try to use native event listeners if available
      if (player?.addListener) {
        const possibleEvents = [
          // Playback/status events
          "statusChange",
          "playbackStatusUpdate",
          "timeUpdate",
          "ended",
          // Common remote-control event names used by various native players
          "remote-next",
          "remote-previous",
          "remoteNext",
          "remotePrevious",
          "remote-play",
          "remote-pause",
          "remotePlay",
          "remotePause",
          "remote-skip",
          "remote-skip-to-next",
          "remote-skip-to-previous",
          "action",
        ];

        for (const eventName of possibleEvents) {
          try {
            const handler = (payload?: any) => {
              // Verbose debug: log incoming remote event and current playback state
              try {
                console.log(
                  `[Remote Event] Received event: ${eventName}`,
                  { payload, currentSong: currentSong?.id, queueLength: queue?.length, currentIndex }
                );
              } catch {
                // ignore logging errors
              }

              // Handle explicit remote control actions first
              const lower = eventName.toLowerCase();
              if (lower.includes("next") || lower.includes("skip-to-next") || lower.includes("remote-next") || lower.includes("remote-skip")) {
                console.log("[Remote Event] Triggering nextSong() from handler");
                nextSong();
                return;
              }
              if (lower.includes("prev") || lower.includes("previous") || lower.includes("skip-to-previous") || lower.includes("remote-previous")) {
                console.log("[Remote Event] Triggering previousSong() from handler");
                previousSong();
                return;
              }
              if (lower.includes("pause") || lower === "remote-pause" || lower === "remotepause") {
                try {
                  player.pause?.();
                  setIsPlaying(false);
                } catch {}
                return;
              }
              if (lower.includes("play") || lower === "remote-play" || lower === "remoteplay") {
                try {
                  player.play?.();
                  setIsPlaying(true);
                } catch {}
                return;
              }

              // Fallback: treat some status-change events as potential end-of-song
              try {
                if (!player || !player.duration) return;
                const currentTime = player.currentTime;
                const duration = player.duration;
                if (currentTime >= duration - 0.5 && !hasCheckedEndOfSong.current) {
                  hasCheckedEndOfSong.current = true;
                  if (playbackMode === "repeat_one") {
                    player.currentTime = 0;
                    player.play?.();
                    setTimeout(() => {
                      hasCheckedEndOfSong.current = false;
                    }, 1000);
                  } else {
                    console.log("[Remote Event] Fallback: detected end-of-song, calling nextSong()");
                    nextSong();
                  }
                }
              } catch {
                // ignore
              }
            };

            const ref = player.addListener(eventName as any, handler);
            statusListeners.push({ name: eventName, ref });
            console.log(`Successfully added listener for: ${eventName}`);
            // continue trying to add listeners for other useful events instead of breaking
          } catch {
            // Event doesn't exist; try the next one
            continue;
          }
        }
      }
    } catch (error) {
      console.log("Native event listeners not available:", error);
    }

    // --- SETTING UP INTERVALS (Optimized for background reliability) ---
    intervalsRef.current.playing = setInterval(playingListener, 500);
    intervalsRef.current.timeUpdate = setInterval(timeUpdateListener, 1000);
    intervalsRef.current.status = setInterval(statusChangeListener, 500);

    // Multiple playback end detection intervals for maximum reliability
    intervalsRef.current.playbackEnd = setInterval(playbackEndListener, 200);

    // Additional aggressive background checker (only when app might be backgrounded)
    const backgroundChecker = setInterval(() => {
      if (!player || !player.duration || isLoading) return;

      const currentTime = player.currentTime;
      const duration = player.duration;
      const timeRemaining = duration - currentTime;

      // Very aggressive end detection specifically for background scenarios
      if (timeRemaining <= 1 && !hasCheckedEndOfSong.current) {
        console.log(
          `[Aggressive Background] Forcing next song. Time: ${currentTime}/${duration}`
        );
        hasCheckedEndOfSong.current = true;

        if (playbackMode === "repeat_one") {
          player.currentTime = 0;
          player.play();
          setTimeout(() => {
            hasCheckedEndOfSong.current = false;
            positionStuckCount.current = 0;
          }, 1000);
        } else {
          nextSong();
        }
      }
    }, 100); // Very frequent checking for background reliability

    // Store the background checker for cleanup
    (intervalsRef.current as any).backgroundChecker = backgroundChecker;

    // --- CLEANUP FUNCTION ---
    return () => {
      // Remove native event listeners if they exist
      try {
        if (statusListeners.length && player.removeListener) {
          for (const sl of statusListeners) {
            try {
              // If the ref supports remove(), call it, otherwise use removeListener
              sl.ref?.remove?.() || player.removeListener?.(sl.name as any, sl.ref);
            } catch {
              // ignore individual removal errors
            }
          }
        }
      } catch (error) {
        console.log("Error removing native listeners:", error);
      }

      Object.values(intervalsRef.current).forEach((intervalId) => {
        if (intervalId !== undefined) clearInterval(intervalId);
      });
      intervalsRef.current = {};
    };
  }, [player, queue, nextSong, previousSong, stop, playbackMode, isLoading, isPlaying, currentIndex, currentSong]);

  // Separate effect for player loop property - less frequent changes
  useEffect(() => {
    if (player) {
      player.loop = playbackMode === "repeat_one";
    }
  }, [player, playbackMode]);

  const togglePlayPause = useCallback(() => {
    console.log("DEBUG: togglePlayPause called. Player instance:", !!player);
    if (!player) {
      console.warn(
        "Player instance is not available. Cannot toggle play/pause."
      );
      return;
    }
    console.log(
      "DEBUG: Player is available. Current playing state:",
      player.playing
    );
    try {
      if (player.playing) {
        player.pause();
        setIsPlaying(false); // Optimistic update
        userPausedManually.current = true; // Mark as manual pause
        console.log("DEBUG: Player paused manually. isPlaying set to false.");
      } else {
        player.play();
        setIsPlaying(true); // Optimistic update
        userPausedManually.current = false; // Playing now
        console.log("DEBUG: Player started playing. isPlaying set to true.");
      }
    } catch (e) {
      console.error("ERROR: Crash inside player.play/pause:", e);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [player]);

  const seekBy = useCallback(
    (seconds: number) => {
      player.currentTime = Math.max(
        0,
        Math.min(player.currentTime + seconds, player.duration)
      );
      Haptics.selectionAsync();
    },
    [player]
  );

  const setQueue = useCallback(
    (songs: ApiSong[], startIndex: number = 0) => {
      setQueueState(songs);
      setCurrentIndex(startIndex);
      if (playbackMode === "shuffle") {
        shuffledQueue.current = shuffleArray(songs);
      } else {
        shuffledQueue.current = [];
      }
    },
    [playbackMode]
  );

  const togglePlaybackMode = useCallback(() => {
    const modes: PlaybackMode[] = ["normal", "repeat", "repeat_one", "shuffle"];
    const nextModeIndex = (modes.indexOf(playbackMode) + 1) % modes.length;
    const newMode = modes[nextModeIndex];
    setPlaybackMode(newMode);
    if (newMode === "shuffle") {
      shuffledQueue.current = shuffleArray(queue);
    } else {
      shuffledQueue.current = [];
    }
  }, [playbackMode, queue]);

  const applyEqProfile = useCallback(
    (profile: string) => {
      const profileKey = profile as keyof typeof EQ_PROFILES;
      if (!EQ_PROFILES[profileKey]) return;

      setActiveEqProfileState(profile);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      if (profile === "Custom") {
        setEqGainsState(customEqGains);
      } else {
        setEqGainsState(EQ_PROFILES[profileKey]);
      }

      saveEqSettings(profile, customEqGains);
      // If a song is playing, persist this EQ for that song as well
      if (currentSong?.id) {
        saveSongEqSettings(currentSong.id, profile, customEqGains);
      }
    },
    [customEqGains, saveEqSettings, saveSongEqSettings, currentSong]
  );

  const updateCustomGain = useCallback(
    (index: number, value: number) => {
      setCustomEqGains((prevGains) => {
        const newCustomGains = [...prevGains];
        newCustomGains[index] = value;
        if (activeEqProfile === "Custom") {
          setEqGainsState(newCustomGains);
        }
        saveEqSettings(
          activeEqProfile === "Custom" ? "Custom" : activeEqProfile,
          newCustomGains
        );
        // Persist custom EQ per-song when available
        if (currentSong?.id) {
          saveSongEqSettings(
            currentSong.id,
            activeEqProfile === "Custom" ? "Custom" : activeEqProfile,
            newCustomGains
          );
        }
        return newCustomGains;
      });

      if (activeEqProfile !== "Custom") {
        setActiveEqProfileState("Custom");
      }

      Haptics.selectionAsync();
    },
    [activeEqProfile, saveEqSettings, saveSongEqSettings, currentSong]
  );

  const setAudioOutput = useCallback(async (output: AudioOutput) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAudioOutputState(output);
    await AsyncStorage.setItem("audio_output", output);
  }, []);

  const setSongQuality = useCallback(async (quality: SongQuality) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSongQualityState(quality);
    await AsyncStorage.setItem("song_quality", quality);
  }, []);

  const toggleFavorite = useCallback(async () => {
    if (!currentSong) return;
    const isCurrentlyFavorite = favorites.includes(currentSong.id);
    const storedFavoritesJSON = await AsyncStorage.getItem("user_favorites");
    const currentFavorites: ApiSong[] = storedFavoritesJSON
      ? JSON.parse(storedFavoritesJSON)
      : [];
    let newFavorites: ApiSong[];
    let action: "added" | "removed" = "added";
    if (isCurrentlyFavorite) {
      newFavorites = currentFavorites.filter((s) => s.id !== currentSong.id);
      action = "removed";
    } else {
      newFavorites = [...currentFavorites, currentSong];
      action = "added";
    }
    setFavorites(newFavorites.map((s) => s.id));
    await AsyncStorage.setItem("user_favorites", JSON.stringify(newFavorites));
    try {
      // Notify other parts of the app (that may hold their own favorites state)
      // Emit both the new favorites array and the action performed so UIs
      // can display different animations for add vs remove.
      const { emit } = require("@/utils/eventBus");
      emit("favoritesUpdated", {
        newFavorites,
        action,
        songId: currentSong.id,
      });
    } catch (e) {
      // Ignore if event cannot be emitted
    }
    // Return true if song is now favorited
    return newFavorites.some((s) => s.id === currentSong.id);
  }, [favorites, currentSong]);

  const resumeLastPlayback = useCallback(async () => {
    try {
      if (lastPlayedSong) {
        // Restore the queue if available
        const savedQueue = await AsyncStorage.getItem("last_played_queue");
        const savedIndex = await AsyncStorage.getItem("last_played_index");
        
        if (savedQueue) {
          const parsedQueue = JSON.parse(savedQueue);
          const parsedIndex = savedIndex ? parseInt(savedIndex, 10) : 0;
          
          // Set the queue first
          setQueue(parsedQueue, parsedIndex);
        }
        
        // Play the song
        await playSong(lastPlayedSong);
        
        // Seek to last position if it was significant (more than 5 seconds)
        if (lastPlayedPosition > 5000) {
          setTimeout(() => seekTo(lastPlayedPosition), 800);
        }
      }
    } catch (error) {
      console.error("Failed to resume last playback:", error);
    }
  }, [lastPlayedSong, lastPlayedPosition, playSong, seekTo, setQueue]);

  // Load settings only once on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [
          favsJSON,
          savedEqJson,
          savedAudioOutput,
          savedSongQuality,
          savedLastPlayed,
          savedLastPosition,
        ] = await Promise.all([
          AsyncStorage.getItem("user_favorites"),
          AsyncStorage.getItem("eq_settings"),
          AsyncStorage.getItem("audio_output"),
          AsyncStorage.getItem("song_quality"),
          AsyncStorage.getItem("last_played_song"),
          AsyncStorage.getItem("last_played_position"),
        ]);

        if (favsJSON) {
          setFavorites(JSON.parse(favsJSON).map((s: ApiSong) => s.id));
        }

        if (savedEqJson) {
          const { profile, customGains } = JSON.parse(
            savedEqJson
          ) as EqSettings;
          if (customGains) setCustomEqGains(customGains);
          const gainsToApply =
            profile === "Custom"
              ? customGains || EQ_PROFILES.Custom
              : EQ_PROFILES[profile as keyof typeof EQ_PROFILES] ||
                EQ_PROFILES.Flat;
          setActiveEqProfileState(profile);
          setEqGainsState(gainsToApply);
        }

        if (savedAudioOutput) {
          setAudioOutputState(savedAudioOutput as AudioOutput);
        }

        if (savedSongQuality) {
          setSongQualityState(savedSongQuality as SongQuality);
        }

        if (savedLastPlayed) {
          setLastPlayedSong(JSON.parse(savedLastPlayed));
        }

        if (savedLastPosition) {
          setLastPlayedPosition(parseInt(savedLastPosition, 10));
        }
      } catch (error) {
        console.error("Failed to load settings:", error);
      }
    };
    loadSettings();
  }, []);

  // FIXED: AppState listener - Only save state, don't interfere with playback
  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      async (nextAppState: AppStateStatus) => {
        try {
          // Going to background: remember whether we were playing and persist state
          if (
            appState.current.match(/inactive|active/) &&
            nextAppState === "background"
          ) {
            wasPlayingBeforeBackground.current = !!player?.playing;
            if (currentSong && position > 0) {
              savePlaybackState(currentSong, position, queue, currentIndex);
            }
          }

          // Returning to foreground: if OS paused the player, try to resume.
          if (
            appState.current === "background" &&
            nextAppState === "active"
          ) {
            // Check if playback was interrupted unexpectedly
            if (
              wasPlayingBeforeBackground.current && 
              player && 
              !player.playing && 
              !userPausedManually.current &&
              currentSong
            ) {
              // Player was playing, went to background, and is now stopped (not by user)
              // This indicates battery optimization might have killed the app
              const shouldShow = await shouldShowPlaybackInterruptionAlert();
              if (shouldShow) {
                const message = getPlaybackInterruptionMessage();
                const instructions = await getBatteryOptimizationInstructions();
                
                showAlert({
                  type: 'warning',
                  title: '🎵 Music Stopped on Lock Screen',
                  message: `${message}\n\n${instructions}`,
                  buttons: [
                    {
                      text: 'Open Settings',
                      onPress: () => {
                        openBatteryOptimizationSettings();
                        markPlaybackInterruptionAlertShown();
                      },
                      style: 'default'
                    },
                    {
                      text: 'Later',
                      onPress: () => {
                        markPlaybackInterruptionAlertShown();
                      },
                      style: 'cancel'
                    }
                  ]
                });
              }
            }

            if (wasPlayingBeforeBackground.current) {
              // If player instance is not available yet, or the native
              // audio focus hasn't been fully restored, retry a couple
              // of times with a small delay. Also update isPlaying state
              // after a successful resume so UI stays in sync.
              const tryResume = (attempt = 1) => {
                try {
                  if (!player) {
                    if (attempt < 4) {
                      setTimeout(() => tryResume(attempt + 1), 250);
                    }
                    return;
                  }

                  if (!player.playing) {
                    // Best-effort resume
                    player.play?.();
                    setIsPlaying(true);
                  } else {
                    setIsPlaying(true);
                  }
                } catch (e) {
                  // Retry a couple of times before giving up
                  if (attempt < 4) setTimeout(() => tryResume(attempt + 1), 300);
                  else console.warn("[AppState] Failed to auto-resume playback:", e);
                }
              };

              // Start first attempt after a short delay to let native systems settle
              setTimeout(() => tryResume(1), 150);
            }
          }
        } catch (err) {
          console.warn("[AppState] error in handler:", err);
        } finally {
          appState.current = nextAppState;
        }
      }
    );

    return () => {
      subscription.remove();
    };
  }, [currentSong, position, savePlaybackState, player, queue, currentIndex, showAlert]); // Dependencies are correct

  // Periodically save playback state while playing (every 10 seconds)
  useEffect(() => {
    if (!currentSong || !isPlaying) return;

    const saveInterval = setInterval(() => {
      if (currentSong && position > 0) {
        savePlaybackState(currentSong, position, queue, currentIndex);
      }
    }, 10000); // Save every 10 seconds

    return () => clearInterval(saveInterval);
  }, [currentSong, isPlaying, position, queue, currentIndex, savePlaybackState]);


  // Memoize context values for PlayerContext
  const playerValue = useMemo(
    () => ({
      currentSong,
      isPlaying,
      isLoading,
      queue,
      playbackMode,
      eqGains,
      activeEqProfile,
      audioOutput,
      songQuality,
      favorites,
      lastPlayedSong,
      lastPlayedPosition,
      playSong,
      togglePlayPause,
      nextSong,
      previousSong,
      seekTo,
      setQueue,
      togglePlaybackMode,
      applyEqProfile,
      updateCustomGain,
      seekBy,
      setAudioOutput,
      setSongQuality,
      toggleFavorite,
      savePlaybackState,
      resumeLastPlayback,
    }),
    [
      currentSong,
      isPlaying,
      isLoading,
      queue,
      playbackMode,
      eqGains,
      activeEqProfile,
      audioOutput,
      songQuality,
      favorites,
      lastPlayedSong,
      lastPlayedPosition,
      playSong,
      togglePlayPause,
      nextSong,
      previousSong,
      seekTo,
      setQueue,
      togglePlaybackMode,
      applyEqProfile,
      updateCustomGain,
      seekBy,
      setAudioOutput,
      setSongQuality,
      toggleFavorite,
      savePlaybackState,
      resumeLastPlayback,
    ]
  );

  // Handle external open-with / deep links that point to media URIs
  useEffect(() => {
    const handleUrl = async (event: { url: string } | string | null) => {
      try {
        const url = typeof event === "string" ? event : event?.url;
        if (!url) return;
        // Basic checks for file/content or direct media links
        const isMedia =
          url.startsWith("file:") ||
          url.startsWith("content:") ||
          !!url.match(/^https?:.*\.(mp4|m4v|mov|mp3|m4a|aac|wav|flac)(\?.*)?$/i);
        if (!isMedia) return;

        let finalPlayableUrl = url;

        // If it's an Android content URI, try copying to app cache to get a playable file:// URI
        if (Platform.OS === "android" && url.startsWith("content:")) {
          try {
            const decoded = decodeURIComponent(url);
            const fname = decoded.split("/").pop() || `external-${Date.now()}`;
            const dest = FileSystem.cacheDirectory + fname;

            console.log("Attempting to copy content URI to cache:", url, "->", dest);
            const result = await FileSystem.downloadAsync(url, dest);
            console.log("Content copied to:", result.uri);
            finalPlayableUrl = result.uri;
          } catch (e: any) {
            console.warn("Failed to copy content URI to cache via FileSystem:", e?.message || e);
            // Try native module as a more robust fallback
            try {
              const nativePath = await copyContentUriToCache(url);
              if (nativePath) {
                const maybeFileUri = nativePath.startsWith("file:") ? nativePath : `file://${nativePath}`;
                finalPlayableUrl = maybeFileUri;
                console.log("Content copied to (native):", finalPlayableUrl);
              } else {
                throw new Error("Native module returned no path");
              }
            } catch (nativeErr) {
              console.warn("Native content-uri copy failed:", nativeErr);
              // If the original FileSystem error looks like a permission denial, inform the user with actionable steps
              const msg = String(e?.message || e || "");
              if (msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("securityexception")) {
                try {
                  showAlert({
                    type: "error",
                    title: "Permission Denied",
                    message:
                      "The selected file cannot be opened due to permission restrictions from the source app.\n\nTry using the file manager's Share -> Open with / Save a copy option, or move the file into Downloads and retry.",
                    buttons: [{ text: "OK", style: "default" }],
                  });
                } catch {}
                return;
              }
              // Fall back to using the original url, may still fail when attempting to play
            }
          }
        }

        const decodedForMeta = decodeURIComponent(finalPlayableUrl);
        let externalSong: any = {
          id: `external-${Date.now()}`,
          name: decodedForMeta.split("/").pop() || "External Media",
          title: decodedForMeta.split("/").pop() || "External Media",
          downloadUrl: [{ link: finalPlayableUrl, quality: "320kbps" }],
          image: "",
        };

        // Try to augment external file metadata by searching the remote API
        try {
          const guessed = externalSong.name.replace(/\.[^/.]+$/, "").replace(/[__\-]+/g, " ").trim();
          if (guessed) {
            console.log("Searching remote API for metadata using:", guessed);
            const searchResult = await searchSongs(guessed, 1, 1);
            if (searchResult && searchResult.songs && searchResult.songs.length > 0) {
              const top = searchResult.songs[0];
              console.log("Found remote metadata for external file:", top.id || top.name || top.title);
              // Merge useful fields from remote data into our externalSong
              externalSong = {
                ...externalSong,
                ...top,
              };
              // Ensure downloadUrl remains usable for local file playback unless remote has explicit links
              if (!externalSong.downloadUrl || externalSong.downloadUrl.length === 0) {
                externalSong.downloadUrl = [{ link: finalPlayableUrl, quality: "320kbps" }];
              }
            }
          }
        } catch (err) {
          console.warn("External metadata lookup failed:", err);
        }

        // If the file looks like a video by extension, handle it here to avoid
        // first opening the music player and then switching to video player.
        const looksLikeVideo = (u: string | undefined) => {
          if (!u) return false;
          try {
            const lower = u.split("?")[0].toLowerCase();
            return !!lower.match(/\.(mp4|m4v|mov|webm|mkv|avi)$/);
          } catch {
            return false;
          }
        };

        const isLocalUri = (u: string | undefined) => {
          if (!u) return false;
          return (
            u.startsWith("file:") ||
            u.startsWith("file://") ||
            u.startsWith("content:") ||
            u.startsWith("asset:") ||
            (FileSystem.cacheDirectory && u.startsWith(FileSystem.cacheDirectory)) ||
            (FileSystem.documentDirectory && u.startsWith(FileSystem.documentDirectory))
          );
        };

        // If it's a video and local, open VideoPlayer directly. For remote video-like URLs,
        // probe Content-Type headers first to avoid misclassifying audio mp4 as video.
        if (looksLikeVideo(finalPlayableUrl)) {
          if (isLocalUri(finalPlayableUrl)) {
            try {
              // Open local videos directly from cache without touching music UI
              suppressCurrentSongRef.current = true;
              pauseIfPlaying();
              try {
                await ScreenOrientation.unlockAsync();
              } catch {
                // ignore
              }
              openVideoPlayer(finalPlayableUrl, externalSong.name);
              setTimeout(() => {
                suppressCurrentSongRef.current = false;
              }, 800);
              return;
            } catch (err) {
              console.warn("Failed to open local video player:", err);
            }
          } else {
            // Remote URL: probe headers (HEAD then Range GET) to check MIME type
            let treatAsVideo = false;
            try {
              const headResp = await fetch(finalPlayableUrl, { method: "HEAD" });
              const contentType = headResp.headers.get("content-type") || "";
              if (contentType.startsWith("video/")) {
                treatAsVideo = true;
              } else {
                try {
                  const getResp = await fetch(finalPlayableUrl, { method: "GET", headers: { Range: "bytes=0-0" } });
                  const contentType2 = getResp.headers.get("content-type") || "";
                  if (contentType2.startsWith("video/")) treatAsVideo = true;
                } catch {
                  treatAsVideo = false;
                }
              }
            } catch (err) {
              console.warn("Could not determine remote content-type for external file, defaulting to audio:", err);
              treatAsVideo = false;
            }

            if (treatAsVideo) {
              try {
                suppressCurrentSongRef.current = true;
                pauseIfPlaying();
                try {
                  await ScreenOrientation.unlockAsync();
                } catch {
                  // ignore
                }
                openVideoPlayer(finalPlayableUrl, externalSong.name);
                setTimeout(() => {
                  suppressCurrentSongRef.current = false;
                }, 800);
                return;
              } catch (err) {
                console.warn("Failed to open remote video player:", err);
              }
            }
          }
        }

        // Fire-and-forget play (audio)
        playSong(externalSong as any).catch((e) =>
          console.error("Failed to play external media:", e)
        );
      } catch (e) {
        console.warn("External URL handler error:", e);
      }
    };

    // initial URL
    Linking.getInitialURL().then((url) => handleUrl(url));

    const sub = Linking.addEventListener("url", handleUrl as any);
    return () => sub.remove();
  }, [playSong, openVideoPlayer, showAlert, pauseIfPlaying]);

  // Push EQ gains to native equalizer whenever they change (if available)
  useEffect(() => {
    try {
      setEqualizerGains(eqGains);
    } catch {
      // ignore
    }
  }, [eqGains]);

  // Release native equalizer on unmount
  useEffect(() => {
    return () => {
      try {
        releaseEqualizer();
      } catch {
        // ignore
      }
    };
  }, []);

  // Memoize context values for ProgressContext
  const progressValue = useMemo(
    () => ({
      playbackPosition: position,
      playbackDuration: duration,
      seekBy,
    }),
    [position, duration, seekBy]
  );

  return (
    <PlayerContext.Provider value={playerValue}>
      <ProgressContext.Provider value={progressValue}>
        {children}

        {/* Global video player modal for video playback initiated from PlayerContext */}
        <VideoPlayer
          visible={!!videoModal.visible}
          videoUri={videoModal.uri ?? ""}
          videoTitle={videoModal.title ?? ""}
          videoWidth={videoModal.width}
          videoHeight={videoModal.height}
          onClose={closeVideoPlayer}
          onNext={nextSong}
          onPrevious={previousSong}
        />

        <VideoView
          player={player}
          style={{ height: 0, width: 0 }}
          nativeControls={false}
          contentFit="contain"
        />
      </ProgressContext.Provider>
    </PlayerContext.Provider>
  );
};

// --- CUSTOM HOOKS ---
export const usePlayer = (): PlayerContextType => {
  const context = useContext(PlayerContext);
  if (!context)
    throw new Error("usePlayer must be used within a PlayerProvider");
  return context;
};

export const useProgress = (): ProgressContextType => {
  const context = useContext(ProgressContext);
  if (!context)
    throw new Error("useProgress must be used within a PlayerProvider");
  return context;
};

export const usePlayerWithProgress = (): FullPlayerContextType => {
  const player = usePlayer();
  const progress = useProgress();
  return useMemo(() => ({ ...player, ...progress }), [player, progress]);
};

export const useCurrentSong = () => {
  const context = useContext(PlayerContext);
  if (!context)
    throw new Error("useCurrentSong must be used within a PlayerProvider");
  return context.currentSong;
};

export const useIsPlaying = () => {
  const context = useContext(PlayerContext);
  if (!context)
    throw new Error("useIsPlaying must be used within a PlayerProvider");
  return context.isPlaying;
};

export const useIsLoading = () => {
  const context = useContext(PlayerContext);
  if (!context)
    throw new Error("useIsLoading must be used within a PlayerProvider");
  return context.isLoading;
};

export const useQueue = () => {
  const context = useContext(PlayerContext);
  if (!context)
    throw new Error("useQueue must be used within a PlayerProvider");
  return context.queue;
};

export const usePlaybackMode = () => {
  const context = useContext(PlayerContext);
  if (!context)
    throw new Error("usePlaybackMode must be used within a PlayerProvider");
  return context.playbackMode;
};

export const useFavorites = () => {
  const context = useContext(PlayerContext);
  if (!context)
    throw new Error("useFavorites must be used within a PlayerProvider");
  return context.favorites;
};
