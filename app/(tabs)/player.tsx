// app/(tabs)/player.tsx
import { usePlayer, useProgress } from "@/context/PlayerContext";
import { ApiImage } from "@/services/apiTypes";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import Slider from "@react-native-community/slider";
import { router, Stack, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar"; // Ensure StatusBar is imported
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
  View,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

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
    nextSong,
    previousSong,
    seekTo,
    playbackMode,
    togglePlaybackMode,
  } = usePlayer();

  const { playbackPosition, playbackDuration } = useProgress();

  const [isSeeking, setIsSeeking] = useState(false);
  const [sliderValue, setSliderValue] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const isChangingSongRef = useRef(false);

  // Animated values
  const artworkAppear = useSharedValue(0);
  const controlsAppear = useSharedValue(0);
  const slideOffset = useSharedValue(0);

  const handleBack = () => {
    setIsExiting(true);
    // Exit animations - faster and smoother
    artworkAppear.value = withTiming(0, { duration: 200 });
    controlsAppear.value = withTiming(0, { duration: 200 });

    // Navigate back immediately after animation starts
    setTimeout(() => {
      router.back();
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
  }, [currentSong]);

  useEffect(() => {
    if (!isSeeking && playbackPosition !== undefined) {
      setSliderValue(playbackPosition);
    }
  }, [playbackPosition, isSeeking]);

  // Fixed animated styles with proper typing
  const animatedArtworkStyle = useAnimatedStyle(() => {
    const scale = interpolate(artworkAppear.value, [0, 1], [0.8, 1]);
    const translateY = interpolate(artworkAppear.value, [0, 1], [50, 0]);

    return {
      opacity: artworkAppear.value,
      transform: [{ scale }, { translateY }],
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

            <GestureDetector gesture={swipeGesture}>
              <Animated.View
                style={[styles.swipeableSection, animatedSlideStyle]}
              >
                <Animated.View
                  style={[styles.artworkContainer, animatedArtworkStyle]}
                >
                  <Image source={{ uri: artworkUrl }} style={styles.artwork} />
                </Animated.View>

                <Animated.View
                  style={[styles.songInfoContainer, animatedControlsStyle]}
                >
                  <Text style={styles.titleText} numberOfLines={2}>
                    {songTitle}
                  </Text>
                  <Text style={styles.artistText} numberOfLines={1}>
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
          </SafeAreaView>
        </View>
      </ImageBackground>
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
    maxHeight: width * 0.75 + 40,
  },
  artwork: {
    width: width * 0.75,
    height: width * 0.75,
    borderRadius: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 15,
  },
  songInfoContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    paddingHorizontal: 20,
    minHeight: 80,
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
});
