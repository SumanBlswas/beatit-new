import FontAwesome from "@expo/vector-icons/FontAwesome";
import Slider from "@react-native-community/slider";
import { LinearGradient } from "expo-linear-gradient";
import * as NavigationBar from "expo-navigation-bar";
import * as ScreenOrientation from "expo-screen-orientation";
// --- FIX 1: Correct event import ---
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";

interface VideoPlayerProps {
  visible: boolean;
  videoUri: string;
  videoTitle: string;
  videoWidth?: number;
  videoHeight?: number;
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
}

export default function VideoPlayer({
  visible,
  videoUri,
  videoTitle,
  videoWidth,
  videoHeight,
  onClose,
  onNext,
  onPrevious,
}: VideoPlayerProps) {
  const player = useVideoPlayer(videoUri || null, (player) => {
    if (videoUri) {
      console.log("[expo-prev VideoPlayer] Player callback - playing video");
      player.loop = false;
      player.play();

      const statusSubscription = player.addListener('statusChange', (payload) => {
        if (payload.status === 'error') {
          console.error("[expo-prev VideoPlayer] Status Changed to ERROR:", payload.error);
        }
      });

      // Cleanup listener when player is re-created or unmounted is handled by expo-video internally for the player instance usually,
      // but strictly speaking we should clean up if we could. However useVideoPlayer callback runs once per player instance creation.

      setTimeout(() => {
        console.log("[expo-prev VideoPlayer] Player state:", {
          playing: player.playing,
          status: player.status,
          error: (player as any).error,
        });
      }, 500);
    }
  });

  // Early return for rendering - but hooks must run first!
  const shouldRender = visible && videoUri && videoUri.trim() !== '';

  const [showControls, setShowControls] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const controlsTimeout = useRef<any>(null);
  const updateInterval = useRef<any>(null);

  // Subtitle and audio track states
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [availableSubtitles, setAvailableSubtitles] = useState<any[]>([]);
  const [selectedSubtitle, setSelectedSubtitle] = useState<number>(-1);
  const [availableAudioTracks, setAvailableAudioTracks] = useState<any[]>([]);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<number>(0);

  // Store original track references
  const originalAudioTracks = useRef<any[]>([]);
  const originalSubtitleTracks = useRef<any[]>([]);

  // Live subtitle (speech recognition) states
  const [liveSubtitlesEnabled, setLiveSubtitlesEnabled] = useState(false);
  const [liveSubtitleText, setLiveSubtitleText] = useState("");
  const [isRecognizing, setIsRecognizing] = useState(false);
  const recognitionTimeoutRef = useRef<any>(null);
  const isStartingRecognition = useRef(false);
  const lastErrorTime = useRef<number>(0);
  const hasAutoEnabledLiveSubtitles = useRef(false);
  const keepAliveIntervalRef = useRef<any>(null);
  const shouldKeepAlive = useRef(false);

  // Zoom state
  const baseScale = useRef(1);
  const [currentZoom, setCurrentZoom] = useState(1);
  const [videoAspectRatio, setVideoAspectRatio] = useState<number | null>(null);
  const [isVideoLandscape, setIsVideoLandscape] = useState<boolean | null>(
    null
  );
  const hasAutoRotated = useRef(false);

  // Double-tap seek feedback
  const [showSeekFeedback, setShowSeekFeedback] = useState<{ side: 'left' | 'right'; timestamp: number } | null>(null);

  // Speech recognition event handling
  useSpeechRecognitionEvent("start", () => {
    setIsRecognizing(true);
    console.log("Speech recognition started");
  });

  useSpeechRecognitionEvent("end", () => {
    setIsRecognizing(false);
    isStartingRecognition.current = false;
    console.log("Speech recognition ended - attempting to restart if enabled");

    // Auto-restart if live subtitles are still enabled
    if (shouldKeepAlive.current && liveSubtitlesEnabled) {
      console.log("Keep-alive restart triggered...");
      setTimeout(async () => {
        if (shouldKeepAlive.current && liveSubtitlesEnabled) {
          try {
            isStartingRecognition.current = true;
            await ExpoSpeechRecognitionModule.start({
              lang: "en-US",
              interimResults: true,
              maxAlternatives: 1,
              continuous: true,
              requiresOnDeviceRecognition: false,
            });
            setIsRecognizing(true);
            console.log("Speech recognition restarted successfully");
          } catch (e) {
            console.log("Restart error:", e);
            isStartingRecognition.current = false;
          }
        }
      }, 300);
    }
  });

  useSpeechRecognitionEvent("result", (event) => {
    console.log("Speech recognition result event:", JSON.stringify(event, null, 2));

    // Handle both interim and final results
    const results = event.results;
    if (results && results.length > 0) {
      const latestResult = results[results.length - 1];
      const transcript = latestResult?.transcript;

      console.log("Transcript received:", transcript);

      if (transcript) {
        setLiveSubtitleText(transcript);

        // Clear subtitle after 5 seconds of no new speech (increased from 3)
        if (recognitionTimeoutRef.current) {
          clearTimeout(recognitionTimeoutRef.current);
        }
        recognitionTimeoutRef.current = setTimeout(() => {
          setLiveSubtitleText("");
        }, 5000);
      }
    } else {
      console.log("No results in event");
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    console.error("Speech recognition error:", event.error);

    // Handle no-speech errors gracefully
    if (event.error === "no-speech") {
      const now = Date.now();
      // Prevent logging too frequently (max once per 2 seconds)
      if (now - lastErrorTime.current > 2000) {
        console.log("No speech detected, continuing to listen...");
        lastErrorTime.current = now;
      }
      // Don't set isRecognizing to false for no-speech errors
      // The recognition will continue automatically
    } else {
      setIsRecognizing(false);
      isStartingRecognition.current = false;
    }
  });

  // ... (no changes in this useEffect)
  useEffect(() => {
    if (visible) {
      const checkVideoOrientation = async () => {
        let detectedLandscape = false;
        let detectedAspectRatio = 9 / 16;

        // If explicit dimensions were provided by the caller, use them first
        if (videoWidth && videoHeight) {
          detectedAspectRatio = videoWidth / videoHeight;
          detectedLandscape = detectedAspectRatio > 1;
        } else {
          // Try to detect natural video size from the player instance.
          // Poll for a longer period and check multiple vendorproperty names so
          // devices that expose metadata slowly still get a chance.
          try {
            const maxAttempts = 30; // up to ~7.5s with 250ms delay
            let attempt = 0;
            while (attempt < maxAttempts) {
              attempt += 1;
              const p: any = player as any;
              const nat: any = p?.naturalSize || p?.videoNaturalSize || p?.natural || p?.nativeSize || null;
              const candW =
                nat?.width ||
                nat?.w ||
                p?.videoWidth ||
                p?.width ||
                p?.naturalWidth ||
                (nat && nat?.videoWidth) ||
                0;
              const candH =
                nat?.height ||
                nat?.h ||
                p?.videoHeight ||
                p?.height ||
                p?.naturalHeight ||
                (nat && nat?.videoHeight) ||
                0;

              if (candW > 0 && candH > 0) {
                detectedAspectRatio = candW / candH;
                detectedLandscape = detectedAspectRatio > 1;
                console.log("VideoPlayer: detected native size:", candW, candH);
                break;
              }

              // If player has duration and still no size, give it a chance to load metadata
              await new Promise((res) => setTimeout(res, 250));
            }
          } catch {
            // ignore and fall back to default aspect ratio
          }
        }

        setVideoAspectRatio(detectedAspectRatio);
        setIsVideoLandscape(detectedLandscape);

        if (autoRotate && detectedLandscape && !hasAutoRotated.current) {
          hasAutoRotated.current = true;
          try {
            await ScreenOrientation.lockAsync(
              ScreenOrientation.OrientationLock.LANDSCAPE
            );
            setIsLandscape(true);
          } catch {
            // ignore orientation lock failures
          }
        } else {
          try {
            await ScreenOrientation.lockAsync(
              ScreenOrientation.OrientationLock.PORTRAIT
            );
            setIsLandscape(false);
          } catch {
            // ignore
          }
        }

        // --- Note: This logic is here, so we apply it in FIX 5 ---
        baseScale.current = 1;
        setCurrentZoom(1);
      };
      checkVideoOrientation();
    }
    return () => {
      if (visible) {
        ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.PORTRAIT
        ).catch(() => { });
        setIsLandscape(false);
        baseScale.current = 1;
        setCurrentZoom(1);
        setAutoRotate(true);
        setVideoAspectRatio(null);
        setIsVideoLandscape(null);
        hasAutoRotated.current = false;
      }
    };
  }, [visible, videoWidth, videoHeight, autoRotate, player]);

  // ... (no changes in toggleOrientation, getVideoDimensions, calculateAutoZoom)
  const toggleOrientation = async () => {
    if (isLandscape) {
      await ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.PORTRAIT
      );
      setIsLandscape(false);
    } else {
      await ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.LANDSCAPE
      );
      setIsLandscape(true);
    }

    setTimeout(() => {
      const fitZoomScale = calculateAutoZoom();
      baseScale.current = fitZoomScale;
      setCurrentZoom(fitZoomScale);
    }, 100);
  };

  const getVideoDimensions = useCallback(() => {
    const screenWidth = Dimensions.get("window").width;
    const videoAR = videoAspectRatio || 9 / 16;

    const width = screenWidth;
    const height = width / videoAR;

    return { width, height };
  }, [videoAspectRatio]);

  const calculateAutoZoom = useCallback(() => {
    const screenWidth = Dimensions.get("window").width;
    const screenHeight = Dimensions.get("window").height;
    const screenAR = screenWidth / screenHeight;
    let videoAR = videoAspectRatio || 9 / 16;
    const zoomScale = screenAR / videoAR;
    return zoomScale;
  }, [videoAspectRatio]);

  // ... (no changes in these useEffects or handlers)
  useEffect(() => {
    if (!visible || !player || isVideoLandscape === null) return;
    const timer = setTimeout(() => {
      getVideoDimensions();
    }, 400);
    return () => clearTimeout(timer);
  }, [visible, player, isVideoLandscape, isLandscape, getVideoDimensions]);

  useEffect(() => {
    if (!player || !visible) return;
    setIsPlaying(player.playing);
    setDuration(player.duration || 0);
    setCurrentTime(player.currentTime || 0);
    const interval = setInterval(() => {
      if (!isSeeking && player) {
        try {
          const time = player.currentTime;
          const dur = player.duration;
          const playing = player.playing;
          if (typeof time === "number" && !isNaN(time)) {
            setCurrentTime(time);
          }
          if (typeof dur === "number" && !isNaN(dur) && dur > 0) {
            setDuration(dur);
          }
          setIsPlaying(playing);
        } catch (e) {
          console.log("Player state update error:", e);
        }
      }
    }, 100);
    updateInterval.current = interval;
    return () => {
      if (updateInterval.current) {
        clearInterval(updateInterval.current);
      }
    };
  }, [player, visible, isSeeking]);

  const hideControlsAfterDelay = useCallback(() => {
    if (controlsTimeout.current) {
      clearTimeout(controlsTimeout.current);
    }
    controlsTimeout.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  }, [isPlaying]);

  const handleToggleControls = () => {
    setShowControls(!showControls);
    if (!showControls) {
      hideControlsAfterDelay();
    }
  };

  // Live subtitle functions (moved before handlePlayPause to avoid hoisting issues)
  const startLiveSubtitles = useCallback(async () => {
    // Prevent multiple simultaneous start attempts
    if (isStartingRecognition.current || isRecognizing) {
      console.log("Recognition already starting or active, skipping...");
      return;
    }

    try {
      isStartingRecognition.current = true;

      console.log("Requesting microphone permissions...");
      const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!result.granted) {
        console.log("Microphone permission denied");
        isStartingRecognition.current = false;
        return;
      }

      console.log("Starting speech recognition with config:", {
        lang: "en-US",
        interimResults: true,
        maxAlternatives: 1,
        continuous: true,
        requiresOnDeviceRecognition: false,
      });

      await ExpoSpeechRecognitionModule.start({
        lang: "en-US",
        interimResults: true,
        maxAlternatives: 1,
        continuous: true,
        requiresOnDeviceRecognition: false,
      });

      setLiveSubtitlesEnabled(true);
      shouldKeepAlive.current = true; // Enable keep-alive
      console.log("Live subtitles started successfully with keep-alive");

      // Set up a periodic check to ensure recognition stays active
      if (keepAliveIntervalRef.current) {
        clearInterval(keepAliveIntervalRef.current);
      }
      keepAliveIntervalRef.current = setInterval(async () => {
        if (shouldKeepAlive.current && liveSubtitlesEnabled && !isRecognizing && !isStartingRecognition.current) {
          console.log("Keep-alive check: restarting inactive recognition...");
          try {
            await ExpoSpeechRecognitionModule.start({
              lang: "en-US",
              interimResults: true,
              maxAlternatives: 1,
              continuous: true,
              requiresOnDeviceRecognition: false,
            });
          } catch (e) {
            console.log("Keep-alive restart error:", e);
          }
        }
      }, 3000); // Check every 3 seconds
    } catch (error) {
      console.error("Error starting live subtitles:", error);
      isStartingRecognition.current = false;
    }
  }, [isRecognizing, liveSubtitlesEnabled]);

  const stopLiveSubtitles = useCallback(async () => {
    if (!isRecognizing && !isStartingRecognition.current) {
      console.log("Recognition not active, skipping stop...");
      return;
    }

    try {
      shouldKeepAlive.current = false; // Disable keep-alive

      // Clear keep-alive interval
      if (keepAliveIntervalRef.current) {
        clearInterval(keepAliveIntervalRef.current);
        keepAliveIntervalRef.current = null;
      }

      await ExpoSpeechRecognitionModule.stop();
      setLiveSubtitlesEnabled(false);
      setLiveSubtitleText("");
      isStartingRecognition.current = false;
      if (recognitionTimeoutRef.current) {
        clearTimeout(recognitionTimeoutRef.current);
      }
      console.log("Live subtitles stopped and keep-alive disabled");
    } catch (error) {
      console.error("Error stopping live subtitles:", error);
      isStartingRecognition.current = false;
    }
  }, [isRecognizing]);

  const handlePlayPause = useCallback(async () => {
    try {
      if (player.playing) {
        player.pause();
        // Only stop microphone if it's actually running
        if (liveSubtitlesEnabled && isRecognizing) {
          console.log("Pausing video - stopping microphone");
          await stopLiveSubtitles();
        }
      } else {
        player.play();
        // Only start microphone if live subtitles are enabled and not already running
        if (liveSubtitlesEnabled && !isRecognizing) {
          console.log("Playing video - starting microphone");
          await startLiveSubtitles();
        }
      }
      setTimeout(() => {
        setIsPlaying(player.playing);
      }, 50);
    } catch (e) {
      console.log("Play/pause error:", e);
    }
    hideControlsAfterDelay();
  }, [player, hideControlsAfterDelay, liveSubtitlesEnabled, isRecognizing, startLiveSubtitles, stopLiveSubtitles]);

  const handleSeek = useCallback((value: number) => {
    setCurrentTime(value);
  }, []);

  const handleSeekComplete = useCallback(
    (value: number) => {
      try {
        setIsSeeking(true);
        player.currentTime = value;
        setTimeout(() => {
          setCurrentTime(player.currentTime);
          setIsSeeking(false);
        }, 100);
      } catch (e) {
        console.log("Seek error:", e);
        setIsSeeking(false);
      }
      hideControlsAfterDelay();
    },
    [player, hideControlsAfterDelay]
  );

  const handleDoubleTapSeek = useCallback((side: 'left' | 'right') => {
    const seekAmount = 10;
    const newTime = side === 'left'
      ? Math.max(0, player.currentTime - seekAmount)
      : Math.min(duration, player.currentTime + seekAmount);

    player.currentTime = newTime;
    setCurrentTime(newTime);

    // Show feedback
    setShowSeekFeedback({ side, timestamp: Date.now() });
    setTimeout(() => setShowSeekFeedback(null), 800);
  }, [player, duration]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleClose = async () => {
    player.pause();

    // Stop speech recognition if active and clear keep-alive
    shouldKeepAlive.current = false;
    if (keepAliveIntervalRef.current) {
      clearInterval(keepAliveIntervalRef.current);
      keepAliveIntervalRef.current = null;
    }

    if (isRecognizing) {
      try {
        await ExpoSpeechRecognitionModule.stop();
      } catch (e) {
        console.log("Error stopping speech recognition:", e);
      }
    }

    if (isLandscape) {
      await ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.PORTRAIT
      );
      setIsLandscape(false);
    }
    baseScale.current = 1;
    setCurrentZoom(1);
    hasAutoEnabledLiveSubtitles.current = false; // Reset for next video
    setTimeout(() => {
      onClose();
    }, 100);
  };

  const handleToggleLiveSubtitles = async () => {
    if (liveSubtitlesEnabled) {
      console.log("Toggling off live subtitles");
      await stopLiveSubtitles();
    } else {
      console.log("Toggling on live subtitles");
      // Start immediately when enabled, regardless of play state
      await startLiveSubtitles();
    }
    setShowSettingsMenu(false);
    hideControlsAfterDelay();
  };

  // --- FIX 2: Use declarative API (player.subtitleTrack = ...) ---
  const handleToggleSubtitles = () => {
    try {
      if (subtitlesEnabled) {
        // Turn them off
        player.subtitleTrack = null;
        setSelectedSubtitle(-1);
        setSubtitlesEnabled(false);
        console.log("Subtitles disabled");
      } else {
        // Turn them on - select the first available track
        if (originalSubtitleTracks.current.length > 0) {
          const firstTrack = originalSubtitleTracks.current[0];
          player.subtitleTrack = firstTrack;
          setSelectedSubtitle(0);
          setSubtitlesEnabled(true);
          console.log("Subtitles enabled:", availableSubtitles[0]?.label);
        } else {
          setSubtitlesEnabled(false);
        }
      }
    } catch (error) {
      console.error("Error toggling subtitles:", error);
    }

    setShowSettingsMenu(false);
    hideControlsAfterDelay();
  };

  const handleSelectSubtitle = (index: number) => {
    try {
      if (index === -1) {
        // User selected "Off"
        console.log("Disabling subtitles");
        player.subtitleTrack = null;
        setSubtitlesEnabled(false);
        setSelectedSubtitle(-1);
      } else {
        // Use the original track object from player
        const originalTrack = originalSubtitleTracks.current[index];

        if (originalTrack) {
          console.log(
            `Switching to subtitle track ${index}: ${availableSubtitles[index]?.label}`
          );
          player.subtitleTrack = originalTrack;
          setSubtitlesEnabled(true);
          setSelectedSubtitle(index);
        } else {
          console.warn(`Could not find subtitle track at index ${index}`);
        }
      }
    } catch (error) {
      console.error("Error switching subtitle track:", error);
    }

    setShowSettingsMenu(false);
    hideControlsAfterDelay();
  };

  // --- FIX 3: Use declarative API (player.audioTrack = ...) ---
  const handleSelectAudioTrack = (index: number) => {
    try {
      // Use the original track object from player
      const originalTrack = originalAudioTracks.current[index];

      if (originalTrack) {
        console.log(
          `Switching to audio track ${index}: ${availableAudioTracks[index]?.label}`
        );
        player.audioTrack = originalTrack;
        setSelectedAudioTrack(index);

        // Auto-enable matching subtitle track for the new audio language
        const newAudioLanguage = originalTrack.language;
        if (newAudioLanguage && availableSubtitles.length > 0) {
          const matchingSubtitle = availableSubtitles.find(
            (s) => s.language === newAudioLanguage
          );
          if (matchingSubtitle) {
            console.log(`Auto-switching subtitle to match audio: ${newAudioLanguage}`);
            const subtitleTrack = originalSubtitleTracks.current[matchingSubtitle.index];
            if (subtitleTrack) {
              player.subtitleTrack = subtitleTrack;
              setSelectedSubtitle(matchingSubtitle.index);
              setSubtitlesEnabled(true);
            }
          }
        }
      } else {
        console.warn(`Could not find audio track at index ${index}`);
      }
    } catch (error) {
      console.error("Error switching audio track:", error);
    }

    setShowSettingsMenu(false);
    hideControlsAfterDelay();
  };

  // --- FIX 4: Use correct event names and property names ---
  useEffect(() => {
    if (!visible || !player) return;

    // Track processing removed to prevent crash
    console.log("Track processing disabled intentionally.");
    setAvailableAudioTracks([]);
    setAvailableSubtitles([]);

  }, [visible, player, liveSubtitlesEnabled, isPlaying, startLiveSubtitles]);

  useEffect(() => {
    if (visible && showControls && isPlaying) {
      hideControlsAfterDelay();
    }
  }, [visible, showControls, isPlaying, hideControlsAfterDelay]);

  // Cleanup speech recognition on unmount
  useEffect(() => {
    return () => {
      shouldKeepAlive.current = false;

      if (keepAliveIntervalRef.current) {
        clearInterval(keepAliveIntervalRef.current);
        keepAliveIntervalRef.current = null;
      }

      if (isRecognizing) {
        try {
          ExpoSpeechRecognitionModule.stop();
        } catch {
          // Ignore cleanup errors
        }
      }

      if (recognitionTimeoutRef.current) {
        clearTimeout(recognitionTimeoutRef.current);
      }
    };
  }, [isRecognizing]);

  // Hide system UI (including Xiaomi gesture indicators) when video is playing
  useEffect(() => {
    if (visible && Platform.OS === 'android') {
      const hideSystemUI = async () => {
        try {
          // Hide status bar
          StatusBar.setHidden(true, 'none');
          StatusBar.setBackgroundColor('transparent', false);
          StatusBar.setTranslucent(true);

          // Use expo-navigation-bar to hide navigation bar and gestures
          await NavigationBar.setVisibilityAsync('hidden');
          await NavigationBar.setBehaviorAsync('overlay-swipe');
          await NavigationBar.setBackgroundColorAsync('#00000000'); // Transparent

          console.log("Navigation bar hidden successfully");
        } catch (error) {
          console.log("Error hiding system UI:", error);
        }
      };

      hideSystemUI();
    }

    return () => {
      if (Platform.OS === 'android') {
        // Restore navigation bar on cleanup
        StatusBar.setHidden(false, 'fade');
        StatusBar.setTranslucent(false);
        NavigationBar.setVisibilityAsync('visible').catch(() => { });
        NavigationBar.setBackgroundColorAsync('#000000').catch(() => { });
      }
    };
  }, [visible]);

  // Create double-tap gestures for left and right sides
  const leftDoubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      runOnJS(handleDoubleTapSeek)('left');
    });

  const rightDoubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      runOnJS(handleDoubleTapSeek)('right');
    });

  if (!shouldRender) return null;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
      hardwareAccelerated
      presentationStyle="fullScreen"
    >
      <GestureHandlerRootView style={styles.container}>
        <StatusBar hidden translucent backgroundColor="transparent" />

        <View style={styles.videoContainer}>
          <View style={{ flex: 1, flexDirection: 'row' }}>
            {/* Left side - double tap to go back 10s */}
            <GestureDetector gesture={leftDoubleTap}>
              <TouchableOpacity
                style={{ flex: 1 }}
                activeOpacity={1}
                onPress={handleToggleControls}
                delayPressIn={0}
              >
                <View style={{ flex: 1 }} />
              </TouchableOpacity>
            </GestureDetector>

            {/* Right side - double tap to go forward 10s */}
            <GestureDetector gesture={rightDoubleTap}>
              <TouchableOpacity
                style={{ flex: 1 }}
                activeOpacity={1}
                onPress={handleToggleControls}
                delayPressIn={0}
              >
                <View style={{ flex: 1 }} />
              </TouchableOpacity>
            </GestureDetector>
          </View>

          {/* Video view positioned absolutely to be behind tap zones */}
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
            <VideoView
              player={player}
              style={{
                width: Dimensions.get("window").width,
                height: isVideoLandscape
                  ? Dimensions.get("window").height
                  : Dimensions.get("window").width /
                  (videoAspectRatio || 9 / 16),
                // --- FIX 5: Apply zoom to fix unused variable error ---
                transform: [{ scale: currentZoom }],
              }}
              contentFit="contain"
              nativeControls={false}
            />
          </View>

          {/* Double-tap feedback indicators */}
          {showSeekFeedback && (
            <View style={[
              styles.seekFeedback,
              showSeekFeedback.side === 'left' ? styles.seekFeedbackLeft : styles.seekFeedbackRight
            ]}>
              <FontAwesome
                name={showSeekFeedback.side === 'left' ? 'backward' : 'forward'}
                size={40}
                color="rgba(255, 255, 255, 0.9)"
              />
              <Text style={styles.seekFeedbackText}>10s</Text>
            </View>
          )}
        </View>

        {/* ... (Rest of the JSX is unchanged) ... */}
        {showControls && (
          <View style={styles.controlsOverlay}>
            <LinearGradient
              colors={["rgba(0,0,0,0.8)", "transparent"]}
              style={styles.topBar}
            >
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleClose}
              >
                <FontAwesome name="arrow-left" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.videoTitle} numberOfLines={1}>
                {videoTitle}
              </Text>
              <View style={styles.topRightButtons}>
                {isVideoLandscape !== null && videoAspectRatio && (
                  <View style={styles.videoInfoBadge}>
                    <Text style={styles.videoInfoText}>
                      {videoAspectRatio.toFixed(2)}:1
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.settingsButton}
                  onPress={() => setShowSettingsMenu(!showSettingsMenu)}
                >
                  <LinearGradient
                    colors={["rgba(255,0,102,0.3)", "rgba(153,0,255,0.3)"]}
                    style={styles.settingsButtonGradient}
                  >
                    <FontAwesome name="cog" size={20} color="#fff" />
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.rotateButton}
                  onPress={toggleOrientation}
                >
                  <LinearGradient
                    colors={["rgba(255,0,102,0.3)", "rgba(153,0,255,0.3)"]}
                    style={styles.rotateButtonGradient}
                  >
                    <FontAwesome name="rotate-right" size={20} color="#fff" />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>

            {showSettingsMenu && (
              <View style={styles.settingsMenu}>
                <View style={styles.settingsMenuWrapper}>
                  <LinearGradient
                    colors={[
                      "rgba(26, 26, 26, 0.98)",
                      "rgba(10, 10, 10, 0.98)",
                    ]}
                    style={styles.settingsMenuGradient}
                  >
                    <View style={styles.settingsMenuHeader}>
                      <Text style={styles.settingsMenuTitle}>Settings</Text>
                      <TouchableOpacity
                        onPress={() => setShowSettingsMenu(false)}
                      >
                        <FontAwesome name="times" size={20} color="#fff" />
                      </TouchableOpacity>
                    </View>

                    <ScrollView
                      style={styles.settingsMenuContent}
                      showsVerticalScrollIndicator={false}
                      nestedScrollEnabled={true}
                    >
                      <View style={styles.settingsSection}>
                        <View style={styles.settingsSectionHeader}>
                          <FontAwesome name="cc" size={18} color="#ff0066" />
                          <Text style={styles.settingsSectionTitle}>
                            Subtitles
                          </Text>
                        </View>

                        <TouchableOpacity
                          style={styles.settingItem}
                          onPress={handleToggleSubtitles}
                        >
                          <Text style={styles.settingItemText}>
                            {subtitlesEnabled
                              ? "Disable Subtitles"
                              : "Enable Subtitles"}
                          </Text>
                          <View
                            style={[
                              styles.settingToggle,
                              subtitlesEnabled && styles.settingToggleActive,
                            ]}
                          >
                            <View
                              style={[
                                styles.settingToggleThumb,
                                subtitlesEnabled &&
                                styles.settingToggleThumbActive,
                              ]}
                            />
                          </View>
                        </TouchableOpacity>

                        {subtitlesEnabled &&
                          availableSubtitles.map((subtitle) => (
                            <TouchableOpacity
                              key={subtitle.index}
                              style={styles.settingItem}
                              onPress={() =>
                                handleSelectSubtitle(subtitle.index)
                              }
                            >
                              <Text style={styles.settingItemText}>
                                {subtitle.label}
                              </Text>
                              {selectedSubtitle === subtitle.index && (
                                <FontAwesome
                                  name="check"
                                  size={16}
                                  color="#ff0066"
                                />
                              )}
                            </TouchableOpacity>
                          ))}

                        {subtitlesEnabled && (
                          <TouchableOpacity
                            style={styles.settingItem}
                            onPress={() => handleSelectSubtitle(-1)}
                          >
                            <Text style={styles.settingItemText}>Off</Text>
                            {selectedSubtitle === -1 && (
                              <FontAwesome
                                name="check"
                                size={16}
                                color="#ff0066"
                              />
                            )}
                          </TouchableOpacity>
                        )}
                      </View>

                      <View style={styles.settingsSection}>
                        <View style={styles.settingsSectionHeader}>
                          <FontAwesome
                            name="volume-up"
                            size={18}
                            color="#ff0066"
                          />
                          <Text style={styles.settingsSectionTitle}>
                            Audio Track
                          </Text>
                        </View>

                        {availableAudioTracks.map((track) => (
                          <TouchableOpacity
                            key={track.index}
                            style={styles.settingItem}
                            onPress={() => handleSelectAudioTrack(track.index)}
                          >
                            <Text style={styles.settingItemText}>
                              {track.label}
                            </Text>
                            {selectedAudioTrack === track.index && (
                              <FontAwesome
                                name="check"
                                size={16}
                                color="#ff0066"
                              />
                            )}
                          </TouchableOpacity>
                        ))}
                      </View>

                      <View style={styles.settingsSection}>
                        <View style={styles.settingsSectionHeader}>
                          <FontAwesome name="microphone" size={18} color="#ff0066" />
                          <Text style={styles.settingsSectionTitle}>
                            Voice Captions
                          </Text>
                        </View>

                        <TouchableOpacity
                          style={styles.settingItem}
                          onPress={handleToggleLiveSubtitles}
                        >
                          <Text style={styles.settingItemText}>
                            Voice-to-Text
                          </Text>
                          <View
                            style={[
                              styles.settingToggle,
                              liveSubtitlesEnabled && styles.settingToggleActive,
                            ]}
                          >
                            <View
                              style={[
                                styles.settingToggleThumb,
                                liveSubtitlesEnabled &&
                                styles.settingToggleThumbActive,
                              ]}
                            />
                          </View>
                        </TouchableOpacity>

                        {liveSubtitlesEnabled && (
                          <View style={styles.settingItem}>
                            <Text style={[styles.settingItemText, { fontSize: 12, opacity: 0.7 }]}>
                              🎤 Listens to your voice (not video audio)
                            </Text>
                            {isRecognizing && (
                              <FontAwesome
                                name="circle"
                                size={12}
                                color="#ff0066"
                              />
                            )}
                          </View>
                        )}
                      </View>
                    </ScrollView>
                  </LinearGradient>
                </View>
              </View>
            )}

            <View style={styles.centerControls}>
              <TouchableOpacity
                style={styles.centerPlayButton}
                onPress={handlePlayPause}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={["rgba(255,255,255,0.3)", "rgba(255,255,255,0.1)"]}
                  style={styles.centerPlayGradient}
                >
                  <FontAwesome
                    name={isPlaying ? "pause" : "play"}
                    size={40}
                    color="#fff"
                    style={!isPlaying && { marginLeft: 5 }}
                  />
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.8)"]}
              style={styles.bottomBar}
            >
              <View style={styles.progressContainer}>
                <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={Math.max(duration, 1)}
                  value={Math.min(currentTime, duration)}
                  onValueChange={handleSeek}
                  onSlidingComplete={handleSeekComplete}
                  minimumTrackTintColor="#ff0066"
                  maximumTrackTintColor="rgba(255,255,255,0.3)"
                  thumbTintColor="#fff"
                />
                <Text style={styles.timeText}>{formatTime(duration)}</Text>
              </View>

              <View style={styles.bottomControls}>
                {onPrevious && (
                  <TouchableOpacity
                    style={styles.controlButton}
                    onPress={() => {
                      onPrevious();
                      hideControlsAfterDelay();
                    }}
                  >
                    <FontAwesome name="step-backward" size={24} color="#fff" />
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.controlButton, styles.mainPlayButton]}
                  onPress={handlePlayPause}
                >
                  <LinearGradient
                    colors={["#ff0066", "#9900ff"]}
                    style={styles.mainPlayGradient}
                  >
                    <FontAwesome
                      name={isPlaying ? "pause" : "play"}
                      size={28}
                      color="#fff"
                      style={!isPlaying && { marginLeft: 3 }}
                    />
                  </LinearGradient>
                </TouchableOpacity>

                {onNext && (
                  <TouchableOpacity
                    style={styles.controlButton}
                    onPress={() => {
                      onNext();
                      hideControlsAfterDelay();
                    }}
                  >
                    <FontAwesome name="step-forward" size={24} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
            </LinearGradient>
          </View>
        )}

        {/* Live Subtitle Display - Always show when enabled, regardless of controls visibility */}
        {liveSubtitlesEnabled && liveSubtitleText && (
          <View style={styles.liveSubtitleContainer}>
            <LinearGradient
              colors={["rgba(0,0,0,0.8)", "rgba(0,0,0,0.6)"]}
              style={styles.liveSubtitleGradient}
            >
              <Text style={styles.liveSubtitleText}>
                {liveSubtitleText}
              </Text>
            </LinearGradient>
          </View>
        )}
      </GestureHandlerRootView>
    </Modal>
  );
}

