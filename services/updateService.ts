import { CURRENT_VERSION_CODE } from "@/constants/AppVersion";
import * as FileSystem from "expo-file-system";
import * as IntentLauncher from "expo-intent-launcher";
import * as Sharing from "expo-sharing";
import { Alert, Platform } from "react-native";

const UPDATE_JSON_URL =
  "https://raw.githubusercontent.com/SumanBlswas/beatit-new/refs/heads/main/update.json";

export interface UpdateInfo {
  version: string;
  versionCode: number;
  releaseNotes: string[];
  downloadUrl: string;
  updateRequired: boolean;
  isCritical?: boolean;
}

export const checkForUpdate = async (): Promise<UpdateInfo | null> => {
  try {
    const response = await fetch(UPDATE_JSON_URL, { cache: "no-cache" });
    if (!response.ok) return null;

    const data = await response.json();
    const remoteVersionCode = data.versionCode || 0;

    // Check if update is available
    if (remoteVersionCode > CURRENT_VERSION_CODE) {
      // Check for critical update (3 versions behind)
      const isCritical = remoteVersionCode - CURRENT_VERSION_CODE >= 3;

      return {
        version: data.version,
        versionCode: remoteVersionCode,
        releaseNotes: data.releaseNotes || [],
        downloadUrl: data.downloadUrl,
        updateRequired: data.updateRequired || false,
        isCritical,
      };
    }

    return null;
  } catch (error) {
    console.warn("[UpdateService] Check failed:", error);
    return null;
  }
};

export const isUpdateDownloaded = async (version: string): Promise<boolean> => {
  try {
    const fileName = `beatit-v${version}.apk`;
    const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
    const info = await FileSystem.getInfoAsync(fileUri);
    return info.exists;
  } catch (e) {
    return false;
  }
};

export const installUpdate = async (version: string): Promise<void> => {
  try {
    const fileName = `beatit-v${version}.apk`;
    const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
    const info = await FileSystem.getInfoAsync(fileUri);

    if (!info.exists) {
      throw new Error("Update file not found");
    }

    if (Platform.OS === "android") {
      const contentUri = await FileSystem.getContentUriAsync(fileUri);
      await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
        data: contentUri,
        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
        type: "application/vnd.android.package-archive",
      });
    }
  } catch (error) {
    console.error("Install failed, falling back to share:", error);
    // Fallback
    const fileName = `beatit-v${version}.apk`;
    const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: "application/vnd.android.package-archive",
        dialogTitle: "Install Update",
      });
    }
  }
};

export const downloadAndInstallUpdate = async (
  downloadUrl: string,
  fileName: string = "beatit-update.apk",
  onProgress?: (progress: number) => void,
): Promise<void> => {
  try {
    if (Platform.OS !== "android") {
      Alert.alert(
        "Update",
        "Automatic updates are only supported on Android. Please update via your App Store.",
      );
      return;
    }

    const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

    const downloadResumable = FileSystem.createDownloadResumable(
      downloadUrl,
      fileUri,
      {},
      (downloadProgress) => {
        const progress =
          downloadProgress.totalBytesWritten /
          downloadProgress.totalBytesExpectedToWrite;
        if (onProgress) onProgress(progress);
      },
    );

    const result = await downloadResumable.downloadAsync();

    if (result?.uri) {
      // Try IntentLauncher first for direct install
      try {
        const contentUri = await FileSystem.getContentUriAsync(result.uri);
        await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
          data: contentUri,
          flags: 1,
          type: "application/vnd.android.package-archive",
        });
      } catch (e) {
        console.log("IntentLauncher failed, trying Sharing");
        // Share/Install Fallback
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(result.uri, {
            mimeType: "application/vnd.android.package-archive",
            dialogTitle: "Install Update",
          });
        } else {
          Alert.alert(
            "Error",
            "Sharing is not available to install the update.",
          );
        }
      }
    }
  } catch (error) {
    console.error("[UpdateService] Download failed:", error);
    throw error;
  }
};
