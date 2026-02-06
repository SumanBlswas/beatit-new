import { ApiSong } from "@/services/apiTypes";
import { FontAwesome } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Dimensions,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import {
  Gesture,
  GestureDetector
} from "react-native-gesture-handler";
import Animated, {
  Extrapolate,
  interpolate,
  runOnJS,
  runOnUI,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

// --- Constants ---
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.35;
const CARD_WIDTH = SCREEN_WIDTH * 0.88;
const CARD_HEIGHT = SCREEN_HEIGHT * 0.6;
const DISMISS_AREA_HEIGHT = 100;

// --- Interfaces ---
interface NotificationCardPageProps {
  songs: ApiSong[];
  onSwipeRight: (song: ApiSong) => void;
  onPlaySong: (song: ApiSong, queue: ApiSong[]) => void;
  getImageUrl: (imageInput: any, quality?: string) => string;
}

// --- Utility Functions ---
const cleanSongName = (name: string): string => {
  if (!name) return "";
  const sanitizedName = name
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'");
  const separators = /\s*\(|\s*\[|\s*feat\.|\s*ft\.|\s*-\s/g;
  const match = separators.exec(sanitizedName);
  return match
    ? sanitizedName.substring(0, match.index).trim()
    : sanitizedName.trim();
};

const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// --- Main Component ---
const NotificationCardPage: React.FC<NotificationCardPageProps> = ({
  songs,
  onSwipeRight,
  onPlaySong,
  getImageUrl,
}) => {
  // --- State Management ---
  const [isNotificationVisible, setIsNotificationVisible] = useState(true);
  const [isDetailedViewVisible, setIsDetailedViewVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const autoCollapseTimer = useRef<NodeJS.Timeout | null>(null);

  const shuffledSongs = useMemo(() => shuffleArray(songs), [songs]);

  // --- Animation Shared Values ---
  const notificationTranslateY = useSharedValue(0);
  const notificationTranslateX = useSharedValue(0);
  const expansionProgress = useSharedValue(0);
  const cardTranslateX = useSharedValue(0);
  const cardTranslateY = useSharedValue(0);
  const cardRotate = useSharedValue(0);
  const cardScale = useSharedValue(1);
  const topCardOpacity = useSharedValue(1);
  const nextCardScale = useSharedValue(0.92);
  const nextCardTranslateY = useSharedValue(25);
  const thirdCardScale = useSharedValue(0.84);
  const thirdCardTranslateY = useSharedValue(50);
  const dismissAreaOpacity = useSharedValue(0);

  // --- Animation Logic & Lifecycle ---
  useEffect(() => {
    // Placeholder for visibility logic
    const showNotification = async () => {
      // Replace with your own logic using AsyncStorage
      const lastDismissed = null; // await AsyncStorage.getItem('lastDismissed');
      const now = new Date().getTime();
      if (!lastDismissed || now - Number(lastDismissed) > 2 * 60 * 60 * 1000) {
        setIsNotificationVisible(true);
        notificationTranslateY.value = withSpring(0);
      }
    };

    showNotification();
  }, []);

  const clearAutoCollapseTimer = () => {
    if (autoCollapseTimer.current) {
      clearTimeout(autoCollapseTimer.current);
    }
  };

  useEffect(() => {
    clearAutoCollapseTimer();
    if (isExpanded) {
      autoCollapseTimer.current = setTimeout(() => {
        setIsExpanded(false);
      }, 6000) as unknown as NodeJS.Timeout;
    } else {
      // Ensure drag state is reset when collapsed (auto or manual)
      runOnJS(setIsDragging)(false);
      dismissAreaOpacity.value = withTiming(0);
    }
    expansionProgress.value = withSpring(isExpanded ? 1 : 0, {
      damping: 20,
      stiffness: 250,
    });
    return () => clearAutoCollapseTimer();
  }, [isExpanded]);

  const handleClosePress = () => {
    clearAutoCollapseTimer();
    if (isExpanded) {
      setIsExpanded(false);
      setIsDragging(false);
    } else {
      notificationTranslateY.value = withTiming(
        -150,
        { duration: 300 },
        (finished) => {
          if (finished) {
            runOnJS(setIsNotificationVisible)(false);
          }
        }
      );
    }
  };

  const advanceToNextCard = useCallback(() => {
    setCurrentIndex((prev) => prev + 1);
    setIsAnimating(false);
  }, []);

  const handleSwipeCompletion = useCallback(
    (direction: "left" | "right") => {
      if (direction === "right" && shuffledSongs[currentIndex]) {
        onSwipeRight(shuffledSongs[currentIndex]);
      }
      advanceToNextCard();
    },
    [currentIndex, onSwipeRight, shuffledSongs, advanceToNextCard]
  );

  const triggerSwipe = useCallback(
    (direction: "left" | "right") => {
      "worklet";
      if (isAnimating) return;
      runOnJS(setIsAnimating)(true);

      const swipeDirection = direction === "right" ? 1 : -1;
      const targetX = SCREEN_WIDTH * 1.5 * swipeDirection;

      nextCardScale.value = withSpring(1, { damping: 20, stiffness: 200 });
      nextCardTranslateY.value = withSpring(0, { damping: 20, stiffness: 200 });
      thirdCardScale.value = withSpring(0.92, { damping: 20, stiffness: 200 });
      thirdCardTranslateY.value = withSpring(25, {
        damping: 20,
        stiffness: 200,
      });

      topCardOpacity.value = withTiming(0, { duration: 200 });
      cardScale.value = withTiming(0.8, { duration: 300 });
      cardRotate.value = withTiming(30 * swipeDirection, { duration: 300 });
      cardTranslateX.value = withTiming(
        targetX,
        { duration: 300 },
        (finished) => {
          if (finished) {
            runOnJS(handleSwipeCompletion)(direction);
          }
        }
      );
    },
    [
      isAnimating,
      topCardOpacity,
      cardScale,
      cardRotate,
      cardTranslateX,
      nextCardScale,
      nextCardTranslateY,
      thirdCardScale,
      thirdCardTranslateY,
      handleSwipeCompletion,
    ]
  );

  useEffect(() => {
    if (currentIndex > 0 && currentIndex < shuffledSongs.length) {
      runOnUI(() => {
        "worklet";
        cardTranslateX.value = 0;
        cardTranslateY.value = 0;
        cardRotate.value = 0;
        cardScale.value = 1;
        topCardOpacity.value = withTiming(1, { duration: 250 });
      })();
    }
  }, [currentIndex, shuffledSongs.length]);

  // --- Gesture Handlers ---
  const singleTap = Gesture.Tap()
    .maxDuration(250)
    .onStart(() => {
      const currentSong = shuffledSongs[currentIndex];
      if (currentSong) {
        runOnJS(onPlaySong)(currentSong, shuffledSongs);
      }
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onStart(() => {
      const currentSong = shuffledSongs[currentIndex];
      if (currentSong && !isAnimating) {
        runOnJS(onSwipeRight)(currentSong);
        triggerSwipe("right");
      }
    });

  const panGesture = Gesture.Pan()
    .enabled(!isAnimating)
    .onUpdate((event) => {
      cardTranslateX.value = event.translationX;
      cardTranslateY.value = event.translationY;
      cardRotate.value = interpolate(
        event.translationX,
        [-SCREEN_WIDTH / 2, SCREEN_WIDTH / 2],
        [-15, 15],
        Extrapolate.CLAMP
      );
      const absTranslation = Math.abs(event.translationX);
      cardScale.value = interpolate(
        absTranslation,
        [0, SWIPE_THRESHOLD],
        [1, 0.95],
        Extrapolate.CLAMP
      );
      nextCardScale.value = interpolate(
        absTranslation,
        [0, SWIPE_THRESHOLD],
        [0.92, 1],
        Extrapolate.CLAMP
      );
      nextCardTranslateY.value = interpolate(
        absTranslation,
        [0, SWIPE_THRESHOLD],
        [25, 0],
        Extrapolate.CLAMP
      );
    })
    .onEnd((event) => {
      if (Math.abs(event.translationX) < SWIPE_THRESHOLD) {
        topCardOpacity.value = withSpring(1);
        cardTranslateX.value = withSpring(0, { damping: 20, stiffness: 200 });
        cardTranslateY.value = withSpring(0, { damping: 20, stiffness: 200 });
        cardRotate.value = withSpring(0, { damping: 20, stiffness: 200 });
        cardScale.value = withSpring(1, { damping: 20, stiffness: 200 });
        nextCardScale.value = withSpring(0.92, { damping: 20, stiffness: 200 });
        nextCardTranslateY.value = withSpring(25, {
          damping: 20,
          stiffness: 200,
        });
        return;
      }
      const direction = event.translationX > 0 ? "right" : "left";
      triggerSwipe(direction);
    });

  const composedGesture = Gesture.Race(doubleTap, panGesture, singleTap);

  const onDrag = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: notificationTranslateX.value },
        { translateY: notificationTranslateY.value },
      ] as any,
    };
  });

  const dragGesture = Gesture.Pan()
    .onBegin(() => {
      runOnJS(setIsDragging)(true);
      dismissAreaOpacity.value = withTiming(1);
    })
    .onUpdate((event) => {
      notificationTranslateX.value = event.translationX;
      notificationTranslateY.value = event.translationY;
    })
    .onEnd(() => {
      const originalTop = Platform.OS === "ios" ? 100 : 180;
      const absoluteY = originalTop + notificationTranslateY.value;
      if (
        absoluteY >
        SCREEN_HEIGHT - DISMISS_AREA_HEIGHT
      ) {
        notificationTranslateY.value = withTiming(SCREEN_HEIGHT, {}, () => {
          runOnJS(setIsNotificationVisible)(false);
        });
      } else {
        notificationTranslateX.value = withSpring(0);
        notificationTranslateY.value = withSpring(0);
      }
      dismissAreaOpacity.value = withTiming(0, {}, () => {
        runOnJS(setIsDragging)(false);
      });
    });

  // --- Animated Styles ---
  const notificationContainerStyle = useAnimatedStyle(() => {
    const width = interpolate(
      expansionProgress.value,
      [0, 1],
      [58, SCREEN_WIDTH - 40]
    );
    const height = interpolate(expansionProgress.value, [0, 1], [58, 82]);
    const borderRadius = interpolate(expansionProgress.value, [0, 1], [29, 20]);
    return {
      width,
      height,
      borderRadius,
      transform: [
        { translateX: notificationTranslateX.value },
        { translateY: notificationTranslateY.value },
      ] as any,
    };
  });

  const animatedImageStyle = useAnimatedStyle(() => {
    const size = interpolate(expansionProgress.value, [0, 1], [48, 70]);
    return {
      width: size,
      height: size,
      borderRadius: interpolate(expansionProgress.value, [0, 1], [14, 20]),
    };
  });

  const notificationTextStyle = useAnimatedStyle(() => {
    return {
      opacity: expansionProgress.value,
      transform: [
        {
          translateX: interpolate(expansionProgress.value, [0, 1], [-20, 0]),
        },
      ],
    };
  });

  const dismissAreaStyle = useAnimatedStyle(() => {
    return {
      opacity: dismissAreaOpacity.value,
      transform: [
        {
          translateY: interpolate(
            dismissAreaOpacity.value,
            [0, 1],
            [DISMISS_AREA_HEIGHT, 0]
          ),
        },
      ],
    };
  });

  const topCardAnimatedStyle = useAnimatedStyle(() => ({
    opacity: topCardOpacity.value,
    transform: [
      { translateX: cardTranslateX.value },
      { translateY: cardTranslateY.value },
      { rotate: `${cardRotate.value}deg` },
      { scale: cardScale.value },
    ] as const,
  }));

  const nextCardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: nextCardScale.value },
      { translateY: nextCardTranslateY.value },
    ] as const,
    opacity: interpolate(nextCardScale.value, [0.92, 1], [0.8, 1]),
  }));

  const thirdCardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: thirdCardScale.value },
      { translateY: thirdCardTranslateY.value },
    ] as const,
    opacity: 0.6,
  }));

  const likeOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(
      cardTranslateX.value,
      [50, SWIPE_THRESHOLD],
      [0, 1],
      Extrapolate.CLAMP
    ),
    transform: [
      {
        scale: interpolate(
          cardTranslateX.value,
          [50, SWIPE_THRESHOLD],
          [0.8, 1],
          Extrapolate.CLAMP
        ),
      },
    ],
  }));

  const nopeOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(
      cardTranslateX.value,
      [-50, -SWIPE_THRESHOLD],
      [0, 1],
      Extrapolate.CLAMP
    ),
    transform: [
      {
        scale: interpolate(
          cardTranslateX.value,
          [-50, -SWIPE_THRESHOLD],
          [0.8, 1],
          Extrapolate.CLAMP
        ),
      },
    ],
  }));

  // --- Reusable Card Component ---
  const renderCard = (
    song: ApiSong,
    animatedStyle: any,
    isTopCard: boolean = false
  ) => {
    const cardContent = (
      <Animated.View style={[styles.card, animatedStyle]}>
        <Image
          source={{ uri: getImageUrl(song.image, "500x500") }}
          style={styles.cardImage}
        />
        <BlurView
          intensity={Platform.OS === "ios" ? 40 : 80}
          tint="dark"
          style={styles.cardGlassOverlay}
        >
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.4)", "rgba(0,0,0,0.9)"]}
            style={styles.cardContentOverlay}
          >
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {cleanSongName(song.name)}
              </Text>
              <Text style={styles.cardArtist} numberOfLines={1}>
                {typeof song.primaryArtists === "string"
                  ? song.primaryArtists
                  : song.primaryArtists?.map((a) => a.name).join(", ")}
              </Text>
            </View>
          </LinearGradient>
        </BlurView>

        {isTopCard && (
          <>
            <Animated.View
              style={[styles.feedbackOverlay, styles.like, likeOpacity]}
            >
              <FontAwesome name="heart" size={90} color="white" />
              <Text style={styles.feedbackText}>LIKE</Text>
            </Animated.View>
            <Animated.View
              style={[styles.feedbackOverlay, styles.nope, nopeOpacity]}
            >
              <FontAwesome name="times" size={90} color="white" />
              <Text style={styles.feedbackText}>NOPE</Text>
            </Animated.View>
          </>
        )}
      </Animated.View>
    );

    return isTopCard ? (
      <GestureDetector gesture={composedGesture}>{cardContent}</GestureDetector>
    ) : (
      cardContent
    );
  };

  // --- Main Render Logic ---
  const firstSong = shuffledSongs[0];

  if (isDetailedViewVisible) {
    const currentSong = shuffledSongs[currentIndex];
    const nextSong = shuffledSongs[currentIndex + 1];
    const thirdSong = shuffledSongs[currentIndex + 2];

    if (!currentSong) {
      return (
        <BlurView intensity={90} tint="dark" style={styles.centered}>
          <LinearGradient
            colors={["#FF6600", "#FF8C00"]}
            style={styles.completionCard}
          >
            <FontAwesome
              name="check-circle"
              size={80}
              color="white"
              style={{ opacity: 0.8 }}
            />
            <Text style={styles.noMoreSongsText}>All Caught Up!</Text>
            <Text style={styles.noMoreSongsSubText}>
              You've explored all the new tunes for now. Check back later for
              more.
            </Text>
            <TouchableOpacity
              style={styles.closeButtonLarge}
              onPress={() => {
                setIsDetailedViewVisible(false);
                setIsNotificationVisible(false);
                setIsDragging(false);
              }}
            >
              <Text style={styles.closeButtonText}>Done</Text>
            </TouchableOpacity>
          </LinearGradient>
        </BlurView>
      );
    }

    return (
      <BlurView intensity={90} tint="dark" style={styles.detailedViewContainer}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeIcon}
            onPress={() => {
              setIsDetailedViewVisible(false);
              setIsExpanded(false);
              setIsDragging(false);
            }}
          >
            <FontAwesome name="close" size={24} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>

        <View style={styles.cardStack}>
          {thirdSong && renderCard(thirdSong, thirdCardAnimatedStyle, false)}
          {nextSong && renderCard(nextSong, nextCardAnimatedStyle, false)}
          {currentSong && renderCard(currentSong, topCardAnimatedStyle, true)}
        </View>

        <View style={styles.progressIndicator}>
          <Text style={styles.progressText}>
            {Math.min(currentIndex + 1, shuffledSongs.length)} /{" "}
            {shuffledSongs.length}
          </Text>
        </View>
      </BlurView>
    );
  }

  if (!isNotificationVisible) return null;

  return (
    <>
      {/* --- THIS IS THE FIX --- */}
      {/* The overlay is now only rendered when the notification is expanded */}
      {isExpanded && (
        <TouchableWithoutFeedback onPress={() => {
          setIsExpanded(false);
          runOnJS(setIsDragging)(false);
          dismissAreaOpacity.value = withTiming(0);
        }}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
      )}

      <GestureDetector gesture={dragGesture}>
        <Animated.View
          style={[
            styles.notificationPositioner,
            onDrag,
            notificationContainerStyle,
          ]}
        >
          <BlurView intensity={95} tint="prominent" style={styles.notificationBlur}>
            <TouchableOpacity
              style={styles.touchableContent}
              activeOpacity={0.8}
              onPress={() => {
                if (isExpanded) {
                  clearAutoCollapseTimer();
                  setIsDetailedViewVisible(true);
                } else {
                  setIsExpanded(true);
                }
              }}
            >
              {firstSong && (
                <Animated.Image
                  source={{ uri: getImageUrl(firstSong.image, "150x150") }}
                  style={[styles.notificationImage, animatedImageStyle]}
                />
              )}
              <Animated.View
                style={[
                  styles.notificationTextContainer,
                  notificationTextStyle,
                ]}
              >
                <Text style={styles.notificationText} numberOfLines={1}>
                  🎵 Discover new music!
                </Text>
                <Text style={styles.notificationSubText} numberOfLines={1}>
                  Tap here to explore suggestions.
                </Text>
              </Animated.View>
            </TouchableOpacity>
            {isExpanded && (
              <TouchableOpacity
                style={styles.closeNotification}
                onPress={handleClosePress}
              >
                <FontAwesome
                  name="close"
                  size={18}
                  color="rgba(255,255,255,0.6)"
                />
              </TouchableOpacity>
            )}
          </BlurView>
        </Animated.View>
      </GestureDetector>
      {isDragging && (
        <Animated.View style={[styles.dismissArea, dismissAreaStyle]}>
          <FontAwesome name="trash-o" size={32} color="white" />
          <Text style={styles.dismissText}>Drag here to dismiss</Text>
        </Animated.View>
      )}
    </>
  );
};

