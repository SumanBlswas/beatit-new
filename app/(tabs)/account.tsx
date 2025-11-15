import { BeautifulAlert } from "@/components/BeautifulAlert";
import { ConfirmTypedModal } from "@/components/ConfirmTypedModal";
import { useAuth } from "@/context/AuthContext";
import { useGoogleSignIn } from "@/hooks/useGoogleSignIn";
import { on as eventOn } from "@/utils/eventBus";
import {
  AppSettings,
  exportUserData,
  getAppSettings,
  getLoggedOutFlag,
  saveAppSettings,
  setLoggedOutFlag,
} from "@/utils/storage";
import { FontAwesome } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BlurView } from "expo-blur";
import * as FileSystem from "expo-file-system";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming
} from "react-native-reanimated";
// --- App Version & Update Check ---
const APP_VERSION = require('../../package.json').version;
const GITHUB_REPO = "yourusername/beatit-app"; // CHANGE THIS TO YOUR REPO
const UPDATE_CHECK_KEY = "last_update_check";

function getTodayDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
}

async function fetchLatestVersion() {
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`);
    const data = await res.json();
    return data.tag_name?.replace(/^v/, "") || null;
  } catch {
    return null;
  }
}

export default function AccountScreen() {
  const {
    userInfo,
    signOut,
    updateProfile,
    uploadProfileImage,
    deleteAccount,
    clearAppData,
  } = useAuth();
  const router = useRouter();
  const { signIn: googleSignIn, loading: googleLoading } = useGoogleSignIn();

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showClearDataModal, setShowClearDataModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showImagePickerModal, setShowImagePickerModal] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({
    theme: "system",
    autoAcceptNfc: false,
    shareUsageAnonymously: false,
  });
  const [hasLoggedOut, setHasLoggedOut] = useState(false);

  // --- Version State ---
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [updateStatus, setUpdateStatus] = useState<string>("Checking...");
  const [checkingUpdate, setCheckingUpdate] = useState(false);
    // --- Check for updates (manual & daily) ---
    const checkForUpdate = useCallback(async (manual = false) => {
      setCheckingUpdate(true);
      const latest = await fetchLatestVersion();
      setLatestVersion(latest);
      if (!latest) {
        setUpdateStatus("Could not check");
      } else if (latest === APP_VERSION) {
        setUpdateStatus("Up to date");
      } else {
        setUpdateStatus(`Update available: v${latest}`);
      }
      setCheckingUpdate(false);
      // Store last check date
      if (!manual) await AsyncStorage.setItem(UPDATE_CHECK_KEY, getTodayDateString());
    }, []);

    // --- Auto check once per day ---
    useEffect(() => {
      (async () => {
        const lastCheck = await AsyncStorage.getItem(UPDATE_CHECK_KEY);
        if (lastCheck !== getTodayDateString()) {
          await checkForUpdate();
        } else {
          // If already checked today, just show status
          const latest = await fetchLatestVersion();
          setLatestVersion(latest);
          if (!latest) setUpdateStatus("Could not check");
          else if (latest === APP_VERSION) setUpdateStatus("Up to date");
          else setUpdateStatus(`Update available: v${latest}`);
        }
      })();
    }, []);
  const avatarScale = useSharedValue(0.5);
  const avatarTranslateX = useSharedValue(0);
  const avatarTranslateY = useSharedValue(0);
  const avatarOpacity = useSharedValue(0);
  const contentOpacity = useSharedValue(0);
  const contentTranslateY = useSharedValue(20);
  const backButtonOpacity = useSharedValue(0);
  const backButtonScale = useSharedValue(0.8);

  // Track if we're currently animating
  const isAnimating = useSharedValue(false);

  // Refs for measuring positions
  const headerLayoutRef = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const avatarMeasureRef = useRef<any>(null);

  // Listen for header avatar layout
  useEffect(() => {
    const handler = (layout: any) => {
      headerLayoutRef.current = layout;
    };
    const unsubscribe = eventOn("headerAvatarLayout", handler);
    return () => unsubscribe && unsubscribe();
  }, []);

  const checkLoggedOutFlag = async () => {
    const flag = await getLoggedOutFlag();
    setHasLoggedOut(flag);
  };

  const loadSettings = async () => {
    const saved = await getAppSettings();
    if (saved) {
      setSettings(saved);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  // Entrance animation on focus
  useFocusEffect(
    useCallback(() => {
      checkLoggedOutFlag();

      // Reset all animations to start state
      avatarScale.value = 0.5;
      avatarOpacity.value = 0;
      contentOpacity.value = 0;
      contentTranslateY.value = 20;
      backButtonOpacity.value = 0;
      backButtonScale.value = 0.8;
      isAnimating.value = true;

      // Try to measure and animate from header position
      const t = setTimeout(() => {
        let didMeasure = false;

        try {
          if (
            headerLayoutRef.current &&
            avatarMeasureRef.current?.measureInWindow
          ) {
            const {
              x: hx,
              y: hy,
              width: hw,
              height: hh,
            } = headerLayoutRef.current;
            avatarMeasureRef.current.measureInWindow(
              (ax: number, ay: number, aw: number, ah: number) => {
                const headerCenterX = hx + hw / 2;
                const headerCenterY = hy + hh / 2;
                const avatarCenterX = ax + aw / 2;
                const avatarCenterY = ay + ah / 2;
                const deltaX = headerCenterX - avatarCenterX;
                const deltaY = headerCenterY - avatarCenterY;

                // Set start position
                avatarTranslateX.value = deltaX;
                avatarTranslateY.value = deltaY;
                avatarScale.value = 0.3;

                didMeasure = true;

                // Start animations
                startEntranceAnimation();
              }
            );

            // If measure callback doesn't fire within 100ms, fallback
            setTimeout(() => {
              if (!didMeasure) {
                startEntranceAnimation();
              }
            }, 100);

            return;
          }
        } catch (e) {
          // Fallback on error
        }

        // Immediate fallback if no header layout
        startEntranceAnimation();
      }, 50);

      return () => {
        clearTimeout(t);
        // Exit animation when leaving screen
        avatarOpacity.value = withTiming(0, { duration: 200 });
        contentOpacity.value = withTiming(0, { duration: 200 });
        backButtonOpacity.value = withTiming(0, { duration: 200 });
      };
    }, [])
  );

  const startEntranceAnimation = () => {
    "worklet";

    // Back button fades in first
    backButtonOpacity.value = withTiming(1, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    });
    backButtonScale.value = withSpring(1, {
      damping: 15,
      stiffness: 150,
    });

    // Avatar animations
    avatarOpacity.value = withTiming(1, {
      duration: 400,
      easing: Easing.out(Easing.cubic),
    });

    avatarScale.value = withSpring(1, {
      damping: 14,
      stiffness: 120,
      mass: 0.8,
    });

    avatarTranslateX.value = withSpring(0, {
      damping: 16,
      stiffness: 140,
      mass: 0.8,
    });

    avatarTranslateY.value = withSpring(0, {
      damping: 16,
      stiffness: 140,
      mass: 0.8,
    });

    // Content fades in after avatar starts moving
    contentOpacity.value = withDelay(
      150,
      withTiming(
        1,
        {
          duration: 500,
          easing: Easing.out(Easing.cubic),
        },
        (finished) => {
          if (finished) {
            isAnimating.value = false;
          }
        }
      )
    );

    contentTranslateY.value = withDelay(
      150,
      withTiming(0, {
        duration: 500,
        easing: Easing.out(Easing.cubic),
      })
    );
  };

  const avatarAnimatedStyle = useAnimatedStyle(() => ({
    opacity: avatarOpacity.value,
    transform: [
      { scale: avatarScale.value },
      { translateX: avatarTranslateX.value },
      { translateY: avatarTranslateY.value },
    ] as any,
  }));

  const contentAnimatedStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: contentTranslateY.value }],
  }));

  const backButtonAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backButtonOpacity.value,
    transform: [{ scale: backButtonScale.value }],
  }));

  const getAvatarSource = () => {
    if (userInfo?.googlePhotoUrl) {
      return { uri: userInfo.googlePhotoUrl };
    }
    if (userInfo?.avatarUri) {
      return { uri: userInfo.avatarUri };
    }
    if (userInfo?.gender === "female") {
      return require("@/assets/images/female.png");
    }
    return require("@/assets/images/male.png");
  };

  const handleBack = () => {
    // Animate out before going back
    avatarOpacity.value = withTiming(0, { duration: 200 });
    contentOpacity.value = withTiming(0, { duration: 200 });
    backButtonOpacity.value = withTiming(0, { duration: 200 });

    setTimeout(() => {
      router.back();
    }, 200);
  };

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    await signOut();
    await setLoggedOutFlag(true);
    setHasLoggedOut(true);
    setShowLogoutModal(false);
    router.replace("/");
  };

  const handleDeleteAccount = async () => {
    try {
      setLoading(true);
      await deleteAccount();
      setShowDeleteModal(false);
      Alert.alert("Success", "Your account has been deleted.");
      router.replace("/");
    } catch {
      Alert.alert("Error", "Failed to delete account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleClearAppData = async () => {
    try {
      setLoading(true);
      await clearAppData();
      setShowClearDataModal(false);

      Alert.alert("App Data Cleared", "All app data has been removed.", [
        { text: "OK", onPress: () => router.replace("/") },
      ]);
    } catch {
      Alert.alert("Error", "Failed to clear app data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleEditProfile = () => {
    setEditName(userInfo?.name || "");
    setShowEditModal(true);
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert("Error", "Name cannot be empty");
      return;
    }

    try {
      setLoading(true);
      await updateProfile({ name: editName.trim() });
      setShowEditModal(false);
      Alert.alert("Success", "Profile updated successfully");
    } catch {
      Alert.alert("Error", "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const handleChangeProfilePicture = () => {
    setShowImagePickerModal(true);
  };

  const handleExportData = async () => {
    try {
      setLoading(true);
      const data = await exportUserData();
      const filename = `beatit_export_${Date.now()}.json`;
      const path = `${FileSystem.documentDirectory}${filename}`;

      await FileSystem.writeAsStringAsync(path, data);

      if (Platform.OS === "ios" || Platform.OS === "android") {
        await Share.share({
          url: path,
          title: "Export Account Data",
        });
      } else {
        Alert.alert("Success", `Data exported to ${filename}`);
      }
    } catch {
      Alert.alert("Error", "Failed to export data");
    } finally {
      setLoading(false);
    }
  };

  const handleSettingChange = async (key: keyof AppSettings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    await saveAppSettings(newSettings);
  };

  const ActionButton: React.FC<{
    icon: string;
    title: string;
    color: string;
    onPress: () => void;
  }> = ({ icon, title, color, onPress }) => (
    <TouchableOpacity
      style={styles.actionButton}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <LinearGradient
        colors={[color, `${color}cc`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.actionButtonGradient}
      >
        <FontAwesome name={icon as any} size={24} color="#fff" />
      </LinearGradient>
      <Text style={styles.actionButtonText}>{title}</Text>
    </TouchableOpacity>
  );

  const MenuItem: React.FC<{
    icon: string;
    title: string;
    subtitle?: string;
    onPress?: () => void;
    showChevron?: boolean;
    rightElement?: React.ReactNode;
  }> = ({
    icon,
    title,
    subtitle,
    onPress,
    showChevron = true,
    rightElement,
  }) => (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <View style={styles.menuItemLeft}>
        <View style={styles.menuIconContainer}>
          <LinearGradient
            colors={["#6366f1", "#8b5cf6"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.menuIconGradient}
          >
            <FontAwesome name={icon as any} size={18} color="#fff" />
          </LinearGradient>
        </View>
        <View style={styles.menuTextContainer}>
          <Text style={styles.menuTitle}>{title}</Text>
          {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      {rightElement ||
        (showChevron && (
          <FontAwesome name="chevron-right" size={16} color="#666" />
        ))}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Back Button with Animation */}
      <Animated.View
        style={[styles.backButtonContainer, backButtonAnimatedStyle]}
      >
        <TouchableOpacity
          onPress={handleBack}
          activeOpacity={0.8}
          style={styles.backButtonWrapper}
        >
          <BlurView intensity={40} tint="light" style={styles.backButtonBlur} />
          <View style={styles.backButtonOverlay} />
          <View style={styles.backButtonContent}>
            <FontAwesome name="arrow-left" size={22} color="#fff" />
          </View>
        </TouchableOpacity>
      </Animated.View>

      <Animated.ScrollView
        style={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContentContainer}
      >
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <Animated.View
            ref={avatarMeasureRef}
            style={[styles.avatarWrapper, avatarAnimatedStyle]}
          >
            <TouchableOpacity
              onPress={handleChangeProfilePicture}
              activeOpacity={0.8}
            >
              <Image source={getAvatarSource()} style={styles.avatar} />
              <View style={styles.avatarEditBadge}>
                <FontAwesome name="camera" size={16} color="#fff" />
              </View>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={contentAnimatedStyle}>
            <TouchableOpacity
              onPress={handleEditProfile}
              style={styles.nameContainer}
            >
              <Text style={styles.userName}>{userInfo?.name || "Guest"}</Text>
              <FontAwesome
                name="pencil"
                size={14}
                color="#aaa"
                style={styles.editIcon}
              />
            </TouchableOpacity>
            <Text style={styles.userEmail}>
              {userInfo?.email || "Not signed in"}
            </Text>
          </Animated.View>
        </View>

        {/* All content wrapped in animated view */}
        <Animated.View style={contentAnimatedStyle}>
          {/* Primary Actions */}
          <View style={styles.actionsContainer}>
            <ActionButton
              icon="heart"
              title="Liked Songs"
              color="#ff0066"
              onPress={() => router.push("/(tabs)/downloads")}
            />
            <ActionButton
              icon="list"
              title="Playlists"
              color="#6366f1"
              onPress={() => router.push("/(tabs)/downloads")}
            />
            <ActionButton
              icon="star"
              title="Premium"
              color="#fbbf24"
              onPress={() => setShowPremiumModal(true)}
            />
          </View>

          <View style={styles.divider} />

          {/* Account Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>

            <MenuItem
              icon="user"
              title="Edit Profile"
              subtitle="Update your name and details"
              onPress={handleEditProfile}
            />

            <MenuItem
              icon="camera"
              title="Change Profile Picture"
              subtitle="Take a photo or choose from gallery"
              onPress={handleChangeProfilePicture}
            />

            {userInfo && (
              <MenuItem
                icon="sign-out"
                title="Logout"
                subtitle="Keep local data, sign out from account"
                onPress={handleLogout}
              />
            )}
          </View>

          {/* Privacy & Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Privacy & Settings</Text>

            <MenuItem
              icon="moon-o"
              title="App Theme"
              subtitle={`Current: ${settings.theme}`}
              onPress={() => setShowThemeModal(true)}
            />

            <MenuItem
              icon="wifi"
              title="Auto-accept NFC shares"
              showChevron={false}
              rightElement={
                <Switch
                  value={settings.autoAcceptNfc}
                  onValueChange={(value) =>
                    handleSettingChange("autoAcceptNfc", value)
                  }
                  trackColor={{ false: "#333", true: "#ff0066" }}
                  thumbColor="#fff"
                />
              }
            />

            <MenuItem
              icon="bar-chart"
              title="Share usage anonymously"
              showChevron={false}
              rightElement={
                <Switch
                  value={settings.shareUsageAnonymously}
                  onValueChange={(value) =>
                    handleSettingChange("shareUsageAnonymously", value)
                  }
                  trackColor={{ false: "#333", true: "#6366f1" }}
                  thumbColor="#fff"
                />
              }
            />
          </View>

          {/* Data Management */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Data Management</Text>

            <MenuItem
              icon="download"
              title="Export Account Data"
              subtitle="Download your data as JSON"
              onPress={handleExportData}
            />

            <MenuItem
              icon="trash"
              title="Delete App Data"
              subtitle="Remove all local downloads and cache"
              onPress={() => setShowClearDataModal(true)}
            />

            {userInfo && (
              <MenuItem
                icon="user-times"
                title="Delete Account"
                subtitle="Permanently delete your account"
                onPress={() => setShowDeleteModal(true)}
              />
            )}
          </View>

          {/* App Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>

            <MenuItem
              icon="info-circle"
              title="App Version"
              subtitle={`Current: v${APP_VERSION}`}
              showChevron={false}
              rightElement={
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 13, color: updateStatus.includes('Update') ? '#ff0066' : '#666' }}>{updateStatus}</Text>
                  <TouchableOpacity
                    style={{ marginTop: 4, padding: 6, backgroundColor: '#eee', borderRadius: 8 }}
                    onPress={() => checkForUpdate(true)}
                    disabled={checkingUpdate}
                  >
                    <Text style={{ fontSize: 13, color: '#6366f1' }}>{checkingUpdate ? 'Checking...' : 'Check for Update'}</Text>
                  </TouchableOpacity>
                  {updateStatus.includes('Update') && latestVersion && (
                    <TouchableOpacity
                      style={{ marginTop: 4, padding: 6, backgroundColor: '#ff0066', borderRadius: 8 }}
                      onPress={() => {
                        Linking.openURL('https://github.com/' + GITHUB_REPO + '/releases');
                      }}
                    >
                      <Text style={{ fontSize: 13, color: '#fff' }}>Update Now</Text>
                    </TouchableOpacity>
                  )}
                </View>
              }
            />

            <MenuItem
              icon="life-ring"
              title="Support & Feedback"
              subtitle="Get help or send feedback"
              onPress={() => setShowSupportModal(true)}
            />
          </View>

          {/* Sign in with Google */}
          {!userInfo && !hasLoggedOut && (
            <TouchableOpacity
              style={styles.googleButton}
              onPress={async () => {
                await googleSignIn();
                await setLoggedOutFlag(false);
                setHasLoggedOut(false);
              }}
              disabled={googleLoading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={["#4285F4", "#34A853"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.googleButtonGradient}
              >
                {googleLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <FontAwesome name="google" size={20} color="#fff" />
                    <Text style={styles.googleButtonText}>
                      Sign in with Google
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          )}

          <View style={styles.bottomSpacer} />
        </Animated.View>
      </Animated.ScrollView>

      {/* Modals */}
      <BeautifulAlert
        visible={showPremiumModal}
        title="Premium Features"
        message="Premium features are coming soon! Stay tuned for exclusive benefits."
        type="info"
        buttons={[
          {
            text: "OK",
            onPress: () => setShowPremiumModal(false),
            style: "default",
          },
        ]}
        onClose={() => setShowPremiumModal(false)}
      />

      <BeautifulAlert
        visible={showSupportModal}
        title="Support & Feedback"
        message={
          "Contact us at support@beatit.com\nWe'd love to hear your feedback!"
        }
        type="info"
        buttons={[
          {
            text: "OK",
            onPress: () => setShowSupportModal(false),
            style: "default",
          },
        ]}
        onClose={() => setShowSupportModal(false)}
      />

      {/* Edit Profile Modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <BlurView
            intensity={20}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setShowEditModal(false)}
          />
          <View style={styles.modernModal}>
            <View style={styles.modernModalIconContainer}>
              <LinearGradient
                colors={["#6366f1", "#8b5cf6"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.modernModalIconGradient}
              >
                <FontAwesome name="user" size={28} color="#fff" />
              </LinearGradient>
            </View>

            <Text style={styles.modernModalTitle}>Edit Profile</Text>
            <Text style={styles.modernModalSubtitle}>
              Update your profile information
            </Text>

            <TextInput
              style={styles.modernInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Enter your name"
              placeholderTextColor="#999"
              autoFocus
            />

            <View style={styles.modernModalButtons}>
              <TouchableOpacity
                style={styles.modernModalButtonSecondary}
                onPress={() => setShowEditModal(false)}
              >
                <Text style={styles.modernModalButtonSecondaryText}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modernModalButtonPrimary,
                  !editName.trim() && styles.buttonDisabled,
                ]}
                onPress={handleSaveProfile}
                disabled={loading || !editName.trim()}
              >
                <LinearGradient
                  colors={
                    !editName.trim() ? ["#666", "#666"] : ["#6366f1", "#8b5cf6"]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.modernModalButtonGradient}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.modernModalButtonPrimaryText}>
                      Save
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Logout Modal */}
      <Modal
        visible={showLogoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <View style={styles.modalOverlay}>
          <BlurView
            intensity={20}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setShowLogoutModal(false)}
          />
          <View style={styles.modernModal}>
            <View style={styles.modernModalIconContainer}>
              <LinearGradient
                colors={["#ef4444", "#dc2626"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.modernModalIconGradient}
              >
                <FontAwesome name="sign-out" size={28} color="#fff" />
              </LinearGradient>
            </View>

            <Text style={styles.modernModalTitle}>Logout</Text>
            <Text style={styles.modernModalSubtitle}>
              Your local data will be preserved
            </Text>

            <View style={styles.modernModalButtons}>
              <TouchableOpacity
                style={styles.modernModalButtonSecondary}
                onPress={() => setShowLogoutModal(false)}
              >
                <Text style={styles.modernModalButtonSecondaryText}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modernModalButtonPrimary}
                onPress={confirmLogout}
              >
                <LinearGradient
                  colors={["#ef4444", "#dc2626"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.modernModalButtonGradient}
                >
                  <Text style={styles.modernModalButtonPrimaryText}>
                    Logout
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Theme Selection Modal */}
      <Modal
        visible={showThemeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowThemeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <BlurView
            intensity={20}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setShowThemeModal(false)}
          />
          <View style={styles.modernModal}>
            <View style={styles.modernModalIconContainer}>
              <LinearGradient
                colors={["#6366f1", "#8b5cf6"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.modernModalIconGradient}
              >
                <FontAwesome name="moon-o" size={28} color="#fff" />
              </LinearGradient>
            </View>

            <Text style={styles.modernModalTitle}>Choose Theme</Text>
            <Text style={styles.modernModalSubtitle}>
              Select your preferred appearance
            </Text>

            <View style={styles.themeOptions}>
              <TouchableOpacity
                style={[
                  styles.themeOption,
                  settings.theme === "light" && styles.themeOptionActive,
                ]}
                onPress={() => {
                  handleSettingChange("theme", "light");
                  setShowThemeModal(false);
                }}
              >
                <FontAwesome
                  name="sun-o"
                  size={24}
                  color={settings.theme === "light" ? "#6366f1" : "#666"}
                />
                <Text
                  style={[
                    styles.themeOptionText,
                    settings.theme === "light" && styles.themeOptionTextActive,
                  ]}
                >
                  Light
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.themeOption,
                  settings.theme === "dark" && styles.themeOptionActive,
                ]}
                onPress={() => {
                  handleSettingChange("theme", "dark");
                  setShowThemeModal(false);
                }}
              >
                <FontAwesome
                  name="moon-o"
                  size={24}
                  color={settings.theme === "dark" ? "#6366f1" : "#666"}
                />
                <Text
                  style={[
                    styles.themeOptionText,
                    settings.theme === "dark" && styles.themeOptionTextActive,
                  ]}
                >
                  Dark
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.themeOption,
                  settings.theme === "system" && styles.themeOptionActive,
                ]}
                onPress={() => {
                  handleSettingChange("theme", "system");
                  setShowThemeModal(false);
                }}
              >
                <FontAwesome
                  name="mobile"
                  size={24}
                  color={settings.theme === "system" ? "#6366f1" : "#666"}
                />
                <Text
                  style={[
                    styles.themeOptionText,
                    settings.theme === "system" && styles.themeOptionTextActive,
                  ]}
                >
                  System
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Image Picker Modal */}
      <Modal
        visible={showImagePickerModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowImagePickerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <BlurView
            intensity={20}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setShowImagePickerModal(false)}
          />
          <View style={styles.modernModal}>
            <View style={styles.modernModalIconContainer}>
              <LinearGradient
                colors={["#6366f1", "#8b5cf6"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.modernModalIconGradient}
              >
                <FontAwesome name="camera" size={28} color="#fff" />
              </LinearGradient>
            </View>

            <Text style={styles.modernModalTitle}>Change Profile Picture</Text>
            <Text style={styles.modernModalSubtitle}>
              Choose how to update your photo
            </Text>

            <View style={styles.imagePickerOptions}>
              <TouchableOpacity
                style={styles.imagePickerOption}
                onPress={() => {
                  uploadProfileImage("camera");
                  setShowImagePickerModal(false);
                }}
              >
                <LinearGradient
                  colors={["#6366f1", "#8b5cf6"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.imagePickerOptionGradient}
                >
                  <FontAwesome name="camera" size={24} color="#fff" />
                  <Text style={styles.imagePickerOptionText}>Take Photo</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.imagePickerOption}
                onPress={() => {
                  uploadProfileImage("gallery");
                  setShowImagePickerModal(false);
                }}
              >
                <LinearGradient
                  colors={["#8b5cf6", "#a855f7"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.imagePickerOptionGradient}
                >
                  <FontAwesome name="image" size={24} color="#fff" />
                  <Text style={styles.imagePickerOptionText}>
                    Choose from Gallery
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Account Modal */}
      <ConfirmTypedModal
        visible={showDeleteModal}
        title="Delete Account"
        message="This action cannot be undone. All your account data will be permanently deleted."
        confirmWord="DELETE"
        confirmButtonText="Delete Account"
        onConfirm={handleDeleteAccount}
        onCancel={() => setShowDeleteModal(false)}
        dangerMode={true}
      />

      {/* Clear Data Modal */}
      <ConfirmTypedModal
        visible={showClearDataModal}
        title="Clear App Data"
        message="This will delete all downloads, cache, and local data. You will need to download your music again."
        confirmWord="CLEAR"
        confirmButtonText="Clear Data"
        onConfirm={handleClearAppData}
        onCancel={() => setShowClearDataModal(false)}
        dangerMode={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  backButtonContainer: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 40,
    left: 16,
    zIndex: 100,
  },
  backButtonWrapper: {
    borderRadius: 20,
    overflow: "hidden",
    elevation: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  backButtonBlur: {
    width: 40,
    height: 40,
    borderRadius: 20,
    position: "absolute",
    top: 0,
    left: 0,
  },
  backButtonOverlay: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.25)",
    position: "absolute",
    top: 0,
    left: 0,
  },
  backButtonContent: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingTop: Platform.OS === "ios" ? 120 : 100,
  },
  profileSection: {
    alignItems: "center",
    paddingVertical: 32,
  },
  avatarWrapper: {
    marginBottom: 16,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: "#ff0066",
  },
  avatarEditBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#6366f1",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#0a0a0a",
  },
  nameContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  userName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
  },
  editIcon: {
    marginTop: 4,
  },
  userEmail: {
    fontSize: 14,
    color: "#aaa",
    marginTop: 4,
  },
  actionsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  actionButton: {
    alignItems: "center",
    gap: 8,
  },
  actionButtonGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  actionButtonText: {
    fontSize: 12,
    color: "#fff",
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: "#222",
    marginHorizontal: 20,
    marginVertical: 16,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 12,
    marginLeft: 4,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  menuIconContainer: {
    marginRight: 12,
  },
  menuIconGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  menuTextContainer: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 12,
    color: "#aaa",
  },
  googleButton: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 12,
    overflow: "hidden",
  },
  googleButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    gap: 12,
  },
  googleButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.8)",
  },
  modernModal: {
    backgroundColor: "#1F2937",
    borderRadius: 24,
    padding: 28,
    width: "85%",
    maxWidth: 400,
    alignItems: "center",
  },
  modernModalIconContainer: {
    marginBottom: 20,
  },
  modernModalIconGradient: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  modernModalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
    textAlign: "center",
  },
  modernModalSubtitle: {
    fontSize: 14,
    color: "#9CA3AF",
    marginBottom: 24,
    textAlign: "center",
  },
  modernInput: {
    width: "100%",
    backgroundColor: "#374151",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#fff",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#4B5563",
  },
  modernModalButtons: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  modernModalButtonSecondary: {
    flex: 1,
    backgroundColor: "#374151",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  modernModalButtonSecondaryText: {
    color: "#D1D5DB",
    fontSize: 16,
    fontWeight: "600",
  },
  modernModalButtonPrimary: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  modernModalButtonGradient: {
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  modernModalButtonPrimaryText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  themeOptions: {
    width: "100%",
    gap: 12,
    marginBottom: 24,
  },
  themeOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#374151",
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: 2,
    borderColor: "transparent",
  },
  themeOptionActive: {
    borderColor: "#6366f1",
    backgroundColor: "#4B5563",
  },
  themeOptionText: {
    fontSize: 16,
    color: "#9CA3AF",
    fontWeight: "600",
  },
  themeOptionTextActive: {
    color: "#fff",
  },
  imagePickerOptions: {
    width: "100%",
    gap: 12,
    marginBottom: 24,
  },
  imagePickerOption: {
    borderRadius: 12,
    overflow: "hidden",
  },
  imagePickerOptionGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    gap: 12,
  },
  imagePickerOptionText: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "600",
  },
  bottomSpacer: {
    height: 40,
  },
});
