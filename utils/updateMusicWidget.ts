import * as FileSystem from "expo-file-system";
import { NativeModules } from "react-native";

const { PlaybackInfoModule } = NativeModules;

interface PlaybackInfo {
  songTitle?: string;
  artist?: string;
  albumArtPath?: string;
  isPlaying?: boolean;
  progress?: number;
}

// Cache to store remote URL -> local URI mappings
const imageCache: { [key: string]: string } = {};
// Store last sent data to prevent sending null fields
let lastInfo: { [key: string]: any } = {};

export const updateMusicWidget = async (info: PlaybackInfo) => {
  if (!PlaybackInfoModule || !PlaybackInfoModule.setPlaybackInfo) {
    return;
  }

  // Merge new info with last known info
  // This prevents accidentally nulling out fields
  const infoToUpdate = { ...lastInfo, ...info };
  lastInfo = infoToUpdate; // Update last known info

  // Check if we have an album art path and it's a remote URL (starts with http)
  if (
    infoToUpdate.albumArtPath &&
    infoToUpdate.albumArtPath.startsWith("http")
  ) {
    const remoteUrl = infoToUpdate.albumArtPath;

    // Check if we already downloaded this image
    if (imageCache[remoteUrl]) {
      // Use the cached local path
      infoToUpdate.albumArtPath = imageCache[remoteUrl];
    } else {
      try {
        // Create a unique local filename
        // A simple hash: remove non-alphanumeric chars and take last 20
        const safeName = remoteUrl.replace(/[^a-zA-Z0-9]/g, "");
        const fileExtension =
          remoteUrl.split(".").pop()?.split("?")[0] || "jpg";
        const localUri = `${
          FileSystem.cacheDirectory
        }widget_art_${safeName.slice(-20)}.${fileExtension}`;

        // Download and save the file
        const downloadResult = await FileSystem.downloadAsync(
          remoteUrl,
          localUri
        );

        if (downloadResult.status === 200) {
          // Send the local file path (e.g., file:///...) to the widget
          infoToUpdate.albumArtPath = downloadResult.uri;
          imageCache[remoteUrl] = downloadResult.uri; // Save to cache
        } else {
          infoToUpdate.albumArtPath = undefined; // Download failed
        }
      } catch (e) {
        console.error("Failed to download widget artwork:", e);
        infoToUpdate.albumArtPath = undefined; // Don't try to load a bad path
      }
    }
  }

  PlaybackInfoModule.setPlaybackInfo(infoToUpdate, (success: boolean) => {
    // You can log success or handle errors here if needed
    // console.log('Widget update success:', success);
  });
};
