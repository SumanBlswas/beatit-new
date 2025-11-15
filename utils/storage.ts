import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  autoAcceptNfc: boolean;
  shareUsageAnonymously: boolean;
}

export interface UserProfile {
  name: string;
  email: string;
  avatarUri?: string;
  googlePhotoUrl?: string;
  gender?: 'male' | 'female';
  googleId?: string;
}

const SETTINGS_KEY = 'app-settings';
const PROFILE_KEY = 'user-profile';
const LOGGED_OUT_KEY = 'logged-out-flag';
const PROFILE_IMAGE_KEY = 'profile-image-uri';

export async function saveAppSettings(settings: AppSettings) {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export async function getAppSettings(): Promise<AppSettings | null> {
  const raw = await AsyncStorage.getItem(SETTINGS_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function saveUserProfile(profile: UserProfile) {
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export async function getUserProfile(): Promise<UserProfile | null> {
  const raw = await AsyncStorage.getItem(PROFILE_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function clearAppData() {
  await AsyncStorage.clear();
}

export async function exportUserData(): Promise<string> {
  const settings = await getAppSettings();
  const profile = await getUserProfile();
  const exportObj = {
    settings,
    profile,
    exportedAt: new Date().toISOString(),
  };
  return JSON.stringify(exportObj, null, 2);
}

export async function saveProfileImage(uri: string) {
  await AsyncStorage.setItem(PROFILE_IMAGE_KEY, uri);
}

export async function getProfileImage(): Promise<string | null> {
  return await AsyncStorage.getItem(PROFILE_IMAGE_KEY);
}

export async function deleteProfileImage() {
  await AsyncStorage.removeItem(PROFILE_IMAGE_KEY);
}

export async function setLoggedOutFlag(flag: boolean) {
  await AsyncStorage.setItem(LOGGED_OUT_KEY, flag ? 'true' : 'false');
}

export async function getLoggedOutFlag(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(LOGGED_OUT_KEY);
  return raw === 'true';
}
