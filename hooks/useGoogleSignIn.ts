import { makeRedirectUri } from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";

// Required for web browser to close properly after authentication
WebBrowser.maybeCompleteAuthSession();

interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
}

export const useGoogleSignIn = () => {
  const [userInfo, setUserInfo] = useState<GoogleUserInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Configure Google Sign-In
  // Replace with your actual Google Client IDs from Google Cloud Console
  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: "YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com",
    iosClientId: "YOUR_IOS_CLIENT_ID.apps.googleusercontent.com",
    webClientId: "YOUR_WEB_CLIENT_ID.apps.googleusercontent.com",
    redirectUri: makeRedirectUri({
      scheme: "rear",
      path: "redirect",
    }),
  });

  useEffect(() => {
    if (response?.type === "success") {
      const { authentication } = response;
      if (authentication?.accessToken) {
        getUserInfo(authentication.accessToken);
      }
    } else if (response?.type === "error") {
      setError("Authentication failed");
      setLoading(false);
    }
  }, [response]);

  const getUserInfo = async (token: string) => {
    try {
      setLoading(true);
      const response = await fetch(
        "https://www.googleapis.com/userinfo/v2/me",
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to fetch user info");
      }

      const user = await response.json();
      setUserInfo(user);
      setError(null);
    } catch (err) {
      console.error("Error fetching user info:", err);
      setError("Failed to get user information");
    } finally {
      setLoading(false);
    }
  };

  const signIn = async () => {
    try {
      setLoading(true);
      setError(null);
      await promptAsync();
    } catch (err) {
      console.error("Sign in error:", err);
      setError("Sign in failed");
      setLoading(false);
    }
  };

  const signOut = () => {
    setUserInfo(null);
    setError(null);
  };

  return {
    signIn,
    signOut,
    userInfo,
    loading,
    error,
    request,
  };
};
