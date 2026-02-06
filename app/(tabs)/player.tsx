import { NfcShareButton } from "@/components/NfcShareButton";
import { NfcShareWaitingModal } from "@/components/NfcShareWaitingModal";
import { useNfc } from "@/context/NfcContext";
import { usePlayer, useProgress } from "@/context/PlayerContext";
import { useBeautifulAlert } from "@/hooks/useBeautifulAlert";
import { ApiImage } from "@/services/apiTypes";
import { useNetworkStatus } from "@/services/networkService";
import { getSongLyrics } from "@/services/saavnService";
import { on as eventOn } from '@/utils/eventBus';
import FontAwesome from "@expo/vector-icons/FontAwesome";
import Slider from "@react-native-community/slider";
import { BlurView } from "expo-blur";
import { router, Stack, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Image,
  ImageBackground,
  Platform,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import NfcManager from 'react-native-nfc-manager';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";






// Render LyricsView at the end (absolute overlay)
// <LyricsView visible={showLyrics} onClose={() => setShowLyrics(false)} lyrics={lyricsData} currentTime={playbackPosition / 1000} isSynced={isSyncedLyrics} />


const { width } = Dimensions.get("window");

// --- MARQUEE COMPONENT (Auto-Scrolling Text) ---
const MarqueeText = ({ text, style }: { text: string; style: any }) => {
  const translateX = useSharedValue(0);
  const [textWidth, setTextWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    // Reset position when text changes
    translateX.value = 0;

    if (textWidth > containerWidth && containerWidth > 0) {
      const distance = textWidth - containerWidth;
      // Calculate duration based on width to maintain constant speed (approx 50px/sec)
      const duration = Math.max(distance * 50, 3000);

      translateX.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 2000 }), // Wait 2s at start
          withTiming(-distance - 10, { // Scroll to left
            duration: duration,
            easing: Easing.linear
          }),
          withTiming(-distance - 10, { duration: 1000 }), // Wait 1s at end
          withTiming(0, { // Scroll back to start
            duration: duration,
            easing: Easing.linear
          })
        ),
        -1, // Infinite repeat
        false
      );
    }
  }, [text, textWidth, containerWidth, translateX]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View
      style={{ overflow: 'hidden', width: '100%', alignItems: 'center' }}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      <Animated.Text
        style={[style, animatedStyle, { width: undefined }]} // width undefined allows text to expand
        numberOfLines={1}
        ellipsizeMode="clip" // Clip prevents dots (...) so we can scroll the full text
        onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)}
      >
        {text}
      </Animated.Text>
    </View>
  );
};

// Helper function to decode HTML entities
const decodeHtmlEntities = (text: string): string => {
  if (!text) return text;
  return text
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
};

// Helper function
const getImageUrl = (
  imageInput: ApiImage[] | string | undefined,
  quality: string = "500x500"
): string => {
  const placeholder = "https://via.placeholder.com/500?text=Music";
  if (!imageInput) return placeholder;
  if (typeof imageInput === "string") return imageInput || placeholder;
  if (Array.isArray(imageInput) && imageInput.length > 0) {
    const qualityImage = imageInput.find((img) => img.quality === quality);
    return (
      qualityImage?.link ||
      imageInput[imageInput.length - 1]?.link ||
      placeholder
    );
  }
  return placeholder;
};

const getArtistNameFromPrimary = (
  artistsInput: any[] | string | undefined
): string => {
  if (!artistsInput) return "Unknown Artist";
  if (typeof artistsInput === "string") return decodeHtmlEntities(artistsInput);
  if (Array.isArray(artistsInput) && artistsInput.length > 0) {
    return artistsInput
      .map((a: any) => decodeHtmlEntities(a.name || a.id || ""))
      .filter((name) => name)
      .join(", ");
  }
  return "Unknown Artist";
};

