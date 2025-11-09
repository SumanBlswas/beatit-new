// app/_layout.tsx
import { FontAwesome } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Tabs, usePathname } from "expo-router";
import { useEffect } from "react";
import { Dimensions, Pressable, StyleSheet, View, ViewStyle } from "react-native";
import Animated, {
  Easing,
  Extrapolate,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const { width, height } = Dimensions.get("window");

// 🌊 Individual Particle Component
const Particle = ({ index }: { index: number }) => {
  const x = useSharedValue(Math.random() * width);
  const y = useSharedValue(height + Math.random() * 200);
  const opacity = useSharedValue(0.3 + Math.random() * 0.7);
  const scale = useSharedValue(0.5 + Math.random() * 1.5);

  useEffect(() => {
    const animate = () => {
      x.value = withRepeat(
        withTiming(Math.random() * width, {
          duration: 3000 + Math.random() * 4000,
          easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
        }),
        -1,
        true
      );

      y.value = withRepeat(
        withSequence(
          withTiming(-100, {
            duration: 8000 + Math.random() * 4000,
            easing: Easing.out(Easing.cubic),
          }),
          withTiming(height + 200, { duration: 0 })
        ),
        -1,
        false
      );

      opacity.value = withRepeat(
        withSequence(
          withTiming(0.8, { duration: 2000 }),
          withTiming(0.1, { duration: 3000 })
        ),
        -1,
        true
      );

      const initialScale = scale.value;
      scale.value = withRepeat(
        withTiming(initialScale > 1 ? 0.3 : 2, {
          duration: 4000 + Math.random() * 2000,
        }),
        -1,
        true
      );
    };

    const delay = Math.random() * 2000;
    const timeoutId = setTimeout(animate, delay);

    return () => clearTimeout(timeoutId);
  }, []);

  const particleStyle = useAnimatedStyle(() => ({
    position: "absolute",
    left: x.value,
    top: y.value,
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return <Animated.View style={[styles.particle, particleStyle]} />;
};

// 🌊 Fluid Particle System
const ParticleSystem = () => {
  const particles = Array.from({ length: 12 }, (_, i) => (
    <Particle key={i} index={i} />
  ));

  return <View style={styles.particleContainer}>{particles}</View>;
};

// 🔥 Hyper-Dynamic Tab Icon
const TabIcon = ({ color, focused, name }: any) => {
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);
  const glowIntensity = useSharedValue(0);
  const morphScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0);
  const pressScale = useSharedValue(1);
  const rippleScale = useSharedValue(0);
  const rippleOpacity = useSharedValue(0);

  // 🌀 Continuous micro-animations
  useEffect(() => {
    // Breathing effect
    const breathingAnimation = () => {
      morphScale.value = withSequence(
        withTiming(1.05, {
          duration: 1500,
          easing: Easing.bezier(0.4, 0, 0.6, 1),
        }),
        withTiming(0.98, {
          duration: 1200,
          easing: Easing.bezier(0.4, 0, 0.6, 1),
        }),
        withTiming(1, {
          duration: 800,
          easing: Easing.bezier(0.4, 0, 0.6, 1),
        })
      );
    };

    // Start breathing animation with repeat
    morphScale.value = withRepeat(
      withSequence(
        withTiming(1.05, {
          duration: 1500,
          easing: Easing.bezier(0.4, 0, 0.6, 1),
        }),
        withTiming(0.98, {
          duration: 1200,
          easing: Easing.bezier(0.4, 0, 0.6, 1),
        }),
        withTiming(1, {
          duration: 800,
          easing: Easing.bezier(0.4, 0, 0.6, 1),
        })
      ),
      -1,
      false
    );

    // Subtle rotation pulse
    rotation.value = withRepeat(
      withSequence(
        withTiming(3, { duration: 2000 }),
        withTiming(-2, { duration: 1800 }),
        withTiming(0, { duration: 1000 })
      ),
      -1,
      false
    );
  }, []);

  // 💥 Focus activation sequence
  useEffect(() => {
    if (focused) {
      scale.value = withSequence(
        withTiming(1.4, { duration: 200, easing: Easing.out(Easing.back(2)) }),
        withSpring(1.25, { damping: 8, stiffness: 100 })
      );

      glowIntensity.value = withTiming(1, { duration: 300 });

      // Explosion pulse
      pulseOpacity.value = withSequence(
        withTiming(1, { duration: 150 }),
        withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) })
      );

      // Celebration spin - fixed to avoid chaining with current value
      rotation.value = withTiming(360, {
        duration: 800,
        easing: Easing.out(Easing.back(1.5)),
      });
    } else {
      scale.value = withSpring(1, { damping: 12, stiffness: 150 });
      glowIntensity.value = withTiming(0, { duration: 400 });
    }
  }, [focused]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value * morphScale.value * pressScale.value as never },
      { rotate: `${rotation.value}deg` as never },
    ] as const,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowIntensity.value,
    transform: [{ scale: interpolate(glowIntensity.value, [0, 1], [0.5, 2]) }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
    transform: [{ scale: interpolate(pulseOpacity.value, [0, 1], [1, 3]) }],
  }));

  const rippleStyle = useAnimatedStyle(() => ({
    opacity: rippleOpacity.value,
    transform: [{ scale: rippleScale.value }],
  }));

  return (
    <Animated.View style={styles.iconContainer}>
      {/* Click ripple effect */}
      <Animated.View style={[styles.rippleEffect, rippleStyle]} />

      {/* Explosion pulse ring */}
      <Animated.View style={[styles.pulseRing, pulseStyle]} />

      {/* Main glow */}
      <Animated.View style={[styles.iconGlow, glowStyle]} />

      {/* Icon */}
      <Animated.View style={[styles.iconWrapper, iconStyle]}>
        <FontAwesome
          name={name}
          size={28}
          color={focused ? "#fff" : color}
          style={{
            textShadowColor: focused ? "#ff0066" : "transparent",
            textShadowRadius: 10,
          }}
        />
      </Animated.View>
    </Animated.View>
  );
};

