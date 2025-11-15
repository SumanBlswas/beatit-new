// app/(tabs)/downloads.tsx
import VideoPlayer from "@/components/VideoPlayer";
import { usePlayer } from "@/context/PlayerContext"; // Assuming PlayerContext is accessible
import { ApiSong } from "@/services/apiTypes";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import * as Network from "expo-network";
import { Stack, router, useFocusEffect, useSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Helper functions (copy from index.tsx or a shared utility file)
const decodeHtmlEntities = (text: string): string => {
  if (!text) return text;
  return text
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
};

const getImageUrl = (
  imageInput: any[] | string | undefined,
  quality: string = "150x150"
): string => {
  const placeholder = "https://via.placeholder.com/150/121212/FFFFFF/?text=S";
  if (
    !imageInput ||
    (typeof imageInput === "string" && imageInput.trim() === "")
  )
    return placeholder;
  if (typeof imageInput === "string") return imageInput;
  if (Array.isArray(imageInput) && imageInput.length > 0) {
    const qualityImage = imageInput.find(
      (img) => img.quality === quality && img.link
    );
    if (qualityImage) return qualityImage.link;
    const highRes = imageInput.find(
      (img) => img.quality === "500x500" && img.link
    );
    if (highRes) return highRes.link;
    const anyImage = imageInput.find((img) => img.link);
    if (anyImage) return anyImage.link;
  }
  return placeholder;
};

const getArtistNameFromPrimary = (
  artistsInput: any[] | string | undefined
): string => {
  if (!artistsInput) return "Unknown Artist";
  if (typeof artistsInput === "string") return decodeHtmlEntities(artistsInput);
  if (Array.isArray(artistsInput) && artistsInput.length > 0) {
    return artistsInput
      .map((a: any) => decodeHtmlEntities(a.name || a.id || ""))
      .filter((name) => name)
      .join(", ");
  }
  return "Unknown Artist";
};

const sanitizeSongTitle = (title: string | undefined): string => {
  if (!title) return "Unknown Title";
  return decodeHtmlEntities(title.split("(")[0].trim());
};

const STORAGE_KEYS = {
  USER_DOWNLOADS: "user_downloads",
  USER_GMAIL: "user_gmail", // Needed for potential re-login
};

export default function DownloadsScreen() {
  const { playSong, setQueue } = usePlayer();
  const params = useSearchParams();
  const playUriParam = params.playUri as string | undefined;
  const [videoModalVisible, setVideoModalVisible] = useState(false);
  const [videoModalUri, setVideoModalUri] = useState<string | null>(null);
  const [videoModalTitle, setVideoModalTitle] = useState<string | undefined>(undefined);
  const [downloadedSongs, setDownloadedSongs] = useState<ApiSong[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [downloadProgresses, setDownloadProgresses] = useState<{
    [songId: string]: number;
  }>({});

  const loadDownloadedSongs = useCallback(async () => {
    setIsLoading(true);
    try {
      const savedDownloads = await AsyncStorage.getItem(
        STORAGE_KEYS.USER_DOWNLOADS
      );
      if (savedDownloads) {
        setDownloadedSongs(JSON.parse(savedDownloads));
      }
    } catch (error) {
      console.error("Failed to load downloaded songs:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDownloadedSongs();

    // Replace the NetInfo.addEventListener block with this:
    const unsubscribeNetwork = Network.addNetworkStateListener((state) => {
      const isConnectedNow = state.isConnected && state.isInternetReachable; // Use isConnected and isInternetReachable
      setIsOffline(!isConnectedNow);
      if (isConnectedNow) {
        // If we come online, redirect to the main app page
        router.replace("/");
      }
    });

    return () => unsubscribeNetwork.remove(); // Clean up network listener
  }, [loadDownloadedSongs]);

  // Use useFocusEffect to ensure data is fresh when navigating back
  useFocusEffect(
    useCallback(() => {
      loadDownloadedSongs();
    }, [loadDownloadedSongs])
  );

  // If a playUri param is present (e.g. from external Open-With), attempt to play it
  useEffect(() => {
    if (!playUriParam) return;
    let mounted = true;
    (async () => {
      try {
        const uri = decodeURIComponent(playUriParam);
        const info = await FileSystem.getInfoAsync(uri);
        if (!mounted) return;
        if (!info.exists) {
          Alert.alert("File not found", "The selected file could not be found on device.");
          try { router.replace('/downloads'); } catch {}
          return;
        }

        // Determine if this is a video by file extension
        const lower = uri.split('?')[0].toLowerCase();
        const isVideo = !!lower.match(/\.(mp4|m4v|mov|webm|mkv|avi)$/);

        if (isVideo) {
          // Open VideoPlayer directly (bypass PlayerContext) for local videos
          setVideoModalUri(uri);
          setVideoModalTitle(uri.split('/').pop() || 'External Video');
          setVideoModalVisible(true);
          // Clear query param so navigating back doesn't replay
          try { router.replace('/downloads'); } catch {}
          return;
        }

        // Not a video — treat as audio and use existing downloads playback
        const tempSong: ApiSong = {
          id: `external-${Date.now()}`,
          name: uri.split("/").pop() || "External Media",
          title: uri.split("/").pop() || "External Media",
          downloadUrl: [{ link: uri, quality: "320kbps" }],
          localUri: uri,
        } as any;
        setQueue([tempSong], 0);
        await playSong(tempSong);
        // Clear query param so navigating back doesn't replay
        try { router.replace('/downloads'); } catch {}
      } catch (err) {
        console.warn("Failed to play external file from downloads screen:", err);
      }
    })();
    return () => { mounted = false; };
  }, [playUriParam, playSong, setQueue]);

  const handlePlayDownloadedSong = useCallback(
    async (song: ApiSong) => {
      if (song.localUri) {
        // Create a temporary ApiSong with localUri as the primary source
        const songToPlay: ApiSong = {
          ...song,
          downloadUrl: song.localUri, // PlayerContext's playSong should prioritize this
        };
        setQueue([songToPlay], 0);
        await playSong(songToPlay);
      } else {
        Alert.alert("Error", "Local file not found for this song.");
      }
    },
    [playSong, setQueue]
  );

  const handleDeleteDownloadedSong = useCallback(
    async (song: ApiSong) => {
      Alert.alert(
        "Remove Download",
        `Are you sure you want to remove "${sanitizeSongTitle(
          song.name || song.title
        )}" from your downloads? This will delete the file from your device.`,
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Delete",
            onPress: async () => {
              try {
                if (song.localUri) {
                  await FileSystem.deleteAsync(song.localUri);
                  console.log(`Deleted file: ${song.localUri}`);
                }
                const newDownloadedSongs = downloadedSongs.filter(
                  (s) => s.id !== song.id
                );
                setDownloadedSongs(newDownloadedSongs);
                await AsyncStorage.setItem(
                  STORAGE_KEYS.USER_DOWNLOADS,
                  JSON.stringify(newDownloadedSongs)
                );
                Alert.alert(
                  "Removed",
                  `"${sanitizeSongTitle(song.name || song.title)}" removed.`
                );
              } catch (error) {
                console.error("Failed to delete song:", error);
                Alert.alert(
                  "Error",
                  "Failed to delete song. Please try again."
                );
              }
            },
          },
        ]
      );
    },
    [downloadedSongs]
  );

  const renderDownloadedSongItem = ({ item }: { item: ApiSong }) => (
    <TouchableOpacity
      style={styles.songItem}
      onPress={() => handlePlayDownloadedSong(item)}
      onLongPress={() => handleDeleteDownloadedSong(item)}
      delayLongPress={1000}
    >
      <Image
        source={{ uri: getImageUrl(item.image, "150x150") }}
        style={styles.songArtwork}
      />
      <View style={styles.songInfo}>
        <Text style={styles.songTitle} numberOfLines={1}>
          {sanitizeSongTitle(item.name || item.title)}
        </Text>
        <Text style={styles.songArtist} numberOfLines={1}>
          {getArtistNameFromPrimary(item.primaryArtists)}
        </Text>
        {downloadProgresses[item.id] !== undefined &&
          downloadProgresses[item.id] < 100 && (
            <Text style={styles.downloadProgressText}>
              Downloading: {downloadProgresses[item.id]}%
            </Text>
          )}
        {item.localUri && downloadProgresses[item.id] === undefined && (
          <Text style={styles.downloadProgressText}>Offline</Text>
        )}
      </View>
      <TouchableOpacity
        onPress={() => handleDeleteDownloadedSong(item)}
        style={styles.deleteButton}
      >
        <FontAwesome name="trash" size={20} color="#ff4444" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Downloads</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <FontAwesome name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {isOffline && (
        <View style={styles.offlineBanner}>
          <FontAwesome
            name="wifi"
            size={20}
            color="#fff"
            style={{ marginRight: 10 }}
          />
          <Text style={styles.offlineText}>
            You are currently offline. Only downloaded songs are available.
          </Text>
        </View>
      )}

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1DB954" />
          <Text style={styles.loadingText}>Loading downloads...</Text>
        </View>
      ) : downloadedSongs.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No downloaded songs yet.</Text>
          {!isOffline && (
            <TouchableOpacity
              onPress={() => router.replace("/")}
              style={styles.browseButton}
            >
              <Text style={styles.browseButtonText}>Browse Online</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={downloadedSongs}
          renderItem={renderDownloadedSongItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContentContainer}
        />
      )}

      {/* Local Video modal used when opening from file manager */}
      <VideoPlayer
        visible={videoModalVisible}
        videoUri={videoModalUri ?? ""}
        videoTitle={videoModalTitle}
        onClose={() => setVideoModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#121212",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
    position: "relative",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
  backButton: {
    position: "absolute",
    left: 15,
    padding: 5,
  },
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF6600",
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  offlineText: {
    color: "#fff",
    fontSize: 14,
    textAlign: "center",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingText: {
    color: "#fff",
    marginTop: 10,
    fontSize: 16,
  },
  emptyText: {
    color: "#ccc",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
  },
  browseButton: {
    backgroundColor: "#1DB954",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
  },
  browseButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  listContentContainer: {
    paddingBottom: 20,
    paddingHorizontal: 10,
  },
  songItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 8,
    marginVertical: 5,
    padding: 10,
  },
  songArtwork: {
    width: 60,
    height: 60,
    borderRadius: 6,
    marginRight: 15,
    backgroundColor: "#2a2a2a",
  },
  songInfo: {
    flex: 1,
  },
  songTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  songArtist: {
    color: "#ccc",
    fontSize: 13,
    marginTop: 2,
  },
  downloadProgressText: {
    color: "#1DB954",
    fontSize: 12,
    marginTop: 4,
    fontWeight: "bold",
  },
  deleteButton: {
    padding: 10,
    marginLeft: 10,
  },
});
