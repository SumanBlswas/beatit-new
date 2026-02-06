import VideoPlayer from "@/components/VideoPlayer";
import { useCurrentSong, useIsPlaying, usePlayer } from "@/context/PlayerContext";
import { ApiSong } from "@/services/apiTypes";
import { copyContentUriToCache, extractAudioMetadata } from "@/services/contentUriCopy";
import {
  deleteDownloadedSong,
  formatBytes,
  getDownloadedSongs,
  getTotalDownloadSize,
} from "@/services/downloadService";
import { useNetworkStatus } from "@/services/networkService";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from "expo-file-system";
import { LinearGradient } from "expo-linear-gradient";
import * as MediaLibrary from "expo-media-library";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import TrackPlayer from "react-native-track-player";

// Animated scrolling text component for long titles
const ScrollingText = ({ text, style }: { text: string; style: any }) => {
  const [containerWidth, setContainerWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const scrollAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (textWidth > containerWidth && containerWidth > 0) {
      // Text is longer than container, start animation
      const duration = (textWidth + containerWidth) * 30; // Adjust speed here

      Animated.loop(
        Animated.sequence([
          Animated.delay(1000), // Wait 1 second before starting
          Animated.timing(scrollAnim, {
            toValue: -(textWidth + 20), // Scroll past the text
            duration: duration,
            useNativeDriver: true,
          }),
          Animated.delay(500), // Pause at the end
          Animated.timing(scrollAnim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [textWidth, containerWidth, scrollAnim]);

  return (
    <View
      style={{ overflow: 'hidden', width: '100%' }}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      <Animated.View
        style={{
          transform: [{ translateX: scrollAnim }],
          flexDirection: 'row',
        }}
      >
        <Text
          style={style}
          numberOfLines={1}
          onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)}
        >
          {text}
        </Text>
      </Animated.View>
    </View>
  );
};

export default function DownloadsScreen() {
  const [downloads, setDownloads] = useState<any[]>([]);
  const [albums, setAlbums] = useState<{ name: string; songs: any[]; artwork: string }[]>([]);
  const [playlists, setPlaylists] = useState<{ name: string; songs: any[]; artwork: string }[]>([]);
  const [individualSongs, setIndividualSongs] = useState<any[]>([]);
  const [totalSize, setTotalSize] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [deviceStorage, setDeviceStorage] = useState<{ total: number; free: number } | null>(null);
  const [activeTab, setActiveTab] = useState<"songs" | "albums" | "playlists">("albums");
  const [expandedAlbum, setExpandedAlbum] = useState<string | null>(null);
  const [pageMode, setPageMode] = useState<'downloads' | 'local'>('downloads');
  const scrollViewRef = React.useRef<ScrollView>(null);
  const screenWidth = Dimensions.get('window').width;

  // Local files states
  const [localTab, setLocalTab] = useState<"audio" | "video">("audio");
  const [audioFiles, setAudioFiles] = useState<MediaLibrary.Asset[]>([]);
  const [videoFiles, setVideoFiles] = useState<MediaLibrary.Asset[]>([]);
  const [mediaPermission, setMediaPermission] = useState<boolean>(false);
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<{ uri: string; title: string; width?: number; height?: number } | null>(null);

  // Selection mode states
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteModalData, setDeleteModalData] = useState<{
    type: 'single' | 'multiple' | 'collection';
    title: string;
    count: number;
    onConfirm: () => void;
  } | null>(null);

  const playerActions = usePlayer();
  const currentSong = useCurrentSong();
  const isPlaying = useIsPlaying();
  const { isOnline } = useNetworkStatus();
  const router = useRouter();

  // Check existing media permissions on mount
  useEffect(() => {
    const checkPermissions = async () => {
      try {
        const { status } = await MediaLibrary.getPermissionsAsync();
        const granted = status === 'granted';
        setMediaPermission(granted);
        if (granted) {
          await loadMediaFiles();
        }
      } catch (error) {
        console.error("Error checking permissions:", error);
      }
    };
    checkPermissions();
  }, []);

  // If an external file was passed via AsyncStorage (set by PlayerContext when
  // handling Open With), handle it here and then clear the key.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('external_play_uri');
        if (!mounted || !stored) return;
        await AsyncStorage.removeItem('external_play_uri');

        const uri = stored;
        const info = await FileSystem.getInfoAsync(uri);
        if (!info.exists) {
          Alert.alert('File not found', 'The selected file could not be found on device.');
          try { router.replace('/(tabs)/downloads'); } catch { }
          return;
        }

        const lower = uri.split('?')[0].toLowerCase();
        const isVideo = !!lower.match(/\.(mp4|m4v|mov|webm|mkv|avi)$/);
        if (isVideo) {
          // Ensure we are on the Local page and video tab
          setPageMode('local');
          setLocalTab('video');
          // scroll to local page immediately
          setTimeout(() => {
            scrollViewRef.current?.scrollTo({ x: Dimensions.get('window').width, animated: false });
          }, 50);

          setSelectedVideo({ uri, title: uri.split('/').pop() || 'External Video', width: undefined, height: undefined });
          try { router.replace('/(tabs)/downloads'); } catch { }
        } else {
          // Non-video: hand off to PlayerContext playback
          const tempSong: ApiSong = {
            id: `external-${Date.now()}`,
            name: uri.split('/').pop() || 'External Media',
            title: uri.split('/').pop() || 'External Media',
            downloadUrl: [{ link: uri, quality: '320kbps' }],
            localUri: uri,
          } as any;
          playerActions.setQueue([tempSong], 0);
          await playerActions.playSong(tempSong);
          try { router.replace('/(tabs)/downloads'); } catch { }
        }
      } catch (err) {
        console.warn('Failed to handle external_play_uri in downloads page:', err);
      }
    })();
    return () => { mounted = false; };
  }, [playerActions, router]);

  // Media Library functions
  const requestMediaPermissions = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      const granted = status === 'granted';
      setMediaPermission(granted);
      if (granted) {
        await loadMediaFiles();
      }
      return granted;
    } catch (error) {
      console.error("Error requesting permissions:", error);
      return false;
    }
  };

  const loadMediaFiles = async () => {
    try {
      setIsLoadingMedia(true);

      // Fetch ALL audio files with pagination
      let allAudioFiles: MediaLibrary.Asset[] = [];
      let audioHasNext = true;
      let audioEndCursor: string | undefined = undefined;

      while (audioHasNext) {
        const audioMedia = await MediaLibrary.getAssetsAsync({
          mediaType: 'audio',
          first: 100,
          after: audioEndCursor,
          sortBy: [[MediaLibrary.SortBy.creationTime, false]],
        });
        allAudioFiles = [...allAudioFiles, ...audioMedia.assets];
        audioHasNext = audioMedia.hasNextPage;
        audioEndCursor = audioMedia.endCursor;
        console.log(`Audio batch: ${audioMedia.assets.length}, Total so far: ${allAudioFiles.length}, Has next: ${audioHasNext}`);
      }

      // Fetch ALL video files with pagination
      let allVideoFiles: MediaLibrary.Asset[] = [];
      let videoHasNext = true;
      let videoEndCursor: string | undefined = undefined;

      while (videoHasNext) {
        const videoMedia = await MediaLibrary.getAssetsAsync({
          mediaType: 'video',
          first: 100,
          after: videoEndCursor,
          sortBy: [[MediaLibrary.SortBy.creationTime, false]],
        });
        allVideoFiles = [...allVideoFiles, ...videoMedia.assets];
        videoHasNext = videoMedia.hasNextPage;
        videoEndCursor = videoMedia.endCursor;
        console.log(`Video batch: ${videoMedia.assets.length}, Total so far: ${allVideoFiles.length}, Has next: ${videoHasNext}`);
      }

      console.log(`FINAL: Loaded ${allAudioFiles.length} audio files and ${allVideoFiles.length} video files`);

      setAudioFiles(allAudioFiles);
      setVideoFiles(allVideoFiles);

    } catch (error) {
      console.error("Error loading media files:", error);
    } finally {
      setIsLoadingMedia(false);
    }
  };

  const loadStorageInfo = useCallback(async () => {
    try {
      const info = await FileSystem.getFreeDiskStorageAsync();
      // Approximate total storage (this is a rough estimate)
      const totalStorage = info * 2; // Assuming free is roughly half
      setDeviceStorage({ total: totalStorage, free: info });
    } catch (error) {
      console.error("Error loading storage info:", error);
    }
  }, []);

  const loadDownloads = useCallback(async () => {
    try {
      setIsLoading(true);
      const [downloadedSongs, size] = await Promise.all([
        getDownloadedSongs(),
        getTotalDownloadSize(),
      ]);
      setDownloads(downloadedSongs);
      setTotalSize(size);

      // Group songs by collection type and name
      const albumGroups: { [key: string]: any[] } = {};
      const playlistGroups: { [key: string]: any[] } = {};
      const singles: any[] = [];

      downloadedSongs.forEach((song: any) => {
        const collectionType = song.collectionType || 'individual';
        const collectionName = song.collectionName || song.album?.name || "Unknown Album";

        if (collectionType === 'album') {
          if (!albumGroups[collectionName]) {
            albumGroups[collectionName] = [];
          }
          albumGroups[collectionName].push(song);
        } else if (collectionType === 'playlist') {
          if (!playlistGroups[collectionName]) {
            playlistGroups[collectionName] = [];
          }
          playlistGroups[collectionName].push(song);
        } else {
          singles.push(song);
        }
      });

      // Convert groups to arrays
      const completeAlbums: { name: string; songs: any[]; artwork: string }[] = [];
      Object.entries(albumGroups).forEach(([albumName, songs]) => {
        if (songs.length > 0) {
          completeAlbums.push({
            name: albumName,
            songs: songs,
            artwork: getImageUrl(songs[0]?.image)
          });
        }
      });

      const completePlaylists: { name: string; songs: any[]; artwork: string }[] = [];
      Object.entries(playlistGroups).forEach(([playlistName, songs]) => {
        if (songs.length > 0) {
          completePlaylists.push({
            name: playlistName,
            songs: songs,
            artwork: getImageUrl(songs[0]?.image)
          });
        }
      });

      setAlbums(completeAlbums);
      setPlaylists(completePlaylists);
      setIndividualSongs(singles);

      await loadStorageInfo();
    } catch (error) {
      console.error("Error loading downloads:", error);
    } finally {
      setIsLoading(false);
    }
  }, [loadStorageInfo]);

  useFocusEffect(
    useCallback(() => {
      loadDownloads();
    }, [loadDownloads])
  );

  // Selection mode functions
  const toggleSelection = useCallback((songId: string) => {
    setSelectedSongs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(songId)) {
        newSet.delete(songId);
      } else {
        newSet.add(songId);
      }
      return newSet;
    });
  }, []);

  const selectAll = useCallback(() => {
    const allSongIds = new Set<string>();
    if (activeTab === 'albums') {
      albums.forEach(album => album.songs.forEach(song => allSongIds.add(song.id)));
    } else if (activeTab === 'playlists') {
      playlists.forEach(playlist => playlist.songs.forEach(song => allSongIds.add(song.id)));
    } else {
      individualSongs.forEach(song => allSongIds.add(song.id));
    }
    setSelectedSongs(allSongIds);
  }, [activeTab, albums, playlists, individualSongs]);

  const deselectAll = useCallback(() => {
    setSelectedSongs(new Set());
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedSongs(new Set());
  }, []);

  const handleDeleteSelected = useCallback(() => {
    if (selectedSongs.size === 0) return;

    setDeleteModalData({
      type: 'multiple',
      title: `Delete ${selectedSongs.size} Songs`,
      count: selectedSongs.size,
      onConfirm: async () => {
        try {
          for (const songId of selectedSongs) {
            await deleteDownloadedSong(songId);
          }
          setShowDeleteModal(false);
          exitSelectionMode();
          await loadDownloads();
        } catch (error) {
          console.error("Error deleting songs:", error);
        }
      }
    });
    setShowDeleteModal(true);
  }, [selectedSongs, exitSelectionMode, loadDownloads]);

  const handleDeleteCollection = useCallback(
    (collectionName: string, songs: any[], type: 'album' | 'playlist') => {
      setDeleteModalData({
        type: 'collection',
        title: `Delete ${type === 'album' ? 'Album' : 'Playlist'}`,
        count: songs.length,
        onConfirm: async () => {
          try {
            for (const song of songs) {
              await deleteDownloadedSong(song.id);
            }
            setShowDeleteModal(false);
            await loadDownloads();
          } catch (error) {
            console.error("Error deleting collection:", error);
          }
        }
      });
      setShowDeleteModal(true);
    },
    [loadDownloads]
  );

  const handleDelete = useCallback(
    (songId: string, songName: string) => {
      setDeleteModalData({
        type: 'single',
        title: songName,
        count: 1,
        onConfirm: async () => {
          try {
            await deleteDownloadedSong(songId);
            setShowDeleteModal(false);
            await loadDownloads();
          } catch (error) {
            console.error("Error deleting song:", error);
          }
        }
      });
      setShowDeleteModal(true);
    },
    [loadDownloads]
  );

  // In downloads.tsx, update handlePlay function:
  const handlePlay = useCallback(
    async (song: ApiSong, index: number) => {
      try {
        // Prepare offline queue with decrypted URLs for current and nearby songs
        const preparedQueue = await playerActions.prepareOfflineQueue(downloads, index);

        // Reset TrackPlayer and add prepared queue
        await TrackPlayer.reset();
        await TrackPlayer.add(preparedQueue);

        // Skip to the selected song
        if (index > 0) {
          await TrackPlayer.skip(index);
        }

        // Update player context state
        playerActions.setQueue(downloads, index);

        // Start playback
        await TrackPlayer.play();

      } catch (error) {
        console.error("Error playing downloaded song:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        Alert.alert("Playback Error", `Failed to play song: ${errorMessage}`);
      }
    },
    [downloads, playerActions]
  );

  const handlePlayLocalAudio = useCallback(
    async (audio: MediaLibrary.Asset, index: number) => {
      try {
        // Extract metadata from audio file
        let extractedMetadata = null;
        try {
          extractedMetadata = await extractAudioMetadata(audio.uri);
        } catch (metadataError) {
          console.warn("Failed to extract metadata, using defaults:", metadataError);
        }

        // Convert MediaLibrary.Asset to ApiSong format with extracted metadata
        const localSong: ApiSong = {
          id: audio.id,
          name: extractedMetadata?.title || audio.filename.replace(/\.[^/.]+$/, ""),
          title: extractedMetadata?.title || audio.filename.replace(/\.[^/.]+$/, ""),
          album: {
            id: "local",
            name: extractedMetadata?.album || "Local Files",
            url: ""
          },
          primaryArtists: extractedMetadata?.artist || "Unknown Artist",
          image: extractedMetadata?.albumArtPath ? [{ link: extractedMetadata.albumArtPath, quality: "500x500" }] : [],
          downloadUrl: [{ link: audio.uri, quality: "320kbps" }],
          duration: Math.floor(audio.duration).toString(),
          year: new Date(audio.creationTime).getFullYear().toString(),
          dominantColor: "#ff0066",
          explicitContent: 0,
          language: "unknown",
          url: audio.uri,
        };

        // Convert all audio files to ApiSong format for queue (with metadata extraction)
        const localAudioQueue: ApiSong[] = await Promise.all(
          audioFiles.map(async (file) => {
            let fileMetadata = null;
            try {
              fileMetadata = await extractAudioMetadata(file.uri);
            } catch {
              // Ignore metadata extraction errors for queue items
            }
            return {
              id: file.id,
              name: fileMetadata?.title || file.filename.replace(/\.[^/.]+$/, ""),
              title: fileMetadata?.title || file.filename.replace(/\.[^/.]+$/, ""),
              album: {
                id: "local",
                name: fileMetadata?.album || "Local Files",
                url: ""
              },
              primaryArtists: fileMetadata?.artist || "Unknown Artist",
              image: fileMetadata?.albumArtPath ? [{ link: fileMetadata.albumArtPath, quality: "500x500" }] : [],
              downloadUrl: [{ link: file.uri, quality: "320kbps" }],
              duration: Math.floor(file.duration).toString(),
              year: new Date(file.creationTime).getFullYear().toString(),
              dominantColor: "#ff0066",
              explicitContent: 0,
              language: "unknown",
              url: file.uri,
            };
          })
        );

        // Set local audio queue and play
        playerActions.setQueue(localAudioQueue, index);
        await playerActions.playSong(localSong);
      } catch (error) {
        console.error("Error playing local audio:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        Alert.alert("Playback Error", `Failed to play audio: ${errorMessage}`);
      }
    },
    [audioFiles, playerActions]
  );

  const getImageUrl = (imageInput: any): string => {
    if (!imageInput) return "https://via.placeholder.com/150";
    if (typeof imageInput === "string") return imageInput;
    if (Array.isArray(imageInput) && imageInput.length > 0) {
      return imageInput.find((img) => img.quality === "150x150")?.link || imageInput[0]?.link || "https://via.placeholder.com/150";
    }
    return "https://via.placeholder.com/150";
  };

  const getArtistName = (artistsInput: any): string => {
    if (!artistsInput) return "Unknown Artist";
    if (typeof artistsInput === "string") return artistsInput;
    if (Array.isArray(artistsInput) && artistsInput.length > 0) {
      return artistsInput.map((a: any) => a.name || a).join(", ");
    }
    return "Unknown Artist";
  };

  const renderSongItem = useCallback(
    ({ item, index }: { item: any; index: number }) => {
      const isSelected = selectedSongs.has(item.id);

      return (
        <TouchableOpacity
          style={[
            styles.songItem,
            isSelected && styles.songItemSelected,
            selectionMode && styles.songItemSelectionMode
          ]}
          onPress={() => {
            if (selectionMode) {
              toggleSelection(item.id);
            } else {
              handlePlay(item, index);
            }
          }}
          onLongPress={() => {
            if (!selectionMode) {
              setSelectionMode(true);
              toggleSelection(item.id);
            }
          }}
          delayLongPress={500}
        >
          {selectionMode && (
            <View style={styles.checkboxContainer}>
              <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                {isSelected && <FontAwesome name="check" size={14} color="#fff" />}
              </View>
            </View>
          )}
          <Image
            source={{ uri: getImageUrl(item.image) }}
            style={styles.songArtwork}
          />
          <View style={styles.songInfo}>
            <Text style={styles.songTitle} numberOfLines={1}>
              {item.name || item.title}
            </Text>
            <Text style={styles.songArtist} numberOfLines={1}>
              {getArtistName(item.primaryArtists)}
            </Text>
            <Text style={styles.songSize}>{formatBytes(item.fileSize)}</Text>
          </View>
          {!selectionMode && (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDelete(item.id, item.name || item.title)}
            >
              <FontAwesome name="trash" size={20} color="#ff4444" />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      );
    },
    [handlePlay, handleDelete, selectionMode, selectedSongs, toggleSelection]
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => {
          const offsetX = event.nativeEvent.contentOffset.x;
          const width = event.nativeEvent.layoutMeasurement.width;
          const page = Math.round(offsetX / width);
          setPageMode(page === 0 ? 'downloads' : 'local');
        }}
        style={styles.horizontalScroll}
      >
        {/* Downloads Page */}
        <View style={[styles.page, { width: screenWidth }]}>
          {/* Header with Storage Info */}
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <Text style={styles.headerTitle}>Downloads</Text>
              {!isOnline && (
                <View style={styles.offlineBadge}>
                  <FontAwesome name="wifi" size={12} color="#ff9500" />
                  <Text style={styles.offlineText}>Offline</Text>
                </View>
              )}
            </View>

            {/* Storage Card */}
            {deviceStorage && (
              <View style={styles.storageCard}>
                <LinearGradient
                  colors={["#ff0066", "#9900ff"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.storageGradient}
                >
                  <View style={styles.storageHeader}>
                    <FontAwesome name="database" size={20} color="#fff" />
                    <Text style={styles.storageTitle}>Storage Usage</Text>
                  </View>

                  <View style={styles.storageStats}>
                    <View style={styles.storageStat}>
                      <Text style={styles.storageLabel}>Downloads</Text>
                      <Text style={styles.storageValue}>{formatBytes(totalSize)}</Text>
                    </View>
                    <View style={styles.storageDivider} />
                    <View style={styles.storageStat}>
                      <Text style={styles.storageLabel}>Free Space</Text>
                      <Text style={styles.storageValue}>{formatBytes(deviceStorage.free)}</Text>
                    </View>
                    <View style={styles.storageDivider} />
                    <View style={styles.storageStat}>
                      <Text style={styles.storageLabel}>Total Songs</Text>
                      <Text style={styles.storageValue}>{downloads.length}</Text>
                    </View>
                  </View>

                  {/* Storage Bar */}
                  <View style={styles.storageBarContainer}>
                    <View style={styles.storageBar}>
                      <View
                        style={[
                          styles.storageBarFill,
                          { width: `${Math.min((totalSize / deviceStorage.total) * 100, 100)}%` }
                        ]}
                      />
                    </View>
                    <Text style={styles.storagePercentage}>
                      {((totalSize / deviceStorage.total) * 100).toFixed(1)}% used by app
                    </Text>
                  </View>
                </LinearGradient>
              </View>
            )}

            {/* Downloads Count */}
            <View style={styles.headerInfo}>
              <FontAwesome name="music" size={16} color="#999" />
              <Text style={styles.headerSubtitle}>
                {downloads.length} songs downloaded
              </Text>
            </View>

            {/* Tabs */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.tabsScrollContainer}
              contentContainerStyle={styles.tabsContainer}
              nestedScrollEnabled={true}
            >
              <TouchableOpacity
                style={[styles.tab, activeTab === "albums" && styles.activeTab]}
                onPress={() => setActiveTab("albums")}
              >
                <FontAwesome
                  name="folder"
                  size={18}
                  color={activeTab === "albums" ? "#ff0066" : "#666"}
                />
                <Text style={[styles.tabText, activeTab === "albums" && styles.activeTabText]}>
                  Albums ({albums.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === "playlists" && styles.activeTab]}
                onPress={() => setActiveTab("playlists")}
              >
                <FontAwesome
                  name="list"
                  size={18}
                  color={activeTab === "playlists" ? "#ff0066" : "#666"}
                />
                <Text style={[styles.tabText, activeTab === "playlists" && styles.activeTabText]}>
                  Playlists ({playlists.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === "songs" && styles.activeTab]}
                onPress={() => setActiveTab("songs")}
              >
                <FontAwesome
                  name="music"
                  size={18}
                  color={activeTab === "songs" ? "#ff0066" : "#666"}
                />
                <Text style={[styles.tabText, activeTab === "songs" && styles.activeTabText]}>
                  Songs ({individualSongs.length})
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Content */}
          {isLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color="#ff0066" />
              <Text style={styles.emptyText}>Loading downloads...</Text>
            </View>
          ) : downloads.length === 0 ? (
            <View style={styles.centered}>
              <FontAwesome name="cloud-download" size={64} color="#333" />
              <Text style={styles.emptyTitle}>No Downloads Yet</Text>
              <Text style={styles.emptyText}>
                Downloaded songs will appear here for offline playback
              </Text>
            </View>
          ) : (
            <>
              {activeTab === "albums" && (
                <ScrollView
                  style={styles.contentContainer}
                  contentContainerStyle={currentSong && { paddingBottom: 100 }}
                >
                  {albums.length === 0 ? (
                    <View style={styles.emptySection}>
                      <FontAwesome name="folder-open" size={48} color="#444" />
                      <Text style={styles.emptySectionText}>No complete albums downloaded</Text>
                    </View>
                  ) : (
                    albums.map((album) => (
                      <View key={album.name} style={styles.albumCard}>
                        <TouchableOpacity
                          style={styles.albumCardHeader}
                          onPress={() => setExpandedAlbum(expandedAlbum === album.name ? null : album.name)}
                          onLongPress={() => handleDeleteCollection(album.name, album.songs, 'album')}
                          delayLongPress={500}
                        >
                          <Image
                            source={{ uri: album.artwork }}
                            style={styles.albumCardArtwork}
                          />
                          <View style={styles.albumCardInfo}>
                            <Text style={styles.albumCardTitle} numberOfLines={2}>
                              {album.name}
                            </Text>
                            <Text style={styles.albumCardSubtitle}>
                              {album.songs.length} songs
                            </Text>
                          </View>
                          <FontAwesome
                            name={expandedAlbum === album.name ? "chevron-up" : "chevron-down"}
                            size={20}
                            color="#999"
                          />
                        </TouchableOpacity>

                        {expandedAlbum === album.name && (
                          <View style={styles.albumSongsList}>
                            {album.songs.map((song, index) => (
                              <TouchableOpacity
                                key={song.id}
                                style={styles.albumSongItem}
                                onPress={() => handlePlay(song, downloads.findIndex(s => s.id === song.id))}
                              >
                                <Text style={styles.albumSongIndex}>{index + 1}</Text>
                                <View style={styles.albumSongInfo}>
                                  <Text style={styles.albumSongTitle} numberOfLines={1}>
                                    {song.name || song.title}
                                  </Text>
                                  <Text style={styles.albumSongArtist} numberOfLines={1}>
                                    {getArtistName(song.primaryArtists)}
                                  </Text>
                                </View>
                                <TouchableOpacity
                                  style={styles.albumSongDelete}
                                  onPress={() => handleDelete(song.id, song.name || song.title)}
                                >
                                  <FontAwesome name="trash" size={16} color="#ff4444" />
                                </TouchableOpacity>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </View>
                    ))
                  )}
                </ScrollView>
              )}

              {activeTab === "playlists" && (
                <ScrollView
                  style={styles.contentContainer}
                  contentContainerStyle={currentSong && { paddingBottom: 100 }}
                >
                  {playlists.length === 0 ? (
                    <View style={styles.emptySection}>
                      <FontAwesome name="list" size={48} color="#444" />
                      <Text style={styles.emptySectionText}>No playlists downloaded</Text>
                    </View>
                  ) : (
                    playlists.map((playlist) => (
                      <View key={playlist.name} style={styles.albumCard}>
                        <TouchableOpacity
                          style={styles.albumCardHeader}
                          onPress={() => setExpandedAlbum(expandedAlbum === playlist.name ? null : playlist.name)}
                          onLongPress={() => handleDeleteCollection(playlist.name, playlist.songs, 'playlist')}
                          delayLongPress={500}
                        >
                          <View style={styles.playlistIconContainer}>
                            <Image
                              source={{ uri: playlist.artwork }}
                              style={styles.albumCardArtwork}
                            />
                            <View style={styles.playlistBadge}>
                              <FontAwesome name="list" size={12} color="#fff" />
                            </View>
                          </View>
                          <View style={styles.albumCardInfo}>
                            <Text style={styles.albumCardTitle} numberOfLines={2}>
                              {playlist.name}
                            </Text>
                            <Text style={styles.albumCardSubtitle}>
                              {playlist.songs.length} songs • Playlist
                            </Text>
                          </View>
                          <FontAwesome
                            name={expandedAlbum === playlist.name ? "chevron-up" : "chevron-down"}
                            size={20}
                            color="#999"
                          />
                        </TouchableOpacity>

                        {expandedAlbum === playlist.name && (
                          <View style={styles.albumSongsList}>
                            {playlist.songs.map((song, index) => (
                              <TouchableOpacity
                                key={song.id}
                                style={styles.albumSongItem}
                                onPress={() => handlePlay(song, downloads.findIndex(s => s.id === song.id))}
                              >
                                <Text style={styles.albumSongIndex}>{index + 1}</Text>
                                <View style={styles.albumSongInfo}>
                                  <Text style={styles.albumSongTitle} numberOfLines={1}>
                                    {song.name || song.title}
                                  </Text>
                                  <Text style={styles.albumSongArtist} numberOfLines={1}>
                                    {getArtistName(song.primaryArtists)}
                                  </Text>
                                </View>
                                <TouchableOpacity
                                  style={styles.albumSongDelete}
                                  onPress={() => handleDelete(song.id, song.name || song.title)}
                                >
                                  <FontAwesome name="trash" size={16} color="#ff4444" />
                                </TouchableOpacity>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </View>
                    ))
                  )}
                </ScrollView>
              )}

              {activeTab === "songs" && (
                <ScrollView
                  style={styles.contentContainer}
                  contentContainerStyle={currentSong && { paddingBottom: 100 }}
                >
                  {individualSongs.length === 0 ? (
                    <View style={styles.emptySection}>
                      <FontAwesome name="music" size={48} color="#444" />
                      <Text style={styles.emptySectionText}>No individual songs downloaded</Text>
                    </View>
                  ) : (
                    individualSongs.map((song) => {
                      const songIndex = downloads.findIndex(s => s.id === song.id);
                      return renderSongItem({ item: song, index: songIndex });
                    })
                  )}
                </ScrollView>
              )}
            </>
          )}

          {/* Selection Mode Toolbar */}
          {selectionMode && (
            <View style={styles.selectionToolbar}>
              <LinearGradient
                colors={["#1a1a1a", "#0a0a0a"]}
                style={styles.selectionToolbarGradient}
              >
                <View style={styles.selectionToolbarContent}>
                  <TouchableOpacity
                    style={styles.selectionToolbarButton}
                    onPress={exitSelectionMode}
                  >
                    <FontAwesome name="times" size={22} color="#fff" />
                  </TouchableOpacity>

                  <View style={styles.selectionCountContainer}>
                    <Text style={styles.selectionCount}>
                      {selectedSongs.size}
                    </Text>
                  </View>

                  <View style={styles.selectionActions}>
                    <TouchableOpacity
                      style={styles.selectionActionButton}
                      onPress={() => {
                        // Calculate total songs in current tab
                        let totalInTab = 0;
                        if (activeTab === 'albums') {
                          albums.forEach(album => totalInTab += album.songs.length);
                        } else if (activeTab === 'playlists') {
                          playlists.forEach(playlist => totalInTab += playlist.songs.length);
                        } else {
                          totalInTab = individualSongs.length;
                        }

                        if (selectedSongs.size === totalInTab) {
                          deselectAll();
                        } else {
                          selectAll();
                        }
                      }}
                    >
                      <FontAwesome
                        name={(() => {
                          let totalInTab = 0;
                          if (activeTab === 'albums') {
                            albums.forEach(album => totalInTab += album.songs.length);
                          } else if (activeTab === 'playlists') {
                            playlists.forEach(playlist => totalInTab += playlist.songs.length);
                          } else {
                            totalInTab = individualSongs.length;
                          }
                          return selectedSongs.size === totalInTab ? "check-square" : "square-o";
                        })()}
                        size={20}
                        color="#fff"
                      />
                      <Text style={styles.selectionActionText}>
                        {(() => {
                          let totalInTab = 0;
                          if (activeTab === 'albums') {
                            albums.forEach(album => totalInTab += album.songs.length);
                          } else if (activeTab === 'playlists') {
                            playlists.forEach(playlist => totalInTab += playlist.songs.length);
                          } else {
                            totalInTab = individualSongs.length;
                          }
                          return selectedSongs.size === totalInTab ? "Deselect All" : "Select All";
                        })()}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.selectionActionButton,
                        styles.deleteActionButton,
                        selectedSongs.size === 0 && styles.deleteActionButtonDisabled
                      ]}
                      onPress={handleDeleteSelected}
                      disabled={selectedSongs.size === 0}
                    >
                      <FontAwesome name="trash" size={20} color={selectedSongs.size === 0 ? "#666" : "#ff4444"} />
                      <Text style={[
                        styles.selectionActionText,
                        styles.deleteActionText,
                        selectedSongs.size === 0 && styles.deleteActionTextDisabled
                      ]}>
                        Delete
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </LinearGradient>
            </View>
          )}

          {/* Custom Delete Modal */}
          <Modal
            visible={showDeleteModal}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowDeleteModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContainer}>
                <LinearGradient
                  colors={["#2a2a2a", "#1a1a1a"]}
                  style={styles.modalGradient}
                >
                  {/* Modal Header */}
                  <View style={styles.modalHeader}>
                    <View style={styles.modalIconContainer}>
                      <FontAwesome name="trash" size={32} color="#ff4444" />
                    </View>
                    <Text style={styles.modalTitle}>Delete {deleteModalData?.type === 'single' ? 'Song' : 'Songs'}</Text>
                    <Text style={styles.modalSubtitle}>
                      {deleteModalData?.type === 'single'
                        ? deleteModalData.title
                        : deleteModalData?.type === 'collection'
                          ? `Are you sure you want to delete all ${deleteModalData.count} songs?`
                          : `Delete ${deleteModalData?.count} selected songs?`
                      }
                    </Text>
                  </View>

                  {/* Modal Actions */}
                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.modalCancelButton]}
                      onPress={() => setShowDeleteModal(false)}
                    >
                      <Text style={styles.modalCancelText}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.modalButton, styles.modalDeleteButton]}
                      onPress={() => deleteModalData?.onConfirm()}
                    >
                      <LinearGradient
                        colors={["#ff4444", "#cc0000"]}
                        style={styles.modalDeleteGradient}
                      >
                        <FontAwesome name="trash" size={16} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.modalDeleteText}>Delete</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </LinearGradient>
              </View>
            </View>
          </Modal>
        </View>

        {/* Local Files Page */}
        <View style={[styles.page, { width: screenWidth }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <Text style={styles.headerTitle}>Local Files</Text>
              <TouchableOpacity
                style={styles.refreshButton}
                onPress={() => {
                  if (mediaPermission) {
                    loadMediaFiles();
                  }
                }}
                disabled={!mediaPermission || isLoadingMedia}
              >
                <LinearGradient
                  colors={["#ff0066", "#9900ff"]}
                  style={styles.refreshButtonGradient}
                >
                  <FontAwesome
                    name="refresh"
                    size={18}
                    color="#fff"
                    style={isLoadingMedia ? styles.refreshingIcon : undefined}
                  />
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Storage Card */}
            <View style={styles.storageCard}>
              <LinearGradient
                colors={["#ff0066", "#9900ff"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.storageGradient}
              >
                <View style={styles.storageHeader}>
                  <FontAwesome name="folder-open" size={20} color="#fff" />
                  <Text style={styles.storageTitle}>Device Media</Text>
                </View>

                <View style={styles.storageStats}>
                  <View style={styles.storageStat}>
                    <Text style={styles.storageLabel}>Audio</Text>
                    <Text style={styles.storageValue}>{audioFiles.length}</Text>
                  </View>
                  <View style={styles.storageDivider} />
                  <View style={styles.storageStat}>
                    <Text style={styles.storageLabel}>Video</Text>
                    <Text style={styles.storageValue}>{videoFiles.length}</Text>
                  </View>
                  <View style={styles.storageDivider} />
                  <View style={styles.storageStat}>
                    <Text style={styles.storageLabel}>Total</Text>
                    <Text style={styles.storageValue}>{audioFiles.length + videoFiles.length}</Text>
                  </View>
                </View>
              </LinearGradient>
            </View>

            {/* Info Text */}
            <View style={styles.headerInfo}>
              <FontAwesome name="mobile" size={16} color="#999" />
              <Text style={styles.headerSubtitle}>
                Browse media from your device
              </Text>
            </View>

            {/* Tabs */}
            {mediaPermission && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.tabsScrollContainer}
                contentContainerStyle={styles.tabsContainer}
                nestedScrollEnabled={true}
              >
                <TouchableOpacity
                  style={[styles.tab, localTab === "audio" && styles.activeTab]}
                  onPress={() => setLocalTab("audio")}
                >
                  <FontAwesome
                    name="music"
                    size={18}
                    color={localTab === "audio" ? "#ff0066" : "#666"}
                  />
                  <Text style={[styles.tabText, localTab === "audio" && styles.activeTabText]}>
                    Audio ({audioFiles.length})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tab, localTab === "video" && styles.activeTab]}
                  onPress={() => setLocalTab("video")}
                >
                  <FontAwesome
                    name="video-camera"
                    size={18}
                    color={localTab === "video" ? "#ff0066" : "#666"}
                  />
                  <Text style={[styles.tabText, localTab === "video" && styles.activeTabText]}>
                    Video ({videoFiles.length})
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>

          {/* Content */}
          {!mediaPermission ? (
            <View style={styles.centered}>
              <FontAwesome name="lock" size={64} color="#333" />
              <Text style={styles.emptyTitle}>Permission Required</Text>
              <Text style={styles.emptyText}>
                Allow access to your device media library to browse audio and video files
              </Text>
              <TouchableOpacity
                style={styles.permissionButton}
                onPress={requestMediaPermissions}
              >
                <LinearGradient
                  colors={["#ff0066", "#9900ff"]}
                  style={styles.permissionButtonGradient}
                >
                  <FontAwesome name="unlock" size={20} color="#fff" />
                  <Text style={styles.permissionButtonText}>Grant Permission</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : isLoadingMedia ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color="#ff0066" />
              <Text style={styles.emptyText}>Loading media files...</Text>
            </View>
          ) : (
            <>
              {localTab === "audio" && (
                <ScrollView
                  style={styles.contentContainer}
                  contentContainerStyle={currentSong && { paddingBottom: 100 }}
                >
                  {audioFiles.length === 0 ? (
                    <View style={styles.emptySection}>
                      <FontAwesome name="music" size={48} color="#444" />
                      <Text style={styles.emptySectionText}>No audio files found</Text>
                    </View>
                  ) : (
                    audioFiles.map((audio, index) => (
                      <TouchableOpacity
                        key={audio.id}
                        style={styles.audioCard}
                        onPress={() => handlePlayLocalAudio(audio, index)}
                        activeOpacity={0.7}
                      >
                        <LinearGradient
                          colors={["rgba(255,0,102,0.15)", "rgba(153,0,255,0.15)"]}
                          style={styles.audioCardGradient}
                        >
                          <View style={styles.audioCardContent}>
                            <View style={styles.audioArtwork}>
                              <LinearGradient
                                colors={["#ff0066", "#9900ff"]}
                                style={styles.audioArtworkGradient}
                              >
                                <FontAwesome name="music" size={28} color="#fff" />
                              </LinearGradient>
                            </View>

                            <View style={styles.audioInfo}>
                              <Text style={styles.audioTitle} numberOfLines={1}>
                                {audio.filename.replace(/\.[^/.]+$/, "")}
                              </Text>
                              <View style={styles.audioMeta}>
                                <FontAwesome name="clock-o" size={12} color="#999" />
                                <Text style={styles.audioMetaText}>
                                  {Math.floor(audio.duration / 60)}:{String(Math.floor(audio.duration % 60)).padStart(2, '0')}
                                </Text>
                              </View>
                            </View>

                            <View style={styles.audioPlayButton}>
                              <LinearGradient
                                colors={["#ff0066", "#9900ff"]}
                                style={styles.audioPlayGradient}
                              >
                                <FontAwesome name="play" size={16} color="#fff" style={{ marginLeft: 2 }} />
                              </LinearGradient>
                            </View>
                          </View>
                        </LinearGradient>
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              )}

              {localTab === "video" && (
                <ScrollView
                  style={styles.contentContainer}
                  contentContainerStyle={currentSong && { paddingBottom: 100 }}
                >
                  {videoFiles.length === 0 ? (
                    <View style={styles.emptySection}>
                      <FontAwesome name="video-camera" size={48} color="#444" />
                      <Text style={styles.emptySectionText}>No video files found</Text>
                    </View>
                  ) : (
                    <View style={styles.videoGrid}>
                      {videoFiles.map((video, index) => (
                        <TouchableOpacity
                          key={video.id}
                          style={styles.videoCard}
                          onPress={async () => {
                            console.log("[Downloads] Video selected:", {
                              uri: video.uri,
                              title: video.filename,
                              width: video.width,
                              height: video.height,
                            });

                            // For Android content:// URIs, copy to cache first for better compatibility
                            let finalUri = video.uri;
                            if (Platform.OS === 'android' && video.uri.startsWith('content:')) {
                              try {
                                console.log("[Downloads] Copying content URI to cache for video");
                                finalUri = await copyContentUriToCache(video.uri);
                                console.log("[Downloads] Video URI copied to cache:", finalUri);
                              } catch (error) {
                                console.warn("[Downloads] Failed to copy video URI, using original:", error);
                              }
                            }

                            setSelectedVideo({
                              uri: finalUri,
                              title: video.filename,
                              width: video.width,
                              height: video.height
                            });
                          }}
                          activeOpacity={0.9}
                        >
                          <View style={styles.videoCardContainer}>
                            <LinearGradient
                              colors={["rgba(255,0,102,0.1)", "rgba(153,0,255,0.1)"]}
                              style={styles.videoCardGradient}
                            >
                              <View style={styles.videoThumbnailWrapper}>
                                <Image
                                  source={{ uri: video.uri }}
                                  style={styles.videoThumbnail}
                                />
                                <LinearGradient
                                  colors={["transparent", "rgba(0,0,0,0.7)"]}
                                  style={styles.videoOverlay}
                                >
                                  <View style={styles.videoPlayIcon}>
                                    <LinearGradient
                                      colors={["rgba(255,0,102,0.9)", "rgba(153,0,255,0.9)"]}
                                      style={styles.videoPlayIconGradient}
                                    >
                                      <FontAwesome name="play" size={20} color="#fff" style={{ marginLeft: 2 }} />
                                    </LinearGradient>
                                  </View>
                                </LinearGradient>
                                <View style={styles.videoDurationBadge}>
                                  <LinearGradient
                                    colors={["rgba(0,0,0,0.8)", "rgba(0,0,0,0.6)"]}
                                    style={styles.videoDurationGradient}
                                  >
                                    <FontAwesome name="clock-o" size={10} color="#fff" />
                                    <Text style={styles.videoDurationText}>
                                      {Math.floor(video.duration / 60)}:{String(Math.floor(video.duration % 60)).padStart(2, '0')}
                                    </Text>
                                  </LinearGradient>
                                </View>
                              </View>
                              <View style={styles.videoInfoContainer}>
                                <ScrollingText
                                  text={video.filename.replace(/\.[^/.]+$/, "")}
                                  style={styles.videoTitleText}
                                />
                              </View>
                            </LinearGradient>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </ScrollView>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* Video Player Modal */}
      {selectedVideo && (
        <VideoPlayer
          visible={true}
          videoUri={selectedVideo.uri}
          videoTitle={selectedVideo.title}
          videoWidth={selectedVideo.width}
          videoHeight={selectedVideo.height}
          onClose={() => {
            setSelectedVideo(null);
            // Maintain scroll position on local page
            if (pageMode === 'local') {
              setTimeout(() => {
                scrollViewRef.current?.scrollTo({ x: screenWidth, animated: false });
              }, 100);
            }
          }}
          onNext={() => {
            // Find current video index and play next
            const currentIndex = videoFiles.findIndex(v => v.uri === selectedVideo.uri);
            if (currentIndex >= 0 && currentIndex < videoFiles.length - 1) {
              const nextVideo = videoFiles[currentIndex + 1];
              setSelectedVideo({
                uri: nextVideo.uri,
                title: nextVideo.filename,
                width: nextVideo.width,
                height: nextVideo.height
              });
            }
          }}
          onPrevious={() => {
            // Find current video index and play previous
            const currentIndex = videoFiles.findIndex(v => v.uri === selectedVideo.uri);
            if (currentIndex > 0) {
              const prevVideo = videoFiles[currentIndex - 1];
              setSelectedVideo({
                uri: prevVideo.uri,
                title: prevVideo.filename,
                width: prevVideo.width,
                height: prevVideo.height
              });
            }
          }}
        />
      )}

      {/* Enhanced Mini Player - Show only on audio tab in local mode, or in downloads mode */}
      {currentSong && ((pageMode === 'local' && localTab === 'audio') || pageMode === 'downloads') && (
        <TouchableOpacity
          style={styles.miniPlayer}
          onPress={() => router.push("/(tabs)/player")}
          activeOpacity={0.95}
        >
          <LinearGradient
            colors={["#ff0066", "#9900ff"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.miniPlayerGradient}
          >
            {/* Glassmorphism overlay */}
            <View style={styles.miniPlayerGlass}>
              <View style={styles.miniPlayerContent}>
                <View style={styles.artworkContainer}>
                  <Image
                    source={{ uri: getImageUrl(currentSong.image) }}
                    style={styles.miniPlayerArtwork}
                  />
                  <View style={styles.artworkGlow} />
                </View>

                <View style={styles.miniPlayerInfo}>
                  <View style={styles.nowPlayingBadge}>
                    <View style={styles.nowPlayingDot} />
                    <Text style={styles.nowPlayingText}>NOW PLAYING</Text>
                  </View>
                  <Text style={styles.miniPlayerTitle} numberOfLines={1}>
                    {currentSong.name || currentSong.title}
                  </Text>
                  <Text style={styles.miniPlayerArtist} numberOfLines={1}>
                    {getArtistName(currentSong.primaryArtists)}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.miniPlayerButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    playerActions.togglePlayPause();
                  }}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={["#fff", "#f0f0f0"]}
                    style={styles.playButtonGradient}
                  >
                    <FontAwesome
                      name={isPlaying ? "pause" : "play"}
                      size={20}
                      color="#ff0066"
                      style={!isPlaying && { marginLeft: 2 }}
                    />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  header: {
    padding: 20,
    paddingTop: Platform.OS === "ios" ? 10 : 20,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "bold",
  },
  offlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 149, 0, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  offlineText: {
    color: "#ff9500",
    fontSize: 12,
    fontWeight: "700",
  },
  storageCard: {
    marginBottom: 20,
    borderRadius: 16,
    overflow: "hidden",
    elevation: 5,
    shadowColor: "#ff0066",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  storageGradient: {
    padding: 20,
  },
  storageHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  storageTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  storageStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  storageStat: {
    flex: 1,
    alignItems: "center",
  },
  storageDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginHorizontal: 8,
  },
  storageLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    marginBottom: 4,
    textTransform: "uppercase",
    fontWeight: "600",
  },
  storageValue: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  storageBarContainer: {
    marginTop: 8,
  },
  storageBar: {
    height: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 4,
    overflow: "hidden",
  },
  storageBarFill: {
    height: "100%",
    backgroundColor: "#fff",
    borderRadius: 4,
  },
  storagePercentage: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 11,
    marginTop: 6,
    textAlign: "center",
  },
  headerInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerSubtitle: {
    color: "#999",
    fontSize: 14,
  },
  tabsContainer: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 2,
    borderColor: "transparent",
    minWidth: 120,
  },
  activeTab: {
    backgroundColor: "rgba(255, 0, 102, 0.15)",
    borderColor: "#ff0066",
  },
  tabText: {
    color: "#666",
    fontSize: 14,
    fontWeight: "600",
  },
  activeTabText: {
    color: "#ff0066",
  },
  contentContainer: {
    flex: 1,
    padding: 15,
  },
  emptySection: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptySectionText: {
    color: "#666",
    fontSize: 15,
    marginTop: 12,
  },
  albumCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 16,
    marginBottom: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  albumCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  albumCardArtwork: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: "#2a2a2a",
    marginRight: 16,
  },
  playlistIconContainer: {
    position: 'relative',
    marginRight: 16,
  },
  playlistBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: '#ff0066',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#1a1a1a',
  },
  albumCardInfo: {
    flex: 1,
  },
  albumCardTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
  },
  albumCardSubtitle: {
    color: "#999",
    fontSize: 14,
  },
  albumSongsList: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
    paddingTop: 8,
  },
  albumSongItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.03)",
  },
  albumSongIndex: {
    color: "#666",
    fontSize: 14,
    fontWeight: "600",
    width: 30,
  },
  albumSongInfo: {
    flex: 1,
    marginRight: 12,
  },
  albumSongTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 3,
  },
  albumSongArtist: {
    color: "#999",
    fontSize: 13,
  },
  albumSongDelete: {
    padding: 8,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "transparent",
  },
  emptyTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "bold",
    marginTop: 20,
    marginBottom: 10,
  },
  emptyText: {
    color: "#999",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 280,
  },
  listContent: {
    padding: 20,
    paddingTop: 10,
  },
  albumHeader: {
    backgroundColor: "#1a1a1a",
    marginHorizontal: 15,
    marginTop: 15,
    marginBottom: 8,
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  albumHeaderContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
  },
  albumHeaderArtwork: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: "#2a2a2a",
    marginRight: 12,
  },
  albumHeaderInfo: {
    flex: 1,
  },
  albumHeaderTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  albumHeaderSubtitle: {
    color: "#999",
    fontSize: 13,
  },
  songItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  songArtwork: {
    width: 64,
    height: 64,
    borderRadius: 10,
    marginRight: 14,
    backgroundColor: "#2a2a2a",
  },
  songInfo: {
    flex: 1,
  },
  songTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  songArtist: {
    color: "#999",
    fontSize: 13,
    marginBottom: 4,
  },
  songSize: {
    color: "#666",
    fontSize: 11,
    fontWeight: "500",
  },
  deleteButton: {
    padding: 12,
    marginLeft: 4,
  },
  miniPlayer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 95,
    elevation: 20,
    shadowColor: "#ff0066",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  miniPlayerGradient: {
    flex: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },
  miniPlayerGlass: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    // backdropFilter: "blur(20px)",
  },
  miniPlayerContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  artworkContainer: {
    position: "relative",
    marginRight: 14,
  },
  miniPlayerArtwork: {
    width: 64,
    height: 64,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  artworkGlow: {
    position: "absolute",
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    zIndex: -1,
  },
  miniPlayerInfo: {
    flex: 1,
    justifyContent: "center",
  },
  nowPlayingBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  nowPlayingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#00ff88",
    marginRight: 6,
  },
  nowPlayingText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  miniPlayerTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  miniPlayerArtist: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 13,
    fontWeight: "500",
  },
  miniPlayerButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginLeft: 12,
    elevation: 8,
    shadowColor: "#fff",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  playButtonGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  tabsScrollContainer: {
    marginTop: 16,
  },
  deleteCollectionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 10,
    backgroundColor: "rgba(255, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 68, 68, 0.3)",
  },
  deleteCollectionText: {
    color: "#ff4444",
    fontSize: 14,
    fontWeight: "600",
  },
  // Selection mode styles
  songItemSelected: {
    backgroundColor: "rgba(255, 0, 102, 0.15)",
    borderColor: "#ff0066",
    borderWidth: 2,
  },
  songItemSelectionMode: {
    paddingLeft: 8,
  },
  checkboxContainer: {
    marginRight: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#666",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  checkboxSelected: {
    backgroundColor: "#ff0066",
    borderColor: "#ff0066",
  },
  // Selection toolbar styles
  selectionToolbar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  selectionToolbarGradient: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
  },
  selectionToolbarContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectionToolbarButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  selectionCountContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 16,
  },
  selectionCount: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  selectionActions: {
    flexDirection: "row",
    gap: 12,
  },
  selectionActionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  selectionActionText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  deleteActionButton: {
    backgroundColor: "rgba(255, 68, 68, 0.15)",
  },
  deleteActionButtonDisabled: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    opacity: 0.5,
  },
  deleteActionText: {
    color: "#ff4444",
  },
  deleteActionTextDisabled: {
    color: "#666",
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContainer: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 24,
    overflow: "hidden",
  },
  modalGradient: {
    padding: 24,
  },
  modalHeader: {
    alignItems: "center",
    marginBottom: 24,
  },
  modalIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255, 68, 68, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "rgba(255, 68, 68, 0.3)",
  },
  modalTitle: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  modalSubtitle: {
    color: "#999",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
  },
  modalButton: {
    flex: 1,
    borderRadius: 14,
    overflow: "hidden",
  },
  modalCancelButton: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  modalDeleteButton: {
    overflow: "hidden",
  },
  modalDeleteGradient: {
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  modalDeleteText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  // Horizontal scroll styles
  horizontalScroll: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  // Local files styles
  permissionButton: {
    marginTop: 30,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#ff0066",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  permissionButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    paddingHorizontal: 40,
    gap: 12,
  },
  permissionButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  // Audio card styles
  audioCard: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  audioCardGradient: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  audioCardContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 15,
  },
  audioArtwork: {
    width: 60,
    height: 60,
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#ff0066",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 5,
  },
  audioArtworkGradient: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  audioInfo: {
    flex: 1,
    gap: 6,
  },
  audioTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  audioMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  audioMetaText: {
    color: "#999",
    fontSize: 13,
    fontWeight: "600",
  },
  audioPlayButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#ff0066",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  audioPlayGradient: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 24,
  },
  // Video grid styles
  videoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    // paddingHorizontal: 8,
    paddingTop: 8,
  },
  videoCard: {
    width: (Dimensions.get('window').width - 16) / 2 - 16,
    marginBottom: 8,
    marginHorizontal: 4,
  },
  videoCardContainer: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  videoCardGradient: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
  },
  videoThumbnailWrapper: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: "#1a1a1a",
    position: "relative",
  },
  videoThumbnail: {
    width: "100%",
    height: "100%",
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  videoPlayIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
  },
  videoPlayIconGradient: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
    borderRadius: 28,
  },
  videoDurationBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    borderRadius: 8,
    overflow: "hidden",
  },
  videoDurationGradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  videoDurationText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  videoInfoContainer: {
    padding: 12,
    overflow: 'hidden',
  },
  videoTitleText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
    shadowColor: "#ff0066",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 5,
  },
  refreshButtonGradient: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 22,
  },
  refreshingIcon: {
    transform: [{ rotate: "360deg" }],
  },
});
