// Equalizer.tsx - FIXED VERSION
import { EQ_BANDS, EQ_PROFILES, usePlayer } from "@/context/PlayerContext";
import { useNetworkStatus } from "@/services/networkService";
import Slider from "@react-native-community/slider";
import { useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BackHandler,
  Dimensions,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// CRITICAL CONSTANTS - DO NOT CHANGE
const SLIDER_HEIGHT = 180; // Total height of slider container
const TRACK_HEIGHT = 140; // Visible track height
const SLIDER_RANGE = 12; // -12 to +12 dB
const THUMB_SIZE = 24; // Thumb diameter

const useAnimatedBandStyle = (sharedValue: Animated.SharedValue<number>) => {
  return useAnimatedStyle(() => {
    const isPositive = sharedValue.value > 0;
    const intensity = Math.abs(sharedValue.value) / SLIDER_RANGE;

    return {
      transform: [{ scale: 1 + intensity * 0.25 }],
      backgroundColor: isPositive
        ? "#00ff88"
        : sharedValue.value < 0
        ? "#ff0088"
        : "#666",
      borderWidth: 2,
      borderColor: isPositive
        ? "#00ffaa"
        : sharedValue.value < 0
        ? "#ff00aa"
        : "#888",
      elevation: 5,
      shadowColor: isPositive ? "#00ff88" : "#ff0088",
      shadowOpacity: 0.7 + intensity * 0.3,
      shadowRadius: 10 + intensity * 6,
    };
  });
};

const Equalizer: React.FC = () => {
  const { eqGains, activeEqProfile, applyEqProfile, updateCustomGain } =
    usePlayer();
  const { isOnline } = useNetworkStatus();
  const router = useRouter();

  const sharedValue1 = useSharedValue(0);
  const sharedValue2 = useSharedValue(0);
  const sharedValue3 = useSharedValue(0);
  const sharedValue4 = useSharedValue(0);
  const sharedValue5 = useSharedValue(0);
  const sharedValue6 = useSharedValue(0);
  const sharedValue7 = useSharedValue(0);
  const sharedValue8 = useSharedValue(0);

  const sharedValues = useMemo(
    () => [
      sharedValue1,
      sharedValue2,
      sharedValue3,
      sharedValue4,
      sharedValue5,
      sharedValue6,
      sharedValue7,
      sharedValue8,
    ],
    [
      sharedValue1,
      sharedValue2,
      sharedValue3,
      sharedValue4,
      sharedValue5,
      sharedValue6,
      sharedValue7,
      sharedValue8,
    ]
  );

  const animatedStyle1 = useAnimatedBandStyle(sharedValue1);
  const animatedStyle2 = useAnimatedBandStyle(sharedValue2);
  const animatedStyle3 = useAnimatedBandStyle(sharedValue3);
  const animatedStyle4 = useAnimatedBandStyle(sharedValue4);
  const animatedStyle5 = useAnimatedBandStyle(sharedValue5);
  const animatedStyle6 = useAnimatedBandStyle(sharedValue6);
  const animatedStyle7 = useAnimatedBandStyle(sharedValue7);
  const animatedStyle8 = useAnimatedBandStyle(sharedValue8);

  const allAnimatedStyles = [
    animatedStyle1,
    animatedStyle2,
    animatedStyle3,
    animatedStyle4,
    animatedStyle5,
    animatedStyle6,
    animatedStyle7,
    animatedStyle8,
  ];

  const bgAnimation = useSharedValue(0);
  const slidingRef = useRef(false);
  const [tempGains, setTempGains] = useState<number[]>(eqGains);

  useEffect(() => {
    if (!slidingRef.current) {
      setTempGains(eqGains);
    }
  }, [eqGains]);

  useEffect(() => {
    bgAnimation.value = withTiming(1, {
      duration: 3000,
      easing: Easing.inOut(Easing.ease),
    });
  }, [bgAnimation]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (!isOnline) {
          router.replace("/(tabs)/downloads");
          return true;
        }
        return false;
      }
    );
    return () => backHandler.remove();
  }, [isOnline, router]);

  useEffect(() => {
    if (slidingRef.current) return;
    const springConfig = { damping: 15, stiffness: 150, mass: 1 };
    eqGains.forEach((gain, index) => {
      sharedValues[index].value = withSpring(gain, springConfig);
    });
  }, [eqGains, sharedValues]);

  const backgroundStyle = useAnimatedStyle(() => ({
    opacity: bgAnimation.value,
    transform: [{ scale: 0.8 + bgAnimation.value * 0.2 }],
  }));

  const selectProfile = useCallback(
    (profile: string) => {
      applyEqProfile(profile);
    },
    [applyEqProfile]
  );

  const handleGainChange = useCallback(
    (index: number, value: number) => {
      updateCustomGain(index, value);
    },
    [updateCustomGain]
  );

  // PERFECT POSITIONING FORMULA
  // Container center is at SLIDER_HEIGHT / 2 = 90px
  // Track spans from 20px to 160px (center at 90px)
  // Value -12 should be at 160px (bottom), +12 at 20px (top), 0 at 90px (center)
  const getThumbPosition = (value: number) => {
    const center = SLIDER_HEIGHT / 2;
    const pixelsPerDb = TRACK_HEIGHT / 2 / SLIDER_RANGE;
    // Negative sign because top = 0, and positive values should go up
    return center - value * pixelsPerDb - THUMB_SIZE / 2;
  };

  // PERFECT ACTIVE TRACK FORMULA
  const getActiveTrackStyle = (value: number) => {
    const center = SLIDER_HEIGHT / 2;
    const pixelsPerDb = TRACK_HEIGHT / 2 / SLIDER_RANGE;
    const height = Math.abs(value) * pixelsPerDb;

    if (value > 0) {
      // Positive: track goes from (center - height) to center
      return {
        height,
        backgroundColor: "#00ff88",
        top: center - height,
      };
    } else if (value < 0) {
      // Negative: track goes from center to (center + height)
      return {
        height,
        backgroundColor: "#ff0088",
        top: center,
      };
    }
    return {
      height: 0,
      backgroundColor: "transparent",
      top: center,
    };
  };

  const renderProfileButton = (profile: string) => {
    const isActive = activeEqProfile === profile;
    const isCustom = profile === "Custom";
    const isSignature = profile === "Signature";

    const displayName =
      profile === "BassBoost"
        ? "BASS"
        : profile === "TrebleBoost"
        ? "TREBLE"
        : profile === "VocalBoost"
        ? "VOCAL"
        : profile === "Custom"
        ? "CUSTOM"
        : profile === "Signature"
        ? "SIGNATURE"
        : profile.toUpperCase();

    return (
      <TouchableOpacity
        key={profile}
        style={[
          styles.profileButton,
          isActive && styles.activeProfileButton,
          isCustom && isActive && styles.customProfileButton,
          isSignature && isActive && styles.signatureProfileButton,
        ]}
        onPress={() => selectProfile(profile)}
        activeOpacity={0.8}
      >
        <Text
          style={[
            styles.profileText,
            isActive && styles.activeProfileText,
            isCustom && isActive && styles.customProfileText,
            isSignature && isActive && styles.signatureProfileText,
          ]}
        >
          {displayName}
        </Text>
        {isSignature && isActive && (
          <View style={styles.signatureBadge} pointerEvents="none">
            <Text style={styles.signatureBadgeText}>++</Text>
          </View>
        )}
        {isActive && (
          <View
            style={[
              styles.activeIndicator,
              isCustom && styles.customActiveIndicator,
              isSignature && styles.signatureActiveIndicator,
            ]}
          />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      <Animated.View style={[styles.backgroundGradient, backgroundStyle]}>
        <View style={styles.orb1} />
        <View style={styles.orb2} />
        <View style={styles.orb3} />
      </Animated.View>

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>SUMAN</Text>
          <Text style={styles.subtitle}>PROFESSIONAL EQ</Text>
          <View style={styles.titleUnderline} />
        </View>

        <View style={styles.profileSection}>
          <Text style={styles.sectionTitle}>PRESETS</Text>
          <View style={styles.profileButtons}>
            {Object.keys(EQ_PROFILES).map(renderProfileButton)}
          </View>
        </View>

        <View style={styles.eqSection}>
          <Text style={styles.sectionTitle}>FREQUENCY BANDS</Text>
          <View style={styles.eqContainer}>
            {EQ_BANDS.map((band, index) => (
              <View key={band.freq} style={styles.band}>
                <Text style={styles.freq}>{band.freq}</Text>

                <View style={styles.sliderWrapper}>
                  {/* Background track - perfectly centered */}
                  <View style={styles.sliderTrack} />

                  {/* Center line at 0 dB - perfectly centered */}
                  <View style={styles.centerLine} />

                  {/* Active colored track - grows from center */}
                  <View
                    style={[
                      styles.activeTrack,
                      getActiveTrackStyle(tempGains[index]),
                    ]}
                  />

                  {/* Invisible slider for touch handling */}
                  <Slider
                    style={styles.slider}
                    minimumValue={-SLIDER_RANGE}
                    maximumValue={SLIDER_RANGE}
                    step={0.1}
                    value={tempGains[index]}
                    minimumTrackTintColor="transparent"
                    maximumTrackTintColor="transparent"
                    thumbTintColor="transparent"
                    onSlidingStart={() => {
                      slidingRef.current = true;
                    }}
                    onValueChange={(value) => {
                      sharedValues[index].value = value;
                      setTempGains((prev) => {
                        const copy = [...prev];
                        copy[index] = value;
                        return copy;
                      });
                    }}
                    onSlidingComplete={(value) => {
                      slidingRef.current = false;
                      handleGainChange(index, value);
                    }}
                  />

                  {/* Animated thumb - perfectly positioned */}
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.thumb,
                      allAnimatedStyles[index],
                      { top: getThumbPosition(tempGains[index]) },
                    ]}
                  />
                </View>

                <View style={styles.valueContainer}>
                  <Text
                    style={[
                      styles.dbText,
                      {
                        color:
                          tempGains[index] > 0
                            ? "#00ff88"
                            : tempGains[index] < 0
                            ? "#ff0088"
                            : "#666",
                        fontWeight: tempGains[index] !== 0 ? "bold" : "normal",
                      },
                    ]}
                  >
                    {tempGains[index] > 0 ? "+" : ""}
                    {tempGains[index].toFixed(1)}
                  </Text>
                  <Text style={styles.dbUnit}>dB</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.statusBar}>
          <View style={styles.statusItem}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>
              ACTIVE PROFILE: {activeEqProfile.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  backgroundGradient: {
    position: "absolute",
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: "#000",
  },
  orb1: {
    position: "absolute",
    top: 100,
    left: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "#ff008850",
    elevation: 5,
    shadowColor: "#ff0088",
    shadowOpacity: 0.5,
    shadowRadius: 50,
  },
  orb2: {
    position: "absolute",
    top: 300,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "#00ff8830",
    elevation: 5,
    shadowColor: "#00ff88",
    shadowOpacity: 0.3,
    shadowRadius: 60,
  },
  orb3: {
    position: "absolute",
    bottom: 200,
    left: 50,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "#0088ff40",
    elevation: 5,
    shadowColor: "#0088ff",
    shadowOpacity: 0.4,
    shadowRadius: 40,
  },
  content: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 20,
    zIndex: 1,
  },
  header: {
    alignItems: "center",
    marginBottom: 30,
  },
  title: {
    color: "#fff",
    fontSize: 42,
    fontWeight: "900",
    letterSpacing: 6,
    fontFamily: "monospace",
    textShadowColor: "#00ff88",
    textShadowRadius: 20,
  },
  subtitle: {
    color: "#888",
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 3,
    marginTop: 5,
    fontFamily: "monospace",
  },
  titleUnderline: {
    width: 100,
    height: 2,
    backgroundColor: "#00ff88",
    marginTop: 10,
    shadowColor: "#00ff88",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
  },
  profileSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    color: "#888",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
    marginBottom: 15,
    textAlign: "center",
    fontFamily: "monospace",
  },
  profileButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: -6,
  },
  profileButton: {
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: "#333",
    minWidth: 72,
    margin: 6,
    alignItems: "center",
    position: "relative",
  },
  customProfileButton: {
    backgroundColor: "rgba(255,136,0,0.1)",
    borderColor: "#ff8800",
  },
  activeProfileButton: {
    backgroundColor: "rgba(0,255,136,0.1)",
    borderColor: "#00ff88",
  },
  profileText: {
    color: "#888",
    fontWeight: "600",
    fontSize: 10,
    fontFamily: "monospace",
    letterSpacing: 1,
  },
  customProfileText: { color: "#ff8800" },
  activeProfileText: { color: "#00ff88", fontWeight: "700" },
  activeIndicator: {
    position: "absolute",
    bottom: -2,
    width: 20,
    height: 2,
    backgroundColor: "#00ff88",
    shadowColor: "#00ff88",
    shadowOpacity: 1,
    shadowRadius: 5,
  },
  customActiveIndicator: {
    backgroundColor: "#ff8800",
    shadowColor: "#ff8800",
  },
  signatureProfileButton: {
    backgroundColor: "rgba(255,0,153,0.08)",
    borderColor: "red",
  },
  signatureProfileText: { color: "red" },
  signatureActiveIndicator: {
    backgroundColor: "red",
    shadowColor: "red",
  },
  signatureBadge: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: "red",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 20,
    elevation: 6,
    shadowColor: "red",
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  signatureBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    fontFamily: "monospace",
    lineHeight: 12,
  },
  eqSection: { flex: 1 },
  eqContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-start",
    paddingHorizontal: 5,
    flex: 1,
  },
  band: {
    alignItems: "center",
    flex: 1,
  },
  freq: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 15,
    fontFamily: "monospace",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  // CRITICAL: All sliders MUST have exact same dimensions and positioning
  sliderWrapper: {
    position: "relative",
    height: SLIDER_HEIGHT, // 180px - same for all
    width: 50, // 50px - same for all
    alignItems: "center",
    justifyContent: "center",
  },
  sliderTrack: {
    position: "absolute",
    width: 4,
    height: TRACK_HEIGHT, // 140px
    backgroundColor: "#1a1a1a",
    borderRadius: 2,
    top: (SLIDER_HEIGHT - TRACK_HEIGHT) / 2, // 20px - perfectly centered
  },
  centerLine: {
    position: "absolute",
    width: 16,
    height: 2,
    backgroundColor: "#555",
    top: SLIDER_HEIGHT / 2, // 90px - exact center
    zIndex: 2,
  },
  activeTrack: {
    position: "absolute",
    width: 4,
    borderRadius: 2,
    zIndex: 1,
  },
  slider: {
    position: "absolute",
    // Make the interactive slider width match the visible track length so
    // touch events map correctly to the thumb positions after rotating.
    width: TRACK_HEIGHT,
    height: 50,
    transform: [{ rotate: "-90deg" }],
    // Center the rotated slider's touch area over the visual track
    top: (SLIDER_HEIGHT - 50) / 2,
    left: (50 - TRACK_HEIGHT) / 2,
    zIndex: 10,
  },
  thumb: {
    position: "absolute",
    width: THUMB_SIZE, // 24px
    height: THUMB_SIZE, // 24px
    borderRadius: THUMB_SIZE / 2, // 12px - perfect circle
    backgroundColor: "#00ff88",
    zIndex: 5,
  },
  valueContainer: {
    alignItems: "center",
    marginTop: 12,
    minHeight: 40,
  },
  dbText: {
    fontSize: 13,
    fontFamily: "monospace",
    fontWeight: "bold",
  },
  dbUnit: {
    color: "#555",
    fontSize: 10,
    fontFamily: "monospace",
    marginTop: 2,
  },
  statusBar: {
    paddingVertical: 15,
    alignItems: "center",
  },
  statusItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#00ff88",
    marginRight: 10,
    shadowColor: "#00ff88",
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  statusText: {
    color: "#888",
    fontSize: 11,
    fontFamily: "monospace",
    letterSpacing: 1,
  },
});

export default Equalizer;
