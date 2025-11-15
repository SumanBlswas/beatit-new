import { ThemeProvider } from "@/context/ThemeContext";
import { useFonts } from "expo-font";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Alert, Animated, Linking, Platform, StyleSheet } from "react-native";
import "react-native-reanimated";

import AnimatedSplash from "@/components/AnimatedSplash";
import { BatteryOptimizationChecker } from "@/components/BatteryOptimizationChecker";
import { PlayerProvider } from "@/context/PlayerContext";
import { isOnline } from "@/services/networkService";
import * as Notifications from "expo-notifications";
import { GestureHandlerRootView } from "react-native-gesture-handler";

// --- Auth imports ---
import LoginScreen from "@/components/LoginScreen";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { GlobalAlertProvider } from "@/context/GlobalAlertContext";
import { NfcProvider } from "@/context/NfcContext";

async function requestNotificationPermissions() {
  if (Platform.OS === "web") return true;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    Alert.alert(
      "Permission Required",
      "Notifications are needed for media controls. Please enable them in settings.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Open Settings", onPress: () => Linking.openSettings() },
      ]
    );
    return false;
  }
  return true;
}

function AppLayout() {
  const router = useRouter();
  const { userInfo, isLoading } = useAuth();
  const [networkStatus, setNetworkStatus] = useState<boolean | null>(null);

  useEffect(() => {
    // Check network status on mount
    const checkNetwork = async () => {
      const online = await isOnline();
      setNetworkStatus(online);
    };
    checkNetwork();
  }, []);

  // Handle incoming deep links and external file opens
  useEffect(() => {
    const handleUrl = (event: { url: string }) => {
      try {
        const url = event.url;
        if (!url) return;
        // If this looks like a file/content URI or an http(s) video link, open player
        if (
          url.startsWith("file:") ||
          url.startsWith("content:") ||
          url.match(/^https?:.*\.(mp4|m4v|mov|mp3|m4a|aac|wav|flac)(\?.*)?$/i)
        ) {
          router.push(`/(tabs)/player?externalUri=${encodeURIComponent(url)}`);
        }
      } catch (e) {
        console.warn("Failed to handle incoming url:", e);
      }
    };

    // Initial URL when app opens
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl({ url });
    });

    const sub = Linking.addEventListener("url", handleUrl);
    return () => sub.remove();
  }, [router]);

  if (isLoading || networkStatus === null) {
    return <AnimatedSplash />;
  }

  // If offline, skip login and go directly to app (will redirect to downloads)
  if (!networkStatus) {
    return (
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
    );
  }

  // If online but not logged in, show login screen
  if (!userInfo) {
    return <LoginScreen />;
  }

  // If online and logged in, show app
    return (
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
    );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });
  const [showSplash, setShowSplash] = useState(true);
  const [fadeAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    // FIX: Changed NodeJS.Timeout to number for splashTimeout
    let splashTimeout: number | undefined;
    let fallbackTimeout: number | undefined; // Also for fallback to be consistent

    const initializeApp = async () => {
      try {
        // Request notification permissions
        await requestNotificationPermissions();
        console.log("App permissions configured.");
      } catch (e) {
        console.error("Initialization error:", e);
      }

      // Your existing splash screen timer
      splashTimeout = setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }).start(() => {
          setShowSplash(false);
        });
      }, 1200);
    };

    initializeApp();

    // FIX: Changed NodeJS.Timeout to number for fallback
    fallbackTimeout = setTimeout(() => {
      setShowSplash(false);
    }, 3000);

    return () => {
      if (splashTimeout !== undefined) clearTimeout(splashTimeout);
      if (fallbackTimeout !== undefined) clearTimeout(fallbackTimeout);
    };
  }, [fadeAnim]); // Added fadeAnim to dependencies as it's used in the effect

  useEffect(() => {
    // This correctly hides the native splash screen once your custom splash is done
    if (!showSplash && loaded) {
      SplashScreen.hideAsync();
    }
  }, [showSplash, loaded]);

  // This part handles showing your custom splash screen
  if (!loaded || showSplash) {
    return (
      <Animated.View
        style={{
          ...StyleSheet.absoluteFillObject,
          zIndex: 10,
          opacity: fadeAnim,
        }}
      >
        <AnimatedSplash />
      </Animated.View>
    );
  }

  // This renders the main app
  return (
    <AuthProvider>
      <GlobalAlertProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <ThemeProvider>
            <PlayerProvider>
              <NfcProvider>
                <BatteryOptimizationChecker />
                <AppLayout />
                <StatusBar style="auto" />
              </NfcProvider>
            </PlayerProvider>
          </ThemeProvider>
        </GestureHandlerRootView>
      </GlobalAlertProvider>
    </AuthProvider>
  );
}