// 🌈 Dynamic Color Waves
const ColorWaves = () => {
  const wave1 = useSharedValue(0);
  const wave2 = useSharedValue(0);
  const wave3 = useSharedValue(0);

  useEffect(() => {
    wave1.value = withRepeat(
      withTiming(width * 2, { duration: 12000, easing: Easing.linear }),
      -1,
      false
    );

    wave2.value = withRepeat(
      withTiming(-width * 1.5, { duration: 15000, easing: Easing.linear }),
      -1,
      false
    );

    wave3.value = withRepeat(
      withTiming(width * 3, { duration: 18000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const wave1Style = useAnimatedStyle(() => ({
    transform: [{ translateX: wave1.value }],
  }));

  const wave2Style = useAnimatedStyle(() => ({
    transform: [{ translateX: wave2.value }],
  }));

  const wave3Style = useAnimatedStyle(() => ({
    transform: [{ translateX: wave3.value }],
  }));

  const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient);

  return (
    <>
      <AnimatedGradient
        colors={["#ff006650", "#ff990030", "#00ff9950", "#ff006650"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.wave, wave1Style, { bottom: 0 }]}
      />
      <AnimatedGradient
        colors={["#9900ff40", "#ff006640", "#00ccff40", "#9900ff40"]}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
        style={[styles.wave, wave2Style, { bottom: 20 }]}
      />
      <AnimatedGradient
        colors={["#00ff9930", "#ff660030", "#0066ff30", "#00ff9930"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[styles.wave, wave3Style, { bottom: 40 }]}
      />
    </>
  );
};

// Add this hook at the top of the file after imports
const useTabBarVisibility = () => {
  const pathname = usePathname();
  return {
    isVisible: pathname !== "/player",
  };
};

// 🎭 Morphing Tab Bar
const MorphingTabBar = () => {
  const morphProgress = useSharedValue(0);
  const breatheScale = useSharedValue(1);
  const { isVisible } = useTabBarVisibility();

  const morphStyle = useAnimatedStyle(() => {
    const borderRadius = interpolate(
      morphProgress.value,
      [0, 0.5, 1],
      [40, 25, 40],
      Extrapolate.CLAMP
    );

    const scaleX = interpolate(
      morphProgress.value,
      [0, 0.3, 0.7, 1],
      [1, 1.05, 0.95, 1],
      Extrapolate.CLAMP
    );

    return {
      borderRadius,
      transform: [
        { scaleX: scaleX * breatheScale.value },
        { scaleY: breatheScale.value },
      ],
    };
  });

  useEffect(() => {
    if (!isVisible) return;

    morphProgress.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: 4000,
          easing: Easing.bezier(0.4, 0, 0.6, 1),
        }),
        withTiming(0, { duration: 3500, easing: Easing.bezier(0.4, 0, 0.6, 1) })
      ),
      -1,
      false
    );

    breatheScale.value = withRepeat(
      withSequence(
        withTiming(1.02, {
          duration: 2500,
          easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
        }),
        withTiming(0.98, {
          duration: 2000,
          easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
        }),
        withTiming(1, {
          duration: 1500,
          easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
        })
      ),
      -1,
      false
    );
  }, [isVisible, morphProgress, breatheScale]);

  if (!isVisible) {
    return null;
  }

  return (
    <Animated.View style={[styles.tabWrapper as ViewStyle, morphStyle]}>
      <BlurView intensity={90} tint="dark" style={styles.blurGlass as ViewStyle}>
        <LinearGradient
          colors={["rgba(255, 255, 255, 0.1)", "rgba(255, 255, 255, 0.02)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.glassOverlay}
        />
      </BlurView>
    </Animated.View>
  );
};

export default function AppLayout() {
  const { isVisible } = useTabBarVisibility();

  // Create styles within the component
  const dynamicStyles = StyleSheet.create({
    tabBar: {
      position: "absolute",
      bottom: 30,
      left: 20,
      right: 20,
      height: 85,
      borderRadius: 40,
      backgroundColor: "transparent",
      borderTopWidth: 0,
      elevation: 1,
      zIndex: 1, // Lower z-index
      // display: isVisible ? "flex" : "none",
      width: "20%"
    },
    tabWrapper: {
      position: "absolute",
      bottom: 40,
      left: 20,
      right: 20,
      height: 75,
      borderRadius: 40,
      backgroundColor: "rgb(255, 0, 102)",
      overflow: "hidden",
      zIndex: 0, // Lower z-index
      shadowColor: "#ff0066",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.3,
      shadowRadius: 25,
      elevation: 8888,
      display: isVisible ? "flex" : "none",
    },
  });

  return (
    <View style={styles.container}>
      {/* 🌊 Particle Background */}
      <ParticleSystem />

      {/* 🌈 Dynamic Color Waves */}
      <ColorWaves />

      {/* 🎭 Morphing Tab Bar Container */}
      <MorphingTabBar />

      {/* 🚀 Enhanced Tabs */}
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarStyle: dynamicStyles.tabBar,
          tabBarActiveTintColor: "#fff",
          tabBarInactiveTintColor: "#fff",
          tabBarItemStyle: {
            borderRadius: 40,
            paddingVertical: 10,
            paddingHorizontal: 20,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            // tabBarIcon: (props) => <TabIcon {...props} name="fire" />,
            tabBarButton: (props: any) => (
              <Pressable {...props} android_ripple={null} />
            ),
            tabBarStyle: { display: "none" },
          }}
        />

        <Tabs.Screen
          name="eq"
          options={{
            title: "Equalizer",
            // tabBarStyle: { display: "none" },
            // tabBarIcon: ({ color }) => (
            //   <FontAwesome name="sliders" size={24} color={color} />
            // ),
            tabBarButton: () => null,
            tabBarHideOnKeyboard: true,
          }}
        />

        <Tabs.Screen
          name="player"
          options={{
            tabBarStyle: { display: "none" },
            tabBarButton: () => null,
            // Add this to hide the morphing tab wrapper as well
            tabBarHideOnKeyboard: true,
            // tabBarVisible: false
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },

  // 🌊 Particle System
  particleContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: "none",
  },
  particle: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#ff0066",
    shadowColor: "#ff0066",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },

  // 🌈 Color Waves
  wave: {
    position: "absolute",
    width: width * 3,
    height: 120,
    left: -width,
  },

  // 🎭 Tab Bar
  tabBar: {
    position: "absolute",
    bottom: 30,
    left: 20,
    right: 20,
    height: 85,
    borderRadius: 40,
    backgroundColor: "transparent",
    borderTopWidth: 0,
    elevation: 88888,
    zIndex: 1, // Lower z-index
    // width: "40%"
  },
  tabWrapper: {
    position: "absolute",
    bottom: 40,
    left: 20,
    right: 20,
    height: 75,
    borderRadius: 40,
    backgroundColor: "rgb(255, 0, 102)",
    overflow: "hidden",
    zIndex: 0, // Lower z-index
    shadowColor: "#ff0066",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 25,
    elevation: 9999,
    // display: "none"
    // width: "40%"
  },
  blurGlass: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  glassOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  // 🔥 Enhanced Icons
  iconContainer: {
    justifyContent: "center",
    alignItems: "center",
    width: 70,
    height: 70,
    position: "relative",
    left: 35
  },
  iconWrapper: {
    justifyContent: "center",
    alignItems: "center",
    width: 50,
    height: 50,
    borderRadius: 25,
    zIndex: 3,
  },
  iconGlow: {
    position: "absolute",
    width: 40,
    height: 40,
    borderRadius: 40,
    backgroundColor: "#ff0066",
    zIndex: 1,
    shadowColor: "#ff0066",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 30,
  },
  pulseRing: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: "#ff0066",
    zIndex: 0,
  },
  rippleEffect: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255, 0, 102, 0.3)",
    zIndex: 0,
  },
});