const secondsToMinuteSecond = (milliseconds: number | undefined): string => {
  if (!milliseconds || isNaN(milliseconds)) return "0:00";
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

// --- ANIMATED LYRIC LINE COMPONENT ---
const LyricLine = React.memo(({
  text,
  isActive,
  isPast,
  isSynced
}: {
  text: string;
  isActive: boolean;
  isPast: boolean;
  isSynced: boolean;
}) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(isPast ? 0.3 : isActive ? 1 : 0.5);

  useEffect(() => {
    if (isActive) {
      scale.value = withTiming(1.02, { duration: 300 });
      opacity.value = withTiming(1, { duration: 300 });
    } else {
      scale.value = withTiming(1, { duration: 300 });
      opacity.value = withTiming(isPast ? 0.25 : 0.45, { duration: 400 });
    }
  }, [isActive, isPast]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  // For non-synced, show all lines clearly
  if (!isSynced) {
    return (
      <View style={{ marginBottom: 28, paddingHorizontal: 8 }}>
        <Text style={{
          fontSize: 26,
          fontWeight: '700',
          color: '#FFFFFF',
          textAlign: 'center',
          lineHeight: 38,
        }}>
          {text}
        </Text>
      </View>
    );
  }

  return (
    <Animated.View style={[{ marginBottom: 28, paddingHorizontal: 8 }, animatedStyle]}>
      <Text style={{
        fontSize: isActive ? 34 : 26,
        fontWeight: isActive ? '900' : '600',
        color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.85)',
        textAlign: 'center',
        lineHeight: isActive ? 46 : 38,
        // Glow effect for active line
        textShadowColor: isActive ? 'rgba(255,255,255,0.8)' : 'transparent',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: isActive ? 20 : 0,
      }}>
        {text}
      </Text>
    </Animated.View>
  );
});

