// Equalizer.tsx
import Slider from "@react-native-community/slider";
import React, { useCallback, useEffect } from "react";
import {
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
// Import the shared constants and the hook with our new functions
import { EQ_BANDS, EQ_PROFILES, usePlayer } from "@/context/PlayerContext";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// This animated hook can remain here as it's purely for UI styling
const useAnimatedBandStyle = (sharedValue: Animated.SharedValue<number>) => {
  return useAnimatedStyle(() => {
    const isPositive = sharedValue.value > 0;
    const intensity = Math.abs(sharedValue.value) / 12;

    return {
      transform: [{ scale: 1 + intensity * 0.3 }],
      backgroundColor: isPositive
        ? "#00ff88"
        : sharedValue.value < 0
        ? "#ff0088"
        : "#888",
      borderWidth: 2,
      borderColor: isPositive
        ? "#00ffaa"
        : sharedValue.value < 0
        ? "#ff00aa"
        : "#aaa",
      elevation: 5,
      shadowColor: isPositive ? "#00ff88" : "#ff0088",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8 + intensity * 0.2,
      shadowRadius: 12 + intensity * 8,
    };
  });
};

const Equalizer: React.FC = () => {
  // Get everything from the context. No more local state for EQ!
  const { eqGains, activeEqProfile, applyEqProfile, updateCustomGain } =
    usePlayer();

  // This section for creating animated values is correct
  const sharedValue1 = useSharedValue(0);
  const sharedValue2 = useSharedValue(0);
  const sharedValue3 = useSharedValue(0);
  const sharedValue4 = useSharedValue(0);
  const sharedValue5 = useSharedValue(0);
  const sharedValue6 = useSharedValue(0);
  const sharedValue7 = useSharedValue(0);
  const sharedValue8 = useSharedValue(0);

  const sharedValues = [
    sharedValue1,
    sharedValue2,
    sharedValue3,
    sharedValue4,
    sharedValue5,
    sharedValue6,
    sharedValue7,
    sharedValue8,
  ];

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

  useEffect(() => {
    bgAnimation.value = withTiming(1, {
      duration: 3000,
      easing: Easing.inOut(Easing.ease),
    });
  }, [bgAnimation]);

  // This effect correctly syncs the animations with the context state
  useEffect(() => {
    const springConfig = { damping: 15, stiffness: 150, mass: 1 };
    eqGains.forEach((gain, index) => {
      sharedValues[index].value = withSpring(gain, springConfig);
    });
  }, [eqGains, sharedValues]);

  const backgroundStyle = useAnimatedStyle(() => ({
    opacity: bgAnimation.value,
    transform: [{ scale: 0.8 + bgAnimation.value * 0.2 }],
  }));

  // SIMPLIFIED: Profile selection function now just calls the context
  const selectProfile = useCallback(
    (profile: string) => {
      applyEqProfile(profile);
    },
    [applyEqProfile]
  );

  // SIMPLIFIED: Gain change handler now just calls the context
  const handleGainChange = useCallback(
    (index: number, value: number) => {
      updateCustomGain(index, value);
    },
    [updateCustomGain]
  );

  // The rest of the component is for rendering and needs no changes.
  const renderProfileButton = (profile: string) => {
    const isActive = activeEqProfile === profile;
    const isCustom = profile === "Custom";

    const displayName =
      profile === "BassBoost"
        ? "BASS"
        : profile === "TrebleBoost"
        ? "TREBLE"
        : profile === "VocalBoost"
        ? "VOCAL"
        : profile === "Custom"
        ? "CUSTOM"
        : profile.toUpperCase();

    return (
      <TouchableOpacity
        key={profile}
        style={[
          styles.profileButton,
          isActive && styles.activeProfileButton,
          isCustom && isActive && styles.customProfileButton,
        ]}
        onPress={() => selectProfile(profile)}
        activeOpacity={0.8}
      >
        <Text
          style={[
            styles.profileText,
            isActive && styles.activeProfileText,
            isCustom && isActive && styles.customProfileText,
          ]}
        >
          {displayName}
        </Text>
        {isActive && (
          <View
            style={[
              styles.activeIndicator,
              isCustom && styles.customActiveIndicator,
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

                <View style={styles.sliderContainer}>
                  <View style={styles.sliderTrack} />
                  <View style={styles.centerLine} />

                  <View
                    style={[
                      styles.activeTrack,
                      {
                        height: (Math.abs(eqGains[index]) / 12) * 75,
                        backgroundColor:
                          eqGains[index] > 0
                            ? "#00ff88"
                            : eqGains[index] < 0
                            ? "#ff0088"
                            : "transparent",
                        bottom:
                          eqGains[index] >= 0
                            ? 75
                            : 75 - (Math.abs(eqGains[index]) / 12) * 75,
                      },
                    ]}
                  />

                  <Slider
                    style={[styles.slider, { left: -55 }]}
                    minimumValue={-12}
                    maximumValue={12}
                    step={0.1}
                    value={eqGains[index]}
                    minimumTrackTintColor="transparent"
                    maximumTrackTintColor="transparent"
                    thumbTintColor="transparent"
                    onValueChange={(value) => handleGainChange(index, value)}
                  />

                  <Animated.View
                    style={[
                      styles.thumb,
                      allAnimatedStyles[index],
                      {
                        bottom: 67.5 + (eqGains[index] / 12) * 75,
                      },
                    ]}
                  />
                </View>

                <View style={styles.valueContainer}>
                  <Text
                    style={[
                      styles.dbText,
                      {
                        color:
                          eqGains[index] > 0
                            ? "#00ff88"
                            : eqGains[index] < 0
                            ? "#ff0088"
                            : "#888",
                        fontWeight: eqGains[index] !== 0 ? "bold" : "normal",
                      },
                    ]}
                  >
                    {eqGains[index] > 0 ? "+" : ""}
                    {eqGains[index].toFixed(1)}
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

// Styles (No changes needed)
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
    shadowOffset: { width: 0, height: 0 },
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
    shadowOffset: { width: 0, height: 0 },
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
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 40,
  },
  content: { flex: 1, paddingTop: 60, paddingHorizontal: 20, zIndex: 1 },
  header: { alignItems: "center", marginBottom: 30 },
  title: {
    color: "#fff",
    fontSize: 42,
    fontWeight: "900",
    letterSpacing: 6,
    fontFamily: "monospace",
    textShadowColor: "#00ff88",
    textShadowOffset: { width: 0, height: 0 },
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
  profileSection: { marginBottom: 30 },
  sectionTitle: {
    color: "#888",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
    marginBottom: 15,
    textAlign: "center",
    fontFamily: "monospace",
  },
  profileButtons: { flexDirection: "row", justifyContent: "space-between" },
  profileButton: {
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: "#333",
    minWidth: 70,
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
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 5,
  },
  customActiveIndicator: { backgroundColor: "#ff8800", shadowColor: "#ff8800" },
  eqSection: { flex: 1 },
  eqContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    flex: 1,
  },
  band: { alignItems: "center", flex: 1, marginHorizontal: 2 },
  freq: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 20,
    fontFamily: "monospace",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  sliderContainer: {
    position: "relative",
    height: 200,
    width: 40,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 5,
  },
  sliderTrack: {
    position: "absolute",
    width: 4,
    height: 150,
    backgroundColor: "#222",
    borderRadius: 2,
  },
  centerLine: {
    position: "absolute",
    width: 12,
    height: 2,
    backgroundColor: "#444",
    top: 75,
  },
  activeTrack: { position: "absolute", width: 4, borderRadius: 2 },
  slider: {
    position: "absolute",
    width: 150,
    height: 40,
    transform: [{ rotate: "-90deg" }],
    zIndex: 1,
    opacity: 0,
  },
  thumb: {
    position: "absolute",
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#00ff88",
    zIndex: 0,
    pointerEvents: "none",
  },
  valueContainer: { alignItems: "center", marginTop: 15, minHeight: 35 },
  dbText: { fontSize: 12, fontFamily: "monospace", fontWeight: "bold" },
  dbUnit: {
    color: "#666",
    fontSize: 10,
    fontFamily: "monospace",
    marginTop: 2,
  },
  statusBar: { paddingVertical: 15, alignItems: "center" },
  statusItem: { flexDirection: "row", alignItems: "center" },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#00ff88",
    marginRight: 10,
    shadowColor: "#00ff88",
    shadowOffset: { width: 0, height: 0 },
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
