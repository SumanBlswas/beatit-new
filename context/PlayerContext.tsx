// app/(tabs)/player.tsx
import VideoPlayer from "@/components/VideoPlayer";
import { useGlobalAlert } from "@/context/GlobalAlertContext";
import { ApiSong } from "@/services/apiTypes";
import {
    initEqualizer,
    releaseEqualizer,
    setEqualizerGains,
} from "@/services/audioEq";
import * as downloadService from "@/services/downloadService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ExpoFileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import * as ScreenOrientation from "expo-screen-orientation";
import { useVideoPlayer } from 'expo-video';
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { AppState, AppStateStatus, Platform } from "react-native";
import TrackPlayer, {
    AppKilledPlaybackBehavior,
    Capability,
    Event,
    State,
    useTrackPlayerEvents,
    useProgress as useTrackPlayerProgress
} from 'react-native-track-player';

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
    { freq: "60Hz" }, { freq: "170Hz" }, { freq: "310Hz" }, { freq: "600Hz" },
    { freq: "1kHz" }, { freq: "3KHz" }, { freq: "6kHz" }, { freq: "12kHz" },
];

export const EQ_PROFILES = {
    Flat: [0, 0, 0, 0, 0, 0, 0, 0],
    BassBoost: [8, 6, 4, 2, 0, -2, -4, -6],
    TrebleBoost: [-6, -4, -2, 0, 2, 4, 6, 8],
    VocalBoost: [-2, 0, 4, 6, 6, 4, 0, -2],
    Custom: [0, 0, 0, 0, 0, 0, 0, 0],
    Rock: [6, 4, 2, 0, 1, 3, 5, 6],
    Pop: [4, 2, 0, 0, 1, 3, 4, 4],
    Jazz: [3, 2, 0, 0, 2, 3, 2, 1],
    Classical: [-2, -1, 0, 1, 2, 2, 1, 0],
    HipHop: [8, 6, 3, 0, -1, -2, 0, 2],
    Electronic: [7, 5, 3, 0, 1, 3, 5, 6],
    Dance: [6, 5, 4, 2, 1, 3, 5, 6],
    Acoustic: [2, 1, 0, 0, 2, 3, 2, 1],
    Signature: [5, 4, 2, 0, 1, 3, 5, 6],
};

export const EQ_SIGNATURE = {
    key: "Signature",
    name: "Suman Signature",
    tagline: "Studio-tuned signature sound",
    description: "Warm lows, clear mids and sparkling highs — a balanced signature tuned for modern listening across genres.",
};

// --- INTERFACES & TYPES ---
export type PlaybackMode = "normal" | "shuffle" | "repeat" | "repeat_one";
export type AudioOutput = "speaker" | "earpiece";
export type SongQuality = "48kbps" | "96kbps" | "160kbps" | "320kbps";

interface EqSettings { profile: string; customGains: number[]; }
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
    prepareOfflineQueue: (songs: ApiSong[], startIndex?: number) => Promise<any[]>;  // ADD THIS LINE
}

interface FullPlayerContextType extends PlayerContextType, ProgressContextType { }

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);
const ProgressContext = createContext<ProgressContextType | undefined>(undefined);

