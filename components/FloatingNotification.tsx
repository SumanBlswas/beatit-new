import FontAwesome from "@expo/vector-icons/FontAwesome";
import React, { useEffect, useRef } from "react";
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  runOnJS,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

// --- Helper Components for Hooks ---

interface ParticleProps {
  index: number;
  particleSpread: SharedValue<number>;
  colors: { primary: string };
}

const Particle: React.FC<ParticleProps> = ({
  index,
  particleSpread,
  colors,
}) => {
  const style = useAnimatedStyle((): ViewStyle => {
    const angle = (index / 8) * Math.PI * 2;
    const radius = particleSpread.value * 60;
    return {
      transform: [
        { translateX: Math.cos(angle) * radius },
        { translateY: Math.sin(angle) * radius },
        { scale: interpolate(particleSpread.value, [0, 1, 2], [0, 1, 0]) },
      ],
      opacity: interpolate(particleSpread.value, [0, 0.5, 1, 2], [0, 1, 1, 0]),
    };
  });

  return (
    <Animated.View
      style={[
        styles.particle,
        { backgroundColor: index % 2 === 0 ? colors.primary : "#ff6b6b" },
        style,
      ]}
    />
  );
};

interface BarProps {
  barValue: SharedValue<number>;
  color: string;
}

const Bar: React.FC<BarProps> = ({ barValue, color }) => {
  const style = useAnimatedStyle(() => ({
    height: interpolate(barValue.value, [0, 1], [4, 32]),
    opacity: interpolate(barValue.value, [0, 1], [0.3, 1]),
  }));

  return (
    <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />
  );
};

interface OrbProps {
  orbX: SharedValue<number>;
  orbY: SharedValue<number>;
  energyPulse: SharedValue<number>;
  backgroundColor: string;
  size: number;
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
}

const Orb: React.FC<OrbProps> = ({
  orbX,
  orbY,
  energyPulse,
  backgroundColor,
  size,
  top,
  left,
  right,
  bottom,
}) => {
  const style = useAnimatedStyle(
    (): ViewStyle => ({
      transform: [
        { translateX: orbX.value },
        { translateY: orbY.value },
        { scale: interpolate(energyPulse.value, [0, 1], [0.8, 1.2]) },
      ],
      opacity: interpolate(energyPulse.value, [0, 1], [0.4, 0.8]),
    })
  );

  return (
    <Animated.View
      style={[
        styles.orb,
        {
          width: size,
          height: size,
          backgroundColor: backgroundColor,
          top: top,
          left: left,
          right: right,
          bottom: bottom,
        },
        style,
      ]}
    />
  );
};

// --- FloatingNotification Component ---

interface FloatingNotificationProps {
  songImage: string;
  songTitle: string;
  artistName: string;
  isVisible: boolean;
  onHide: () => void;
  colors: {
    card: string;
    primary: string;
    text: string;
    textSecondary: string;
    background: string;
  };
}

