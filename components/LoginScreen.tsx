// components/LoginScreen.tsx
import { useAuth } from "@/context/AuthContext";
import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  Platform,
  Animated as RNAnimated,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { PanGestureHandler, State } from "react-native-gesture-handler";
import Svg, {
  Circle,
  Defs,
  Path,
  Rect,
  Stop,
  LinearGradient as SvgGradient,
} from "react-native-svg";

const AnimatedCircle = RNAnimated.createAnimatedComponent(Circle);

const BACKEND_URL = "https://backendforsongeet.vercel.app";
const { width, height } = Dimensions.get("window");

// Enhanced Google Logo
const GoogleLogoSVG = ({ size = 24 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <Path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <Path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <Path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </Svg>
);

// Enhanced Music Wave Animation
const MusicWave = ({ animated = true }) => {
  const waveAnims = useRef(
    Array.from({ length: 5 }, () => new Animated.Value(0.3))
  ).current;

  useEffect(() => {
    if (animated) {
      const animations = waveAnims.map((anim, index) =>
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 1,
              duration: 400 + index * 100,
              useNativeDriver: false,
            }),
            Animated.timing(anim, {
              toValue: 0.3,
              duration: 400 + index * 100,
              useNativeDriver: false,
            }),
          ])
        )
      );
      animations.forEach((anim) => anim.start());
      return () => animations.forEach((anim) => anim.stop());
    }
  }, [animated]);

  return (
    <View style={styles.waveContainer}>
      {waveAnims.map((anim, index) => (
        <Animated.View
          key={index}
          style={[
            styles.waveBar,
            {
              height: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 60],
              }),
            },
          ]}
        />
      ))}
    </View>
  );
};

// Beautiful Blossom Animation Component
const BlossomAnimation = ({ size = 120 }) => {
  const bloomScale = useRef(new Animated.Value(0)).current;
  const petalRotations = useRef(
    Array.from({ length: 8 }, () => new Animated.Value(0))
  ).current;
  const centerPulse = useRef(new Animated.Value(1)).current;
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Main bloom animation
    Animated.timing(bloomScale, {
      toValue: 1,
      duration: 2000,
      useNativeDriver: true,
    }).start();

    // Petal rotation animations
    petalRotations.forEach((rotation, index) => {
      Animated.loop(
        Animated.timing(rotation, {
          toValue: 1,
          duration: 3000 + index * 200,
          useNativeDriver: true,
        })
      ).start();
    });

    // Center pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(centerPulse, {
          toValue: 1.2,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(centerPulse, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Shimmer effect
    Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  return (
    <View
      style={{
        width: size,
        height: size,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Animated.View
        style={[
          styles.blossomWrapper,
          {
            transform: [{ scale: bloomScale }],
          },
        ]}
      >
        <Svg width={size} height={size} viewBox="0 0 120 120">
          <Defs>
            <SvgGradient id="petalGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#FFB6C1" />
              <Stop offset="50%" stopColor="#FFC0CB" />
              <Stop offset="100%" stopColor="#FF69B4" />
            </SvgGradient>
            <SvgGradient
              id="centerGradient"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <Stop offset="0%" stopColor="#FFD700" />
              <Stop offset="100%" stopColor="#FFA500" />
            </SvgGradient>
          </Defs>

          {/* Petals */}
          {petalRotations.map((rotation, index) => {
            const angle = (index * 360) / 8;
            const animatedRotation = rotation.interpolate({
              inputRange: [0, 1],
              outputRange: ["0deg", "10deg"],
            });
            return (
              <Animated.View
                key={index}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: size,
                  height: size,
                  transform: [
                    { rotate: `${angle}deg` },
                    { rotate: animatedRotation },
                  ],
                }}
              >
                <Svg width={size} height={size} viewBox="0 0 120 120">
                  <Path
                    d="M 60 30 Q 45 20, 40 35 Q 50 50, 60 60 Q 70 50, 80 35 Q 75 20, 60 30 Z"
                    fill="url(#petalGradient)"
                    opacity="0.9"
                  />
                </Svg>
              </Animated.View>
            );
          })}
          {/* Center */}
          <AnimatedCircle
            cx="60"
            cy="60"
            r="12"
            fill="url(#centerGradient)"
            transform={[
              {
                scale: centerPulse,
              },
            ]}
          />

          {/* Shimmer effect */}
          <AnimatedCircle
            cx="60"
            cy="60"
            r="8"
            fill="#FFFFFF"
            opacity={shimmer.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0.3, 0.8, 0.3],
            })}
          />
        </Svg>
      </Animated.View>
    </View>
  );
};

