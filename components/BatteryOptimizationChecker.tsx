// components/BatteryOptimizationChecker.tsx

/**
 * Battery Optimization Checker Component
 * Checks and prompts user about battery optimization on mount
 */

import { useGlobalAlert } from "@/context/GlobalAlertContext";
import {
  getBatteryOptimizationInstructions,
  shouldShowBatteryOptimizationPrompt,
} from "@/services/batteryOptimizationService";
import * as IntentLauncher from "expo-intent-launcher";
import { useEffect } from "react";
import { Platform } from "react-native";

export const BatteryOptimizationChecker: React.FC = () => {
  const { showAlert } = useGlobalAlert();

  useEffect(() => {
    const checkBatteryOptimization = async () => {
      if (Platform.OS !== "android") {
        return;
      }

      const shouldShow = await shouldShowBatteryOptimizationPrompt();

      if (shouldShow) {
        // Wait a bit after app loads
        setTimeout(() => {
          const instructions = getBatteryOptimizationInstructions();

          showAlert({
            title: "🔋 Battery Optimization",
            message:
              "For uninterrupted music playback and to prevent the app from being killed in the background, please disable battery optimization.\n\n" +
              instructions,
            type: "warning",
            buttons: [
              { text: "Later", style: "cancel" },
              {
                text: "Open Battery Usage",
                style: "default",
                onPress: async () => {
                  try {
                    await IntentLauncher.startActivityAsync(
                      "android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS",
                      { data: "package:com.songeet" }
                    );
                  } catch (error) {
                    console.error(
                      "Failed to open battery usage settings:",
                      error
                    );
                  }
                },
              },
            ],
          });
        }, 2500); // Show after splash screen
      }
    };

    checkBatteryOptimization();
  }, [showAlert]);

  return null; // This component doesn't render anything
};
