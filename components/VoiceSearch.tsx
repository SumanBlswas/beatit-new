import FontAwesome from "@expo/vector-icons/FontAwesome";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import {
    ExpoSpeechRecognitionModule,
    useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import React, { useEffect, useRef, useState } from "react";
import {
    Alert,
    Animated,
    Dimensions,
    Easing,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
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
  const [shouldKeepListening, setShouldKeepListening] = useState(true);

  // Animation values - Apple Intelligence style
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  // Edge glow animations - flow around screen borders
  const topGlow = useRef(new Animated.Value(0)).current;
  const rightGlow = useRef(new Animated.Value(0)).current;
  const bottomGlow = useRef(new Animated.Value(0)).current;
  const leftGlow = useRef(new Animated.Value(0)).current;

  // Position animations for flowing effect
  const flowX = useRef(new Animated.Value(0)).current;
  const flowY = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  // Color cycling - smooth crossfade between themes
  const [activeColorIndex, setActiveColorIndex] = useState(0);
  const [nextColorIndex, setNextColorIndex] = useState(1);
  const colorTransition = useRef(new Animated.Value(0)).current;
  const colorAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const recognitionRef = useRef<any>(null);
  const restartTimeoutRef = useRef<any>(null);

  // Handle speech recognition results
  useSpeechRecognitionEvent("result", (event) => {
    console.log("Speech result received:", event);
    if (event.results && event.results.length > 0) {
      const lastResult = event.results[event.results.length - 1];
      const transcriptText = lastResult?.transcript || "";

      console.log("Transcript:", transcriptText, "isFinal:", event.isFinal);

      // Check if this is a final result (event.isFinal property)
      if (event.isFinal) {
        setTranscript(transcriptText);
        setInterimTranscript("");
        if (transcriptText.trim()) {
          // Stop listening first, then animate and send results
          setShouldKeepListening(false);
          stopListening();
          
          // Animate out before closing
          Animated.parallel([
            Animated.timing(scaleAnim, {
              toValue: 1.2,
              duration: 200,
              useNativeDriver: false,
            }),
            Animated.timing(fadeAnim, {
              toValue: 0,
              duration: 300,
              useNativeDriver: false,
            }),
          ]).start(() => {
            onSearchResult(transcriptText);
          });
        }
      } else {
        setInterimTranscript(transcriptText);
      }
    }
  });

  // Handle start event
  useSpeechRecognitionEvent("start", () => {
    console.log("Speech recognition started successfully");
    setIsListening(true);
  });

  // Handle end event - auto-restart if user wants to continue
  useSpeechRecognitionEvent("end", () => {
    console.log("Speech recognition ended");

    // If still visible and should keep listening, restart after brief pause
    if (shouldKeepListening && isVisible) {
      restartTimeoutRef.current = setTimeout(() => {
        console.log("Auto-restarting speech recognition...");
        startListening();
      }, 1000); // 1 second pause before restart
    } else {
      setIsListening(false);
    }
  });

  // Handle error event - gracefully handle "no-speech" and auto-restart
  useSpeechRecognitionEvent("error", (event) => {
    console.error("Speech recognition error:", event.error);

    // Don't show error for common issues like silence, aborted, or not-allowed
    if (
      event.error === "no-speech" ||
      event.error === "audio-capture" ||
      event.error === "aborted" ||
      event.error === "not-allowed"
    ) {
      // Just restart if still active
      if (shouldKeepListening && isVisible) {
        restartTimeoutRef.current = setTimeout(() => {
          startListening();
        }, 1500);
      } else {
        setIsListening(false);
      }
    } else {
      // For other errors, just log and stop - no alert popup
      setIsListening(false);
      console.warn("Voice recognition stopped due to error:", event.error);
    }
  }); // Initialize Web Speech API for web platform
  useEffect(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = "en-US";

        recognitionRef.current.onresult = (event: any) => {
          let interim = "";
          let final = "";

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcriptPart = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              final += transcriptPart;
            } else {
              interim += transcriptPart;
            }
          }

          setInterimTranscript(interim);
          if (final) {
            setTranscript(final);
            onSearchResult(final);
            stopListening();
          }
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error("Web speech recognition error:", event.error);
          setIsListening(false);
          // Don't show any alert popups for errors - just log them
          console.warn("Web voice recognition stopped due to error:", event.error);
        };

        recognitionRef.current.onend = () => {
          setIsListening(false);
        };
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignore cleanup errors
        }
      }
    };
  }, [onSearchResult]);

  // Animate in when visible and auto-start listening
  useEffect(() => {
    if (isVisible) {
      setTranscript("");
      setInterimTranscript("");
      setShouldKeepListening(true);
      // Force mic to start immediately with forceStart flag
      startListening(true);

      // Animate entrance
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

      // Fallback: try again after animation
      const timer = setTimeout(() => {
        if (shouldKeepListening && !isListening) {
          startListening(true);
        }
      }, 400);

      return () => {
        clearTimeout(timer);
        if (restartTimeoutRef.current) {
          clearTimeout(restartTimeoutRef.current);
        }
      };
    } else {
      // When modal closes, stop listening immediately
      setShouldKeepListening(false);
      stopListening(); // Stop the microphone
      scaleAnim.setValue(0.8);
      fadeAnim.setValue(0);
      topGlow.setValue(0);
      rightGlow.setValue(0);
      bottomGlow.setValue(0);
      leftGlow.setValue(0);
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible]);

  // Apple Intelligence style edge-flowing animations
  useEffect(() => {
    if (isVisible) {
      // Flowing edge glows - they move around screen perimeter
      const animateEdge = (edge: Animated.Value, delay: number) => {
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(edge, {
              toValue: 1,
              duration: 3000,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: false,
            }),
            Animated.timing(edge, {
              toValue: 0,
              duration: 3000,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: false,
            }),
          ])
        ).start();
      };

      // Stagger the edge animations to create flowing effect
      animateEdge(topGlow, 0);
      animateEdge(rightGlow, 750);
      animateEdge(bottomGlow, 1500);
      animateEdge(leftGlow, 2250);

      // Flowing position animations - multiple directions
      Animated.loop(
        Animated.sequence([
          Animated.timing(flowX, {
            toValue: 1,
            duration: 8000,
            easing: Easing.bezier(0.45, 0.05, 0.55, 0.95),
            useNativeDriver: false,
          }),
          Animated.timing(flowX, {
            toValue: 0,
            duration: 8000,
            easing: Easing.bezier(0.45, 0.05, 0.55, 0.95),
            useNativeDriver: false,
          }),
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(flowY, {
            toValue: 1,
            duration: 10000,
            easing: Easing.bezier(0.42, 0, 0.58, 1),
            useNativeDriver: false,
          }),
          Animated.timing(flowY, {
            toValue: 0,
            duration: 10000,
            easing: Easing.bezier(0.42, 0, 0.58, 1),
            useNativeDriver: false,
          }),
        ])
      ).start();

      // Rotation for organic movement
      Animated.loop(
        Animated.timing(rotate, {
          toValue: 1,
          duration: 20000,
          easing: Easing.linear,
          useNativeDriver: false,
        })
      ).start();

      // Infinite seamless color transition loop
      let isMounted = true;
      const runColorCycle = () => {
        if (!isMounted) return;
        colorTransition.setValue(0);
        colorAnimRef.current = Animated.timing(colorTransition, {
          toValue: 1,
          duration: 12000,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false,
        });
        colorAnimRef.current.start(({ finished }) => {
          if (!finished || !isVisible || !isMounted) return;
          setActiveColorIndex((prev) => {
            const newActive = nextColorIndex;
            setNextColorIndex((newActive + 1) % 5);
            return newActive;
          });
          runColorCycle();
        });
      };
      runColorCycle();
      // cleanup handled above, no need for extra return

      return () => {
        if (colorAnimRef.current) {
          colorAnimRef.current.stop();
        }
      };
    } else {
      topGlow.setValue(0);
      rightGlow.setValue(0);
      bottomGlow.setValue(0);
      leftGlow.setValue(0);
      flowX.setValue(0);
      flowY.setValue(0);
      rotate.setValue(0);
      colorTransition.setValue(0);
      setActiveColorIndex(0);
      setNextColorIndex(1);
    }
  }, [
    isVisible,
    topGlow,
    rightGlow,
    bottomGlow,
    leftGlow,
    flowX,
    flowY,
    rotate,
    colorTransition,
    nextColorIndex,
  ]);

  const startListening = async (forceStart = false) => {
    if (!forceStart && !shouldKeepListening) return;

    setInterimTranscript("");
    setIsListening(true);

    try {
      // For native platforms (Android/iOS), use expo-speech-recognition
      if (Platform.OS !== "web") {
        const result =
          await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        if (!result.granted) {
          Alert.alert(
            "Permission Required",
            "Microphone permission is required for voice search."
          );
          setIsListening(false);
          return;
        }

        await ExpoSpeechRecognitionModule.start({
          lang: "en-US",
          interimResults: true,
          maxAlternatives: 1,
          continuous: true,
          requiresOnDeviceRecognition: false,
          addsPunctuation: true,
          contextualStrings: ["music", "song", "artist", "album", "play"],
        });
        console.log("Speech recognition started with config");
      } else {
        // For web platform, use Web Speech API
        if (recognitionRef.current) {
          recognitionRef.current.start();
        } else {
          Alert.alert(
            "Not Supported",
            "Voice recognition is not supported in this browser."
          );
          setIsListening(false);
        }
      }
    } catch (error) {
      console.error("Failed to start recognition:", error);
      setIsListening(false);
      // Don't show alert popup - just log the error
      console.warn("Voice recognition failed to start, likely due to quick close");
    }
  };

  const stopListening = async () => {
    try {
      if (Platform.OS !== "web") {
        await ExpoSpeechRecognitionModule.stop();
      } else if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    } catch (error) {
      console.error("Failed to stop recognition:", error);
    }
    setIsListening(false);
  };

  if (!isVisible) return null;

  // Apple Intelligence style color themes - vibrant and flowing
  const colorThemes = [
    ["#FF6B9D", "#C084FC", "#60A5FA"], // Pink-Purple-Blue
    ["#F59E0B", "#EC4899", "#8B5CF6"], // Amber-Pink-Purple
    ["#10B981", "#06B6D4", "#3B82F6"], // Green-Cyan-Blue
    ["#EF4444", "#F59E0B", "#FBBF24"], // Red-Amber-Yellow
    ["#8B5CF6", "#EC4899", "#F43F5E"], // Purple-Pink-Rose
  ];
  const currentTheme = colorThemes[activeColorIndex];
  const nextTheme = colorThemes[nextColorIndex];

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          backgroundColor: "transparent",
        },
      ]}
    >
      {/* Single unified fluid gradient with crossfade layer */}
      <BlurView
        intensity={40}
        tint="dark"
        style={StyleSheet.absoluteFillObject}
      >
        <Animated.View
          style={[
            {
              position: "absolute",
              top: -height * 0.5,
              left: -width * 0.5,
              width: width * 2,
              height: height * 2,
            },
            {
              opacity: 1, // lower opacity for better background visibility
              transform: [
                {
                  translateX: flowX.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, width * 0.35],
                  }),
                },
                {
                  translateY: flowY.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, height * 0.35],
                  }),
                },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={[
              currentTheme[0] + "DD",
              currentTheme[1] + "BB",
              currentTheme[2] + "DD",
              currentTheme[0] + "BB",
            ]}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            locations={[0, 0.33, 0.66, 1]}
          />
        </Animated.View>

        {/* Crossfade overlay to next theme */}
        <Animated.View
          style={[
            {
              position: "absolute",
              top: -height * 0.5,
              left: -width * 0.5,
              width: width * 2,
              height: height * 2,
            },
            {
              opacity: colorTransition, // native opacity crossfade for 120fps smoothness
              transform: [
                {
                  translateX: flowY.interpolate({
                    inputRange: [0, 1],
                    outputRange: [width * 0.1, -width * 0.1],
                  }),
                },
                {
                  translateY: flowX.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-height * 0.1, height * 0.1],
                  }),
                },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={[
              nextTheme[0] + "CC",
              nextTheme[1] + "99",
              nextTheme[2] + "CC",
            ]}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            locations={[0, 0.5, 1]}
          />
        </Animated.View>
      </BlurView>

      {/* Close Button */}
      <TouchableOpacity
        style={styles.closeButton}
        onPress={() => {
          setShouldKeepListening(false);
          stopListening();
          setTranscript("");
          setInterimTranscript("");
          onClose();
        }}
      >
        <FontAwesome name="times" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Center Content - Minimal Text Only */}
      <Animated.View
        style={[
          styles.contentContainer,
          {
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Transcript Display */}
        {(transcript || interimTranscript) && (
          <Animated.View
            style={[
              styles.transcriptContainer,
              {
                backgroundColor: "rgba(0,0,0,0.6)",
                borderColor: currentTheme[1],
              },
            ]}
          >
            <Text style={[styles.transcriptText, { color: "#FFFFFF" }]}>
              {transcript || interimTranscript}
            </Text>
          </Animated.View>
        )}

        {/* Hint Text */}
        {!transcript && !interimTranscript && (
          <Text style={[styles.hintText, { color: "#FFFFFF" }]}>
            {isListening ? "Listening..." : "Speak to search"}
          </Text>
        )}
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1001,
    overflow: "hidden",
    backgroundColor: "transparent",
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
    // shadowColor: "#000",
    // shadowOffset: { width: 0, height: 10 },
    // shadowOpacity: 0.5,
    // shadowRadius: 20,
    // elevation: 15,
  },
  transcriptText: {
    fontSize: 24,
    textAlign: "center",
    fontWeight: "600",
    lineHeight: 36,
  },
  hintText: {
    fontSize: 20,
    textAlign: "center",
    fontWeight: "600",
    // opacity: 0.8,
  },
});
