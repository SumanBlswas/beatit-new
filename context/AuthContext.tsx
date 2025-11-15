// context/AuthContext.tsx
import {
  clearAppData as clearStorageData,
  deleteProfileImage,
  getUserProfile,
  saveProfileImage,
  saveUserProfile,
  setLoggedOutFlag,
  UserProfile
} from "@/utils/storage";
import * as ImagePicker from 'expo-image-picker';
import React, { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { Alert } from "react-native";

// Define the shape of the user data you expect
interface User {
  _id: string;
  name: string;
  email: string;
  avatarUri?: string;
  gender?: 'male' | 'female';
  googleId?: string;
  googlePhotoUrl?: string;
  // Add any other user properties you expect from your backend
}

// Define the type for your context's value
interface AuthContextType {
  userInfo: User | null;
  isLoading: boolean;
  signIn: (user: User) => void;
  signOut: () => void;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  uploadProfileImage: (source: 'camera' | 'gallery') => Promise<void>;
  deleteAccount: () => Promise<void>;
  clearAppData: () => Promise<void>;
}

// Create the context with an initial undefined value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [userInfo, setUserInfo] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user profile on mount
  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      const profile = await getUserProfile();
      if (profile) {
        setUserInfo({
          _id: profile.googleId || 'local',
          name: profile.name,
          email: profile.email,
          avatarUri: profile.avatarUri,
          gender: profile.gender,
          googleId: profile.googleId,
          googlePhotoUrl: profile.googlePhotoUrl,
        });
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // This is the function the LoginScreen will call upon successful authentication
  const signIn = async (user: User) => {
    setUserInfo(user);
    // Save to storage
    const profile: UserProfile = {
      name: user.name,
      email: user.email,
      avatarUri: user.avatarUri,
      gender: user.gender,
      googleId: user.googleId,
      googlePhotoUrl: user.googlePhotoUrl,
    };
    await saveUserProfile(profile);
    await setLoggedOutFlag(false); // Clear logged out flag on manual login
  };

  const signOut = async () => {
    setUserInfo(null);
    // Keep local data, just clear user session
    const profile = await getUserProfile();
    if (profile) {
      await saveUserProfile({
        ...profile,
        name: '',
        email: '',
        googleId: undefined,
        googlePhotoUrl: undefined,
      });
    }
    await setLoggedOutFlag(true); // Set logged out flag
  };

  const updateProfile = async (updates: Partial<User>) => {
    if (!userInfo) return;

    const updatedUser = { ...userInfo, ...updates };
    setUserInfo(updatedUser);

    // Save to storage
    const profile: UserProfile = {
      name: updatedUser.name,
      email: updatedUser.email,
      avatarUri: updatedUser.avatarUri,
      gender: updatedUser.gender,
      googleId: updatedUser.googleId,
      googlePhotoUrl: updatedUser.googlePhotoUrl,
    };
    await saveUserProfile(profile);
  };

  const uploadProfileImage = async (source: 'camera' | 'gallery') => {
    try {
      // Request permissions
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Camera permission is required to take photos.');
          return;
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Gallery permission is required to select photos.');
          return;
        }
      }

      // Launch picker
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });

      if (!result.canceled && result.assets[0]) {
        // Delete old image if exists
        if (userInfo?.avatarUri) {
          await deleteProfileImage();
        }

        // Save new image
        await saveProfileImage(result.assets[0].uri);
        await updateProfile({ avatarUri: result.assets[0].uri });
      }
    } catch (error) {
      console.error('Error uploading profile image:', error);
      Alert.alert('Error', 'Failed to upload profile image. Please try again.');
    }
  };

  const deleteAccount = async () => {
    try {
      // Call backend API if available
      // await api.deleteAccount(userInfo?._id);
      
      // Clear local user data
      if (userInfo?.avatarUri) {
        await deleteProfileImage();
      }
      
      await saveUserProfile({
        name: '',
        email: '',
        avatarUri: undefined,
        gender: undefined,
        googleId: undefined,
        googlePhotoUrl: undefined,
      });
      
      setUserInfo(null);
    } catch (error) {
      console.error('Error deleting account:', error);
      throw error;
    }
  };

  const clearAppData = async () => {
    try {
      await clearStorageData();
      setUserInfo(null);
    } catch (error) {
      console.error('Error clearing app data:', error);
      throw error;
    }
  };

  // The value provided to consuming components
  const value = {
    userInfo,
    isLoading,
    signIn,
    signOut,
    updateProfile,
    uploadProfileImage,
    deleteAccount,
    clearAppData,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to easily access the auth context in other components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
