import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import { useColorScheme } from "react-native";
import { useAmbientTheme } from "../hooks/useAmbientTheme";

export const lightTheme = {
  background: "#F0F0F0",
  card: "#FFFFFF",
  text: "#121212",
  textSecondary: "#666666",
  primary: "#ff6600",
  separator: "#E0E0E0",
  overlay: "rgba(0, 0, 0, 0.4)",
};

export const darkTheme = {
  background: "#121212",
  card: "#1C1C1C",
  text: "#FFFFFF",
  textSecondary: "#AAAAAA",
  primary: "#ff6600",
  separator: "#2C2C2C",
  overlay: "rgba(0, 0, 0, 0.6)",
};

interface ThemeContextType {
  theme: "light" | "dark";
  colors: typeof lightTheme;
  toggleTheme: () => void;
  mode: "manual" | "auto" | "reverse";
  setMode: (mode: "manual" | "auto" | "reverse") => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const systemScheme = useColorScheme();
  const [theme, setTheme] = useState(systemScheme || "dark");
  const [mode, setMode] = useState<"manual" | "auto" | "reverse">("manual");

  // Use ambient theme only if mode is auto or reverse
  const ambientEnv = useAmbientTheme(mode === "auto" || mode === "reverse");

  useEffect(() => {
    const loadTheme = async () => {
      const savedTheme = (await AsyncStorage.getItem("app-theme")) as
        | "light"
        | "dark"
        | null;
      const savedMode = (await AsyncStorage.getItem("theme-mode")) as
        | "manual"
        | "auto"
        | "reverse"
        | null;
      if (savedTheme) {
        setTheme(savedTheme);
      }
      if (savedMode === "auto" || savedMode === "reverse" || savedMode === "manual") {
        setMode(savedMode);
      }
    };
    loadTheme();
  }, []);

  useEffect(() => {
    if (mode === "auto" && (ambientEnv === "dark" || ambientEnv === "light")) {
      setTheme(ambientEnv);
    } else if (mode === "reverse" && (ambientEnv === "dark" || ambientEnv === "light")) {
      setTheme(ambientEnv === "dark" ? "light" : "dark");
    }
    // If manual, do not change theme
  }, [mode, ambientEnv]);

  const toggleTheme = async () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    await AsyncStorage.setItem("app-theme", newTheme);
  };

  const handleSetMode = async (newMode: "manual" | "auto" | "reverse") => {
    setMode(newMode);
    await AsyncStorage.setItem("theme-mode", newMode);
    if (newMode === "manual") {
      // Persist current theme as manual
      await AsyncStorage.setItem("app-theme", theme);
    }
  };

  const colors = useMemo(
    () => (theme === "light" ? lightTheme : darkTheme),
    [theme]
  );

  const value = {
    theme,
    colors,
    toggleTheme,
    mode,
    setMode: handleSetMode,
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