// --- COMPACT LYRICS OVERLAY (shows on artwork) ---
const LyricsOverlay = ({
  visible,
  onClose,
  lyrics,
  currentTime,
  isSynced,
}: {
  visible: boolean;
  onClose: () => void;
  lyrics: any[];
  currentTime: number;
  isSynced: boolean;
}) => {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(0);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [displayedLines, setDisplayedLines] = useState<{ prev: string | null, current: string, next: string | null, nextNext: string | null }>({
    prev: null, current: '', next: null, nextNext: null
  });

  // Animation values for smooth line transitions
  const lineOpacity = useSharedValue(1);
  const lineTranslateY = useSharedValue(0);

  // Reset state when lyrics change (new song)
  useEffect(() => {
    setActiveIndex(-1);
    setDisplayedLines({ prev: null, current: '', next: null, nextNext: null });
    lineOpacity.value = 1;
    lineTranslateY.value = 0;
  }, [lyrics]);

  // Fade in/out animation
  useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, { duration: 300 });
    if (!visible) {
      translateY.value = withTiming(0, { duration: 200 });
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  // Animated style for lyrics content - smooth slide up
  const linesAnimatedStyle = useAnimatedStyle(() => ({
    opacity: lineOpacity.value,
    transform: [{ translateY: lineTranslateY.value }],
  }));

  // Swipe down gesture to close
  const swipeGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY > 0) {
        translateY.value = e.translationY * 0.5;
      }
    })
    .onEnd((e) => {
      if (e.translationY > 60) {
        translateY.value = withTiming(200, { duration: 200 });
        runOnJS(onClose)();
      } else {
        translateY.value = withTiming(0, { duration: 200 });
      }
    });

  // Find active lyric and animate transition
  useEffect(() => {
    if (visible && isSynced && lyrics.length > 0) {
      const newActiveIndex = lyrics.findIndex((line, index) => {
        const nextLine = lyrics[index + 1];
        return currentTime >= line.time && (!nextLine || currentTime < nextLine.time);
      });

      if (newActiveIndex !== activeIndex && newActiveIndex >= 0) {
        // Animate out current lines
        lineOpacity.value = withTiming(0, { duration: 150 });
        lineTranslateY.value = withTiming(-15, { duration: 150 });

        // After a brief delay, update lines and animate in
        setTimeout(() => {
          setActiveIndex(newActiveIndex);

          // Get new lines
          const prev = newActiveIndex > 0 ? (isSynced ? lyrics[newActiveIndex - 1]?.text : lyrics[newActiveIndex - 1]) : null;
          const current = isSynced ? lyrics[newActiveIndex]?.text : lyrics[newActiveIndex];
          const next = newActiveIndex < lyrics.length - 1 ? (isSynced ? lyrics[newActiveIndex + 1]?.text : lyrics[newActiveIndex + 1]) : null;
          const nextNext = newActiveIndex < lyrics.length - 2 ? (isSynced ? lyrics[newActiveIndex + 2]?.text : lyrics[newActiveIndex + 2]) : null;

          setDisplayedLines({ prev, current, next, nextNext });

          // Reset position and animate in from below
          lineTranslateY.value = 15;
          lineOpacity.value = withTiming(1, { duration: 200 });
          lineTranslateY.value = withTiming(0, { duration: 200 });
        }, 150);
      } else if (activeIndex === -1 && lyrics.length > 0) {
        // Initial load
        const idx = Math.max(0, newActiveIndex);
        setActiveIndex(idx);
        const prev = idx > 0 ? (isSynced ? lyrics[idx - 1]?.text : lyrics[idx - 1]) : null;
        const current = isSynced ? lyrics[idx]?.text : lyrics[idx];
        const next = idx < lyrics.length - 1 ? (isSynced ? lyrics[idx + 1]?.text : lyrics[idx + 1]) : null;
        const nextNext = idx < lyrics.length - 2 ? (isSynced ? lyrics[idx + 2]?.text : lyrics[idx + 2]) : null;
        setDisplayedLines({ prev, current, next, nextNext });
      }
    }
  }, [currentTime, visible, isSynced, lyrics, activeIndex]);

  if (!visible || !lyrics || lyrics.length === 0) return null;

  return (
    <GestureDetector gesture={swipeGesture}>
      <Animated.View style={[{
        position: 'absolute',
        top: 15,
        left: 20,
        right: 20,
        bottom: 15,
        borderRadius: 15,
        overflow: 'hidden',
      }, animatedStyle]}>
        {/* Glass background - slightly larger to cover any gaps */}
        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 10 }]} />

        {/* Small drag indicator */}
        <View style={{ alignItems: 'center', paddingTop: 12 }}>
          <View style={{
            width: 28,
            height: 3,
            backgroundColor: 'rgba(255,255,255,0.25)',
            borderRadius: 2,
          }} />
        </View>

        {/* Lyrics container with smooth animation */}
        <Animated.View style={[{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 14,
        }, linesAnimatedStyle]}>
          {/* Previous line (faded) */}
          {displayedLines.prev && (
            <Text style={{
              fontSize: 14,
              fontWeight: '500',
              color: 'rgba(255,255,255,0.2)',
              textAlign: 'center',
              marginBottom: 8,
            }} numberOfLines={2}>
              {displayedLines.prev}
            </Text>
          )}

          {/* Current line (prominent) */}
          <Text style={{
            fontSize: 19,
            fontWeight: '700',
            color: '#FFFFFF',
            textAlign: 'center',
            marginBottom: 8,
            textShadowColor: 'rgba(255,255,255,0.25)',
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 6,
          }} numberOfLines={3}>
            {displayedLines.current || '♪ ♫ ♪'}
          </Text>

          {/* Next line */}
          {displayedLines.next && (
            <Text style={{
              fontSize: 14,
              fontWeight: '500',
              color: 'rgba(255,255,255,0.4)',
              textAlign: 'center',
              marginBottom: 6,
            }} numberOfLines={2}>
              {displayedLines.next}
            </Text>
          )}

          {/* Next next line (more faded) */}
          {displayedLines.nextNext && (
            <Text style={{
              fontSize: 12,
              fontWeight: '400',
              color: 'rgba(255,255,255,0.15)',
              textAlign: 'center',
            }} numberOfLines={2}>
              {displayedLines.nextNext}
            </Text>
          )}
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
};

export default function PlayerLayout() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <FullPlayerScreen />
    </>
  );
}