// --- Stylesheet ---
const styles = StyleSheet.create({
  notificationPositioner: {
    position: "absolute",
    top: Platform.OS === "ios" ? 100 : 180,
    right: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0,
    shadowRadius: 20,
    elevation: 20,
    overflow: "hidden",
    backgroundColor: "transparent"
  },
  notificationBlur: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderWidth: 0,
    borderColor: "transparent",
    borderRadius: 3
  },
  touchableContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    height: "100%",
  },
  notificationImage: {
    borderRadius: 15,
    position: "relative",
  },
  notificationTextContainer: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  notificationText: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  notificationSubText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    marginTop: 2,
  },
  closeNotification: {
    padding: 8,
    marginRight: 4,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignSelf: "flex-start",
  },
  centered: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  completionCard: {
    borderRadius: 24,
    padding: 40,
    alignItems: "center",
    width: "100%",
    maxWidth: CARD_WIDTH,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  detailedViewContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-start",
    alignItems: "center",
    paddingTop: Platform.OS === "ios" ? 60 : 40,
  },
  header: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 40,
    right: 20,
    zIndex: 10,
  },
  closeIcon: {
    padding: 12,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  cardStack: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 80,
  },
  card: {
    position: "absolute",
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 28,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.35,
    shadowRadius: 30,
    elevation: 25,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    overflow: "hidden",
  },
  cardImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  cardGlassOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  cardContentOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    borderRadius: 28,
  },
  cardContent: {
    padding: 30,
  },
  cardTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: "white",
    lineHeight: 38,
    textShadowColor: "rgba(0, 0, 0, 0.6)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 5,
  },
  cardArtist: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 18,
    marginTop: 8,
    fontWeight: "600",
    textShadowColor: "rgba(0, 0, 0, 0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  feedbackOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 28,
  },
  like: {
    backgroundColor: "rgba(51, 204, 153, 0.25)",
    borderWidth: 4,
    borderColor: "rgba(255, 255, 255, 0.8)",
  },
  nope: {
    backgroundColor: "rgba(255, 88, 100, 0.25)",
    borderWidth: 4,
    borderColor: "rgba(255, 255, 255, 0.8)",
  },
  feedbackText: {
    color: "white",
    fontSize: 28,
    fontWeight: "900",
    marginTop: 12,
    textShadowColor: "rgba(0, 0, 0, 0.6)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    letterSpacing: 2,
  },
  progressIndicator: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 40 : 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderRadius: 16,
  },
  progressText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 14,
    fontWeight: "600",
  },
  noMoreSongsText: {
    color: "white",
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 20,
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  noMoreSongsSubText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 16,
    marginTop: 12,
    textAlign: "center",
    paddingHorizontal: 20,
    lineHeight: 22,
  },
  closeButtonLarge: {
    marginTop: 40,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    paddingVertical: 16,
    paddingHorizontal: 50,
    borderRadius: 28,
  },
  closeButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  dismissArea: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: DISMISS_AREA_HEIGHT,
    backgroundColor: "rgba(255, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
  },
  dismissText: {
    color: "white",
    marginLeft: 10,
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default NotificationCardPage;