const events = [
    Event.PlaybackState,
    Event.PlaybackError,
    Event.RemotePlay,
    Event.RemotePause,
    Event.RemoteNext,
    Event.RemotePrevious,
    Event.RemoteSeek,
    Event.PlaybackActiveTrackChanged,
];

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { showAlert } = useGlobalAlert();
    const updateMusicWidget = require("@/utils/updateMusicWidget").updateMusicWidget;

    // State
    const [currentSong, setCurrentSong] = useState<ApiSong | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { position: rntpPosition, duration: rntpDuration } = useTrackPlayerProgress();
    const [videoProgress, setVideoProgress] = useState({ position: 0, duration: 0 });

    const [queue, setQueueState] = useState<ApiSong[]>([]);
    const queueRef = useRef<ApiSong[]>([]);
    const [currentIndex, setCurrentIndex] = useState<number>(0);
    const [playbackMode, setPlaybackMode] = useState<PlaybackMode>("normal");
    const [activeEqProfile, setActiveEqProfileState] = useState<string>("Flat");
    const [eqGains, setEqGainsState] = useState<number[]>(EQ_PROFILES.Flat);
    const [customEqGains, setCustomEqGains] = useState<number[]>(EQ_PROFILES.Custom);
    const [audioOutput, setAudioOutputState] = useState<AudioOutput>("speaker");
    const [songQuality, setSongQualityState] = useState<SongQuality>("320kbps");
    const [lastPlayedSong, setLastPlayedSong] = useState<ApiSong | null>(null);
    const [lastPlayedPosition, setLastPlayedPosition] = useState<number>(0);
    const [favorites, setFavorites] = useState<string[]>([]);
    const [videoModal, setVideoModal] = useState<{
        visible: boolean; uri: string | null; title?: string; width?: number; height?: number;
    }>({ visible: false, uri: null });
    const [currentPlayerType, setCurrentPlayerType] = useState<'audio' | 'video'>('audio');
    const [pendingSongId, setPendingSongId] = useState<string | null>(null);

    // Refs
    const shuffledQueue = useRef<ApiSong[]>([]);
    const suppressCurrentSongRef = useRef(false);
    const appState = useRef(AppState.currentState);
    const wasPlayingBeforeBackground = useRef<boolean>(false);
    const playSongLockRef = useRef(false);
    const playSongTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isSetup = useRef(false);

    // Video modal handlers
    const openVideoPlayer = useCallback((uri: string, title?: string, width?: number, height?: number) => {
        setVideoModal({ visible: true, uri, title, width, height });
    }, []);

    const closeVideoPlayer = useCallback(() => {
        setVideoModal({ visible: false, uri: null });
    }, []);

    // Setup TrackPlayer
    useEffect(() => {
        const setup = async () => {
            if (isSetup.current) return;
            try {
                await TrackPlayer.setupPlayer({
                    autoHandleInterruptions: true,
                });
                await TrackPlayer.updateOptions({
                    android: {
                        appKilledPlaybackBehavior: AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
                        alwaysPauseOnInterruption: true,
                    },
                    capabilities: [
                        Capability.Play,
                        Capability.Pause,
                        Capability.SkipToNext,
                        Capability.SkipToPrevious,
                        Capability.SeekTo,
                    ],
                    notificationCapabilities: [
                        Capability.Play,
                        Capability.Pause,
                        Capability.SkipToNext,
                        Capability.SkipToPrevious,
                        Capability.SeekTo,
                    ],
                    progressUpdateEventInterval: 1,
                });
                isSetup.current = true;
                console.log("TrackPlayer setup complete");
            } catch (error) {
                isSetup.current = true;
                console.log("TrackPlayer setup error (likely already setup):", error);
            }
        };
        setup();
    }, []);

    // Video player using expo-video
    const videoPlayer = useVideoPlayer(null, (playerInstance) => {
        playerInstance.muted = false;
        playerInstance.showNowPlayingNotification = true;
        playerInstance.staysActiveInBackground = true;
        if ((playerInstance as any).allowsExternalPlayback !== undefined) {
            (playerInstance as any).allowsExternalPlayback = false;
        }
        try { (playerInstance as any).audioSessionMode = 'none'; } catch { }
        try { (playerInstance as any).audioMixWithOthers = true; } catch { }
    });

    // Unified position/duration
    const position = currentPlayerType === 'audio' ? rntpPosition * 1000 : videoProgress.position;
    const duration = currentPlayerType === 'audio' ? rntpDuration * 1000 : videoProgress.duration;

    // Monitor video progress - FIXED to prevent circular updates
    useEffect(() => {
        if (currentPlayerType !== 'video') return;
    }, [currentPlayerType, videoPlayer]);

    // Storage helpers
    const saveEqSettings = useCallback(async (profile: string, customGains: number[]) => {
        try {
            await AsyncStorage.setItem("eq_settings", JSON.stringify({ profile, customGains }));
        } catch (error) { console.error("Failed to save EQ settings:", error); }
    }, []);

    const saveSongEqSettings = useCallback(async (songId: string, profile: string, customGains: number[]) => {
        try {
            await AsyncStorage.setItem(`eq_song_${songId}`, JSON.stringify({ profile, customGains }));
        } catch (error) { console.error(`Failed to save EQ for song ${songId}:`, error); }
    }, []);

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

    // FIXED: Separate effect to handle EQ loading
    useEffect(() => {
        if (!pendingSongId) return;

        const loadEq = async () => {
            try {
                const perSong = await loadSongEqSettings(pendingSongId);
                if (perSong) {
                    setCustomEqGains(perSong.customGains || EQ_PROFILES.Custom);
                    setActiveEqProfileState(perSong.profile || "Custom");
                    const gainsToApply = perSong.profile === "Custom"
                        ? perSong.customGains || EQ_PROFILES.Custom
                        : EQ_PROFILES[perSong.profile as keyof typeof EQ_PROFILES] || EQ_PROFILES.Flat;
                    setEqGainsState(gainsToApply);
                }
            } catch (error) {
                console.error("Failed to load song EQ:", error);
            } finally {
                setPendingSongId(null);
            }
        };

        loadEq();
    }, [pendingSongId, loadSongEqSettings]);

    const savePlaybackState = useCallback(async (
        song: ApiSong | null, pos: number, currentQueue?: ApiSong[], index?: number
    ) => {
        if (song) {
            try {
                await AsyncStorage.setItem("last_played_song", JSON.stringify(song));
                await AsyncStorage.setItem("last_played_position", pos.toString());
                if (currentQueue && currentQueue.length > 0) {
                    await AsyncStorage.setItem("last_played_queue", JSON.stringify(currentQueue));
                    await AsyncStorage.setItem("last_played_index", String(index ?? 0));
                }
                setLastPlayedSong(song);
                setLastPlayedPosition(pos);
            } catch (error) { console.error("Failed to save playback state:", error); }
        }
    }, []);

    const stop = useCallback(async () => {
        try {
            await TrackPlayer.reset();
            videoPlayer?.pause();
        } catch (e) { console.warn("stop() encountered error:", e); }
        setIsPlaying(false);
        setCurrentSong(null);
    }, [videoPlayer]);

    const seekTo = useCallback(async (positionMs: number) => {
        const positionSec = positionMs / 1000;
        if (currentPlayerType === 'audio') {
            await TrackPlayer.seekTo(positionSec);
        } else {
            (videoPlayer as any).currentTime = positionSec;
        }
    }, [currentPlayerType, videoPlayer]);

    const seekBy = useCallback(async (seconds: number) => {
        if (currentPlayerType === 'audio') {
            const newPos = rntpPosition + seconds;
            await TrackPlayer.seekTo(newPos);
        } else {
            const currentTime = (videoPlayer as any).currentTime || 0;
            (videoPlayer as any).currentTime = currentTime + seconds;
        }
        Haptics.selectionAsync();
    }, [currentPlayerType, rntpPosition, videoPlayer]);

    // Helper to get song URL
    const getSongUrl = useCallback(async (song: ApiSong): Promise<string | undefined> => {
        // Check for downloaded songs first
        const downloadedSongs = await downloadService.getDownloadedSongs();
        const downloadedSong = downloadedSongs.find((s) => s.id === song.id);

        if (downloadedSong) {
            return await downloadService.getDecryptedFileUri(downloadedSong);
        }

        // Get URL from API if needed
        let songData = { ...song };
        if (!Array.isArray(song.downloadUrl) || song.downloadUrl.length === 0) {
            const res = await fetch(`https://suman-api.vercel.app/songs?id=${song.id}`);
            const apiData = await res.json();
            if (apiData.status === "SUCCESS" && apiData.data?.[0]) {
                songData = apiData.data[0];
            }
        }

        if (Array.isArray(songData.downloadUrl)) {
            const preferred = songData.downloadUrl.find((q) => q.quality === songQuality);
            const fallback = songData.downloadUrl.find((q) => q.quality === "320kbps") || songData.downloadUrl[0];
            return (preferred || fallback)?.link;
        }

        return undefined;
    }, [songQuality]);

    const playSong = useCallback(async (song: ApiSong, force: boolean = false, newQueue?: ApiSong[]) => {
        console.log("[PlaySong] Called with song:", song?.name || song?.title);
        if (!song) return;

        // 1. Locking to prevent race conditions
        if (playSongLockRef.current) {
            if (force) playSongLockRef.current = false;
            else return;
        }
        playSongLockRef.current = true;
        setIsLoading(true);

        // Timeout safety
        if (playSongTimeoutRef.current) clearTimeout(playSongTimeoutRef.current);
        playSongTimeoutRef.current = setTimeout(() => {
            if (playSongLockRef.current) {
                playSongLockRef.current = false;
                setIsLoading(false);
            }
        }, 8000); // Increased timeout for potential file copying

        try {
            // 2. Pause existing video
            if (videoPlayer && (videoPlayer as any).playing) {
                videoPlayer.pause();
            }
            setCurrentPlayerType('audio');

            // 3. Resolve URL
            let songData = { ...song };
            let finalUrl: string | undefined;

            // Try getting decrypted/downloaded URL first
            try {
                finalUrl = await getSongUrl(song);
            } catch (e) { }

            // Fallback to object properties
            if (!finalUrl) {
                if (typeof song.downloadUrl === 'string') finalUrl = song.downloadUrl;
                else if (typeof song.url === 'string') finalUrl = song.url;
                else if (Array.isArray(song.downloadUrl)) finalUrl = song.downloadUrl.find(q => q.quality === songQuality)?.link || song.downloadUrl[0]?.link;
            }

            if (!finalUrl) throw new Error("No playable URL found.");

            // --- FIX: HANDLE CONTENT URIS (Android Local Files) ---
            // content:// URIs often fail in players. Copy to cache (file://) first.
            if (Platform.OS === 'android' && finalUrl.startsWith('content:')) {
                try {
                    const fileName = (song.name || 'temp_video').replace(/[^a-zA-Z0-9]/g, '_');
                    const dest = `${ExpoFileSystem.cacheDirectory}${fileName}`;

                    // Copy content to cache
                    await ExpoFileSystem.copyAsync({ from: finalUrl, to: dest });
                    finalUrl = dest; // Use the new file:// URI
                    console.log("Copied content URI to cache:", finalUrl);
                } catch (err) {
                    console.warn("Failed to copy content URI, trying original:", err);
                }
            }

            // --- ROBUST VIDEO DETECTION ---
            const looksLikeVideo = (u: string) => {
                const lower = u.split('?')[0].toLowerCase();
                return !!lower.match(/\.(mp4|m4v|mov|webm|mkv|avi)$/);
            };

            const isLocalFile = (u: string) => {
                return u.startsWith('file:') || u.startsWith('/') || u.startsWith('content:') || u.startsWith('asset:');
            };

            let shouldPlayAsVideo = false;

            // Initial check based on extension or type
            if (looksLikeVideo(finalUrl) || song.type === 'video') {
                if (isLocalFile(finalUrl)) {
                    // Local video file -> Definitely video
                    shouldPlayAsVideo = true;
                } else {
                    // Remote video file -> Check headers to be sure it's not audio-only mp4
                    try {
                        // Quick HEAD request to check content-type
                        const response = await fetch(finalUrl, { method: 'HEAD' });
                        const type = response.headers.get('Content-Type');
                        if (type && type.startsWith('video/')) {
                            shouldPlayAsVideo = true;
                        }
                    } catch (e) {
                        // If network check fails, trust the extension if it looks like video
                        shouldPlayAsVideo = true;
                    }
                }
            }

            // --- EXECUTE VIDEO PLAYBACK ---
            if (shouldPlayAsVideo) {
                try {
                    suppressCurrentSongRef.current = true;
                    await TrackPlayer.pause(); // Ensure audio player is stopped
                    try { await ScreenOrientation.unlockAsync(); } catch { }

                    const cleanName = (songData.name || songData.title || "Unknown").split("(")[0].trim();

                    // Open the expo-video modal
                    openVideoPlayer(finalUrl, cleanName);
                    setCurrentPlayerType('video');

                    // Sync state
                    const queueToUse = newQueue || queueRef.current;
                    const startIndex = queueToUse.findIndex(s => s.id === song.id);
                    setTimeout(() => savePlaybackState({ ...songData, name: cleanName }, 0, queueToUse, startIndex >= 0 ? startIndex : currentIndex), 500);
                    setTimeout(() => { suppressCurrentSongRef.current = false; }, 800);
                } catch (err) {
                    console.warn("Failed to open video player:", err);
                    // Fallback to audio player if video fails? 
                    // Usually better to just stop here if video failed.
                } finally {
                    setIsLoading(false);
                    playSongLockRef.current = false;
                }
                return; // EXIT, do not run audio logic
            }

            // -----------------------------------
            // ... AUDIO PLAYBACK LOGIC (TrackPlayer) ...
            // -----------------------------------

            const cleanSongName = (songData.name || songData.title || "Unknown").split("(")[0].trim();
            const artistString = typeof songData.primaryArtists === "string" ? songData.primaryArtists : Array.isArray(songData.primaryArtists) ? songData.primaryArtists.map((a: any) => a.name || a).join(", ") : "";

            let pictureUri = "";
            if (Array.isArray(songData.image)) {
                pictureUri = songData.image.find((img) => img.quality === "500x500")?.link || songData.image[0]?.link || "";
            } else if (typeof songData.image === "string") {
                pictureUri = songData.image;
            }

            if (!suppressCurrentSongRef.current) setCurrentSong({ ...songData, name: cleanSongName });

            updateMusicWidget({
                songTitle: cleanSongName,
                artist: artistString,
                albumArtPath: pictureUri,
                isPlaying: true,
                progress: 0,
            });

            // Queue Logic
            const queueToUse = newQueue || queueRef.current;
            if (newQueue) {
                setQueueState(newQueue);
                queueRef.current = newQueue;
            }
            const songIndexInQueue = queueToUse.findIndex(s => s.id === song.id);
            const startIndex = songIndexInQueue >= 0 ? songIndexInQueue : 0;
            setCurrentIndex(startIndex);

            await TrackPlayer.reset();

            const tracksToAdd = queueToUse.map((queueSong) => {
                const isTarget = queueSong.id === song.id;
                let trackUrl = isTarget ? finalUrl : '';

                // For other tracks, use placeholder - will decrypt on demand
                if (!trackUrl) {
                    if (Array.isArray(queueSong.downloadUrl)) trackUrl = queueSong.downloadUrl.find(q => q.quality === songQuality)?.link || queueSong.downloadUrl[0]?.link || '';
                    else if (typeof queueSong.downloadUrl === "string") trackUrl = queueSong.downloadUrl;
                    if (!trackUrl && queueSong.url) trackUrl = queueSong.url;
                }

                const trackArtist = typeof queueSong.primaryArtists === "string" ? queueSong.primaryArtists : Array.isArray(queueSong.primaryArtists) ? queueSong.primaryArtists.map((a: any) => a.name || a).join(", ") : "";

                let trackArtwork = undefined;
                if (Array.isArray(queueSong.image) && queueSong.image.length > 0) trackArtwork = queueSong.image.find(img => img.quality === "500x500")?.link || queueSong.image[0]?.link;
                else if (typeof queueSong.image === "string" && queueSong.image.length > 0) trackArtwork = queueSong.image;

                return {
                    id: queueSong.id,
                    url: trackUrl || '',
                    title: (queueSong.name || queueSong.title || "Unknown").split("(")[0].trim(),
                    artist: trackArtist,
                    artwork: trackArtwork,
                };
            });

            await TrackPlayer.add(tracksToAdd);

            if (startIndex > 0) {
                await TrackPlayer.skip(startIndex);
            }

            await TrackPlayer.play();
            setIsPlaying(true);

            try {
                await initEqualizer(0);
                setEqualizerGains(eqGains);
            } catch { }

            setTimeout(() => savePlaybackState({ ...songData, name: cleanSongName }, 0, queueToUse, startIndex), 1000);

        } catch (error) {
            console.error("Error in playSong:", error);
            stop();
            alert(`Error playing ${song.name}`);
        } finally {
            if (playSongTimeoutRef.current) {
                clearTimeout(playSongTimeoutRef.current);
                playSongTimeoutRef.current = null;
            }
            setIsLoading(false);
            playSongLockRef.current = false;
        }
    }, [videoPlayer, songQuality, stop, savePlaybackState, queue, currentIndex, eqGains, openVideoPlayer, getSongUrl, updateMusicWidget, setQueueState]);

    const nextSong = useCallback(async () => {
        try {
            await TrackPlayer.skipToNext();
        } catch (error) {
            console.log('No next track available');
            // Handle repeat mode
            if (playbackMode === "repeat") {
                await TrackPlayer.skip(0);
                await TrackPlayer.play();
            } else {
                await stop();
            }
        }
    }, [playbackMode, stop]);

    const previousSong = useCallback(async () => {
        try {
            await TrackPlayer.skipToPrevious();
        } catch (error) {
            console.log('No previous track available');
        }
    }, []);

    // 2. New function to prepare offline queue with decrypted URLs
    const prepareOfflineQueue = useCallback(async (songs: ApiSong[], startIndex: number = 0): Promise<any[]> => {
        console.log("[PrepareOfflineQueue] Preparing queue with", songs.length, "songs");

        const preparedTracks = await Promise.all(
            songs.map(async (song, index) => {
                let trackUrl = '';

                // For the current song and nearby songs (±2), decrypt immediately
                const shouldDecryptNow = Math.abs(index - startIndex) <= 2;

                if (shouldDecryptNow) {
                    try {
                        trackUrl = await getSongUrl(song);
                        console.log(`[PrepareOfflineQueue] Decrypted song ${index}:`, song.name);
                    } catch (error) {
                        console.warn(`[PrepareOfflineQueue] Failed to decrypt song ${index}:`, error);
                    }
                }

                // Fallback to placeholder URL if decryption failed or not needed yet
                if (!trackUrl) {
                    if (Array.isArray(song.downloadUrl)) {
                        trackUrl = song.downloadUrl.find(q => q.quality === songQuality)?.link || song.downloadUrl[0]?.link || '';
                    } else if (typeof song.downloadUrl === "string") {
                        trackUrl = song.downloadUrl;
                    }
                    if (!trackUrl && song.url) trackUrl = song.url;
                }

                const trackArtist = typeof song.primaryArtists === "string"
                    ? song.primaryArtists
                    : Array.isArray(song.primaryArtists)
                        ? song.primaryArtists.map((a: any) => a.name || a).join(", ")
                        : "";

                let trackArtwork = undefined;
                if (Array.isArray(song.image) && song.image.length > 0) {
                    trackArtwork = song.image.find(img => img.quality === "500x500")?.link || song.image[0]?.link;
                } else if (typeof song.image === "string" && song.image.length > 0) {
                    trackArtwork = song.image;
                }

                return {
                    id: song.id,
                    url: trackUrl || '',
                    title: (song.name || song.title || "Unknown").split("(")[0].trim(),
                    artist: trackArtist,
                    artwork: trackArtwork,
                };
            })
        );

        return preparedTracks;
    }, [getSongUrl, songQuality]);

    // 3. Modified function to handle track changes and decrypt on-demand
    const handleTrackChange = useCallback(async (trackIndex: number) => {
        const currentQueue = queueRef.current;
        if (!currentQueue || trackIndex >= currentQueue.length) return;

        const song = currentQueue[trackIndex];
        console.log("[HandleTrackChange] Track changed to index:", trackIndex, song.name);

        // Update UI state
        setCurrentIndex(trackIndex);
        setCurrentSong(song);
        setPendingSongId(song.id);

        // SAVE PLAYBACK STATE HERE
        savePlaybackState(song, 0, currentQueue, trackIndex);

        // Decrypt current track if needed
        try {
            const tracks = await TrackPlayer.getQueue();
            const currentTrack = tracks[trackIndex];

            // Check if current track needs decryption (placeholder URL)
            const needsDecryption = currentTrack && (
                !currentTrack.url ||
                currentTrack.url.includes('saavn.me') ||
                currentTrack.url.includes('preview')
            );

            if (needsDecryption) {
                console.log("[HandleTrackChange] Current track needs decryption");
                const decryptedUrl = await getSongUrl(song);

                if (decryptedUrl && decryptedUrl !== currentTrack.url) {
                    console.log("[HandleTrackChange] Replacing with decrypted URL");

                    const trackArtist = typeof song.primaryArtists === "string"
                        ? song.primaryArtists
                        : Array.isArray(song.primaryArtists)
                            ? song.primaryArtists.map((a: any) => a.name || a).join(", ")
                            : "";

                    let trackArtwork = undefined;
                    if (Array.isArray(song.image) && song.image.length > 0) {
                        trackArtwork = song.image.find(img => img.quality === "500x500")?.link || song.image[0]?.link;
                    } else if (typeof song.image === "string" && song.image.length > 0) {
                        trackArtwork = song.image;
                    }

                    await TrackPlayer.remove(trackIndex);
                    await TrackPlayer.add({
                        id: song.id,
                        url: decryptedUrl,
                        title: (song.name || song.title || "Unknown").split("(")[0].trim(),
                        artist: trackArtist,
                        artwork: trackArtwork,
                    }, trackIndex);

                    // Resume playback at current track
                    await TrackPlayer.skip(trackIndex);
                    await TrackPlayer.play();
                }
            }
        } catch (error) {
            console.error("[HandleTrackChange] Error handling track change:", error);
        }

        // Pre-decrypt next track in background
        const nextIndex = trackIndex + 1;
        if (nextIndex < currentQueue.length) {
            getSongUrl(currentQueue[nextIndex]).then(async (nextUrl) => {
                if (nextUrl) {
                    try {
                        const tracks = await TrackPlayer.getQueue();
                        if (tracks[nextIndex] && tracks[nextIndex].url !== nextUrl) {
                            const nextSong = currentQueue[nextIndex];
                            const trackArtist = typeof nextSong.primaryArtists === "string"
                                ? nextSong.primaryArtists
                                : Array.isArray(nextSong.primaryArtists)
                                    ? nextSong.primaryArtists.map((a: any) => a.name || a).join(", ")
                                    : "";

                            let trackArtwork = undefined;
                            if (Array.isArray(nextSong.image) && nextSong.image.length > 0) {
                                trackArtwork = nextSong.image.find(img => img.quality === "500x500")?.link || nextSong.image[0]?.link;
                            } else if (typeof nextSong.image === "string" && nextSong.image.length > 0) {
                                trackArtwork = nextSong.image;
                            }

                            await TrackPlayer.remove(nextIndex);
                            await TrackPlayer.add({
                                id: nextSong.id,
                                url: nextUrl,
                                title: (nextSong.name || nextSong.title || "Unknown").split("(")[0].trim(),
                                artist: trackArtist,
                                artwork: trackArtwork,
                            }, nextIndex);

                            console.log("[HandleTrackChange] Pre-decrypted next track");
                        }
                    } catch (error) {
                        console.warn("[HandleTrackChange] Failed to pre-decrypt next track:", error);
                    }
                }
            }).catch(err => console.warn("[HandleTrackChange] Background decryption failed:", err));
        }
    }, [getSongUrl, setCurrentSong, setPendingSongId, setCurrentIndex, savePlaybackState]);

    // Toggle play/pause
    const togglePlayPause = useCallback(async () => {
        if (currentPlayerType === 'audio') {
            const { state } = await TrackPlayer.getPlaybackState();
            if (state === State.Playing) {
                await TrackPlayer.pause();
            } else {
                await TrackPlayer.play();
            }
        } else {
            if ((videoPlayer as any).playing) {
                videoPlayer.pause();
            } else {
                videoPlayer.play();
            }
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, [currentPlayerType, videoPlayer]);

    const setQueue = useCallback((songs: ApiSong[], startIndex: number = 0) => {
        setQueueState(songs);
        queueRef.current = songs; // FIX: Update ref immediately

        setCurrentIndex(startIndex);
        if (playbackMode === "shuffle") shuffledQueue.current = shuffleArray(songs);
        else shuffledQueue.current = [];
    }, [playbackMode]);

    const togglePlaybackMode = useCallback(() => {
        const modes: PlaybackMode[] = ["normal", "repeat", "repeat_one", "shuffle"];
        const nextModeIndex = (modes.indexOf(playbackMode) + 1) % modes.length;
        const newMode = modes[nextModeIndex];
        setPlaybackMode(newMode);
        if (newMode === "shuffle") shuffledQueue.current = shuffleArray(queue);
        else shuffledQueue.current = [];
    }, [playbackMode, queue]);

    // FIXED: applyEqProfile - make async saves non-blocking
    const applyEqProfile = useCallback((profile: string) => {
        const profileKey = profile as keyof typeof EQ_PROFILES;
        if (!EQ_PROFILES[profileKey]) return;

        setActiveEqProfileState(profile);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        const newGains = profile === "Custom" ? customEqGains : EQ_PROFILES[profileKey];
        setEqGainsState(newGains);

        // Save asynchronously without blocking
        Promise.all([
            saveEqSettings(profile, customEqGains),
            currentSong?.id ? saveSongEqSettings(currentSong.id, profile, customEqGains) : Promise.resolve()
        ]).catch(console.error);
    }, [customEqGains, saveEqSettings, saveSongEqSettings, currentSong]);

    // FIXED: updateCustomGain - make async saves non-blocking
    const updateCustomGain = useCallback((index: number, value: number) => {
        Haptics.selectionAsync();

        setCustomEqGains((prevGains) => {
            const newCustomGains = [...prevGains];
            newCustomGains[index] = value;

            if (activeEqProfile === "Custom") {
                setEqGainsState(newCustomGains);
            }

            // Save asynchronously without blocking
            const profileToSave = activeEqProfile === "Custom" ? "Custom" : activeEqProfile;
            Promise.all([
                saveEqSettings(profileToSave, newCustomGains),
                currentSong?.id ? saveSongEqSettings(currentSong.id, profileToSave, newCustomGains) : Promise.resolve()
            ]).catch(console.error);

            return newCustomGains;
        });

        if (activeEqProfile !== "Custom") {
            setActiveEqProfileState("Custom");
        }
    }, [activeEqProfile, saveEqSettings, saveSongEqSettings, currentSong]);

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
        if (!currentSong) return false;
        const isCurrentlyFavorite = favorites.includes(currentSong.id);
        const storedFavoritesJSON = await AsyncStorage.getItem("user_favorites");
        const currentFavorites: ApiSong[] = storedFavoritesJSON ? JSON.parse(storedFavoritesJSON) : [];
        let newFavorites: ApiSong[];
        let action: "added" | "removed" = "added";
        if (isCurrentlyFavorite) { newFavorites = currentFavorites.filter((s) => s.id !== currentSong.id); action = "removed"; }
        else { newFavorites = [...currentFavorites, currentSong]; action = "added"; }
        setFavorites(newFavorites.map((s) => s.id));
        await AsyncStorage.setItem("user_favorites", JSON.stringify(newFavorites));
        try { const { emit } = require("@/utils/eventBus"); emit("favoritesUpdated", { newFavorites, action, songId: currentSong.id }); } catch { }
        return newFavorites.some((s) => s.id === currentSong.id);
    }, [favorites, currentSong]);

    const resumeLastPlayback = useCallback(async () => {
        try {
            const savedSong = await AsyncStorage.getItem("last_played_song");
            const savedPos = await AsyncStorage.getItem("last_played_position");
            const savedQueue = await AsyncStorage.getItem("last_played_queue");

            if (savedSong) {
                const song = JSON.parse(savedSong);
                const pos = savedPos ? parseFloat(savedPos) : 0;

                let queueToUse = [song];
                if (savedQueue) {
                    queueToUse = JSON.parse(savedQueue);
                }

                // Actually play the song using playSong
                await playSong(song, true, queueToUse);

                // Seek to saved position if any
                if (pos > 0) {
                    await seekTo(pos);
                }
            }
        } catch (error) { console.error("Failed to resume last playback:", error); }
    }, [playSong, seekTo]);

    useTrackPlayerEvents(events, async (event) => {
        if (event.type === Event.PlaybackError) {
            console.warn('Playback Error:', event);
        }

        if (event.type === Event.PlaybackState) {
            setIsPlaying(event.state === State.Playing);
            setIsLoading(event.state === State.Buffering || event.state === State.Loading);

            // Update widget state
            if (currentSong) {
                let albumArtPath = "";
                if (Array.isArray(currentSong.image)) albumArtPath = currentSong.image[0]?.link || "";
                else if (typeof currentSong.image === "string") albumArtPath = currentSong.image;

                updateMusicWidget({
                    songTitle: currentSong.title || currentSong.name,
                    artist: typeof currentSong.primaryArtists === "string" ? currentSong.primaryArtists : "",
                    albumArtPath,
                    isPlaying: event.state === State.Playing,
                    progress: duration > 0 ? position / duration : 0,
                });
            }
        }

        if (event.type === Event.RemoteSeek) {
            TrackPlayer.seekTo(event.position);
        }

        // IMPORTANT: Handle automatic track changes (from next/prev or auto-advance)
        if (event.type === Event.PlaybackActiveTrackChanged) {
            if (event.index !== undefined && event.index !== null && !playSongLockRef.current) {
                await handleTrackChange(event.index);
            }
        }

        if (event.type === Event.RemotePlay) TrackPlayer.play();
        if (event.type === Event.RemotePause) TrackPlayer.pause();
        if (event.type === Event.RemoteNext) nextSong();
        if (event.type === Event.RemotePrevious) previousSong();
    });

    // Load settings on mount
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const [favsJSON, savedEqJson, savedAudioOutput, savedSongQuality, savedLastPlayed, savedLastPosition] = await Promise.all([
                    AsyncStorage.getItem("user_favorites"),
                    AsyncStorage.getItem("eq_settings"),
                    AsyncStorage.getItem("audio_output"),
                    AsyncStorage.getItem("song_quality"),
                    AsyncStorage.getItem("last_played_song"),
                    AsyncStorage.getItem("last_played_position"),
                ]);

                if (favsJSON) setFavorites(JSON.parse(favsJSON).map((s: ApiSong) => s.id));
                if (savedEqJson) {
                    const { profile, customGains } = JSON.parse(savedEqJson) as EqSettings;
                    if (customGains) setCustomEqGains(customGains);
                    const gainsToApply = profile === "Custom" ? customGains || EQ_PROFILES.Custom
                        : EQ_PROFILES[profile as keyof typeof EQ_PROFILES] || EQ_PROFILES.Flat;
                    setActiveEqProfileState(profile);
                    setEqGainsState(gainsToApply);
                }
                if (savedAudioOutput) setAudioOutputState(savedAudioOutput as AudioOutput);
                if (savedSongQuality) setSongQualityState(savedSongQuality as SongQuality);
                if (savedLastPlayed) setLastPlayedSong(JSON.parse(savedLastPlayed));
                if (savedLastPosition) setLastPlayedPosition(parseInt(savedLastPosition, 10));
            } catch (error) { console.error("Failed to load settings:", error); }
        };
        loadSettings();
    }, []);

    // AppState listener
    useEffect(() => {
        const subscription = AppState.addEventListener("change", async (nextAppState: AppStateStatus) => {
            appState.current = nextAppState;
        });
        return () => { subscription.remove(); };
    }, []);

    // Sync EQ gains to native
    useEffect(() => { try { setEqualizerGains(eqGains); } catch { } }, [eqGains]);

    // Release equalizer on unmount
    useEffect(() => { return () => { try { releaseEqualizer(); } catch { } }; }, []);

    // Memoized context values
    const playerValue = useMemo(() => ({
        currentSong, isPlaying, isLoading, queue, playbackMode, eqGains, activeEqProfile, audioOutput, songQuality,
        favorites, lastPlayedSong, lastPlayedPosition, playSong, togglePlayPause, nextSong, previousSong, seekTo,
        setQueue, togglePlaybackMode, applyEqProfile, updateCustomGain, seekBy, setAudioOutput, setSongQuality,
        toggleFavorite, savePlaybackState, resumeLastPlayback, prepareOfflineQueue,  // ADD prepareOfflineQueue HERE
    }), [currentSong, isPlaying, isLoading, queue, playbackMode, eqGains, activeEqProfile, audioOutput, songQuality,
        favorites, lastPlayedSong, lastPlayedPosition, prepareOfflineQueue]);  // AND ADD IT TO DEPENDENCIES

    const progressValue = useMemo(() => ({
        playbackPosition: position, playbackDuration: duration, seekBy,
    }), [position, duration, seekBy]);

    return (
        <PlayerContext.Provider value={playerValue}>
            <ProgressContext.Provider value={progressValue}>
                {children}
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
                {/* <VideoView player={videoPlayer} style={{ height: 0, width: 0 }} nativeControls={false} contentFit="contain" /> */}
            </ProgressContext.Provider>
        </PlayerContext.Provider>
    );
};