export const FullPlayerScreen: React.FC = () => {
  const {
    currentSong,
    isPlaying,
    togglePlayPause,
    toggleFavorite,
    nextSong,
    previousSong,
    seekTo,
    playbackMode,
    togglePlaybackMode,
  } = usePlayer();

  const { playbackPosition, playbackDuration } = useProgress();
  const { isOnline } = useNetworkStatus();
  const {
    nfcSupported,
    nfcEnabled,
    shareState,
    shareViaNfc,
    cancelShare,
  } = useNfc();
  const { showAlert, AlertComponent } = useBeautifulAlert();

  const [isSeeking, setIsSeeking] = useState(false);
  const [sliderValue, setSliderValue] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const [showNfcModal, setShowNfcModal] = useState(false);
  const isChangingSongRef = useRef(false);

  // --- LYRICS STATE ---
  const [showLyrics, setShowLyrics] = useState(false);
  const [lyricsData, setLyricsData] = useState<any[]>([]);
  const [isSyncedLyrics, setIsSyncedLyrics] = useState(false);

  // Fetch lyrics when song changes
  useEffect(() => {
    if (currentSong) {
      // Capture the song ID at the start to detect stale updates
      const fetchingSongId = currentSong.id;

      setLyricsData([]);
      setIsSyncedLyrics(false);

      // Import cache functions dynamically to avoid circular deps
      const fetchLyrics = async () => {
        const { getCachedLyrics, cacheLyrics } = await import('@/services/lyricsCache');

        // 1. Try cache first
        const cached = await getCachedLyrics(currentSong.id);
        if (cached) {
          // Check if song changed during cache lookup
          if (fetchingSongId !== currentSong.id) {
            console.log('[Lyrics] Song changed, ignoring stale cache result');
            return;
          }
          processParsedLyrics(cached.lyrics, cached.isSynced, fetchingSongId);
          return;
        }

        // 2. Fetch from API
        const result = await getSongLyrics(currentSong.id, currentSong.name, currentSong.subtitle);

        // Check if song changed during API fetch
        if (fetchingSongId !== currentSong.id) {
          console.log('[Lyrics] Song changed, ignoring stale API result');
          return;
        }

        if (result) {
          const { lyrics: rawLyrics, isSynced: apiSynced } = result;

          // Cache the lyrics for future use
          await cacheLyrics(
            currentSong.id,
            rawLyrics,
            apiSynced,
            currentSong.name || '',
            currentSong.subtitle || ''
          );

          processParsedLyrics(rawLyrics, apiSynced, fetchingSongId);
        }
      };

      // Helper to process and set lyrics - accepts songId to verify before updating
      const processParsedLyrics = (rawLyrics: string, apiIndicatesSynced: boolean, expectedSongId: string) => {
        // Final check before updating state
        if (expectedSongId !== currentSong.id) {
          console.log('[Lyrics] Song changed before parsing, ignoring');
          return;
        }

        // Clean up HTML: convert <br>, <br/>, <br /> to newlines
        let cleanedLyrics = rawLyrics
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/p>/gi, '\n')
          .replace(/<p>/gi, '')
          .replace(/&nbsp;/gi, ' ')
          .replace(/&amp;/gi, '&')
          .replace(/&quot;/gi, '"')
          .replace(/&#39;/gi, "'")
          .replace(/<[^>]*>/g, ''); // Remove any remaining HTML tags

        const lrcRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;

        if (lrcRegex.test(cleanedLyrics)) {
          // LRC format with timestamps
          const lines = cleanedLyrics.split('\n');
          const parsed = lines.map(line => {
            const match = lrcRegex.exec(line);
            if (match) {
              const minutes = parseInt(match[1]);
              const seconds = parseInt(match[2]);
              const ms = parseInt(match[3].padEnd(3, '0'));
              return {
                time: minutes * 60 + seconds + ms / 1000,
                text: match[4].trim()
              };
            }
            return null;
          }).filter(l => l && l.text.trim().length > 0);

          if (parsed.length > 0) {
            setLyricsData(parsed);
            setIsSyncedLyrics(true);
          } else {
            const plainLines = cleanedLyrics.split('\n').filter(l => l.trim().length > 0);
            setLyricsData(plainLines);
            setIsSyncedLyrics(false);
          }
        } else {
          const plainLines = cleanedLyrics.split('\n').filter(l => l.trim().length > 0);
          setLyricsData(plainLines);
          setIsSyncedLyrics(false);
        }
      };

      fetchLyrics();
    }
  }, [currentSong]);

  // Animated values
  const artworkAppear = useSharedValue(0);
  const controlsAppear = useSharedValue(0);
  const slideOffset = useSharedValue(0);
  // Heart/favorite animation shared values
  const heartOpacity = useSharedValue(0);
  const heartTranslate = useSharedValue(0);
  // Thumbs-down animation shared values
  const thumbsOpacity = useSharedValue(0);
  const thumbsTranslate = useSharedValue(0);

  const handleBack = () => {
    setIsExiting(true);
    // Exit animations - faster and smoother
    artworkAppear.value = withTiming(0, { duration: 200 });
    controlsAppear.value = withTiming(0, { duration: 200 });

    // Navigate back immediately after animation starts
    setTimeout(() => {
      // If offline, go to downloads page, otherwise use normal back navigation
      if (!isOnline) {
        router.replace("/(tabs)/downloads");
      } else {
        router.back();
      }
    }, 150);

    // Reset exit state after navigation
    setTimeout(() => {
      setIsExiting(false);
    }, 300);
  };

  // Trigger animations every time the screen is focused
  useFocusEffect(
    useCallback(() => {
      if (currentSong && !isExiting) {
        // Reset animations to 0 first
        artworkAppear.value = 0;
        controlsAppear.value = 0;
        slideOffset.value = 0;

        // Your original animations
        artworkAppear.value = withTiming(1, { duration: 500 });
        controlsAppear.value = withTiming(1, { duration: 700 });
        slideOffset.value = withTiming(0, { duration: 300 });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentSong, isExiting])
  );

  // Handle song changes (different from screen focus)
  useEffect(() => {
    if (currentSong && !isChangingSongRef.current) {
      artworkAppear.value = withTiming(1, { duration: 500 });
      controlsAppear.value = withTiming(1, { duration: 700 });
      slideOffset.value = withTiming(0, { duration: 300 });
    }
    isChangingSongRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSong]);

  useEffect(() => {
    if (!isSeeking && playbackPosition !== undefined) {
      setSliderValue(playbackPosition);
    }
  }, [playbackPosition, isSeeking]);

  // Auto-close NFC modal after success/error
  useEffect(() => {
    if (shareState === 'success' || shareState === 'error' || shareState === 'cancelled') {
      const timeout = setTimeout(() => {
        setShowNfcModal(false);
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [shareState]);

  // Fixed animated styles with proper typing
  const animatedArtworkStyle = useAnimatedStyle(() => {
    const scale = interpolate(artworkAppear.value, [0, 1], [0.8, 1]);
    const translateY = interpolate(artworkAppear.value, [0, 1], [50, 0]);

    return {
      opacity: artworkAppear.value,
      transform: [{ scale }, { translateY }],
    } as any;
  });

  const heartStyle = useAnimatedStyle(() => {
    return {
      opacity: heartOpacity.value,
      transform: [{ translateY: heartTranslate.value }],
    } as any;
  });

  const thumbsStyle = useAnimatedStyle(() => {
    return {
      opacity: thumbsOpacity.value,
      transform: [{ translateY: thumbsTranslate.value }],
    } as any;
  });

  const animatedControlsStyle = useAnimatedStyle(() => {
    const translateY = interpolate(controlsAppear.value, [0, 1], [50, 0]);

    return {
      opacity: controlsAppear.value,
      transform: [{ translateY }],
    } as any;
  });

  const animatedSlideStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: slideOffset.value }],
    } as any;
  });

  // Swipe gesture for next/previous
  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-10, 10])
    .onEnd((e) => {
      if (e.translationX > 20 && !isSeeking && !isChangingSongRef.current) {
        isChangingSongRef.current = true;
        artworkAppear.value = withTiming(0, { duration: 100 });
        runOnJS(previousSong)();
        slideOffset.value = withTiming(0, { duration: 300 });
      } else if (
        e.translationX < -20 &&
        !isSeeking &&
        !isChangingSongRef.current
      ) {
        isChangingSongRef.current = true;
        artworkAppear.value = withTiming(0, { duration: 100 });
        runOnJS(nextSong)();
        slideOffset.value = withTiming(0, { duration: 300 });
      }
    });

  // Double-tap gesture to favorite + show heart animation
  const triggerHeart = useCallback(() => {
    'worklet';
    heartOpacity.value = 1;
    heartTranslate.value = 0;
    heartTranslate.value = withTiming(-28, { duration: 700 });
    heartOpacity.value = withTiming(0, { duration: 700 });
  }, [heartOpacity, heartTranslate]);

  const triggerThumbsDown = useCallback(() => {
    'worklet';
    thumbsOpacity.value = 1;
    thumbsTranslate.value = 0;
    // Animate downwards (top -> bottom)
    thumbsTranslate.value = withTiming(28, { duration: 700 });
    thumbsOpacity.value = withTiming(0, { duration: 700 });
  }, [thumbsOpacity, thumbsTranslate]);

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(400)
    .onEnd(() => {
      // Simply toggle favorite on JS thread. The favoritesUpdated event
      // will be emitted by PlayerContext and the listener below will
      // handle showing the heart animation when appropriate.
      try {
        runOnJS(toggleFavorite)();
      } catch { }
    });

  // Vertical Gesture for Lyrics (Up) and Close (Down)
  const verticalSwipeGesture = Gesture.Pan()
    .activeOffsetY([-20, 20])
    .failOffsetX([-10, 10])
    .onEnd((e) => {
      if (e.translationY < -50) {
        // Swipe Up -> Show Lyrics
        if (lyricsData.length > 0) {
          runOnJS(setShowLyrics)(true);
        }
      } else if (e.translationY > 50) {
        // Swipe Down -> Back
        runOnJS(handleBack)();
      }
    });

  // Combine swipe and double-tap so both work on the artwork area
  const combinedGesture = Gesture.Simultaneous(swipeGesture, doubleTap, verticalSwipeGesture);

  // Listen for favorites updates and show heart when current song is added
  useEffect(() => {
    const handler = (payload: { newFavorites: any[]; action?: string; songId?: string }) => {
      if (!currentSong) return;
      const songId = payload?.songId;
      if (!songId) return;
      if (songId !== currentSong.id) return;
      const action = payload.action ?? ((payload.newFavorites || []).some((s) => s.id === songId) ? "added" : "removed");
      try {
        if (action === "added") {
          triggerHeart();
        } else {
          triggerThumbsDown();
        }
      } catch { }
    };
    const unsubscribe = eventOn('favoritesUpdated', handler);
    return () => unsubscribe && unsubscribe();
  }, [currentSong, triggerHeart, triggerThumbsDown]);

  if (!currentSong) {
    return (
      <SafeAreaView style={styles.safeAreaDark}>
        <StatusBar style="light" />
        <View style={styles.centered}>
          <Text style={styles.placeholderText}>No song selected.</Text>
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backButtonMinimal}
          >
            <FontAwesome name="arrow-left" size={22} color="#fff" />
            <Text style={styles.backButtonTextMinimal}>Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const artworkUrl = getImageUrl(currentSong.image, "500x500");
  const songTitle = decodeHtmlEntities(
    currentSong.name || currentSong.title || "Unknown Title"
  );
  const songArtist =
    getArtistNameFromPrimary(currentSong.primaryArtists) ||
    decodeHtmlEntities(currentSong.subtitle) ||
    "Unknown Artist";

  const handleSeek = (value: number) => {
    if (seekTo) {
      seekTo(value);
    }
    setSliderValue(value);
    setIsSeeking(false);
  };

  const handleShare = async () => {
    if (!currentSong) return;

    const songTitle = decodeHtmlEntities(
      currentSong.name || currentSong.title || "Unknown Title"
    );
    const songArtist =
      getArtistNameFromPrimary(currentSong.primaryArtists) ||
      decodeHtmlEntities(currentSong.subtitle) ||
      "Unknown Artist";
    const albumName = currentSong.album?.name
      ? decodeHtmlEntities(currentSong.album.name)
      : "Unknown Album";
    const artworkUrl = getImageUrl(currentSong.image, "500x500");

    const shareMessage =
      `🎵 Now Playing on Suman Music 🎵\n\n` +
      `🎤 Song: ${songTitle}\n` +
      `👨‍🎤 Artist: ${songArtist}\n` +
      `💿 Album: ${albumName}\n\n` +
      `🖼️ Artwork: ${artworkUrl}\n\n` +
      `🎧 Listen now on Suman Music - Your Ultimate Music Experience!\n\n` +
      `#SumanMusic #NowPlaying #MusicLovers`;

    try {
      const shareOptions = {
        message: shareMessage,
        title: `${songTitle} - ${songArtist}`,
        url: artworkUrl, // This will include the image URL for platforms that support it
      };

      // For iOS, we can try to share the image directly
      if (Platform.OS === "ios") {
        shareOptions.url = artworkUrl;
      }

      await Share.share(shareOptions);
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const handleNfcShare = async () => {
    if (!currentSong) {
      showAlert({
        title: 'No Song Playing',
        message: 'Please play a song first before sharing via NFC.',
        type: 'warning',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      return;
    }

    if (!nfcSupported) {
      showAlert({
        title: 'NFC Not Available',
        message: 'NFC is not supported on this device or you are using Expo Go.\n\nPlease build a development build using:\n\neas build --profile development --platform android\n\nOr run: npx expo run:android',
        type: 'warning',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      return;
    }

    if (!nfcEnabled) {
      showAlert({
        title: 'NFC Disabled',
        message: 'NFC is disabled on your device. Please enable NFC in Settings to share songs.',
        type: 'warning',
        buttons: [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Settings',
            style: 'default',
            onPress: async () => {
              try {
                await NfcManager.goToNfcSetting();
              } catch (error) {
                console.error('Failed to open NFC settings:', error);
              }
            }
          }
        ],
      });
      return;
    }

    setShowNfcModal(true);
    try {
      await shareViaNfc(currentSong.id);
    } catch (error) {
      console.error("Error sharing via NFC:", error);
    }
  };

  const handleNfcModalClose = () => {
    setShowNfcModal(false);
    if (shareState === 'waiting') {
      cancelShare();
    }
  };

  const navigateToEQ = () => {
    router.push("/eq");
  };

  const getPlaybackIconName = () => {
    switch (playbackMode) {
      case "shuffle":
        return "random";
      case "repeat_one":
        return "repeat";
      case "repeat":
        return "repeat";
      default:
        return "repeat";
    }
  };

  const getPlaybackIconColor = () => {
    return playbackMode !== "normal" && currentSong ? "#1DB954" : "#eee";
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ImageBackground
        source={{ uri: artworkUrl }}
        style={styles.backgroundImage}
        blurRadius={30}
        resizeMode="cover"
      >
        <View style={styles.overlay}>
          <SafeAreaView style={styles.safeArea}>
            <StatusBar style="light" />

            <Animated.View style={[styles.header, animatedControlsStyle]}>
              <TouchableOpacity onPress={handleBack} style={styles.iconButton}>
                <FontAwesome name="chevron-down" size={24} color="#eee" />
              </TouchableOpacity>
              <Text style={styles.headerTitle} numberOfLines={1}>
                Now Playing
              </Text>
              <TouchableOpacity
                onPress={navigateToEQ}
                style={styles.iconButton}
              >
                <FontAwesome name="sliders" size={24} color="#eee" />
              </TouchableOpacity>
            </Animated.View>

            <GestureDetector gesture={combinedGesture}>
              <Animated.View
                style={[styles.swipeableSection, animatedSlideStyle]}
              >
                <Animated.View
                  style={[styles.artworkContainer, animatedArtworkStyle]}
                >
                  <Image source={{ uri: artworkUrl }} style={styles.artwork} />
                  <Animated.View style={[styles.heartOverlay, heartStyle]} pointerEvents="none">
                    <FontAwesome name="heart" size={64} color="#ff4d6d" />
                  </Animated.View>
                  <Animated.View style={[styles.heartOverlay, thumbsStyle]} pointerEvents="none">
                    <FontAwesome name="thumbs-down" size={64} color="#66b3ff" />
                  </Animated.View>

                  {/* Lyrics Overlay - shows on top of artwork */}
                  <LyricsOverlay
                    visible={showLyrics}
                    onClose={() => setShowLyrics(false)}
                    lyrics={lyricsData}
                    currentTime={(playbackPosition || 0) / 1000}
                    isSynced={isSyncedLyrics}
                  />
                </Animated.View>

                <Animated.View
                  style={[styles.songInfoContainer, animatedControlsStyle]}
                >
                  {/* Title: Shrinks text slightly to fit whole words, prevents mid-word cuts */}
                  <Text
                    style={styles.titleText}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                  >
                    {songTitle}
                  </Text>

                  {/* Artist: Same logic */}
                  <Text
                    style={styles.artistText}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                  >
                    {songArtist}
                  </Text>
                </Animated.View>
              </Animated.View>
            </GestureDetector>

            <Animated.View
              style={[styles.seekBarContainer, animatedControlsStyle]}
            >
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={playbackDuration || 1}
                value={sliderValue}
                minimumTrackTintColor="#1DB954"
                maximumTrackTintColor="rgba(255, 255, 255, 0.3)"
                thumbTintColor="#1DB954"
                onSlidingStart={() => setIsSeeking(true)}
                onSlidingComplete={handleSeek}
                onValueChange={(value) => setSliderValue(value)}
              />
              <View style={styles.timeContainer}>
                <Text style={styles.timeText}>
                  {secondsToMinuteSecond(playbackPosition)}
                </Text>
                <Text style={styles.timeText}>
                  {secondsToMinuteSecond(playbackDuration)}
                </Text>
              </View>
            </Animated.View>

            <Animated.View
              style={[styles.controlsContainer, animatedControlsStyle]}
            >
              <TouchableOpacity
                style={styles.controlButtonSmall}
                onPress={togglePlaybackMode}
                disabled={!currentSong}
              >
                <FontAwesome
                  name={getPlaybackIconName() as any}
                  size={20}
                  color={getPlaybackIconColor()}
                />
                {playbackMode === "repeat_one" && (
                  <Text style={styles.repeatOneIndicator}>1</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.controlButton}
                onPress={previousSong}
                disabled={!currentSong}
              >
                <FontAwesome
                  name="step-backward"
                  size={28}
                  color={currentSong ? "#eee" : "#777"}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.controlButton, styles.playPauseButton]}
                onPress={togglePlayPause}
                disabled={!currentSong}
              >
                {/* Added key prop to force re-render when isPlaying changes */}
                <FontAwesome
                  key={isPlaying ? "pause-icon" : "play-icon"}
                  name={isPlaying ? "pause" : "play"}
                  size={32}
                  color={currentSong ? "#000" : "#555"}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.controlButton}
                onPress={nextSong}
                disabled={!currentSong}
              >
                <FontAwesome
                  name="step-forward"
                  size={28}
                  color={currentSong ? "#eee" : "#777"}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.controlButtonSmall}
                onPress={handleShare}
              >
                <FontAwesome name="share-alt" size={20} color="#eee" />
              </TouchableOpacity>
            </Animated.View>

            {/* NFC Share Button (Android only) */}
            {Platform.OS === 'android' && (
              <Animated.View style={[styles.nfcButtonContainer, animatedControlsStyle]}>
                <NfcShareButton
                  onPress={handleNfcShare}
                  disabled={!currentSong}
                  size="small"
                  style={styles.nfcButton}
                />
              </Animated.View>
            )}

            {/* NFC Share Modal */}
            <NfcShareWaitingModal
              visible={showNfcModal}
              shareState={shareState}
              onCancel={handleNfcModalClose}
              onClose={handleNfcModalClose}
              songTitle={songTitle}
            />
          </SafeAreaView>
        </View>
      </ImageBackground>

      <AlertComponent />
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  safeAreaDark: {
    flex: 1,
    backgroundColor: "#000",
  },
  safeArea: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    backgroundColor: "#121212",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 20,
    justifyContent: "space-between",
    paddingBottom: Platform.OS === "ios" ? 30 : 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Platform.OS === "ios" ? 10 : 20,
    paddingBottom: 20,
    width: "100%",
  },
  headerTitle: {
    color: "#eee",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
    flex: 1,
  },
  iconButton: {
    padding: 10,
  },
  swipeableSection: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
    marginHorizontal: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    marginVertical: 20,
  },
  artworkContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 20,
    maxHeight: width * 0.65 + 40,
  },
  artwork: {
    width: width * 0.75,
    height: width * 0.65,
    borderRadius: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 15,
  },
  heartOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  songInfoContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    paddingHorizontal: 20,
    minHeight: 80,
    width: '100%', // Ensure container takes full width for marquee
  },
  titleText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  artistText: {
    color: "#ccc",
    fontSize: 18,
    textAlign: "center",
  },
  seekBarContainer: {
    paddingVertical: 20,
    minHeight: 60,
  },
  slider: {
    width: "100%",
    height: 40,
  },
  timeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 5,
    paddingHorizontal: 5,
  },
  timeText: {
    color: "#bbb",
    fontSize: 12,
  },
  controlsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 20,
    minHeight: 100,
  },
  controlButton: {
    padding: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  controlButtonSmall: {
    padding: 10,
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  playPauseButton: {
    backgroundColor: "#fff",
    borderRadius: 35,
    width: 70,
    height: 70,
    marginHorizontal: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  placeholderText: {
    color: "#fff",
    fontSize: 18,
    marginBottom: 20,
  },
  backButtonMinimal: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#333",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  backButtonTextMinimal: {
    color: "#fff",
    fontSize: 16,
    marginLeft: 10,
  },
  repeatOneIndicator: {
    position: "absolute",
    top: 0,
    right: -2,
    fontSize: 10,
    fontWeight: "bold",
    color: "#1DB954",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 2,
    borderRadius: 2,
  },
  nfcButtonContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    alignItems: 'center',
  },
  nfcButton: {
    minWidth: 160,
  },
});