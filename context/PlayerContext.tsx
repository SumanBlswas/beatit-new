// app/(tabs)/player.tsx
import { ApiSong } from "@/services/apiTypes";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
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
import { AppState, AppStateStatus } from "react-native";

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
  toggleFavorite: () => Promise<void>;
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

  // Refs to prevent re-renders and track state
  const shuffledQueue = useRef<ApiSong[]>([]);
  const appState = useRef(AppState.currentState);
  const wasPlayingBeforeBackground = useRef<boolean>(false); // Track if was playing before background
  const hasCheckedEndOfSong = useRef<boolean>(false); // Prevent multiple next song calls
  const lastKnownPosition = useRef<number>(0); // Track position for background detection
  const positionStuckCount = useRef<number>(0); // Count how many times position hasn't changed
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
    player.pause();
    player.currentTime = 0;
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
      setIsLoading(true);
      hasCheckedEndOfSong.current = false; // Reset end check for new song
      positionStuckCount.current = 0; // Reset stuck counter for new song
      lastKnownPosition.current = 0; // Reset position tracking
  let songData = { ...song };
  let finalUrl: string | undefined;

      try {
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

        if (!finalUrl) {
          throw new Error("No playable URL found.");
        }

        const cleanSongName = songData.name.split("(")[0].trim();
        const cleanedSongData = { ...songData, name: cleanSongName };
        setCurrentSong(cleanedSongData);

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

        player.replace({
          uri: finalUrl,
          metadata: {
            title: cleanSongName,
            artist: artistString,
            artwork: pictureUri,
          },
        });
        player.play();
        
        // Automatically save this song as the last played
        setTimeout(() => {
          savePlaybackState(cleanedSongData, 0, queue, currentIndex);
        }, 1000);
      } catch (error) {
        console.error("Error in playSong:", error);
        alert(`Error playing ${song.name}.`);
        setIsLoading(false);
        stop();
      }
    },
    [player, songQuality, stop, savePlaybackState, queue, currentIndex]
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
        console.error("Player status error:", player);
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
        console.log("DEBUG: Player paused. isPlaying set to false.");
      } else {
        player.play();
        setIsPlaying(true); // Optimistic update
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
    },
    [customEqGains, saveEqSettings]
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
        return newCustomGains;
      });

      if (activeEqProfile !== "Custom") {
        setActiveEqProfileState("Custom");
      }

      Haptics.selectionAsync();
    },
    [activeEqProfile, saveEqSettings]
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
    if (isCurrentlyFavorite) {
      newFavorites = currentFavorites.filter((s) => s.id !== currentSong.id);
    } else {
      newFavorites = [...currentFavorites, currentSong];
    }
    setFavorites(newFavorites.map((s) => s.id));
    await AsyncStorage.setItem("user_favorites", JSON.stringify(newFavorites));
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
      (nextAppState: AppStateStatus) => {
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
  }, [currentSong, position, savePlaybackState, player, queue, currentIndex]); // Dependencies are correct

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