// --- CUSTOM HOOKS ---
export const usePlayer = (): PlayerContextType => {
    const context = useContext(PlayerContext);
    if (!context) throw new Error("usePlayer must be used within a PlayerProvider");
    return context;
};

export const useProgress = (): ProgressContextType => {
    const context = useContext(ProgressContext);
    if (!context) throw new Error("useProgress must be used within a PlayerProvider");
    return context;
};

export const usePlayerWithProgress = (): FullPlayerContextType => {
    const player = usePlayer();
    const progress = useProgress();
    return useMemo(() => ({ ...player, ...progress }), [player, progress]);
};

export const useCurrentSong = () => {
    const context = useContext(PlayerContext);
    if (!context) throw new Error("useCurrentSong must be used within a PlayerProvider");
    return context.currentSong;
};

export const useIsPlaying = () => {
    const context = useContext(PlayerContext);
    if (!context) throw new Error("useIsPlaying must be used within a PlayerProvider");
    return context.isPlaying;
};

export const useIsLoading = () => {
    const context = useContext(PlayerContext);
    if (!context) throw new Error("useIsLoading must be used within a PlayerProvider");
    return context.isLoading;
};

export const useQueue = () => {
    const context = useContext(PlayerContext);
    if (!context) throw new Error("useQueue must be used within a PlayerProvider");
    return context.queue;
};

export const usePlaybackMode = () => {
    const context = useContext(PlayerContext);
    if (!context) throw new Error("usePlaybackMode must be used within a PlayerProvider");
    return context.playbackMode;
};

export const useFavorites = () => {
    const context = useContext(PlayerContext);
    if (!context) throw new Error("useFavorites must be used within a PlayerProvider");
    return context.favorites;
};