// ... (Styles are unchanged)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  videoContainer: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  videoTouchable: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 50 : 30,
    paddingBottom: 20,
  },
  closeButton: {
    padding: 8,
  },
  videoTitle: {
    flex: 1,
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginHorizontal: 15,
  },
  topRightButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  videoInfoBadge: {
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  videoInfoText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  rotateButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
    shadowColor: "#ff0066",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 5,
  },
  rotateButtonGradient: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 22,
  },
  centerControls: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  centerPlayButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  centerPlayGradient: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.3)",
    borderRadius: 50,
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 20,
    paddingTop: 20,
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    gap: 8,
  },
  slider: {
    flex: 1,
    marginHorizontal: 0,
    height: 40,
  },
  timeText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    minWidth: 48,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  bottomControls: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 30,
  },
  controlButton: {
    alignItems: "center",
    gap: 5,
  },
  controlButtonText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontWeight: "600",
  },
  mainPlayButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    overflow: "hidden",
  },
  mainPlayGradient: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
    borderRadius: 35,
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
    shadowColor: "#ff0066",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 5,
  },
  settingsButtonGradient: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 22,
  },
  settingsMenu: {
    position: "absolute",
    top: 100,
    right: 20,
    width: 280,
    maxHeight: "70%",
    borderRadius: 16,
    overflow: "visible",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 99999,
    zIndex: 99999,
  },
  settingsMenuWrapper: {
    borderRadius: 16,
    overflow: "hidden",
    maxHeight: "100%",
  },
  settingsMenuGradient: {
    padding: 16,
    maxHeight: "100%",
  },
  settingsMenuContent: {
    maxHeight: 400,
  },
  settingsMenuHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  settingsMenuTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  settingsSection: {
    marginBottom: 20,
  },
  settingsSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  settingsSectionTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  settingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    marginBottom: 8,
  },
  settingItemText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "500",
  },
  settingToggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    padding: 2,
    justifyContent: "center",
  },
  settingToggleActive: {
    backgroundColor: "#ff0066",
  },
  settingToggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  settingToggleThumbActive: {
    transform: [{ translateX: 20 }],
  },
  liveSubtitleContainer: {
    position: "absolute",
    bottom: 120,
    left: 20,
    right: 20,
    alignItems: "center",
    zIndex: 1000,
  },
  liveSubtitleGradient: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    maxWidth: "90%",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  liveSubtitleText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 22,
  },
  seekFeedback: {
    position: "absolute",
    top: "50%",
    transform: [{ translateY: -50 }],
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 80,
  },
  seekFeedbackLeft: {
    left: 40,
  },
  seekFeedbackRight: {
    right: 40,
  },
  seekFeedbackText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 8,
  },
});
