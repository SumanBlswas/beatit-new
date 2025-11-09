// context/AuthContext.tsx
import React, { createContext, ReactNode, useContext, useState } from "react";

// Define the shape of the user data you expect
interface User {
  _id: string;
  name: string;
  email: string;
  // Add any other user properties you expect from your backend
}

// Define the type for your context's value
interface AuthContextType {
  userInfo: User | null;
  isLoading: boolean; // You can add this back if you have loading logic
  signIn: (user: User) => void;
  signOut: () => void;
}

// Create the context with an initial undefined value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [userInfo, setUserInfo] = useState<User | null>(null);

  // This is the function the LoginScreen will call upon successful authentication
  const signIn = (user: User) => {
    setUserInfo(user);
  };

  const signOut = () => {
    // Here you would also clear any stored tokens if necessary
    setUserInfo(null);
  };

  // The value provided to consuming components
  const value = {
    userInfo,
    isLoading: false, // Or manage a real loading state
    signIn,
    signOut,
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