// New Enhanced Logo Component with Rotation
const RearLogo = ({ size = 120 }) => {
  const rotationAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotationAnim, {
        toValue: 1,
        duration: 10000, // 10 seconds for a full rotation
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const rotate = rotationAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Svg width={size} height={size} viewBox="0 0 120 120">
        <Defs>
          <SvgGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#FF6B6B" />
            <Stop offset="30%" stopColor="#4ECDC4" />
            <Stop offset="70%" stopColor="#45B7D1" />
            <Stop offset="100%" stopColor="#96CEB4" />
          </SvgGradient>
          <SvgGradient id="innerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#667eea" />
            <Stop offset="100%" stopColor="#764ba2" />
          </SvgGradient>
        </Defs>

        {/* Outer ring with gradient */}
        <Circle cx="60" cy="60" r="55" fill="url(#logoGradient)" />

        {/* Inner circle */}
        <Circle cx="60" cy="60" r="40" fill="url(#innerGradient)" />

        {/* Sound waves */}
        <Path
          d="M 30 45 Q 35 35, 40 45 Q 45 55, 50 45"
          stroke="#ffffff"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
        <Path
          d="M 70 45 Q 75 35, 80 45 Q 85 55, 90 45"
          stroke="#ffffff"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />

        {/* Central play button */}
        <Circle cx="60" cy="60" r="12" fill="#ffffff" opacity="0.9" />
        <Path d="M 56 52 L 56 68 L 68 60 Z" fill="url(#logoGradient)" />

        {/* Music notes */}
        <Circle cx="35" cy="75" r="2" fill="#ffffff" opacity="0.7" />
        <Path
          d="M 37 75 L 37 65 L 42 64 L 42 74"
          stroke="#ffffff"
          strokeWidth="1.5"
          fill="none"
          opacity="0.7"
        />

        <Circle cx="85" cy="75" r="2" fill="#ffffff" opacity="0.7" />
        <Path
          d="M 83 75 L 83 65 L 78 64 L 78 74"
          stroke="#ffffff"
          strokeWidth="1.5"
          fill="none"
          opacity="0.7"
        />
      </Svg>
    </Animated.View>
  );
};

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isCheckingSilentSignIn, setIsCheckingSilentSignIn] = useState(true);

  // Fixed animation system
  const translateX = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<NodeJS.Timeout | number | null>(null);
  const isGestureActive = useRef(false);

  const floatingElements = useRef(
    Array.from({ length: 12 }, (_, i) => ({
      x: Math.random() * width,
      y: new Animated.Value(Math.random() * height),
      scale: new Animated.Value(0.5 + Math.random() * 0.5),
      rotate: new Animated.Value(0),
    }))
  ).current;

  // Silent sign-in effect
  useEffect(() => {
    const attemptSilentSignIn = async () => {
      try {
        GoogleSignin.configure({
          webClientId:
            "903522270495-t5vjfcpsmbdh08sc543ri9m12nsnt3ni.apps.googleusercontent.com",
          offlineAccess: true,
          scopes: ["profile", "email"],
        });
        const userInfo = await GoogleSignin.signInSilently();
        if (userInfo.data.idToken) {
          const backendUser = await sendTokenToBackend(userInfo.data.idToken);
          signIn(backendUser);
        } else {
          throw new Error("No ID token present.");
        }
      } catch (error: any) {
        if (error.code === statusCodes.SIGN_IN_REQUIRED) {
          console.log("Silent sign-in failed: User not logged in.");
        } else {
          console.error("Silent sign-in error:", error);
        }
        setIsCheckingSilentSignIn(false);
      }
    };
    attemptSilentSignIn();
  }, []);

  // Auto-advance timer effect
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (
      currentStep < 2 &&
      !isGestureActive.current &&
      !isCheckingSilentSignIn
    ) {
      timerRef.current = setTimeout(() => {
        setCurrentStep((prevStep) => (prevStep < 2 ? prevStep + 1 : prevStep));
      }, 4000);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentStep, isCheckingSilentSignIn]);

  // Step change effect - smooth animation
  useEffect(() => {
    if (!isGestureActive.current) {
      Animated.spring(translateX, {
        toValue: -currentStep * width,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    }
  }, [currentStep]);

  // Floating elements animation
  useEffect(() => {
    floatingElements.forEach((element, index) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(element.y, {
            toValue: -50,
            duration: 8000 + index * 500,
            useNativeDriver: true,
          }),
          Animated.timing(element.y, {
            toValue: height + 50,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      ).start();

      Animated.loop(
        Animated.timing(element.rotate, {
          toValue: 1,
          duration: 10000 + index * 1000,
          useNativeDriver: true,
        })
      ).start();
    });
  }, []);

  // Fixed gesture handlers
  const onPanGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: translateX } }],
    {
      useNativeDriver: true,
      listener: () => {
        isGestureActive.current = true;
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      },
    }
  );

  const onPanStateChange = (event: any) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      const { translationX, velocityX } = event.nativeEvent;

      let targetStep = currentStep;
      const threshold = width * 0.25;
      const velocityThreshold = 500;

      if (Math.abs(velocityX) > velocityThreshold) {
        if (velocityX < -velocityThreshold && currentStep < 2) {
          targetStep = currentStep + 1;
        } else if (velocityX > velocityThreshold && currentStep > 0) {
          targetStep = currentStep - 1;
        }
      } else {
        if (translationX < -threshold && currentStep < 2) {
          targetStep = currentStep + 1;
        } else if (translationX > threshold && currentStep > 0) {
          targetStep = currentStep - 1;
        }
      }

      const targetTranslateX = -targetStep * width;

      Animated.spring(translateX, {
        toValue: targetTranslateX,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start(() => {
        isGestureActive.current = false;
        setCurrentStep(targetStep);
      });
    }
  };

  const handleSignInPress = async () => {
    setIsSigningIn(true);
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data.idToken;
      if (!idToken) throw new Error("Could not get ID token from Google.");

      const backendUser = await sendTokenToBackend(idToken);
      signIn(backendUser);
    } catch (error: any) {
      handleSignInError(error);
    } finally {
      setIsSigningIn(false);
    }
  };

  const sendTokenToBackend = async (token: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/google-onetap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Backend authentication failed.");
      return data.user;
    } catch (apiError: any) {
      Alert.alert(
        "Authentication Failed",
        "Could not verify your sign-in. " + apiError.message
      );
      throw apiError;
    }
  };

  const handleSignInError = (error: any) => {
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      console.log("User cancelled the sign-in flow.");
    } else if (error.code === "DEVELOPER_ERROR") {
      Alert.alert("Developer Error", "Sign-in is misconfigured.");
    } else {
      Alert.alert(
        "Sign-In Error",
        error.message || "An unknown error occurred."
      );
    }
  };

  if (isCheckingSilentSignIn) {
    return (
      <View
        style={[
          styles.container,
          styles.step3,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <StatusBar barStyle="light-content" />
        <BlossomAnimation size={150} />
        <Text style={[styles.loadingText, { marginTop: 30 }]}>
          Checking your session...
        </Text>
      </View>
    );
  }

  // Render functions
  const renderStep1 = () => (
    <View style={[styles.stepContainer, styles.step1]}>
      {floatingElements.slice(0, 6).map((element, index) => (
        <Animated.View
          key={index}
          style={[
            styles.floatingNote,
            {
              transform: [
                { translateX: element.x },
                { translateY: element.y },
                { scale: element.scale },
                {
                  rotate: element.rotate.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0deg", "360deg"],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.musicNote}>♪</Text>
        </Animated.View>
      ))}
      <View style={styles.contentContainer}>
        <View style={styles.heroIcon}>
          <Svg width={120} height={120} viewBox="0 0 120 120">
            <Defs>
              <SvgGradient
                id="musicGradient"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <Stop offset="0%" stopColor="#FF6B6B" />
                <Stop offset="50%" stopColor="#4ECDC4" />
                <Stop offset="100%" stopColor="#45B7D1" />
              </SvgGradient>
            </Defs>
            <Circle cx="60" cy="60" r="50" fill="url(#musicGradient)" />
            <Circle cx="60" cy="60" r="20" fill="#ffffff" />
            <Path d="M60 45 L75 50 L75 85 L60 80 Z" fill="#FF6B6B" />
          </Svg>
        </View>
        <Text style={styles.stepTitle}>Discover Music</Text>
        <Text style={styles.stepSubtitle}>
          Explore millions of songs from your favorite artists
        </Text>
        <MusicWave animated={currentStep === 0} />
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={[styles.stepContainer, styles.step2]}>
      {floatingElements.slice(6, 12).map((element, index) => (
        <Animated.View
          key={index}
          style={[
            styles.floatingVinyl,
            {
              transform: [
                { translateX: element.x },
                { translateY: element.y },
                { scale: element.scale },
                {
                  rotate: element.rotate.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0deg", "360deg"],
                  }),
                },
              ],
            },
          ]}
        >
          <Svg width={30} height={30} viewBox="0 0 30 30">
            <Circle cx="15" cy="15" r="15" fill="#2C3E50" />
            <Circle cx="15" cy="15" r="10" fill="#34495E" />
            <Circle cx="15" cy="15" r="3" fill="#2C3E50" />
          </Svg>
        </Animated.View>
      ))}
      <View style={styles.contentContainer}>
        <View style={styles.heroIcon}>
          <Svg width={120} height={120} viewBox="0 0 120 120">
            <Defs>
              <SvgGradient
                id="playlistGradient"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <Stop offset="0%" stopColor="#A8E6CF" />
                <Stop offset="50%" stopColor="#88D8C0" />
                <Stop offset="100%" stopColor="#4ECDC4" />
              </SvgGradient>
            </Defs>
            <Rect
              x="20"
              y="30"
              width="80"
              height="60"
              rx="10"
              fill="url(#playlistGradient)"
            />
            <Rect x="30" y="40" width="20" height="3" fill="#ffffff" />
            <Rect x="55" y="40" width="35" height="3" fill="#ffffff" />
            <Rect x="30" y="50" width="20" height="3" fill="#ffffff" />
            <Rect x="55" y="50" width="25" height="3" fill="#ffffff" />
            <Rect x="30" y="60" width="20" height="3" fill="#ffffff" />
            <Rect x="55" y="60" width="30" height="3" fill="#ffffff" />
          </Svg>
        </View>
        <Text style={styles.stepTitle}>Create Playlists</Text>
        <Text style={styles.stepSubtitle}>
          Build your perfect playlists for every mood and moment
        </Text>
        <View style={styles.playlistCards}>
          <View style={[styles.playlistCard, { backgroundColor: "#FF6B6B" }]}>
            <Text style={styles.cardText}>Chill</Text>
          </View>
          <View style={[styles.playlistCard, { backgroundColor: "#4ECDC4" }]}>
            <Text style={styles.cardText}>Workout</Text>
          </View>
          <View style={[styles.playlistCard, { backgroundColor: "#45B7D1" }]}>
            <Text style={styles.cardText}>Party</Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={[styles.stepContainer, styles.step3]}>
      <View style={styles.contentContainer}>
        <View style={styles.loginHero}>
          <RearLogo size={140} />
        </View>
        <Text style={styles.loginTitle}>Welcome to Rear</Text>
        <Text style={styles.loginSubtitle}>
          Join millions of music lovers and start your journey
        </Text>
        {isSigningIn ? (
          <View style={styles.loadingContainer}>
            <BlossomAnimation size={120} />
            <Text style={styles.loadingText}>Signing you in...</Text>
          </View>
        ) : (
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity
              style={styles.googleButton}
              onPress={handleSignInPress}
              activeOpacity={0.8}
            >
              <View style={styles.buttonContent}>
                <GoogleLogoSVG size={28} />
                <Text style={styles.googleButtonText}>
                  Continue with Google
                </Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
    </View>
  );

  return (
    <>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />
      <View style={styles.container}>
        <PanGestureHandler
          onGestureEvent={onPanGestureEvent}
          onHandlerStateChange={onPanStateChange}
          activeOffsetX={[-10, 10]}
          failOffsetY={[-20, 20]}
        >
          <Animated.View
            style={[
              styles.stepsContainer,
              {
                transform: [{ translateX }],
              },
            ]}
          >
            {renderStep1()}
            {renderStep2()}
            {renderStep3()}
          </Animated.View>
        </PanGestureHandler>
        <View style={styles.bottomControls}>
          {currentStep < 2 && (
            <TouchableOpacity
              style={styles.skipButton}
              onPress={() => setCurrentStep(2)}
            >
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          )}
          <View style={styles.stepIndicators}>
            {[0, 1, 2].map((step) => (
              <View
                key={step}
                style={[
                  styles.indicator,
                  currentStep === step && styles.activeIndicator,
                ]}
              />
            ))}
          </View>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1a1a2e" },
  stepsContainer: { flexDirection: "row", width: width * 3, flex: 1 },
  stepContainer: {
    width: width,
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    overflow: "hidden",
  },
  step1: { backgroundColor: "#FF6B6B" },
  step2: { backgroundColor: "#4ECDC4" },
  step3: { backgroundColor: "#667eea" },
  contentContainer: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    width: "100%",
  },
  heroIcon: {
    marginBottom: 40,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
  },
  stepTitle: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 16,
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    fontFamily: Platform.OS === "ios" ? "Avenir Next" : "Roboto",
  },
  stepSubtitle: {
    fontSize: 18,
    color: "rgba(255, 255, 255, 0.9)",
    textAlign: "center",
    lineHeight: 26,
    marginBottom: 40,
    maxWidth: "85%",
    fontFamily: Platform.OS === "ios" ? "Avenir Next" : "Roboto",
  },
  waveContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    height: 80,
    marginTop: 30,
  },
  waveBar: {
    width: 8,
    backgroundColor: "#ffffff",
    marginHorizontal: 3,
    borderRadius: 4,
  },
  playlistCards: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginTop: 30,
  },
  playlistCard: {
    width: 80,
    height: 80,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  cardText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 14,
    fontFamily: Platform.OS === "ios" ? "Avenir Next" : "Roboto",
  },
  loginHero: { marginBottom: 50 },
  loginTitle: {
    fontSize: 42,
    fontWeight: "bold",
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 16,
    letterSpacing: 1,
    fontFamily: Platform.OS === "ios" ? "Avenir Next" : "Roboto",
  },
  loginSubtitle: {
    fontSize: 18,
    color: "rgba(255, 255, 255, 0.9)",
    textAlign: "center",
    lineHeight: 26,
    marginBottom: 50,
    maxWidth: "90%",
    fontFamily: Platform.OS === "ios" ? "Avenir Next" : "Roboto",
  },
  googleButton: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 32,
    minWidth: 280,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
    marginBottom: 40,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  googleButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginLeft: 16,
    fontFamily: Platform.OS === "ios" ? "Avenir Next" : "Roboto",
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    height: 100,
  },
  loadingText: {
    color: "#ffffff",
    fontSize: 16,
    marginTop: 16,
    fontFamily: Platform.OS === "ios" ? "Avenir Next" : "Roboto",
  },
  bottomControls: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 50 : 40,
    left: 0,
    right: 0,
  },
  stepIndicators: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  indicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
    marginHorizontal: 6,
  },
  activeIndicator: { backgroundColor: "#ffffff" },
  skipButton: { position: "absolute", right: 30, bottom: -5, padding: 10 },
  skipText: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 16,
    fontWeight: "500",
    fontFamily: Platform.OS === "ios" ? "Avenir Next" : "Roboto",
  },
  floatingNote: { position: "absolute" },
  musicNote: { fontSize: 24, color: "rgba(255, 255, 255, 0.6)" },
  floatingVinyl: { position: "absolute" },
  blossomContainer: {
    width: 120,
    height: 120,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  blossomWrapper: {
    width: 120,
    height: 120,
  },
  particle: {
    position: "absolute",
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  sparkle: {
    fontSize: 12,
    opacity: 0.8,
  },
});