const FloatingNotification: React.FC<FloatingNotificationProps> = ({
  songImage,
  songTitle,
  artistName,
  isVisible,
  onHide,
  colors,
}) => {
  // Core animation values
  const translateY = useSharedValue(-200);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.3);
  const rotateZ = useSharedValue(0);

  // Morphing and particle effects
  const morphProgress = useSharedValue(0);
  const particleSpread = useSharedValue(0);
  const energyPulse = useSharedValue(0);
  const hologramShift = useSharedValue(0);

  // Audio visualizer bars
  const bar1 = useSharedValue(0.2);
  const bar2 = useSharedValue(0.4);
  const bar3 = useSharedValue(0.6);
  const bar4 = useSharedValue(0.3);
  const bar5 = useSharedValue(0.8);

  // Floating orbs
  const orb1X = useSharedValue(0);
  const orb1Y = useSharedValue(0);
  const orb2X = useSharedValue(0);
  const orb2Y = useSharedValue(0);
  const orb3X = useSharedValue(0);
  const orb3Y = useSharedValue(0);

  // Neon glow effects
  const neonIntensity = useSharedValue(0);
  const scanlineY = useSharedValue(-100);
  const glitchOffset = useSharedValue(0);

  // Fixed timer types
  const hideTimerRef = useRef<number | null>(null);
  const glitchIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (isVisible) {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }

      // Reset all values - start from very top
      translateY.value = -300;
      translateX.value = 0;
      opacity.value = 0;
      scale.value = 0.3;
      rotateZ.value = 0;
      morphProgress.value = 0;
      particleSpread.value = 0;
      energyPulse.value = 0;
      hologramShift.value = 0;
      neonIntensity.value = 0;
      scanlineY.value = -100;
      glitchOffset.value = 0;

      // ULTRA SMOOTH ENTRANCE SEQUENCE

      // Phase 1: Very smooth entry from top
      translateY.value = withTiming(0, {
        duration: 800,
        easing: Easing.bezier(0.25, 0.46, 0.45, 0.94), // Custom smooth bezier curve
      });

      opacity.value = withTiming(1, {
        duration: 700,
        easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
      });

      scale.value = withTiming(1, {
        duration: 700,
        easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
      });

      rotateZ.value = 0; // No rotation for smooth entry

      // Phase 2: Morphing Animation (200-1000ms)
      morphProgress.value = withDelay(
        200,
        withTiming(1, {
          duration: 800,
          easing: Easing.inOut(Easing.cubic),
        })
      );

      // Phase 3: Particle Explosion (400-1200ms)
      particleSpread.value = withDelay(
        400,
        withSequence(
          withTiming(1, { duration: 600, easing: Easing.out(Easing.exp) }),
          withTiming(0, { duration: 200, easing: Easing.in(Easing.exp) })
        )
      );

      // Phase 4: Energy Pulse (continuous)
      energyPulse.value = withDelay(
        600,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
            withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.sin) })
          ),
          -1,
          false
        )
      );

      // Phase 5: Hologram Effect
      hologramShift.value = withDelay(
        300,
        withRepeat(
          withTiming(1, { duration: 2000, easing: Easing.linear }),
          -1,
          false
        )
      );

      // Neon Glow Pulse
      neonIntensity.value = withDelay(
        500,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 800, easing: Easing.inOut(Easing.sin) }),
            withTiming(0.3, {
              duration: 1200,
              easing: Easing.inOut(Easing.sin),
            })
          ),
          -1,
          false
        )
      );

      // Scanning Line Effect
      scanlineY.value = withDelay(
        700,
        withRepeat(
          withTiming(100, { duration: 1500, easing: Easing.linear }),
          -1,
          false
        )
      );

      // Audio Visualizer Bars
      const animateBars = () => {
        bar1.value = withRepeat(
          withTiming(Math.random(), { duration: 200 + Math.random() * 300 }),
          -1,
          true
        );
        bar2.value = withRepeat(
          withTiming(Math.random(), { duration: 150 + Math.random() * 250 }),
          -1,
          true
        );
        bar3.value = withRepeat(
          withTiming(Math.random(), { duration: 180 + Math.random() * 280 }),
          -1,
          true
        );
        bar4.value = withRepeat(
          withTiming(Math.random(), { duration: 220 + Math.random() * 320 }),
          -1,
          true
        );
        bar5.value = withRepeat(
          withTiming(Math.random(), { duration: 160 + Math.random() * 260 }),
          -1,
          true
        );
      };
      setTimeout(animateBars, 800);

      // Floating Orbs
      const animateOrbs = () => {
        orb1X.value = withRepeat(
          withTiming(Math.random() * 40 - 20, { duration: 3000 }),
          -1,
          true
        );
        orb1Y.value = withRepeat(
          withTiming(Math.random() * 20 - 10, { duration: 2500 }),
          -1,
          true
        );
        orb2X.value = withRepeat(
          withTiming(Math.random() * 50 - 25, { duration: 3500 }),
          -1,
          true
        );
        orb2Y.value = withRepeat(
          withTiming(Math.random() * 25 - 12, { duration: 3000 }),
          -1,
          true
        );
        orb3X.value = withRepeat(
          withTiming(Math.random() * 35 - 17, { duration: 2800 }),
          -1,
          true
        );
        orb3Y.value = withRepeat(
          withTiming(Math.random() * 18 - 9, { duration: 3200 }),
          -1,
          true
        );
      };
      setTimeout(animateOrbs, 1000);

      // Glitch Effect (occasional)
      const triggerGlitch = () => {
        glitchOffset.value = withSequence(
          withTiming(5, { duration: 50 }),
          withTiming(-3, { duration: 50 }),
          withTiming(2, { duration: 50 }),
          withTiming(0, { duration: 50 })
        );
      };

      glitchIntervalRef.current = setInterval(() => {
        if (Math.random() > 0.7) triggerGlitch();
      }, 2000) as any;

      // Auto-hide after 5 seconds
      hideTimerRef.current = setTimeout(() => {
        if (glitchIntervalRef.current) {
          clearInterval(glitchIntervalRef.current);
        }

        // ULTRA SMOOTH EXIT SEQUENCE - fade to top
        translateY.value = withTiming(-300, {
          duration: 800,
          easing: Easing.bezier(0.55, 0.06, 0.68, 0.19), // Custom smooth exit curve
        });
        opacity.value = withTiming(0, {
          duration: 700,
          easing: Easing.bezier(0.55, 0.06, 0.68, 0.19),
        });
        scale.value = withTiming(0.9, {
          duration: 700,
          easing: Easing.bezier(0.55, 0.06, 0.68, 0.19),
        });

        // Ensure onHide is called after animation finishes
        setTimeout(() => runOnJS(onHide)(), 800);
      }, 3000) as any;
    } else {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
      if (glitchIntervalRef.current) {
        clearInterval(glitchIntervalRef.current);
      }

      // Instant reset - start from very top
      translateY.value = -300;
      opacity.value = 0;
      scale.value = 0.3;
    }

    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
      if (glitchIntervalRef.current) {
        clearInterval(glitchIntervalRef.current);
      }
    };
  }, [
    isVisible,
    songTitle, // These are only here for React's exhaustive-deps linting,
    artistName, // but generally don't need to trigger the effect unless
    songImage, // their *change* should reset the animation.
    onHide,
    // All shared values should be in the dependency array for completeness,
    // as their .value is set within the effect.
    translateY,
    translateX,
    opacity,
    scale,
    rotateZ,
    morphProgress,
    particleSpread,
    energyPulse,
    hologramShift,
    neonIntensity,
    scanlineY,
    glitchOffset,
    bar1,
    bar2,
    bar3,
    bar4,
    bar5,
    orb1X,
    orb1Y,
    orb2X,
    orb2Y,
    orb3X,
    orb3Y,
  ]);

  // All useAnimatedStyle hooks are now at the top level of the component
  const containerStyle = useAnimatedStyle(
    (): ViewStyle => ({
      transform: [
        { translateY: translateY.value },
        { translateX: translateX.value + glitchOffset.value },
        { scale: scale.value },
        { rotateZ: `${rotateZ.value}deg` },
      ],
      opacity: opacity.value,
    })
  );

  const morphingCardStyle = useAnimatedStyle(() => ({
    borderRadius: interpolate(morphProgress.value, [0, 1], [8, 24]),
    transform: [
      {
        skewX: `${interpolate(
          morphProgress.value,
          [0, 0.5, 1],
          [0, -2, 0]
        )}deg`,
      },
    ],
  }));

  const neonGlowStyle = useAnimatedStyle(() => ({
    shadowOpacity: interpolate(neonIntensity.value, [0, 1], [0.3, 0.8]),
    shadowRadius: interpolate(neonIntensity.value, [0, 1], [10, 25]),
  }));

  const scanlineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanlineY.value }],
    opacity: interpolate(scanlineY.value, [-50, 0, 50], [0, 1, 0]),
  }));

  const hologramStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      hologramShift.value,
      [0, 0.33, 0.66, 1],
      [
        "rgba(0,255,255,0.1)",
        "rgba(255,0,255,0.1)",
        "rgba(255,255,0,0.1)",
        "rgba(0,255,255,0.1)",
      ]
    ),
  }));

  const playButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(energyPulse.value, [0, 1], [1, 1.1]) }],
  }));

  if (!isVisible && opacity.value === 0 && translateY.value <= -100) {
    return null;
  }

  return (
    <Animated.View
      style={[styles.container, containerStyle]}
      pointerEvents="none"
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Floating Energy Orbs */}
        <Orb
          orbX={orb1X}
          orbY={orb1Y}
          energyPulse={energyPulse}
          backgroundColor={colors.primary}
          size={8}
          top={20}
          left={30}
        />
        <Orb
          orbX={orb2X}
          orbY={orb2Y}
          energyPulse={energyPulse}
          backgroundColor="#ff6b6b"
          size={6}
          top={40}
          right={40}
        />
        <Orb
          orbX={orb3X}
          orbY={orb3Y}
          energyPulse={energyPulse}
          backgroundColor="#4ecdc4"
          size={10}
          bottom={30}
          left={50}
        />

        {/* Main Card Container */}
        <Animated.View
          style={[
            styles.card,
            { backgroundColor: colors.card },
            morphingCardStyle,
            neonGlowStyle,
          ]}
        >
          {/* Hologram Overlay */}
          <Animated.View style={[styles.hologramOverlay, hologramStyle]} />

          {/* Scanning Line */}
          <Animated.View style={[styles.scanline, scanlineStyle]} />

          {/* Particle Effects */}
          {[...Array(8)].map((_, i) => (
            <Particle
              key={i}
              index={i}
              particleSpread={particleSpread}
              colors={colors}
            />
          ))}

          <View style={styles.content}>
            {/* Enhanced Album Art with 3D Effect */}
            <View style={styles.albumContainer}>
              <View
                style={[styles.albumGlow, { backgroundColor: colors.primary }]}
              />
              <Image
                source={{
                  uri:
                    songImage ||
                    "https://via.placeholder.com/150/0a0a0a/ffffff/?text=♪",
                }}
                style={styles.albumArt}
              />
              <View style={styles.albumReflection} />

              {/* Audio Visualizer */}
              <View style={styles.visualizer}>
                <Bar barValue={bar1} color={colors.primary} />
                <Bar barValue={bar2} color={colors.primary} />
                <Bar barValue={bar3} color={colors.primary} />
                <Bar barValue={bar4} color={colors.primary} />
                <Bar barValue={bar5} color={colors.primary} />
              </View>
            </View>

            {/* Futuristic Text Display */}
            <View style={styles.textContainer}>
              <View style={styles.titleContainer}>
                <Text
                  style={[styles.title, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {songTitle}
                </Text>
                <View
                  style={[
                    styles.titleUnderline,
                    { backgroundColor: colors.primary },
                  ]}
                />
              </View>

              <Text
                style={[styles.artist, { color: colors.textSecondary }]}
                numberOfLines={1}
              >
                {artistName}
              </Text>

              <View style={styles.statusContainer}>
                <View style={styles.statusIndicators}>
                  <View
                    style={[styles.statusDot, { backgroundColor: "#00ff88" }]}
                  />
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: colors.primary },
                    ]}
                  />
                  <View
                    style={[styles.statusDot, { backgroundColor: "#ff6b6b" }]}
                  />
                </View>
                <Text
                  style={[styles.statusText, { color: colors.textSecondary }]}
                >
                  STREAMING
                </Text>
              </View>
            </View>

            {/* Futuristic Control Panel */}
            <View style={styles.controlPanel}>
              <Animated.View
                style={[
                  styles.playButton,
                  { backgroundColor: colors.primary },
                  playButtonStyle,
                ]}
              >
                <FontAwesome name="play" size={14} color={colors.card} />
              </Animated.View>

              <View style={styles.waveform}>
                {[...Array(3)].map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.waveLine,
                      { backgroundColor: colors.primary },
                    ]}
                  />
                ))}
              </View>
            </View>
          </View>
        </Animated.View>
      </SafeAreaView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 30,
    left: 20,
    right: 20,
    zIndex: 3000,
    alignItems: "center",
  },
  safeArea: {
    width: "100%",
    maxWidth: 400,
  },
  card: {
    borderRadius: 24,
    shadowColor: "#00ffff",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 25,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    overflow: "hidden",
    position: "relative",
  },
  hologramOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.3,
  },
  scanline: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "#00ffff",
    shadowColor: "#00ffff",
    shadowOpacity: 1,
    shadowRadius: 5,
  },
  particle: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 2,
    top: "50%",
    left: "50%",
    shadowColor: "currentColor",
    shadowOpacity: 0.8,
    shadowRadius: 3,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    position: "relative",
    zIndex: 10,
  },
  albumContainer: {
    position: "relative",
    marginRight: 16,
  },
  albumGlow: {
    position: "absolute",
    width: 72,
    height: 72,
    borderRadius: 16,
    opacity: 0.3,
    top: -2,
    left: -2,
  },
  albumArt: {
    width: 68,
    height: 68,
    borderRadius: 14,
    backgroundColor: "#1a1a1a",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.1)",
  },
  albumReflection: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "50%",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 14,
  },
  visualizer: {
    position: "absolute",
    bottom: -8,
    left: 8,
    right: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  bar: {
    width: 3,
    borderRadius: 1.5,
    opacity: 0.8,
  },
  textContainer: {
    flex: 1,
    justifyContent: "center",
  },
  titleContainer: {
    position: "relative",
    marginBottom: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  titleUnderline: {
    position: "absolute",
    bottom: -2,
    left: 0,
    height: 2,
    width: "100%",
    opacity: 0.6,
  },
  artist: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    opacity: 0.8,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusIndicators: {
    flexDirection: "row",
    marginRight: 8,
  },
  statusDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginRight: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  controlPanel: {
    alignItems: "center",
    marginLeft: 8,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "currentColor",
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
    marginBottom: 8,
  },
  waveform: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: 20,
  },
  waveLine: {
    width: 2,
    height: 12,
    borderRadius: 1,
    opacity: 0.6,
  },
  orb: {
    position: "absolute",
    borderRadius: 50,
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
});

export default FloatingNotification;
