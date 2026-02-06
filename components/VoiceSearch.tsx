import FontAwesome from "@expo/vector-icons/FontAwesome";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { ExpoSpeechRecognitionModule } from "expo-speech-recognition";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity
} from "react-native";

const { width, height } = Dimensions.get("window");

interface VoiceSearchProps {
  onSearchResult: (text: string) => void;
  colors: any;
  isVisible: boolean;
  onClose: () => void;
}

export const VoiceSearch: React.FC<VoiceSearchProps> = ({
  onSearchResult,
  colors,
  isVisible,
  onClose,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");

  // Logic Refs
  const isProcessingResult = useRef(false); // Prevents race conditions
  const restartTimeoutRef = useRef<any>(null);

  // Animation Refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const topGlow = useRef(new Animated.Value(0)).current;
  const rightGlow = useRef(new Animated.Value(0)).current;
  const bottomGlow = useRef(new Animated.Value(0)).current;
  const leftGlow = useRef(new Animated.Value(0)).current;
  const flowX = useRef(new Animated.Value(0)).current;
  const flowY = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const colorTransition = useRef(new Animated.Value(0)).current;
  const colorAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const [activeColorIndex, setActiveColorIndex] = useState(0);
  const [nextColorIndex, setNextColorIndex] = useState(1);

  // --- CORE LOGIC: Manage Listeners and Lifecycle ---
  useEffect(() => {
    if (!isVisible) return;

    // Reset state on open
    setTranscript("");
    setInterimTranscript("");
    isProcessingResult.current = false;

    // 1. Register Listeners Manually (Guarantees 1 set of listeners)
    const startListener = ExpoSpeechRecognitionModule.addListener("start", () => {
      console.log("DEBUG: Speech Started");
      setIsListening(true);
    });

    const endListener = ExpoSpeechRecognitionModule.addListener("end", () => {
      console.log("DEBUG: Speech Ended");
      setIsListening(false);

      // Auto-restart only if we haven't found a result yet
      if (!isProcessingResult.current && isVisible) {
        restartTimeoutRef.current = setTimeout(() => {
          startRecognition();
        }, 500);
      }
    });

    const resultListener = ExpoSpeechRecognitionModule.addListener("result", (event) => {
      if (isProcessingResult.current) return; // Ignore trailing results

      if (event.results && event.results.length > 0) {
        const lastResult = event.results[event.results.length - 1];
        const text = lastResult?.transcript || "";

        if (event.isFinal && text.trim()) {
          console.log("DEBUG: Final Result:", text);

          // 1. Lock logic so error/end events don't interfere
          isProcessingResult.current = true;

          // 2. Update UI
          setTranscript(text);
          setInterimTranscript("");

          // 3. Stop Native Module safely
          ExpoSpeechRecognitionModule.stop();

          // 4. Animation & Callback
          Animated.parallel([
            Animated.timing(scaleAnim, { toValue: 1.2, duration: 200, useNativeDriver: false }),
            Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: false }),
          ]).start(() => {
            onSearchResult(text);
          });
        } else {
          setInterimTranscript(text);
        }
      }
    });

    const errorListener = ExpoSpeechRecognitionModule.addListener("error", (event) => {
      // Ignore "client" errors if we already have a result (common race condition)
      if (isProcessingResult.current) return;

      console.log("DEBUG: Speech Error:", event.error);
      setIsListening(false);

      const ignorableErrors = ["no-speech", "audio-capture", "aborted", "not-allowed", "client"];

      if (ignorableErrors.includes(event.error) && isVisible) {
        // Soft restart
        restartTimeoutRef.current = setTimeout(() => {
          startRecognition();
        }, 1000);
      }
    });

    // 2. Start Listening
    startRecognition();

    // 3. Cleanup Function (Runs when modal closes)
    return () => {
      console.log("DEBUG: Cleanup Voice Search");
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);

      // Remove all listeners to prevent "3x logs"
      startListener.remove();
      endListener.remove();
      resultListener.remove();
      errorListener.remove();

      // Force stop
      ExpoSpeechRecognitionModule.stop();

      // Reset Animations
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.8);
    };
  }, [isVisible]); // Only re-run if visibility changes

  const startRecognition = async () => {
    if (isProcessingResult.current) return;

    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission needed", "Please allow microphone access.");
        return;
      }

      // Prevent starting if already started
      await ExpoSpeechRecognitionModule.stop();

      await ExpoSpeechRecognitionModule.start({
        lang: "en-US",
        interimResults: true,
        maxAlternatives: 1,
        continuous: true,
        requiresOnDeviceRecognition: false,
        addsPunctuation: true,
      });
    } catch (error) {
      console.warn("Start error (safe to ignore usually):", error);
    }
  };

  // --- ANIMATIONS (Apple Intelligence Style) ---
  useEffect(() => {
    if (!isVisible) return;

    // Entrance
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 40,
        friction: 8,
        useNativeDriver: false,
      }),
    ]).start();

    // Color Cycling
    let isMounted = true;
    const runColorCycle = () => {
      if (!isMounted || !isVisible) return;
      colorTransition.setValue(0);
      colorAnimRef.current = Animated.timing(colorTransition, {
        toValue: 1,
        duration: 12000,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      });
      colorAnimRef.current.start(({ finished }) => {
        if (finished && isMounted) {
          setActiveColorIndex((prev) => {
            const newActive = nextColorIndex;
            setNextColorIndex((newActive + 1) % 5);
            return newActive;
          });
          runColorCycle();
        }
      });
    };
    runColorCycle();

    // Flow Animations
    const animateEdge = (edge: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(edge, { toValue: 1, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
          Animated.timing(edge, { toValue: 0, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        ])
      ).start();
    };
    animateEdge(topGlow, 0);
    animateEdge(rightGlow, 750);
    animateEdge(bottomGlow, 1500);
    animateEdge(leftGlow, 2250);

    const loopAnim = (anim: Animated.Value, duration: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration: duration, easing: Easing.bezier(0.45, 0.05, 0.55, 0.95), useNativeDriver: false }),
          Animated.timing(anim, { toValue: 0, duration: duration, easing: Easing.bezier(0.45, 0.05, 0.55, 0.95), useNativeDriver: false }),
        ])
      ).start();
    };
    loopAnim(flowX, 8000);
    loopAnim(flowY, 10000);

    Animated.loop(
      Animated.timing(rotate, { toValue: 1, duration: 20000, easing: Easing.linear, useNativeDriver: false })
    ).start();

    return () => {
      isMounted = false;
      if (colorAnimRef.current) colorAnimRef.current.stop();
    };
  }, [isVisible]);

  if (!isVisible) return null;

  const colorThemes = [
    ["#FF6B9D", "#C084FC", "#60A5FA"],
    ["#F59E0B", "#EC4899", "#8B5CF6"],
    ["#10B981", "#06B6D4", "#3B82F6"],
    ["#EF4444", "#F59E0B", "#FBBF24"],
    ["#8B5CF6", "#EC4899", "#F43F5E"],
  ];
  const currentTheme = colorThemes[activeColorIndex];
  const nextTheme = colorThemes[nextColorIndex];

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject}>
        <Animated.View
          style={[
            styles.backgroundLayer,
            {
              transform: [
                { translateX: flowX.interpolate({ inputRange: [0, 1], outputRange: [0, width * 0.35] }) },
                { translateY: flowY.interpolate({ inputRange: [0, 1], outputRange: [0, height * 0.35] }) },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={[currentTheme[0] + "DD", currentTheme[1] + "BB", currentTheme[2] + "DD", currentTheme[0] + "BB"]}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.backgroundLayer,
            {
              opacity: colorTransition,
              transform: [
                { translateX: flowY.interpolate({ inputRange: [0, 1], outputRange: [width * 0.1, -width * 0.1] }) },
                { translateY: flowX.interpolate({ inputRange: [0, 1], outputRange: [-height * 0.1, height * 0.1] }) },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={[nextTheme[0] + "CC", nextTheme[1] + "99", nextTheme[2] + "CC"]}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
          />
        </Animated.View>
      </BlurView>

      <TouchableOpacity
        style={styles.closeButton}
        onPress={() => {
          isProcessingResult.current = true; // Lock execution
          ExpoSpeechRecognitionModule.stop();
          onClose();
        }}
      >
        <FontAwesome name="times" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      <Animated.View style={[styles.contentContainer, { transform: [{ scale: scaleAnim }] }]}>
        {(transcript || interimTranscript) ? (
          <Animated.View style={[styles.transcriptContainer, { borderColor: currentTheme[1] }]}>
            <Text style={styles.transcriptText}>{transcript || interimTranscript}</Text>
          </Animated.View>
        ) : (
          <Text style={styles.hintText}>{isListening ? "Listening..." : "Speak now"}</Text>
        )}
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1001,
    backgroundColor: "transparent",
  },
  backgroundLayer: {
    position: "absolute",
    top: -height * 0.5,
    left: -width * 0.5,
    width: width * 2,
    height: height * 2,
  },
  closeButton: {
    position: "absolute",
    top: 60,
    right: 24,
    padding: 12,
    zIndex: 1002,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 24,
  },
  contentContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    zIndex: 1001,
  },
  transcriptContainer: {
    padding: 28,
    borderRadius: 28,
    minWidth: width * 0.75,
    maxWidth: width * 0.9,
    borderWidth: 2,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  transcriptText: {
    fontSize: 24,
    textAlign: "center",
    fontWeight: "600",
    lineHeight: 36,
    color: "#FFFFFF",
  },
  hintText: {
    fontSize: 20,
    textAlign: "center",
    fontWeight: "600",
    color: "#FFFFFF",
  },
});