import {
  useCurrentSong,
  useIsPlaying,
  usePlayer,
} from "@/context/PlayerContext";
import { ApiArtist, ApiImage, ApiSong, BioObject } from "@/services/apiTypes";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { useAudioPlayer } from "expo-audio";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import { activateKeepAwake, deactivateKeepAwake } from "expo-keep-awake";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Accelerometer } from "expo-sensors";
import { StatusBar } from "expo-status-bar";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  ListRenderItemInfo,
  Modal,
  Platform,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
  Switch,
} from "react-native-gesture-handler";
import NfcManager, { NfcEvents, NfcTech } from "react-native-nfc-manager";
import Animated, {
  Easing,
  Extrapolate,
  interpolate,
  interpolateColor, // Add this
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import SLiquidLoading from "../../components/SLiquidLoading";
import { sanitizeSongTitle } from "../utils/sanitizeSongTitle";
// 1. Import DraggableFlatList
import FloatingNotification from "@/components/FloatingNotification";
import NotificationCardPage from "@/components/NotificationCardPage";
import { VoiceSearch } from "@/components/VoiceSearch";
import DraggableFlatList from "react-native-draggable-flatlist";
import { useAmbientTheme } from "../../hooks/useAmbientTheme";

const AnimatedGestureHandlerRootView = Animated.createAnimatedComponent(
  GestureHandlerRootView
);

NfcManager.start();

const { width, height } = Dimensions.get("window");

const HEADER_MAX_HEIGHT = 250;
const HEADER_MIN_HEIGHT = Platform.OS === "ios" ? 90 : 70;
const HEADER_SCROLL_DISTANCE = HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT;

const STATIC_AVAILABLE_LANGUAGES: Language[] = [
  { name: "Bengali", code: "bengali" },
  { name: "Hindi", code: "hindi" },
  { name: "English", code: "english" },
  { name: "Punjabi", code: "punjabi" },
  { name: "Tamil", code: "tamil" },
  { name: "Telugu", code: "telugu" },
  { name: "Bhojpuri", code: "bhojpuri" },
  { name: "Marathi", code: "marathi" },
  { name: "Gujarati", code: "gujarati" },
  { name: "Malayalam", code: "malayalam" },
  { name: "Kannada", code: "kannada" },
  { name: "Odia", code: "odia" },
  { name: "Assamese", code: "assamese" },
  { name: "Urdu", code: "urdu" },
];

function shuffleArray<T>(array: T[]): T[] {
  if (!array) return [];
  const shuffled = array.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

const navigateToEQ = () => {
  router.push("/eq");
};

const STORAGE_KEYS = {
  RECOMMENDED_SONGS: "recommended_songs",
  LAST_FETCH_TIME: "last_fetch_time",
  SELECTED_LANGUAGE: "selected_language",
  EXPANDED_SECTION_DEFAULT_VIEW_MODE: "expanded_section_default_view_mode",
  APP_THEME: "app_theme",
  APPEARANCE_MODE: "appearance_mode",
  TUTORIAL_SEEN: "tutorial_seen",
  USER_FAVORITES: "user_favorites",
  USER_PLAYLISTS: "user_playlists",
  USER_WATCHLIST: "user_watchlist",
  USER_GMAIL: "user_gmail",
  SHOW_FLOATING_NOTIFICATIONS: "show_floating_notifications",
  KEEP_AWAKE_ENABLED: "keep_awake_enabled",
  SHAKE_NEXT_ENABLED: "shake_next_enabled",
};

interface Album {
  id: string;
  name: string;
  title?: string;
  songs: ApiSong[];
  image: ApiImage[] | string;
  primaryArtists: ApiArtist[] | string;
  url?: string;
  type?: string;
  description?: string;
  year?: string;
  dominantColor?: string;
}
interface Playlist {
  id: string;
  name: string;
  title?: string;
  albums?: Album[];
  songs?: ApiSong[];
  image: ApiImage[] | string;
  description?: string;
  url?: string;
  songCount?: number;
  followerCount?: string;
  dominantColor?: string;
  type?: string;
}

interface ApiArtistDetail extends ApiArtist {
  image: ApiImage[] | string;
  bio?: string | BioObject | BioObject[] | null;
  dominantColor?: string;
  albums?: Album[];
  playlists?: Playlist[];
  topSongs?: ApiSong[];
}
interface Language {
  name: string;
  code: string;
}

const debounce = <F extends (...args: any[]) => any>(
  func: F,
  delay: number
) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<F>): void => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  };
};

const lightColors = {
  background: "#F5F5F5",
  text: "#121212",
  textSecondary: "#555555",
  primary: "#ff6600",
  card: "#FFFFFF",
  separator: "#E0E0E0",
  header: "#FFFFFF",
  headerText: "#FFFFFF",
  statusBar: "dark" as "dark" | "light",
  searchBar: "#EAEAEA",
  placeholder: "#888",
  chip: "#E0E0E0",
  chipSelected: "#ff6600",
  chipText: "#121212",
  chipTextSelected: "#FFFFFF",
  miniPlayer: "rgba(250, 250, 250, 0.95)",
  settingsBackdrop: "rgba(0,0,0,0.5)",
  itemCard: "#FFFFFF",
  fab: "#EFEFEF",
};

const darkColors = {
  background: "#121212",
  text: "#FFFFFF",
  textSecondary: "#999999",
  primary: "#ff6600",
  card: "#1C1C1C",
  separator: "rgba(255,255,255,0.1)",
  header: "#1c1c1c",
  headerText: "#FFFFFF",
  statusBar: "light" as "dark" | "light",
  searchBar: "#181818",
  placeholder: "#888",
  chip: "#333333",
  chipSelected: "#ff6600",
  chipText: "#FFFFFF",
  chipTextSelected: "#FFFFFF",
  miniPlayer: "rgba(40,40,40,0.95)",
  settingsBackdrop: "rgba(0,0,0,0.6)",
  itemCard: "#1C1C1C",
  fab: "#2D2D2D",
};

type Theme = "light" | "dark";
type AppearanceMode =
  | "normal"
  | "vivid"
  | "ambience"
  | "animate"
  | "realistic"
  | "fluid";
type AppColors = typeof lightColors;

interface ClickableArtistLinksProps {
  artistsInput: ApiArtist[] | string | undefined;
  onArtistPress: (artist: ApiArtist | string) => void;
  baseTextStyle?: any;
  touchableTextStyle?: any;
  separatorTextStyle?: any;
  maxArtistsToShow?: number;
  disabled?: boolean;
}

// Add this utility function near the top of your index.tsx file
function formatPlayCount(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 1000000) return `${(count / 1000).toFixed(1)}K`;
  if (count < 1000000000) return `${(count / 1000000).toFixed(1)}M`;
  return `${(count / 1000000000).toFixed(1)}B`;
}

const ClickableArtistLinks: React.FC<ClickableArtistLinksProps> = React.memo(
  ({
    artistsInput,
    onArtistPress,
    baseTextStyle,
    touchableTextStyle,
    separatorTextStyle,
    maxArtistsToShow,
    disabled,
  }) => {
    const processedArtistsArray = useMemo(() => {
      let artists: ApiArtist[] = [];
      if (typeof artistsInput === "string") {
        artists = artistsInput.split(",").map((name, index) => ({
          id: `temp-id-${name.trim()}-${index}-${Math.random()
            .toString(16)
            .slice(2)}`,
          name: name.trim(),
          url: "",
          image: "",
          type: "artist",
        }));
      } else if (Array.isArray(artistsInput)) {
        artists = artistsInput.filter((artist) => artist && artist.name);
      }
      return artists;
    }, [artistsInput]);

    if (!processedArtistsArray.length) {
      if (typeof artistsInput === "string" && artistsInput.trim() !== "") {
        return <Text style={baseTextStyle}>{artistsInput}</Text>;
      }
      return <Text style={baseTextStyle}>Unknown Artist</Text>;
    }
    const artistsToDisplay = maxArtistsToShow
      ? processedArtistsArray.slice(0, maxArtistsToShow)
      : processedArtistsArray;

    return (
      <View
        style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center" }}
      >
        {artistsToDisplay.map((artist, index) => (
          <React.Fragment key={artist.id || `artist-${artist.name}-${index}`}>
            <TouchableOpacity
              onPress={() => onArtistPress(artist)}
              disabled={disabled}
            >
              <Text style={[baseTextStyle, touchableTextStyle]}>
                {artist.name.split(" ")[0]}
              </Text>
            </TouchableOpacity>
            {index < artistsToDisplay.length - 1 && (
              <Text style={[baseTextStyle, separatorTextStyle]}>, </Text>
            )}
          </React.Fragment>
        ))}
        {maxArtistsToShow &&
          processedArtistsArray.length > maxArtistsToShow && (
            <Text style={[baseTextStyle, separatorTextStyle]}> ...</Text>
          )}
      </View>
    );
  }
);
ClickableArtistLinks.displayName = "ClickableArtistLinks";

interface SearchOverlayProps {
  isVisible: boolean;
  onClose: () => void;
  onPlaySong: (song: ApiSong, queue: ApiSong[]) => void;
  getImageUrl: (
    imageInput: ApiImage[] | string | undefined,
    quality?: string
  ) => string;
  getArtistNameFromPrimary: (
    artistsInput: ApiArtist[] | string | undefined
  ) => string;
  processRawSong: (rawSong: any, albumInfo?: any) => ApiSong;
  onArtistPress: (artist: ApiArtist | string) => void;
  onAlbumPress: (album: Album) => void;
  styles: ReturnType<typeof createStyles>;
  initialQuery?: string;
}

const SearchOverlayFn: React.FC<SearchOverlayProps> = ({
  isVisible,
  onClose,
  onPlaySong,
  getImageUrl,
  processRawSong,
  onArtistPress,
  onAlbumPress,
  styles,
  getArtistNameFromPrimary,
  initialQuery = "",
}) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({
    songs: [] as ApiSong[],
    albums: [] as Album[],
    artists: [] as ApiArtistDetail[],
    // Add podcasts here if you have a type for it
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isWebSearch, setIsWebSearch] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
  const animValue = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(animValue.value, [0, 1], [height, 0]) },
    ],
    opacity: animValue.value,
  }));

  // Update query when initialQuery changes
  useEffect(() => {
    if (initialQuery && isVisible) {
      setQuery(initialQuery);
    }
  }, [initialQuery, isVisible]);

  useEffect(() => {
    if (isVisible) {
      animValue.value = withTiming(1, { duration: 300 });
      setTimeout(() => searchInputRef.current?.focus(), 350);
    } else {
      animValue.value = withTiming(0, { duration: 250 });
    }
  }, [isVisible, animValue]);

  const memoizedFetchSearchResults = useCallback(
    async (searchText: string) => {
      if (!searchText.trim()) {
        setResults({ songs: [], albums: [], artists: [] });
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const query = encodeURIComponent(searchText);

        // Fetch all result types at the same time
        const [songRes, albumRes, artistRes] = await Promise.all([
          fetch(
            `https://suman-api.vercel.app/search/songs?query=${query}&limit=10`
          ),
          fetch(
            `https://suman-api.vercel.app/search/albums?query=${query}&limit=5`
          ),
          fetch(
            `https://suman-api.vercel.app/search/artists?query=${query}&limit=5`
          ),
          // Add your podcast search fetch here
        ]);

        // Process song results
        const songsData = await songRes.json();
        const songs =
          songsData.status === "SUCCESS" && songsData.data?.results
            ? songsData.data.results.map((song: any) => processRawSong(song))
            : [];

        // Process album results
        const albumData = await albumRes.json();
        const albums =
          albumData.status === "SUCCESS" && albumData.data?.results
            ? albumData.data.results
            : [];

        // Process artist results
        const artistData = await artistRes.json();
        const artists =
          artistData.status === "SUCCESS" && artistData.data?.results
            ? artistData.data.results
            : [];

        setResults({ songs, albums, artists });
      } catch (error) {
        console.error("Multi-search error:", error);
        setResults({ songs: [], albums: [], artists: [] });
      } finally {
        setIsLoading(false);
      }
    },
    [processRawSong] // Add other dependencies if needed
  );

  const debouncedFetch = useMemo(
    () => debounce(memoizedFetchSearchResults, 400),
    [memoizedFetchSearchResults]
  );
  
  const handleQueryChange = (text: string) => {
    setQuery(text);
    debouncedFetch(text);
  };

  // Trigger search when query is set from voice input
  useEffect(() => {
    if (query && initialQuery && query === initialQuery) {
      memoizedFetchSearchResults(query);
    }
  }, [query, initialQuery, memoizedFetchSearchResults]);

  // Add this code right before the return statement of SearchOverlayFn
  const sections = useMemo(() => {
    const s = [];
    if (results.songs.length > 0) {
      s.push({ title: "Songs", data: results.songs, type: "song" });
    }
    if (results.albums.length > 0) {
      s.push({ title: "Albums", data: results.albums, type: "album" });
    }
    if (results.artists.length > 0) {
      s.push({ title: "Artists", data: results.artists, type: "artist" });
    }
    // Add podcasts section here
    return s;
  }, [results]);

  {
    /* First, create the new item renderers inside SearchOverlayFn */
  }
  const renderSongResultItem = (item: ApiSong) => (
    <TouchableOpacity
      style={styles.searchResultItem}
      onPress={() => onPlaySong(item, results.songs)}
    >
      <Image
        source={{ uri: getImageUrl(item.image, "150x150") }}
        style={styles.searchResultImage}
      />
      <View style={styles.searchResultTextContainer}>
        <Text style={styles.searchResultTitle} numberOfLines={1}>
          {sanitizeSongTitle(item.name || item.title)}
        </Text>
        <Text style={styles.searchResultArtistBase} numberOfLines={1}>
          {getArtistNameFromPrimary(item.primaryArtists)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderAlbumResultItem = (item: Album) => (
    <TouchableOpacity
      style={styles.searchResultItem}
      onPress={() => {
        onClose(); // Close the search overlay
        onAlbumPress(item); // Navigate to the album view
      }}
    >
      <Image
        source={{ uri: getImageUrl(item.image, "150x150") }}
        style={styles.searchResultImage}
      />
      <View style={styles.searchResultTextContainer}>
        <Text style={styles.searchResultTitle} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.searchResultArtistBase} numberOfLines={1}>
          {item.year} • {getArtistNameFromPrimary(item.primaryArtists)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderArtistResultItem = (item: ApiArtistDetail) => (
    <TouchableOpacity
      style={styles.searchResultItem}
      onPress={() => onArtistPress(item)}
    >
      <Image
        source={{ uri: getImageUrl(item.image, "150x150") }}
        style={styles.searchArtistImage}
      />
      <View style={styles.searchResultTextContainer}>
        <Text style={styles.searchResultTitle} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.searchResultArtistBase} numberOfLines={1}>
          Artist
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (!isVisible) return null;

  return (
    <Animated.View style={[styles.searchOverlayContainer, animatedStyle]}>
      <SafeAreaView style={styles.searchSafeArea}>
        <View style={styles.searchBar}>
          <TouchableOpacity onPress={onClose} style={styles.searchActionIcon}>
            <FontAwesome
              name="arrow-left"
              size={22}
              color={styles.searchIcon.color}
            />
          </TouchableOpacity>
          <TextInput
            ref={searchInputRef}
            style={styles.searchInputField}
            placeholder="Search Songs..."
            placeholderTextColor={styles.placeholderText.color}
            value={query}
            onChangeText={handleQueryChange}
            returnKeyType="search"
            autoCorrect={false}
            selectionColor={styles.primaryColor.color}
          />
          <TouchableOpacity
            onPress={() => setIsWebSearch(!isWebSearch)}
            style={[
              styles.searchActionIcon,
              isWebSearch && styles.webSearchActive,
            ]}
          >
            <FontAwesome
              name="globe"
              size={20}
              color={isWebSearch ? "#ff6600" : styles.searchIcon.color}
            />
          </TouchableOpacity>
          {isLoading ? (
            <View style={styles.searchActionIcon}>
              <SLiquidLoading
                size={24}
                color="#FFA500"
                background="transparent"
              />
            </View>
          ) : (
            query.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setQuery("");
                  setResults({ songs: [], albums: [], artists: [] });
                  searchInputRef.current?.focus();
                }}
                style={styles.searchActionIcon}
              >
                <FontAwesome
                  name="times-circle"
                  size={20}
                  color={styles.searchIcon.color}
                />
              </TouchableOpacity>
            )
          )}
        </View>
        <SectionList
          sections={sections}
          keyExtractor={(item, index) => item.id + index}
          renderItem={({ item, section }) => {
            if (section.type === "song")
              return renderSongResultItem(item as ApiSong);
            if (section.type === "album")
              return renderAlbumResultItem(item as Album);
            if (section.type === "artist")
              return renderArtistResultItem(item as ApiArtistDetail);
            return null;
          }}
          renderSectionHeader={({ section: { title } }) => (
            <Text style={styles.sectionHeader}>{title}</Text>
          )}
          contentContainerStyle={{ paddingBottom: 20, paddingTop: 10 }}
          ListEmptyComponent={
            !isLoading && query.length > 2 ? (
              <Text style={styles.noResultsText}>
                No results found for `{query}`
              </Text>
            ) : !isLoading && query.length === 0 ? (
              <Text style={styles.noResultsText}>
                Search for songs, artists, and albums.
              </Text>
            ) : null
          }
        />
      </SafeAreaView>
    </Animated.View>
  );
};
const SearchOverlay = React.memo(SearchOverlayFn);

const TutorialOverlay = ({ isVisible, onClose, styles }) => {
  if (!isVisible) return null;

  const tutorialItems = [
    {
      icon: "hand-pointer-o",
      title: "Play / Pause",
      description: "Tap anywhere on the header to play or pause the music.",
    },
    {
      icon: "arrows-h",
      title: "Seek",
      description:
        "Swipe left or right on the header to seek backward or forward by 10 seconds.",
    },
    {
      icon: "step-forward",
      title: "Next / Previous Song",
      description:
        "Double-tap on the right side of the header for the next song, or on the left for the previous one.",
    },
    {
      icon: "cogs",
      title: "Open Settings",
      description:
        "Long-press on the header for more than 0.8 seconds to open the settings panel.",
    },
    {
      icon: "question-circle-o",
      title: "Re-open this Guide",
      description:
        "Long-press anywhere in the main content area (below the header) to see this guide again.",
    },
  ];

  return (
    <Modal visible={isVisible} transparent animationType="fade">
      <View style={styles.tutorialOverlay}>
        <View style={styles.tutorialContent}>
          <Text style={styles.tutorialTitle}>Quick Guide</Text>
          {tutorialItems.map((item, index) => (
            <View style={styles.tutorialItem} key={index}>
              <FontAwesome
                name={item.icon as any}
                size={24}
                color={styles.primaryColor.color}
              />
              <View style={styles.tutorialTextContainer}>
                <Text style={styles.tutorialItemTitle}>{item.title}</Text>
                <Text style={styles.tutorialItemDescription}>
                  {item.description}
                </Text>
              </View>
            </View>
          ))}
          <TouchableOpacity
            style={styles.tutorialCloseButton}
            onPress={onClose}
          >
            <Text style={styles.tutorialCloseButtonText}>Got It!</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};
const LibraryModal = ({
  isVisible,
  onClose,
  styles,
  colors,
  userPlaylists,
  favorites,
  selectedPlaylist,
  handlePlaylistPress,
  handlePlaySong,
  createPlaylist,
  getImageUrl,
  getArtistNameFromPrimary,
  setFavorites,
  setUserPlaylists,
  setDeleteModalVisible,
  setItemToDelete,
  setDeleteType,
  setDeletePlaylistId,
}) => {
  const [activeTab, setActiveTab] = useState("playlists");
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreatePlaylist = () => {
    setNewPlaylistName("");
    setIsCreateModalVisible(true);
  };

  const handleCreateModalSubmit = async () => {
    if (newPlaylistName.trim().length > 0) {
      setIsCreating(true);
      await createPlaylist(newPlaylistName.trim());
      setIsCreating(false);
      setIsCreateModalVisible(false);
    }
  };

  const onPlaylistSelect = (playlist) => {
    onClose();
    // Use a timeout to allow the modal to close before navigating
    setTimeout(() => {
      handlePlaylistPress(playlist);
    }, 300);
  };

  const onFavoriteSelect = (song) => {
    onClose();
    setTimeout(() => {
      handlePlaySong(song, favorites);
    }, 300);
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.libraryModalBackdrop} onPress={onClose} />
      <SafeAreaView
        style={styles.libraryModalContainer}
        pointerEvents="box-none"
      >
        <View style={styles.libraryModalContent}>
          <View style={styles.libraryModalHeader}>
            <Text style={styles.libraryModalTitle}>My Library</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.libraryModalCloseButton}
            >
              <FontAwesome
                name="close"
                size={24}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.libraryTabContainer}>
            <TouchableOpacity
              style={[
                styles.libraryTab,
                activeTab === "playlists" && styles.libraryTabActive,
              ]}
              onPress={() => setActiveTab("playlists")}
            >
              <Text
                style={[
                  styles.libraryTabText,
                  activeTab === "playlists" && styles.libraryTabTextActive,
                ]}
              >
                Playlists
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.libraryTab,
                activeTab === "favorites" && styles.libraryTabActive,
              ]}
              onPress={() => setActiveTab("favorites")}
            >
              <Text
                style={[
                  styles.libraryTabText,
                  activeTab === "favorites" && styles.libraryTabTextActive,
                ]}
              >
                Favorites
              </Text>
            </TouchableOpacity>
          </View>

          {activeTab === "playlists" && (
            <FlatList
              data={userPlaylists}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.libraryPlaylistItem}
                  onPress={() => onPlaylistSelect(item)}
                >
                  <FontAwesome
                    name="music"
                    size={20}
                    color={colors.textSecondary}
                    style={{ marginRight: 15 }}
                  />
                  <View>
                    <Text style={styles.libraryItemTitle}>{item.name}</Text>
                    <Text style={styles.libraryItemSubtitle}>
                      {item.songs?.length || 0} songs
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              ListHeaderComponent={
                <TouchableOpacity
                  style={styles.createPlaylistButton}
                  onPress={handleCreatePlaylist}
                >
                  <FontAwesome name="plus" size={18} color={colors.primary} />
                  <Text style={styles.createPlaylistButtonText}>
                    Create New Playlist
                  </Text>
                </TouchableOpacity>
              }
              ListEmptyComponent={
                <Text style={styles.libraryEmptyText}>
                  You haven&apos;t created any playlists yet.
                </Text>
              }
            />
          )}

          {activeTab === "favorites" && (
            <FlatList
              data={favorites}
              keyExtractor={(item: ApiSong) => `fav-${item.id}`}
              renderItem={({ item }: { item: ApiSong }) => (
                <TouchableOpacity
                  style={styles.libraryPlaylistItem}
                  onPress={() => onFavoriteSelect(item)}
                  onLongPress={() => {
                    setDeleteType("favorite");
                    setItemToDelete(item);
                    setDeleteModalVisible(true);
                  }}
                  delayLongPress={1000}
                >
                  <Image
                    source={{ uri: getImageUrl(item.image, "150x150") }}
                    style={styles.librarySongArtwork}
                  />
                  <View style={styles.librarySongInfo}>
                    <Text style={styles.libraryItemTitle} numberOfLines={1}>
                      {sanitizeSongTitle(item.name || item.title)}
                    </Text>
                    <Text style={styles.libraryItemSubtitle} numberOfLines={1}>
                      {getArtistNameFromPrimary(item.primaryArtists)}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.libraryEmptyText}>
                  You haven&apos;t favorited any songs yet.
                </Text>
              }
            />
          )}
          {activeTab === "playlists" &&
            selectedPlaylist &&
            selectedPlaylist.id.startsWith("user-playlist-") && (
              // Draggable list for user-created playlist songs
              <DraggableFlatList
                data={selectedPlaylist.songs || []}
                keyExtractor={(item: ApiSong) => `playlist-song-${item.id}`}
                onDragEnd={({ data }) => {
                  // Update the playlist's song order in state and AsyncStorage
                  const updatedPlaylists = userPlaylists.map((p) =>
                    p.id === selectedPlaylist.id ? { ...p, songs: data } : p
                  );
                  setUserPlaylists(updatedPlaylists);
                  AsyncStorage.setItem(
                    STORAGE_KEYS.USER_PLAYLISTS,
                    JSON.stringify(updatedPlaylists)
                  );
                }}
                renderItem={({
                  item,
                  drag,
                  isActive,
                }: {
                  item: ApiSong;
                  drag: () => void;
                  isActive: boolean;
                }) => (
                  <TouchableOpacity
                    style={styles.libraryPlaylistItem}
                    onPress={() => handlePlaySong(item, selectedPlaylist.songs)}
                    onLongPress={() => {
                      setDeleteType("playlistSong");
                      setItemToDelete(item);
                      setDeletePlaylistId(selectedPlaylist.id);
                      setDeleteModalVisible(true);
                    }}
                    delayLongPress={1000}
                    onPressIn={drag}
                  >
                    <Image
                      source={{ uri: getImageUrl(item.image, "150x150") }}
                      style={styles.librarySongArtwork}
                    />
                    <View style={styles.librarySongInfo}>
                      <Text style={styles.libraryItemTitle} numberOfLines={1}>
                        {sanitizeSongTitle(item.name || item.title)}
                      </Text>
                      <Text
                        style={styles.libraryItemSubtitle}
                        numberOfLines={1}
                      >
                        {getArtistNameFromPrimary(item.primaryArtists)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={styles.libraryEmptyText}>
                    This playlist has no songs yet.
                  </Text>
                }
              />
            )}
        </View>
      </SafeAreaView>
      {/* Create Playlist Modal */}
      <Modal
        visible={isCreateModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCreateModalVisible(false)}
      >
        <View
          style={[
            styles.settingsBackdrop,
            { justifyContent: "center", alignItems: "center" },
          ]}
        >
          <View
            style={[styles.settingsContainer, { width: "90%", maxWidth: 400 }]}
          >
            <Text style={styles.settingsTitle}>Create Playlist</Text>
            <TextInput
              style={[
                styles.searchInputField,
                {
                  marginBottom: 20,
                  backgroundColor: colors.card,
                  borderRadius: 8,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: colors.primary,
                  color: colors.text,
                  fontSize: 18,
                },
              ]}
              placeholder="Enter playlist name"
              placeholderTextColor={colors.placeholder}
              value={newPlaylistName}
              onChangeText={setNewPlaylistName}
              autoFocus
              editable={!isCreating}
              onSubmitEditing={handleCreateModalSubmit}
              returnKeyType="done"
            />
            <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
              <TouchableOpacity
                style={[
                  styles.settingsCloseButton,
                  { marginRight: 10, backgroundColor: colors.separator },
                ]}
                onPress={() => setIsCreateModalVisible(false)}
                disabled={isCreating}
              >
                <Text
                  style={[
                    styles.settingsCloseButtonText,
                    { color: colors.textSecondary },
                  ]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.settingsCloseButton}
                onPress={handleCreateModalSubmit}
                disabled={isCreating || newPlaylistName.trim().length === 0}
              >
                <Text style={styles.settingsCloseButtonText}>
                  {isCreating ? "Creating..." : "Create"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
};
const HomeScreen: React.FC = () => {
  const currentSong = useCurrentSong();
  const isPlaying = useIsPlaying();
  const playerActions = usePlayer();
  const [homePageModules, setHomePageModules] = useState<any>(null);
  const [recommendedSongs, setRecommendedSongs] = useState<ApiSong[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(
    null
  );
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<ApiArtistDetail | null>(
    null
  );
  type ViewType = "main" | "playlist" | "album" | "artist";
  const [selectedView, setSelectedView] = useState<ViewType>("main");
  const [isSearchOverlayVisible, setIsSearchOverlayVisible] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>("hindi");
  const [expandedHomepageSection, setExpandedHomepageSection] = useState<{
    type: "playlists" | "albums" | "charts" | "trending";
    viewMode: "list" | "grid";
  } | null>(null);
  const [defaultExpandedViewMode, setDefaultExpandedViewMode] = useState<
    "list" | "grid"
  >("list");
  const [isAddToPlaylistModalVisible, setIsAddToPlaylistModalVisible] =
    useState(false);
  const [songToAdd, setSongToAdd] = useState<ApiSong | null>(null);
  const [isLibraryModalVisible, setIsLibraryModalVisible] = useState(false);

  const [theme, setTheme] = useState<Theme>("dark");
  const [appearanceMode, setAppearanceMode] =
    useState<AppearanceMode>("normal");
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [isQualityDropdownOpen, setIsQualityDropdownOpen] = useState(false);
  const [isTutorialVisible, setIsTutorialVisible] = useState(false);
  const [isKeepAwakeEnabled, setIsKeepAwakeEnabled] = useState(false);
  const [isShakeNextEnabled, setIsShakeNextEnabled] = useState(false);
  const [isSpeechListening, setIsSpeechListening] = useState(false);
  const [voiceSearchText, setVoiceSearchText] = useState("");
  const [favorites, setFavorites] = useState<ApiSong[]>([]);
  const [userPlaylists, setUserPlaylists] = useState<Playlist[]>([]);
  const [watchlist, setWatchlist] = useState<ApiSong[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const colors = theme === "light" ? lightColors : darkColors;
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [showFloatingNotif, setShowFloatingNotif] = useState(false);
  const [showFloatingNotifications, setShowFloatingNotifications] =
    useState<boolean>(true);
  const [floatingNotifSongDetails, setFloatingNotifSongDetails] = useState({
    image: "",
    title: "",
    artist: "",
  });
  const [expandedArtistId, setExpandedArtistId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const availableLanguages = STATIC_AVAILABLE_LANGUAGES;
  const scrollY = useSharedValue(0);
  const flatListRef = useRef<FlatList<any>>(null);
  const libraryButtonOpacity = useSharedValue(1);

  const rippleX = useSharedValue(0);
  const rippleY = useSharedValue(0);
  const rippleProgress = useSharedValue(0);
  const waveProgress = useSharedValue(0);
  const waveOriginX = useSharedValue(0);

  const time = useSharedValue(0);

  const [sWritten, setSWritten] = useState(false);

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<ApiSong | null>(null);
  const [deleteType, setDeleteType] = useState<"favorite" | "playlistSong">(
    "favorite"
  );
  const [deletePlaylistId, setDeletePlaylistId] = useState<string | null>(null);

  const [themeMode, setThemeMode] = useState<"manual" | "auto" | "reverse">(
    "auto"
  );
  const ambientEnv = useAmbientTheme(
    themeMode === "auto" || themeMode === "reverse"
  );

  // 1. A shared value to drive the animation (0 = light, 1 = dark)
  const themeAnimation = useSharedValue(theme === "dark" ? 1 : 0);

  // 2. A useEffect to run the animation when the 'theme' state changes
  useEffect(() => {
    themeAnimation.value = withTiming(theme === "dark" ? 1 : 0, {
      duration: 500, // Animation speed in milliseconds
    });
  }, [theme, themeAnimation]);

  // 3. An animated style that interpolates the background color
  const animatedBackgroundStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      themeAnimation.value,
      [0, 1], // Input range
      [lightColors.background, darkColors.background] // Output colors
    );
    return {
      backgroundColor,
    };
  });

  // ---- END: ADDITIONS FOR SMOOTH THEME TRANSITION ----

  const artistHeaderImageStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: interpolate(
            scrollY.value,
            [-HEADER_MAX_HEIGHT, 0, HEADER_SCROLL_DISTANCE],
            [-HEADER_MAX_HEIGHT / 2, 0, HEADER_SCROLL_DISTANCE * 0.2]
          ),
        },
        {
          scale: interpolate(
            scrollY.value,
            [-HEADER_MAX_HEIGHT, 0],
            [2, 1],
            Extrapolate.CLAMP
          ),
        },
      ],
    } as const;
  });

  const artistTitleStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(
        scrollY.value,
        [0, HEADER_SCROLL_DISTANCE / 2, HEADER_SCROLL_DISTANCE],
        [1, 1, 0],
        Extrapolate.CLAMP
      ),
    };
  });

  const stickyHeaderStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(
        scrollY.value,
        [HEADER_SCROLL_DISTANCE / 2, HEADER_SCROLL_DISTANCE],
        [0, 1],
        Extrapolate.CLAMP
      ),
    };
  });

  useEffect(() => {
    if (isLoading) setSWritten(false);
  }, [isLoading]);

  useEffect(() => {
    time.value = withRepeat(withTiming(1, { duration: 10000 }), -1, true);
  }, []);

  const configureGoogleSignIn = () => {
    GoogleSignin.configure({
      webClientId:
        "903522270495-t5vjfcpsmbdh08sc543ri9m12nsnt3ni.apps.googleusercontent.com",
      offlineAccess: false,
    });
  };

  useEffect(() => {
    configureGoogleSignIn();
  }, []);

  const signIn = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      setUserEmail(userInfo.data.user.email);
      await AsyncStorage.setItem(
        STORAGE_KEYS.USER_GMAIL,
        userInfo.data.user.email
      );
      await loadUserLibrary(userInfo.data.user.email);
    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        // user cancelled the login flow
      } else if (error.code === statusCodes.IN_PROGRESS) {
        // operation (e.g. sign in) is in progress already
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        // play services not available or outdated
      } else {
        // some other error happened
        console.error(error);
      }
    }
  };

  const saveLibraryToFile = async (email: string) => {
    const libraryData = {
      email,
      favorites,
      playlists: userPlaylists,
      watchlist,
    };
    const fileUri = FileSystem.documentDirectory + "library_backup.txt";
    try {
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(libraryData));
    } catch (e) {
      console.error("Failed to save library to file", e);
    }
  };

  const loadLibraryFromFile = async (email: string) => {
    const fileUri = FileSystem.documentDirectory + "library_backup.txt";
    try {
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (fileInfo.exists) {
        const fileContent = await FileSystem.readAsStringAsync(fileUri);
        const libraryData = JSON.parse(fileContent);
        if (libraryData.email === email) {
          setFavorites(libraryData.favorites || []);
          setUserPlaylists(libraryData.playlists || []);
          setWatchlist(libraryData.watchlist || []);
        }
      }
    } catch (e) {
      console.error("Failed to load library from file", e);
    }
  };

  const loadUserLibrary = async (email: string) => {
    const savedFavorites = await AsyncStorage.getItem(
      STORAGE_KEYS.USER_FAVORITES
    );
    if (savedFavorites) setFavorites(JSON.parse(savedFavorites));

    const savedPlaylists = await AsyncStorage.getItem(
      STORAGE_KEYS.USER_PLAYLISTS
    );
    if (savedPlaylists) setUserPlaylists(JSON.parse(savedPlaylists));

    const savedWatchlist = await AsyncStorage.getItem(
      STORAGE_KEYS.USER_WATCHLIST
    );
    if (savedWatchlist) setWatchlist(JSON.parse(savedWatchlist));

    await loadLibraryFromFile(email);
  };
  useEffect(() => {
    // Exit early if the sensor isn't active or hasn't provided a valid value yet.
    if (themeMode === "manual" || !ambientEnv) {
      return;
    }

    let newTheme: Theme | null = null;
    let newAppearance: AppearanceMode | null = null;

    if (themeMode === "auto") {
      newTheme = ambientEnv === "light" ? "light" : "dark";
      newAppearance = ambientEnv === "light" ? "realistic" : "normal";
    } else if (themeMode === "reverse") {
      newTheme = ambientEnv === "light" ? "dark" : "light";
      newAppearance = ambientEnv === "light" ? "normal" : "realistic";
    }

    // Apply changes only if the current state is different from what it should be.
    if (newTheme && newTheme !== theme) {
      setTheme(newTheme);
    }
    if (newAppearance && newAppearance !== appearanceMode) {
      setAppearanceMode(newAppearance);
    }

    // By including all dependencies, this logic will re-run and self-correct if needed.
  }, [themeMode, ambientEnv, theme, appearanceMode]);

  useEffect(() => {
    const loadSettingsAndUser = async () => {
      const savedTheme = (await AsyncStorage.getItem(
        STORAGE_KEYS.APP_THEME
      )) as Theme | null;
      if (savedTheme) setTheme(savedTheme);

      const savedKeepAwake = await AsyncStorage.getItem(
        STORAGE_KEYS.KEEP_AWAKE_ENABLED
      );
      if (savedKeepAwake !== null) {
        setIsKeepAwakeEnabled(JSON.parse(savedKeepAwake));
      }

      const savedShakeNext = await AsyncStorage.getItem(
        STORAGE_KEYS.SHAKE_NEXT_ENABLED
      );
      if (savedShakeNext !== null) {
        setIsShakeNextEnabled(JSON.parse(savedShakeNext));
      }

      const savedAppearance = (await AsyncStorage.getItem(
        STORAGE_KEYS.APPEARANCE_MODE
      )) as AppearanceMode | null;
      if (savedAppearance) setAppearanceMode(savedAppearance);

      const tutorialSeen = await AsyncStorage.getItem(
        STORAGE_KEYS.TUTORIAL_SEEN
      );
      if (!tutorialSeen) {
        setIsTutorialVisible(true);
      }

      const savedFloatingNotifPref = await AsyncStorage.getItem(
        STORAGE_KEYS.SHOW_FLOATING_NOTIFICATIONS
      );
      if (savedFloatingNotifPref !== null) {
        setShowFloatingNotifications(JSON.parse(savedFloatingNotifPref));
      }

      // Always load favorites and playlists from AsyncStorage
      const savedFavorites = await AsyncStorage.getItem(
        STORAGE_KEYS.USER_FAVORITES
      );
      if (savedFavorites) setFavorites(JSON.parse(savedFavorites));

      const savedPlaylists = await AsyncStorage.getItem(
        STORAGE_KEYS.USER_PLAYLISTS
      );
      if (savedPlaylists) setUserPlaylists(JSON.parse(savedPlaylists));

      const savedWatchlist = await AsyncStorage.getItem(
        STORAGE_KEYS.USER_WATCHLIST
      );
      if (savedWatchlist) setWatchlist(JSON.parse(savedWatchlist));

      // If user is logged in, load library from file as well
      const currentUser = await GoogleSignin.getCurrentUser();
      if (currentUser) {
        setUserEmail(currentUser.user.email);
        await loadLibraryFromFile(currentUser.user.email);
      } else {
        Alert.alert(
          "Login Required",
          "Please log in with your Google account to use library features.",
          [
            { text: "Login", onPress: signIn },
            { text: "Cancel", style: "cancel" },
          ]
        );
      }
    };
    loadSettingsAndUser();
  }, []);

  useEffect(() => {
    if (userEmail) {
      saveLibraryToFile(userEmail);
    }
  }, [favorites, userPlaylists, watchlist, userEmail]);

  // Handle keep awake effect
  useEffect(() => {
    if (isKeepAwakeEnabled) {
      activateKeepAwake();
    } else {
      deactivateKeepAwake();
    }
  }, [isKeepAwakeEnabled]);

  const toggleFavorite = async (song: ApiSong) => {
    const isFavorite = favorites.some((s) => s.id === song.id);
    let newFavorites;
    if (isFavorite) {
      newFavorites = favorites.filter((s) => s.id !== song.id);
    } else {
      newFavorites = [...favorites, song];
    }
    setFavorites(newFavorites);
    await AsyncStorage.setItem(
      STORAGE_KEYS.USER_FAVORITES,
      JSON.stringify(newFavorites)
    );
  };

  const createPlaylist = async (
    playlistName: string,
    initialSong?: ApiSong
  ) => {
    let playlistImage = "https://via.placeholder.com/150/121212/FFFFFF/?text=P";
    if (initialSong && initialSong.image) {
      if (typeof initialSong.image === "string") {
        playlistImage = initialSong.image;
      } else if (
        Array.isArray(initialSong.image) &&
        initialSong.image.length > 0
      ) {
        playlistImage = initialSong.image[0].link || playlistImage;
      }
    }
    const newPlaylist: Playlist = {
      id: `user-playlist-${Date.now()}`,
      name: playlistName,
      songs: initialSong ? [initialSong] : [],
      image: playlistImage,
    };
    const newPlaylists = [...userPlaylists, newPlaylist];
    setUserPlaylists(newPlaylists);
    await AsyncStorage.setItem(
      STORAGE_KEYS.USER_PLAYLISTS,
      JSON.stringify(newPlaylists)
    );
    return newPlaylist; // Return the new playlist
  };

  const openAddToPlaylistModal = (song: ApiSong) => {
    setSongToAdd(song);
    setIsAddToPlaylistModalVisible(true);
  };

  const addToPlaylist = async (playlistId: string) => {
    if (!songToAdd) return;
    const newPlaylists = userPlaylists.map((p) => {
      if (p.id === playlistId) {
        // Avoid adding duplicate songs
        if (p.songs?.some((s) => s.id === songToAdd.id)) {
          Alert.alert("Duplicate", "This song is already in the playlist.");
          return p;
        }
        return { ...p, songs: [...(p.songs || []), songToAdd] };
      }
      return p;
    });
    setUserPlaylists(newPlaylists);
    await AsyncStorage.setItem(
      STORAGE_KEYS.USER_PLAYLISTS,
      JSON.stringify(newPlaylists)
    );
    setIsAddToPlaylistModalVisible(false);
    setSongToAdd(null);
  };

  const handleCreatePlaylistFromModal = () => {
    if (!songToAdd) return;
    Alert.prompt(
      "Create Playlist",
      "Enter a name for your new playlist:",
      async (text) => {
        if (text && text.trim().length > 0) {
          await createPlaylist(text.trim(), songToAdd);
          setIsAddToPlaylistModalVisible(false);
          setSongToAdd(null);
        }
      }
    );
  };

  const handleCloseTutorial = async () => {
    setIsTutorialVisible(false);
    await AsyncStorage.setItem(STORAGE_KEYS.TUTORIAL_SEEN, "true");
  };

  const animatedLibraryButton = useAnimatedStyle(() => ({
    opacity: libraryButtonOpacity.value,
  }));

  useEffect(() => {
    const readNfc = async () => {
      try {
        await NfcManager.requestTechnology(NfcTech.Ndef);
      } catch (ex) {
        NfcManager.cancelTechnologyRequest().catch(() => {});
      }
    };
    const onDiscoverTag = () => {
      if (currentSong) {
        playerActions.togglePlayPause();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
      if (Platform.OS === "ios") readNfc();
    };
    const initNfc = async () => {
      if (await NfcManager.isSupported()) {
        NfcManager.setEventListener(NfcEvents.DiscoverTag, onDiscoverTag);
        readNfc();
      }
    };
    initNfc();
    return () => {
      NfcManager.setEventListener(NfcEvents.DiscoverTag, null);
      NfcManager.cancelTechnologyRequest().catch(() => {});
    };
  }, [currentSong, playerActions]);

  useEffect(() => {
    let lastActionTime = 0;
    const accelSubscription = Accelerometer.addListener(
      ({ x: ax, y: ay, z: az }) => {
        if (!isShakeNextEnabled) return;
        const now = Date.now();
        if (now - lastActionTime < 1000) return;
        const totalForce = Math.sqrt(ax * ax + ay * ay + az * az);
        if (totalForce > 2.5) {
          playerActions.nextSong();
          lastActionTime = now;
        }
      }
    );
    return () => accelSubscription.remove();
  }, [playerActions, isShakeNextEnabled]);

  const [isMicSearchActive, setIsMicSearchActive] = useState(false);
  const [isVoiceSearchVisible, setIsVoiceSearchVisible] = useState(false);
  const [voiceSearchQuery, setVoiceSearchQuery] = useState("");
  const micWaveAnim = useSharedValue(0);

  const micWaveAnimatedStyle = useAnimatedStyle(() => ({
    opacity: micWaveAnim.value,
  }));

  // Audio player for mic search sound
  const micSearchSound = useAudioPlayer(
    require("../../assets/audio/start.mp3")
  );

  const handleVoiceSearchResult = (text: string) => {
    setVoiceSearchText(text);
    setVoiceSearchQuery(text); // Store the text for SearchOverlay
    setQuery(text);
    
    // Stop the mic search sound and close voice search
    if (micSearchSound.playing) {
      micSearchSound.pause();
      micSearchSound.seekTo(0); // Reset to start
    }
    
    setIsVoiceSearchVisible(false);
    setIsSearchOverlayVisible(true);
  };

  const handleMicSearch = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Play the start sound for 3 seconds
    try {
      micSearchSound.play();
      
      // Stop after 3 seconds
      setTimeout(() => {
        if (micSearchSound.playing) {
          micSearchSound.pause();
          micSearchSound.seekTo(0); // Reset to start for next use
        }
      }, 3000);
    } catch (error) {
      console.error("Error playing mic search sound:", error);
    }
    
    setIsVoiceSearchVisible(true);
  };

  const lastHapticX = useSharedValue(0);
  const HAPTIC_THRESHOLD = 20;

  const triggerScrubHaptic = () => {
    if (Platform.OS === "android") Vibration.vibrate(15);
    else Haptics.selectionAsync();
  };

  const triggerRipple = (x: number, y: number) => {
    "worklet";
    rippleX.value = x;
    rippleY.value = y;
    rippleProgress.value = 0;
    rippleProgress.value = withTiming(1, {
      duration: 600,
      easing: Easing.out(Easing.quad),
    });
  };

  const triggerWave = (direction: "left" | "right") => {
    "worklet";
    waveOriginX.value = direction === "right" ? -width : width;
    waveProgress.value = 0;
    waveProgress.value = withTiming(1, { duration: 500, easing: Easing.ease });
  };

  const gesture = useMemo(
    () =>
      Gesture.Race(
        Gesture.LongPress()
          .minDuration(800)
          .onStart(() => {
            runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Heavy);
          })
          .onEnd((_e, success) => {
            if (success) runOnJS(setIsSettingsVisible)(true);
          }),
        Gesture.Exclusive(
          Gesture.Tap()
            .numberOfTaps(2)
            .onEnd((e, success) => {
              "worklet";
              if (success && currentSong) {
                if (e.x > width / 2) runOnJS(playerActions.nextSong)();
                else runOnJS(playerActions.previousSong)();
                triggerWave(e.x > width / 2 ? "right" : "left");
              }
            }),
          Gesture.Tap()
            .numberOfTaps(1)
            .onEnd((e) => {
              "worklet";
              const safeAreaTopOffset = Platform.OS === "ios" ? 45 : 0;
              triggerRipple(e.x, e.y - safeAreaTopOffset);
              if (currentSong) {
                runOnJS(playerActions.togglePlayPause)();
              } else if (playerActions.lastPlayedSong) {
                // Resume last played song if tapped when nothing is playing
                runOnJS(playerActions.resumeLastPlayback)();
              }
            }),
          Gesture.Pan()
            .activeOffsetX([-20, 20])
            .failOffsetY([-10, 10])
            .onBegin(() => {
              "worklet";
              runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Heavy);
            })
            .onUpdate((e) => {
              "worklet";
              if (
                Math.abs(e.translationX - lastHapticX.value) > HAPTIC_THRESHOLD
              ) {
                lastHapticX.value = e.translationX;
                runOnJS(triggerScrubHaptic)();
              }
            })
            .onEnd((e) => {
              "worklet";
              lastHapticX.value = 0;
              if (!currentSong) return;

              if (e.translationX > 40) {
                if (playerActions.seekBy) runOnJS(playerActions.seekBy)(10);
                triggerWave("right");
              }
              if (e.translationX < -40) {
                if (playerActions.seekBy) runOnJS(playerActions.seekBy)(-10);
                triggerWave("left");
              }
            })
        )
      ),
    [playerActions]
  );

  const mainContentGesture = Gesture.LongPress()
    .minDuration(1000) // 1 second long press
    .onStart(() => {
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
    })
    .onEnd((_e, success) => {
      if (success) {
        runOnJS(setIsTutorialVisible)(true);
      }
    });

  const scrollHandler = useAnimatedScrollHandler(
    {
      onScroll: (event) => {
        // ✅ Now works on the main page AND the artist page
        if (
          (selectedView === "main" && !expandedHomepageSection) ||
          selectedView === "artist"
        ) {
          scrollY.value = event.contentOffset.y;
        }
      },
    },
    [selectedView, expandedHomepageSection]
  );

  const saveDefaultExpandedViewMode = useCallback(
    async (mode: "list" | "grid") => {
      try {
        await AsyncStorage.setItem(
          STORAGE_KEYS.EXPANDED_SECTION_DEFAULT_VIEW_MODE,
          mode
        );
        setDefaultExpandedViewMode(mode);
      } catch (e) {
        console.error("Failed to save expanded view mode", e);
      }
    },
    []
  );

  const loadDefaultExpandedViewMode = useCallback(async () => {
    try {
      const mode = await AsyncStorage.getItem(
        STORAGE_KEYS.EXPANDED_SECTION_DEFAULT_VIEW_MODE
      );
      if (mode === "grid" || mode === "list") {
        setDefaultExpandedViewMode(mode);
        return mode;
      }
    } catch (e) {
      console.error("Failed to load expanded view mode", e);
    }
    return "list";
  }, []);

  const getArtistNameFromPrimary = useCallback(
    (artistsInput: ApiArtist[] | string | undefined): string => {
      if (!artistsInput) return "Unknown Artist";
      if (typeof artistsInput === "string") return artistsInput;
      if (Array.isArray(artistsInput) && artistsInput.length > 0) {
        return artistsInput
          .map((a) => a.name || "")
          .filter(Boolean)
          .join(", ");
      }
      return "Unknown Artist";
    },
    []
  );

  const getImageUrl = useCallback(
    (
      imageInput: ApiImage[] | string | undefined,
      quality: string = "150x150"
    ): string => {
      const placeholder =
        "https://via.placeholder.com/150/121212/FFFFFF/?text=S";
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
    },
    []
  );

  const processRawSong = useCallback(
    (rawSong: any, containerInfo?: any): ApiSong => {
      let artists: ApiArtist[] = [];
      const rawArtists =
        rawSong.primaryArtists ??
        rawSong.artists ??
        rawSong.artist ??
        containerInfo?.primaryArtists ??
        containerInfo?.artists;
      if (typeof rawArtists === "string") {
        artists = rawArtists.split(",").map((name) => ({
          id: name.trim(),
          name: name.trim(),
          url: "",
          image: "",
          type: "artist",
        }));
      } else if (Array.isArray(rawArtists)) {
        artists = rawArtists.map((art) => {
          if (typeof art === "string")
            return { id: art, name: art, url: "", image: "", type: "artist" };
          const baseArt = {
            id:
              art.id ||
              art.name ||
              `temp-art-${Math.random().toString(16).slice(2)}`,
            name: art.name || "Unknown Artist",
            url: art.url || "",
            image: art.image || "",
            type: art.type || "artist",
          };
          return { ...baseArt, ...art };
        });
      }
      const songImageRaw =
        rawSong.image ?? rawSong.artwork ?? containerInfo?.image;
      let songImage: ApiImage[];
      if (Array.isArray(songImageRaw) && songImageRaw.length > 0) {
        songImage = songImageRaw.filter(
          (img) =>
            img && typeof img.link === "string" && img.link.startsWith("http")
        );
        if (songImage.length === 0)
          songImage = [
            {
              quality: "150x150",
              link: "https://via.placeholder.com/150/121212/FFFFFF/?text=S",
            },
          ];
      } else if (
        typeof songImageRaw === "string" &&
        songImageRaw.startsWith("http")
      ) {
        songImage = [{ quality: "150x150", link: songImageRaw }];
      } else {
        songImage = [
          {
            quality: "150x150",
            link: "https://via.placeholder.com/150/121212/FFFFFF/?text=S",
          },
        ];
      }
      let songId = rawSong.id;
      if (
        songId === null ||
        songId === undefined ||
        String(songId).trim() === ""
      ) {
        const artistNamesString = artists.map((a) => a.name).join("_");
        songId = `${rawSong.name || "untitled"}_${
          artistNamesString || "unknownartist"
        }_${String(rawSong.duration || "0")}`
          .replace(/\s+/g, "_")
          .toLowerCase();
      } else {
        songId = String(songId);
      }

      return {
        id: songId,
        name: rawSong.name ?? rawSong.title ?? "Unknown Song",
        title: rawSong.title ?? rawSong.name ?? "Unknown Song",
        type: rawSong.type ?? "song",
        album: rawSong.album
          ? typeof rawSong.album === "string"
            ? { id: rawSong.album, name: rawSong.album, url: "" }
            : {
                id:
                  rawSong.album.id ??
                  rawSong.album.name ??
                  `album-${Math.random()}`,
                name: rawSong.album.name ?? "Unknown Album",
                url: rawSong.album.url ?? "",
              }
          : containerInfo &&
            (containerInfo.type === "album" ||
              containerInfo.objectType === "album")
          ? {
              id: containerInfo.id ?? `album-${Math.random()}`,
              name: containerInfo.name ?? "Unknown Album",
              url: containerInfo.url ?? "",
            }
          : {
              id: `album-unknown-${Math.random()}`,
              name: "Unknown Album",
              url: "",
            },
        year:
          rawSong.year ??
          containerInfo?.year ??
          new Date().getFullYear().toString(),
        duration: String(rawSong.duration ?? "0"),
        language:
          rawSong.language ?? containerInfo?.language ?? selectedLanguage,
        primaryArtists: artists,
        image: songImage,
        url: rawSong.url ?? rawSong.permaUrl ?? containerInfo?.url ?? "",
        downloadUrl:
          rawSong.downloadUrl ??
          (Array.isArray(rawSong.downloadUrls)
            ? rawSong.downloadUrls
            : undefined) ??
          rawSong.url ??
          "",
        subtitle: rawSong.subtitle ?? getArtistNameFromPrimary(artists),
        explicitContent:
          rawSong.explicitContent ?? rawSong.explicit_content ?? 0,
        playCount:
          parseInt(String(rawSong.playCount || rawSong.play_count || "0")) || 0,
        label: rawSong.label ?? containerInfo?.label ?? "",
        origin:
          rawSong.origin ??
          (containerInfo
            ? containerInfo.type || "container_item"
            : "search_result"),
        permaUrl: rawSong.perma_url ?? rawSong.url ?? containerInfo?.url ?? "",
        dominantColor: rawSong.dominantColor || containerInfo?.dominantColor,
      };
    },
    [getArtistNameFromPrimary, selectedLanguage]
  );

  const fetchData = useCallback(
    async (language: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `https://suman-api.vercel.app/modules?language=${language}`
        );
        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status}`);
        const apiResponse = await response.json();
        const data = apiResponse?.data;
        if (data) {
          const processedModules: any = {};
          if (data.albums)
            processedModules.albums = data.albums.map((album: any) => ({
              ...album,
              songs: (album.songs || []).map((s: any) =>
                processRawSong(s, album)
              ),
            }));
          if (data.playlists)
            processedModules.playlists = data.playlists.map(
              (playlist: any) => ({
                ...playlist,
                songs: (playlist.songs || []).map((s: any) =>
                  processRawSong(s, playlist)
                ),
              })
            );
          if (data.charts)
            processedModules.charts = data.charts.map((chart: any) => ({
              ...chart,
              songs: (chart.songs || []).map((s: any) =>
                processRawSong(s, chart)
              ),
            }));
          if (data.trending && data.trending.songs) {
            processedModules.trending = {
              ...data.trending,
              songs: data.trending.songs.map((s: any) =>
                processRawSong(s, data.trending)
              ),
            };
          } else if (data.trending && Array.isArray(data.trending)) {
            processedModules.trending = {
              songs: data.trending.map((s: any) => processRawSong(s)),
            };
          }
          setHomePageModules(processedModules);
        } else {
          setHomePageModules(null);
        }

        const songs: ApiSong[] = [];
        const processModuleSongs = (
          moduleItems: any[],
          containerInfo?: any
        ) => {
          if (moduleItems && Array.isArray(moduleItems)) {
            moduleItems.forEach((item: any) => {
              if (
                item &&
                (item.type === "song" ||
                  item.downloadUrl ||
                  (item.downloadUrls && item.downloadUrls.length > 0))
              ) {
                songs.push(processRawSong(item, containerInfo || item));
              } else if (item?.songs && Array.isArray(item.songs)) {
                item.songs.forEach((songItem: any) =>
                  songs.push(processRawSong(songItem, item))
                );
              }
            });
          }
        };

        if (apiResponse.data?.albums)
          processModuleSongs(apiResponse.data.albums);
        if (apiResponse.data?.trending?.songs)
          processModuleSongs(
            apiResponse.data.trending.songs,
            apiResponse.data.trending
          );
        else if (Array.isArray(apiResponse.data?.trending))
          processModuleSongs(apiResponse.data.trending);
        if (apiResponse.data?.playlists)
          processModuleSongs(apiResponse.data.playlists);
        if (apiResponse.data?.charts)
          processModuleSongs(apiResponse.data.charts);

        const uniqueSongs = Array.from(
          new Map(songs.map((song) => [song.id, song])).values()
        );
        const finalSongs = shuffleArray(uniqueSongs).slice(0, 30);

        await AsyncStorage.setItem(
          `${STORAGE_KEYS.RECOMMENDED_SONGS}_${language}`,
          JSON.stringify(finalSongs)
        );
        setRecommendedSongs(finalSongs);
      } catch (err) {
        console.error("❌ Error in fetchData:", err);
        setError(err instanceof Error ? err.message : "Failed to load data");
        setHomePageModules(null);
        setRecommendedSongs([]);
      } finally {
        setIsLoading(false);
      }
    },
    [processRawSong]
  );

  const loadSavedData = useCallback(
    async (language: string) => {
      setIsLoading(true);
      try {
        const savedSongsJson = await AsyncStorage.getItem(
          `${STORAGE_KEYS.RECOMMENDED_SONGS}_${language}`
        );
        if (savedSongsJson) {
          const parsedSongs = JSON.parse(savedSongsJson) as ApiSong[];

          if (Array.isArray(parsedSongs) && parsedSongs.length > 0) {
            setRecommendedSongs(parsedSongs);
          }
        }
      } catch (error) {
        console.error("❌ Error loading saved songs:", error);
        setRecommendedSongs([]);
      }
      await fetchData(language);
    },
    [fetchData]
  );

  const saveSelectedLanguage = useCallback(async (languageCode: string) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SELECTED_LANGUAGE, languageCode);
    } catch (e) {
      console.error("Failed to save language to storage", e);
    }
  }, []);

  const loadSelectedLanguage = useCallback(async () => {
    try {
      const lang = await AsyncStorage.getItem(STORAGE_KEYS.SELECTED_LANGUAGE);
      if (lang && availableLanguages.some((l) => l.code === lang)) {
        setSelectedLanguage(lang);
        return lang;
      }
    } catch (e) {
      console.error("Failed to load language from storage", e);
    }
    const defaultLang = "hindi";
    setSelectedLanguage(defaultLang);
    return defaultLang;
  }, [availableLanguages]);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await loadDefaultExpandedViewMode();
      const lang = await loadSelectedLanguage();
      await loadSavedData(lang);
    };
    init();
  }, [loadSelectedLanguage, loadSavedData, loadDefaultExpandedViewMode]);

  const handleLanguageSelect = useCallback(
    async (languageCode: string) => {
      if (selectedLanguage === languageCode && homePageModules) return;
      setSelectedLanguage(languageCode);
      await saveSelectedLanguage(languageCode);
      setSelectedView("main");
      setSelectedPlaylist(null);
      setSelectedAlbum(null);
      setSelectedArtist(null);
      setExpandedHomepageSection(null);
      if (flatListRef.current) {
        flatListRef.current.scrollToOffset({ offset: 0, animated: false });
      }
      scrollY.value = 0;
      setError(null);
      setHomePageModules(null);
      setRecommendedSongs([]);
      await loadSavedData(languageCode);
    },
    [
      selectedLanguage,
      loadSavedData,
      saveSelectedLanguage,
      scrollY,
      homePageModules,
    ]
  );

  const headerAnimatedStyle = useAnimatedStyle(() => {
    const isActive = selectedView === "main" && !expandedHomepageSection;
    return {
      height: isActive
        ? interpolate(
            scrollY.value,
            [0, HEADER_SCROLL_DISTANCE],
            [HEADER_MAX_HEIGHT, HEADER_MIN_HEIGHT],
            Extrapolate.CLAMP
          )
        : HEADER_MIN_HEIGHT,
      opacity:
        (selectedView === "main" && !expandedHomepageSection) ||
        selectedView !== "main"
          ? 1
          : 0,
      zIndex: selectedView === "main" && !expandedHomepageSection ? 10 : 0,
    };
  });

  const headerContentAnimatedStyle = useAnimatedStyle(() => {
    const isActive = selectedView === "main" && !expandedHomepageSection;
    const opacity = isActive
      ? interpolate(
          scrollY.value,
          [0, HEADER_SCROLL_DISTANCE / 2],
          [1, 0],
          Extrapolate.CLAMP
        )
      : 0;
    const translateY = isActive
      ? interpolate(
          scrollY.value,
          [0, HEADER_SCROLL_DISTANCE],
          [0, -50],
          Extrapolate.CLAMP
        )
      : -50;
    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  const miniPlayerAnimatedStyle = useAnimatedStyle(() => {
    const showMiniPlayerHeader =
      selectedView === "main" &&
      !expandedHomepageSection &&
      scrollY.value >= HEADER_SCROLL_DISTANCE - 30;
    const showInDetailView =
      selectedView !== "main" ||
      (selectedView === "main" && expandedHomepageSection);
    const shouldShow = showMiniPlayerHeader || showInDetailView;
    return {
      opacity: withTiming(shouldShow ? 1 : 0, { duration: 150 }),
      transform: [
        { translateY: withTiming(shouldShow ? 0 : -50, { duration: 150 }) },
      ],
    };
  });

  const rippleStyle = useAnimatedStyle(() => {
    const scale = rippleProgress.value * 10;
    const opacity = 1 - rippleProgress.value;
    return {
      position: "absolute",
      left: rippleX.value,
      top: rippleY.value,
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: "rgba(255, 255, 255, 0.4)",
      transform: [{ translateX: -50 }, { translateY: -50 }, { scale }],
      opacity,
    } as import("react-native").ViewStyle;
  });

  const waveStyle = useAnimatedStyle(() => {
    const opacity = Easing.inOut(Easing.quad)(1 - waveProgress.value);
    const translateX = waveOriginX.value * (1 - waveProgress.value);
    if (waveProgress.value === 1) {
      waveProgress.value = 0;
    }
    return {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      opacity: waveProgress.value === 0 ? 0 : opacity,
      transform: [{ translateX }],
    };
  });

  const {
    playSong: playerContextPlaySong,
    setQueue: playerContextSetQueue,
    songQuality,
    setSongQuality,
  } = playerActions;
  const containerInfoFromSong = useCallback((song: ApiSong) => {
    if (song.album && (song.album.id || song.album.name)) return song.album;
    return undefined;
  }, []);

  const handlePlaySong = useCallback(
    async (song: ApiSong, sourceList?: ApiSong[]) => {
      try {
        let queueToUse = sourceList?.length
          ? sourceList
          : selectedArtist?.topSongs?.length
          ? selectedArtist.topSongs
          : recommendedSongs.length
          ? recommendedSongs
          : [song];

        queueToUse = queueToUse.map((s) =>
          s.downloadUrl
            ? s
            : processRawSong(s, containerInfoFromSong(s) || s.album)
        );

        let startIndex = queueToUse.findIndex((s) => s.id === song.id);

        if (startIndex === -1) {
          queueToUse = [
            processRawSong(song, containerInfoFromSong(song) || song.album),
            ...queueToUse,
          ];
          startIndex = 0;
        }

        // Determine sourceListType
        let sourceListType = "unknown";
        if (selectedView === "album") sourceListType = "album";
        else if (selectedView === "playlist") sourceListType = "playlist";
        else if (selectedView === "artist") sourceListType = "artist";
        else if (expandedHomepageSection?.type === "trending")
          sourceListType = "trending";
        else sourceListType = "recommended";

        let songToPlay = { ...queueToUse[startIndex] };

        // For recommended songs only, fetch song details by ID
        if (sourceListType === "recommended") {
          try {
            console.log(
              "DEBUG: Fetching song details for recommended song:",
              songToPlay.id
            );
            const res = await fetch(
              `https://suman-api.vercel.app/songs?id=${songToPlay.id}`
            );
            if (res.ok) {
              const apiData = await res.json();
              if (apiData.status === "SUCCESS" && apiData.data) {
                const fetched = Array.isArray(apiData.data)
                  ? apiData.data[0]
                  : apiData.data;
                console.log(
                  "DEBUG: API Response:",
                  JSON.stringify(apiData, null, 2)
                );
                console.log(
                  "DEBUG: fetched.downloadUrl type:",
                  typeof fetched.downloadUrl
                );
                console.log(
                  "DEBUG: fetched.downloadUrl isArray:",
                  Array.isArray(fetched.downloadUrl)
                );
                console.log(
                  "DEBUG: fetched.downloadUrl value:",
                  fetched.downloadUrl
                );

                // Prefer 320kbps downloadUrl
                let bestUrl = "";
                if (Array.isArray(fetched.downloadUrl)) {
                  console.log(
                    "DEBUG: Processing downloadUrl array with length:",
                    fetched.downloadUrl.length
                  );
                  const bestObj =
                    fetched.downloadUrl.find(
                      (urlObj: any) => urlObj.quality === "320kbps"
                    ) || fetched.downloadUrl[0];
                  console.log("DEBUG: Best download URL object:", bestObj);
                  console.log("DEBUG: bestObj.quality:", bestObj?.quality);
                  console.log("DEBUG: bestObj.link:", bestObj?.link);

                  if (bestObj && bestObj.link) {
                    bestUrl = bestObj.link;
                    console.log("DEBUG: Setting bestUrl to:", bestUrl);
                  } else {
                    console.log("DEBUG: bestObj or bestObj.link is falsy");
                  }
                } else if (typeof fetched.downloadUrl === "string") {
                  bestUrl = fetched.downloadUrl;
                  console.log("DEBUG: Setting bestUrl from string:", bestUrl);
                } else {
                  console.log(
                    "DEBUG: fetched.downloadUrl is neither array nor string"
                  );
                }

                if (bestUrl) {
                  songToPlay.downloadUrl = bestUrl;
                  console.log(
                    "DEBUG: Updated songToPlay.downloadUrl to:",
                    songToPlay.downloadUrl
                  );
                } else {
                  console.log(
                    "DEBUG: No bestUrl found, keeping original downloadUrl:",
                    songToPlay.downloadUrl
                  );
                }
              }
            }
          } catch (e) {
            console.error(
              "Failed to fetch song details for recommended song:",
              e
            );
          }
        }

        playerContextSetQueue(queueToUse, startIndex);
        await playerContextPlaySong(songToPlay);

        if (showFloatingNotifications) {
          // ENSURE THIS CONDITION WRAPS THE ENTIRE NOTIFICATION LOGIC
          setFloatingNotifSongDetails({
            image: getImageUrl(songToPlay.image, "150x150"),
            title: sanitizeSongTitle(songToPlay.name || songToPlay.title),
            artist: getArtistNameFromPrimary(songToPlay.primaryArtists),
          });
          setShowFloatingNotif(true);
        }

        if (isSearchOverlayVisible) setIsSearchOverlayVisible(false);
      } catch (err) {
        console.error("PlaySong Error:", err, "Song:", song);
        alert(`Play failed: ${(err as Error).message}`);
      }
    },
    [
      selectedArtist?.topSongs,
      recommendedSongs,
      playerContextSetQueue,
      playerContextPlaySong,
      processRawSong,
      isSearchOverlayVisible,
      containerInfoFromSong,
      selectedView,
      expandedHomepageSection,
      showFloatingNotifications,
    ]
  );

  // Show current song, or last played song, or first recommended song
  const activeSongForHeader = currentSong || 
    (playerActions.lastPlayedSong && !currentSong ? playerActions.lastPlayedSong : null) ||
    (recommendedSongs.length > 0 ? recommendedSongs[0] : null);
  
  const activeSongTitle = sanitizeSongTitle(
    activeSongForHeader?.name || activeSongForHeader?.title || "Music Player"
  );
  const activeSongArtistDisplay = activeSongForHeader
    ? getArtistNameFromPrimary(activeSongForHeader.primaryArtists) ||
      activeSongForHeader.subtitle ||
      "Select a song"
    : "Select a song";
  const activeSongArtwork = activeSongForHeader
    ? getImageUrl(activeSongForHeader.image, "500x500")
    : "https://via.placeholder.com/400/121212/FFFFFF/?text=S";

  const handlePlaylistPress = useCallback(
    async (playlist: Playlist) => {
      setIsLoading(true);
      setError(null);
      setExpandedHomepageSection(null);
      // If playlist is user-created (local), show directly
      if (playlist.id && playlist.id.startsWith("user-playlist-")) {
        setSelectedPlaylist(playlist);
        setSelectedView("playlist");
        flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
        setIsLoading(false);
        return;
      }
      // Otherwise, fetch from API
      try {
        const response = await fetch(
          `https://suman-api.vercel.app/playlists?id=${playlist.id}`
        );
        if (!response.ok)
          throw new Error(`Playlist fetch error: ${response.status}`);
        const data = await response.json();
        if (data.status === "SUCCESS" && data.data) {
          const fetchedPlaylist = data.data as Playlist;
          const processedSongs = (fetchedPlaylist.songs || []).map((s: any) =>
            processRawSong(s, fetchedPlaylist)
          );
          setSelectedPlaylist({ ...fetchedPlaylist, songs: processedSongs });
          setSelectedView("playlist");
          flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
        } else throw new Error(data.message || "Failed to load playlist.");
      } catch (err) {
        console.error("Error loading playlist:", err);
        setError((err as Error).message);
        setSelectedPlaylist(null);
      } finally {
        setIsLoading(false);
      }
    },
    [processRawSong]
  );

  const handleAlbumPress = useCallback(
    async (album: Album) => {
      setIsLoading(true);
      setError(null);
      setExpandedHomepageSection(null);
      try {
        const response = await fetch(
          `https://suman-api.vercel.app/albums?id=${album.id}`
        );
        if (!response.ok)
          throw new Error(`Album fetch error: ${response.status}`);
        const data = await response.json();

        if (data.status === "SUCCESS" && data.data) {
          const fetchedAlbum = data.data as Album;
          const processedSongs = (fetchedAlbum.songs || []).map((s: any) =>
            processRawSong(s, fetchedAlbum)
          );

          setSelectedAlbum({ ...fetchedAlbum, songs: processedSongs });
          setSelectedView("album");
          flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
        } else throw new Error(data.message || "Failed to load album.");
      } catch (err) {
        console.error("Error loading album:", err);
        setError((err as Error).message);
        setSelectedAlbum(null);
      } finally {
        setIsLoading(false);
      }
    },
    [processRawSong]
  );

  const handleArtistPress = useCallback(
    async (artistInput: ApiArtist | string) => {
      setIsLoading(true);
      setError(null);
      setExpandedHomepageSection(null);

      try {
        const artistName =
          typeof artistInput === "string" ? artistInput : artistInput.name;
        const artistId =
          typeof artistInput !== "string" ? artistInput.id : undefined;

        // Step 1: Fetch the main artist details (for bio/image) and more songs/albums at the same time
        const [artistDetailsRes, songSearchRes, albumSearchRes] =
          await Promise.all([
            artistId
              ? fetch(`https://suman-api.vercel.app/artists?id=${artistId}`)
              : Promise.resolve(null),
            fetch(
              `https://suman-api.vercel.app/search/songs?query=${encodeURIComponent(
                artistName
              )}&limit=50`
            ),
            fetch(
              `https://suman-api.vercel.app/search/albums?query=${encodeURIComponent(
                artistName
              )}&limit=20`
            ),
          ]);

        // Step 2: Process all the fetched data
        let artistPayload: ApiArtistDetail | null = null;
        if (artistDetailsRes && artistDetailsRes.ok) {
          const apiData = await artistDetailsRes.json();
          if (apiData.status === "SUCCESS") {
            artistPayload = apiData.data;
          }
        }

        const songSearchData = await songSearchRes.json();
        const albumSearchData = await albumSearchRes.json();

        // Step 3: Combine the results and remove duplicates
        const allSongs = new Map<string, ApiSong>();

        // Add songs from the main artist endpoint first
        (artistPayload?.topSongs || []).forEach((song) =>
          allSongs.set(song.id, processRawSong(song, artistPayload))
        );

        // Add songs from the search results
        (songSearchData.data?.results || []).forEach((song: any) => {
          const processed = processRawSong(song);
          if (!allSongs.has(processed.id)) {
            allSongs.set(processed.id, processed);
          }
        });

        const allAlbums = new Map<string, Album>();
        // Add albums from the main artist endpoint
        (artistPayload?.albums || []).forEach((album) =>
          allAlbums.set(album.id, album)
        );
        // Add albums from the search results
        (albumSearchData.data?.results || []).forEach((album: Album) => {
          if (!allAlbums.has(album.id)) {
            allAlbums.set(album.id, album);
          }
        });

        // Step 4: Set the final state for the artist view
        const artistToSet: ApiArtistDetail = {
          id: artistPayload?.id || artistId || artistName,
          name: artistName,
          url: artistPayload?.url || "",
          image:
            artistPayload?.image ||
            (typeof artistInput !== "string" ? artistInput.image : ""),
          bio: artistPayload?.bio,
          dominantColor: artistPayload?.dominantColor,
          topSongs: Array.from(allSongs.values()),
          albums: Array.from(allAlbums.values()),
        };

        setSelectedArtist(artistToSet);
        setSelectedView("artist");
      } catch (err) {
        console.error("Error in handleArtistPress:", err);
        setError((err as Error).message);
        setSelectedArtist(null);
      } finally {
        setIsLoading(false);
      }
    },
    [processRawSong]
  );

  const handleBack = useCallback(() => {
    const prevView = selectedView;
    setSelectedView("main");
    setSelectedPlaylist(null);
    setSelectedAlbum(null);
    setSelectedArtist(null);
    setExpandedHomepageSection(null);
    if (prevView !== "main" && flatListRef.current) {
      flatListRef.current.scrollToOffset({ offset: 0, animated: false });
    }
    scrollY.value = 0;
    setError(null);
  }, [selectedView, scrollY]);

  const toggleSearchOverlay = useCallback(() => {
    setIsSearchOverlayVisible((prev) => {
      if (prev) {
        // Clear voice search query when closing
        setVoiceSearchQuery("");
      }
      return !prev;
    });
  }, []);

  const ViewSpecificHeader = () => {
    let title = "Suman Music";
    if (selectedView === "main" && expandedHomepageSection) {
      title =
        expandedHomepageSection.type === "playlists"
          ? "All Playlists"
          : expandedHomepageSection.type === "albums"
          ? "All Albums"
          : expandedHomepageSection.type === "charts"
          ? "All Top Charts"
          : expandedHomepageSection.type === "trending"
          ? "All Trending Songs"
          : "Explore";
    } else if (selectedView === "playlist" && selectedPlaylist)
      title = selectedPlaylist?.name || selectedPlaylist?.title || "Playlist";
    else if (selectedView === "album" && selectedAlbum)
      title = selectedAlbum?.name || selectedAlbum?.title || "Album";
    else if (selectedView === "artist" && selectedArtist)
      title = selectedArtist?.name || "Artist";

    const showBackButton = selectedView !== "main" || expandedHomepageSection;

    const handleViewModeToggle = (newMode: "list" | "grid") => {
      if (expandedHomepageSection) {
        setExpandedHomepageSection((prev) => ({ ...prev!, viewMode: newMode }));
        saveDefaultExpandedViewMode(newMode);
      }
    };

    return (
      <View style={styles.viewHeader}>
        {showBackButton ? (
          <TouchableOpacity
            onPress={
              expandedHomepageSection && selectedView === "main"
                ? () => {
                    setExpandedHomepageSection(null);
                    scrollY.value = 0;
                    if (flatListRef.current)
                      flatListRef.current.scrollToOffset({
                        offset: 0,
                        animated: false,
                      });
                  }
                : handleBack
            }
            style={styles.backButton}
          >
            <FontAwesome name="arrow-left" size={22} color={colors.text} />
          </TouchableOpacity>
        ) : (
          <View
            style={{
              width: (styles.backButton.paddingHorizontal || 0) * 2 + 22,
            }}
          />
        )}

        <Text style={styles.viewTitle} numberOfLines={1}>
          {title}
        </Text>

        {selectedView === "main" &&
        expandedHomepageSection &&
        expandedHomepageSection.type !== "trending" ? (
          <View style={styles.expandedControlsContainer}>
            <TouchableOpacity
              onPress={() => handleViewModeToggle("list")}
              style={styles.controlIconWrapper}
            >
              <FontAwesome
                name="list"
                size={20}
                color={
                  expandedHomepageSection?.viewMode === "list"
                    ? colors.primary
                    : colors.text
                }
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.controlIconWrapper, { marginLeft: 10 }]}
              onPress={() => handleViewModeToggle("grid")}
            >
              <FontAwesome
                name="th-large"
                size={20}
                color={
                  expandedHomepageSection?.viewMode === "grid"
                    ? colors.primary
                    : colors.text
                }
              />
            </TouchableOpacity>
          </View>
        ) : selectedView === "main" && !expandedHomepageSection ? (
          <TouchableOpacity
            onPress={toggleSearchOverlay}
            style={styles.headerSearchIcon}
          >
            <FontAwesome name="search" size={20} color={colors.text} />
          </TouchableOpacity>
        ) : selectedView !== "main" ? (
          <TouchableOpacity
            onPress={toggleSearchOverlay}
            style={styles.headerSearchIcon}
          >
            <FontAwesome name="search" size={20} color={colors.text} />
          </TouchableOpacity>
        ) : (
          <View
            style={{
              width: (styles.headerSearchIcon.paddingHorizontal || 0) * 2 + 20,
            }}
          />
        )}
      </View>
    );
  };

  // Our new smart component that handles expansion for each item
  const ArtistBio: React.FC<{ bio: any; styles: any; colors: any }> = ({
    bio,
    styles,
    colors,
  }) => {
    // State to track the indices of expanded items
    const [expandedItems, setExpandedItems] = useState<number[]>([]);

    const toggleItemExpansion = (index: number) => {
      setExpandedItems(
        (prev) =>
          prev.includes(index)
            ? prev.filter((i) => i !== index) // If already expanded, remove from array to collapse
            : [...prev, index] // If collapsed, add to array to expand
      );
    };

    // --- RENDER LOGIC ---

    // Case 1: bio is an array of objects (a list of points)
    if (Array.isArray(bio)) {
      return (
        <View>
          {bio.map((item, index) => {
            const isExpanded = expandedItems.includes(index);
            const isTruncated = item.text.length > 200; // Check if this specific paragraph is long

            return (
              <View key={index} style={styles.bioListItem}>
                {item.title && (
                  <View style={styles.bioListTitleContainer}>
                    <FontAwesome
                      name="check-circle"
                      size={18}
                      color={colors.primary}
                      style={styles.bioListIcon}
                    />
                    <Text style={styles.bioListTitle}>{item.title}</Text>
                  </View>
                )}
                <Text
                  style={styles.bioListText}
                  numberOfLines={isExpanded ? undefined : 3}
                >
                  {item.text}
                </Text>
                {isTruncated && (
                  <TouchableOpacity
                    onPress={() => toggleItemExpansion(index)}
                    style={styles.showMoreButton}
                  >
                    <Text style={styles.showMoreButtonText}>
                      {isExpanded ? "Show Less" : "Show More"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      );
    }

    // Case 2: bio is a single string (This can also be collapsed)
    if (typeof bio === "string") {
      const isExpanded = expandedItems.includes(0);
      const isTruncated = bio.length > 250;

      return (
        <View style={{ paddingHorizontal: 15 }}>
          <Text
            style={styles.bioText}
            numberOfLines={isExpanded ? undefined : 5}
          >
            {bio.replace(/<br>/g, "\n\n")}
          </Text>
          {isTruncated && (
            <TouchableOpacity
              onPress={() => toggleItemExpansion(0)}
              style={[styles.showMoreButton, { paddingHorizontal: 0 }]}
            >
              <Text style={styles.showMoreButtonText}>
                {isExpanded ? "Show Less" : "Show More"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    // Fallback for single object or unknown format
    if (typeof bio === "object" && bio !== null) {
      return <Text style={styles.bioText}>{bio.text}</Text>;
    }

    return null;
  };

  // --- DEBUG: ListContentHeader render ---
  const ListContentHeader = ({ favorites }) => {
    // --- Expanded Section FlatList hooks: always defined, never conditional ---
    const expandedType = expandedHomepageSection?.type;
    const expandedViewMode = expandedHomepageSection?.viewMode;
    const expandedDataToRender = useMemo(() => {
      switch (expandedType) {
        case "playlists":
          return homePageModules?.playlists || [];
        case "albums":
          return homePageModules?.albums || [];
        case "charts":
          return homePageModules?.charts || [];
        case "trending":
          return homePageModules?.trending?.songs || [];
        default:
          return [];
      }
    }, [expandedType, homePageModules]);
    const expandedNumListColumns = useMemo(
      () =>
        expandedViewMode === "grid" && expandedType !== "trending" ? 2 : 1,
      [expandedViewMode, expandedType]
    );
    const expandedRenderItemFunction = useCallback(
      ({ item }) => {
        switch (expandedType) {
          case "playlists":
            return renderPlaylistItemInternal(item, expandedViewMode, true);
          case "albums":
            return renderAlbumItemInternal(item, expandedViewMode, true);
          case "charts":
            return renderPlaylistItemInternal(
              item,
              expandedViewMode,
              true,
              true
            );
          case "trending":
            return renderTrendingSongItemInternal(item, true);
          default:
            return null;
        }
      },
      [expandedType, expandedViewMode]
    );
    const expandedContentContainerStyle = styles.expandedListContentContainer;
    // --- End expanded section hooks ---

    const LanguageSelector = () => (
      <View style={styles.languageSelectorContainer}>
        <Text style={styles.sectionTitle}>Languages</Text>
        <FlatList
          horizontal
          data={availableLanguages}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.languageChip,
                selectedLanguage === item.code && styles.languageChipSelected,
              ]}
              onPress={() => handleLanguageSelect(item.code)}
            >
              <Text
                style={[
                  styles.languageChipText,
                  selectedLanguage === item.code &&
                    styles.languageChipTextSelected,
                ]}
              >
                {item.name}
              </Text>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => `lang-${item.code}`}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.languageListContent}
        />
      </View>
    );

    const renderPlaylistItemInternal = (
      item: Playlist,
      viewMode: "list" | "grid",
      isExpanded: boolean,
      isChart: boolean = false
    ) => {
      const commonPress = () => handlePlaylistPress(item);
      const imageQuality =
        isExpanded && viewMode === "list" ? "150x150" : "500x500";
      const imageUri = getImageUrl(item.image, imageQuality);

      if (isExpanded && viewMode === "list") {
        return (
          <TouchableOpacity
            style={styles.expandedListItemContainer}
            onPress={commonPress}
          >
            <Image
              source={{ uri: imageUri }}
              style={styles.expandedListItemImage}
            />
            <View style={styles.expandedListItemTextInfo}>
              <Text style={styles.expandedListItemTitle} numberOfLines={1}>
                {item.name || item.title}
              </Text>
              {item.description && !isChart && (
                <Text style={styles.expandedListItemSubtitle} numberOfLines={1}>
                  {item.description}
                </Text>
              )}
              {(isChart || item.songCount || item.songs?.length) && (
                <Text
                  style={styles.expandedListItemSubtitle}
                  numberOfLines={1}
                >{`${item.songCount || item.songs?.length || 0} songs`}</Text>
              )}
            </View>
            <FontAwesome
              name="chevron-right"
              size={16}
              color="#555"
              style={styles.expandedListItemIcon}
            />
          </TouchableOpacity>
        );
      }
      return (
        <TouchableOpacity
          style={
            isExpanded && viewMode === "grid"
              ? styles.gridItemPlaylist
              : styles.playlistItem
          }
          onPress={commonPress}
        >
          <Image
            source={{ uri: imageUri }}
            style={
              isExpanded && viewMode === "grid"
                ? styles.gridItemImage
                : styles.playlistImage
            }
          />
          <View
            style={
              isExpanded && viewMode === "grid"
                ? styles.gridItemTextContainer
                : styles.playlistTextContainer
            }
          >
            <Text
              style={
                isExpanded && viewMode === "grid"
                  ? styles.gridItemTitle
                  : styles.playlistTitle
              }
              numberOfLines={2}
            >
              {item.name || item.title}
            </Text>
            {item.description &&
              (!isExpanded || viewMode !== "grid") &&
              !isChart && (
                <Text style={styles.playlistSubtitle} numberOfLines={1}>
                  {item.description}
                </Text>
              )}
          </View>
        </TouchableOpacity>
      );
    };

    const renderAlbumItemInternal = (
      item: Album,
      viewMode: "list" | "grid",
      isExpanded: boolean
    ) => {
      const commonPress = () => handleAlbumPress(item);
      const imageQuality =
        isExpanded && viewMode === "list" ? "150x150" : "500x500";
      const imageUri = getImageUrl(item.image, imageQuality);

      if (isExpanded && viewMode === "list") {
        return (
          <TouchableOpacity
            style={styles.expandedListItemContainer}
            onPress={commonPress}
          >
            <Image
              source={{ uri: imageUri }}
              style={styles.expandedListItemImage}
            />
            <View style={styles.expandedListItemTextInfo}>
              <Text style={styles.expandedListItemTitle} numberOfLines={1}>
                {item.name || item.title}
              </Text>
              <ClickableArtistLinks
                artistsInput={item.primaryArtists}
                onArtistPress={(artist) => {
                  if (!isExpanded) handleArtistPress(artist);
                }}
                baseTextStyle={styles.expandedListItemSubtitle}
                touchableTextStyle={styles.playlistArtistLinkStyle}
                separatorTextStyle={styles.playlistSeparator}
                maxArtistsToShow={2}
                disabled={true}
              />
            </View>
            <FontAwesome
              name="chevron-right"
              size={16}
              color="#555"
              style={styles.expandedListItemIcon}
            />
          </TouchableOpacity>
        );
      }
      return (
        <TouchableOpacity
          style={
            isExpanded && viewMode === "grid"
              ? styles.gridItemAlbum
              : styles.playlistItem
          }
          onPress={commonPress}
        >
          <Image
            source={{ uri: imageUri }}
            style={
              isExpanded && viewMode === "grid"
                ? styles.gridItemImage
                : styles.playlistImage
            }
          />
          <View
            style={
              isExpanded && viewMode === "grid"
                ? styles.gridItemTextContainer
                : styles.playlistTextContainer
            }
          >
            <Text
              style={
                isExpanded && viewMode === "grid"
                  ? styles.gridItemTitle
                  : styles.playlistTitle
              }
              numberOfLines={2}
            >
              {item.name || item.title}
            </Text>
            <ClickableArtistLinks
              artistsInput={item.primaryArtists}
              onArtistPress={handleArtistPress}
              baseTextStyle={
                isExpanded && viewMode === "grid"
                  ? styles.gridItemSubtitle
                  : styles.playlistSubtitle
              }
              touchableTextStyle={styles.playlistArtistLinkStyle}
              separatorTextStyle={styles.playlistSeparator}
              maxArtistsToShow={isExpanded && viewMode === "grid" ? 1 : 2}
              disabled={true}
            />
          </View>
        </TouchableOpacity>
      );
    };

    const renderTrendingSongItemInternal = (
      song: ApiSong,
      isExpandedList: boolean
    ) => {
      if (isExpandedList) {
        return renderSongItem({
          item: song,
          index: 0,
          separators: {
            highlight: () => {},
            unhighlight: () => {},
            updateProps: () => {},
          },
        });
      }
      return (
        <TouchableOpacity
          style={styles.songItemHorizontal}
          onPress={() => handlePlaySong(song, homePageModules.trending.songs)}
        >
          <Image
            source={{ uri: getImageUrl(song.image, "500x500") }}
            style={styles.songArtworkHorizontal}
          />
          <Text style={styles.songItemTitleHorizontal} numberOfLines={1}>
            {sanitizeSongTitle(song.name || song.title)}
          </Text>
          <ClickableArtistLinks
            artistsInput={song.primaryArtists || song.subtitle}
            onArtistPress={handleArtistPress}
            baseTextStyle={styles.songItemArtistHorizontalBase}
            touchableTextStyle={styles.songItemArtistHorizontalLink}
            separatorTextStyle={styles.songItemArtistHorizontalSeparatorText}
            maxArtistsToShow={1}
            disabled={true}
          />
        </TouchableOpacity>
      );
    };

    const renderFavoriteSongItem = (item: ApiSong) => (
      <TouchableOpacity
        style={styles.songItemHorizontal}
        onPress={() => handlePlaySong(item, favorites)}
      >
        <Image
          source={{ uri: getImageUrl(item.image, "500x500") }}
          style={styles.songArtworkHorizontal}
        />
        <Text style={styles.songItemTitleHorizontal} numberOfLines={1}>
          {sanitizeSongTitle(item.name || item.title)}
        </Text>
        <ClickableArtistLinks
          artistsInput={item.primaryArtists || item.subtitle}
          onArtistPress={handleArtistPress}
          baseTextStyle={styles.songItemArtistHorizontalBase}
          touchableTextStyle={styles.songItemArtistHorizontalLink}
          separatorTextStyle={styles.songItemArtistHorizontalSeparatorText}
          maxArtistsToShow={1}
          disabled={true}
        />
      </TouchableOpacity>
    );

    if (selectedView === "main") {
      if (expandedHomepageSection) {
        if (!expandedDataToRender.length && !isLoading) {
          return (
            <Text style={styles.emptyText}>
              No items to display in this section.
            </Text>
          );
        }
        if (isLoading && !expandedDataToRender.length) {
          return (
            <ActivityIndicator
              size="small"
              color="#ff6600"
              style={{ marginTop: 20 }}
            />
          );
        }
        return (
          <>
            <FlatList
              data={expandedDataToRender}
              renderItem={expandedRenderItemFunction}
              keyExtractor={(item, index) =>
                `${expandedType}-${expandedViewMode}-${
                  item.id || item.name || index
                }`
              }
              numColumns={expandedNumListColumns}
              contentContainerStyle={expandedContentContainerStyle}
              ListFooterComponent={<View style={{ height: 20 }} />}
            />
            <Text
              style={[styles.sectionTitle, { marginTop: 20, paddingBottom: 5 }]}
            >
              Recommended Songs
            </Text>
          </>
        );
      }

      const HORIZONTAL_ITEM_LIMIT = 10;
      const VIEW_ALL_THRESHOLD = Platform.OS === "web" ? 7 : 5;

      return (
        <>
          <GestureDetector gesture={mainContentGesture}>
            <View>
              <LanguageSelector />
              {homePageModules?.playlists?.length > 0 && (
                <View style={styles.sectionContainer}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitle}>Popular Playlists</Text>
                    {homePageModules.playlists.length > VIEW_ALL_THRESHOLD && (
                      <TouchableOpacity
                        onPress={() => {
                          setExpandedHomepageSection({
                            type: "playlists",
                            viewMode: defaultExpandedViewMode,
                          });
                          scrollY.value = 0;
                          if (flatListRef.current)
                            flatListRef.current.scrollToOffset({
                              offset: 0,
                              animated: false,
                            });
                        }}
                      >
                        <Text style={styles.viewAllButtonText}>View All</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <FlatList
                    horizontal
                    data={homePageModules.playlists.slice(
                      0,
                      HORIZONTAL_ITEM_LIMIT
                    )}
                    renderItem={({ item }) =>
                      renderPlaylistItemInternal(item, "list", false)
                    }
                    keyExtractor={(item) =>
                      `playlist-main-${item.id || item.title}`
                    }
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 10 }}
                  />
                </View>
              )}

              {homePageModules?.albums?.length > 0 && (
                <View style={styles.sectionContainer}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitle}>Featured Albums</Text>
                    {homePageModules.albums.length > VIEW_ALL_THRESHOLD && (
                      <TouchableOpacity
                        onPress={() => {
                          setExpandedHomepageSection({
                            type: "albums",
                            viewMode: defaultExpandedViewMode,
                          });
                          scrollY.value = 0;
                          if (flatListRef.current)
                            flatListRef.current.scrollToOffset({
                              offset: 0,
                              animated: false,
                            });
                        }}
                      >
                        <Text style={styles.viewAllButtonText}>View All</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <FlatList
                    horizontal
                    data={homePageModules.albums.slice(
                      0,
                      HORIZONTAL_ITEM_LIMIT
                    )}
                    renderItem={({ item }) =>
                      renderAlbumItemInternal(item, "list", false)
                    }
                    keyExtractor={(item) =>
                      `album-main-${item.id || item.title}`
                    }
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 10 }}
                  />
                </View>
              )}

              {homePageModules?.charts?.length > 0 && (
                <View style={styles.sectionContainer}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitle}>Top Charts</Text>
                    {homePageModules.charts.length > VIEW_ALL_THRESHOLD && (
                      <TouchableOpacity
                        onPress={() => {
                          setExpandedHomepageSection({
                            type: "charts",
                            viewMode: defaultExpandedViewMode,
                          });
                          scrollY.value = 0;
                          if (flatListRef.current)
                            flatListRef.current.scrollToOffset({
                              offset: 0,
                              animated: false,
                            });
                        }}
                      >
                        <Text style={styles.viewAllButtonText}>View All</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <FlatList
                    horizontal
                    data={homePageModules.charts.slice(
                      0,
                      HORIZONTAL_ITEM_LIMIT
                    )}
                    renderItem={({ item }: ListRenderItemInfo<Playlist>) =>
                      renderPlaylistItemInternal(item, "list", false, true)
                    }
                    keyExtractor={(item) =>
                      `chart-main-${item.id || item.title}`
                    }
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 10 }}
                  />
                </View>
              )}
              {/* Favorite Songs Section (if more than 3) */}
              {favorites && favorites.length > 3 && (
                <View style={styles.sectionContainer}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitle}>Favorite Songs</Text>
                    <TouchableOpacity
                      style={{ flexDirection: "row", alignItems: "center" }}
                      onPress={() => handlePlaySong(favorites[0], favorites)}
                      disabled={favorites.length === 0}
                    >
                      <FontAwesome
                        name="play"
                        size={18}
                        color={colors.primary}
                      />
                      <Text
                        style={[styles.viewAllButtonText, { marginLeft: 6 }]}
                      >
                        Play All
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <FlatList
                    horizontal
                    data={favorites.slice(0, HORIZONTAL_ITEM_LIMIT)}
                    renderItem={({ item }) => renderFavoriteSongItem(item)}
                    keyExtractor={(item) => `favorite-main-${item.id}`}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 10 }}
                  />
                </View>
              )}
              {homePageModules?.trending?.songs?.length > 0 && (
                <View style={styles.sectionContainer}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitle}>Trending Now</Text>
                    {homePageModules.trending.songs.length >
                      VIEW_ALL_THRESHOLD && (
                      <TouchableOpacity
                        onPress={() => {
                          setExpandedHomepageSection({
                            type: "trending",
                            viewMode: "list",
                          });
                          scrollY.value = 0;
                          if (flatListRef.current)
                            flatListRef.current.scrollToOffset({
                              offset: 0,
                              animated: false,
                            });
                        }}
                      >
                        <Text style={styles.viewAllButtonText}>View All</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <FlatList
                    horizontal
                    data={homePageModules.trending.songs.slice(
                      0,
                      HORIZONTAL_ITEM_LIMIT
                    )}
                    renderItem={({ item }: ListRenderItemInfo<ApiSong>) =>
                      renderTrendingSongItemInternal(item, false)
                    }
                    keyExtractor={(item) =>
                      `trending-main-${item.id || item.name}`
                    }
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 10 }}
                  />
                </View>
              )}
            </View>
          </GestureDetector>
          <Text
            style={[styles.sectionTitle, { marginTop: 10, paddingBottom: 5 }]}
          >
            Recommended Songs
          </Text>
        </>
      );
    }

    if (selectedView === "playlist" && selectedPlaylist) {
      const totalDuration = calculateTotalDuration(
        selectedPlaylist?.songs || []
      );
      return (
        <View
          style={[
            styles.albumDetailContainer,
            {
              backgroundColor:
                selectedPlaylist?.dominantColor || "rgb(83,83,83)",
            },
          ]}
        >
          <View style={styles.albumHeaderContent}>
            <Image
              source={{ uri: getImageUrl(selectedPlaylist?.image, "500x500") }}
              style={styles.albumDetailImage}
            />
            <View style={styles.albumDetailInfo}>
              <Text style={styles.albumType}>Playlist</Text>
              <Text style={styles.albumDetailTitle} numberOfLines={3}>
                {selectedPlaylist?.name}
              </Text>
              {selectedPlaylist?.description && (
                <Text style={styles.playlistDescriptionText} numberOfLines={2}>
                  {selectedPlaylist.description}
                </Text>
              )}
              <Text style={styles.albumArtistText}>Powered by Suman</Text>
              <View style={styles.albumStats}>
                <Text style={styles.albumStatText}>
                  {selectedPlaylist?.followerCount || "0"} followers •{" "}
                  {selectedPlaylist?.songCount ||
                    selectedPlaylist?.songs?.length ||
                    "0"}{" "}
                  songs • {secondsToMinuteSecond(totalDuration)}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.controlsContainer}>
            <TouchableOpacity
              style={styles.playButton}
              onPress={() =>
                selectedPlaylist?.songs?.[0] &&
                handlePlaySong(
                  selectedPlaylist.songs[0],
                  selectedPlaylist.songs
                )
              }
              disabled={
                !selectedPlaylist?.songs || selectedPlaylist.songs.length === 0
              }
            >
              <FontAwesome name="play" size={28} color="#000" />
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    if (selectedView === "album" && selectedAlbum) {
      const totalDuration = calculateTotalDuration(selectedAlbum?.songs || []);
      return (
        <View
          style={[
            styles.albumDetailContainer,
            {
              backgroundColor: selectedAlbum?.dominantColor || "rgb(83,83,83)",
            },
          ]}
        >
          <View style={styles.albumHeaderContent}>
            <Image
              source={{ uri: getImageUrl(selectedAlbum.image, "500x500") }}
              style={styles.albumDetailImage}
            />
            <View style={styles.albumDetailInfo}>
              <Text style={styles.albumType}>
                {selectedAlbum.type || "Album"}
              </Text>
              <Text style={styles.albumDetailTitle} numberOfLines={2}>
                {selectedAlbum.name}
              </Text>
              <ClickableArtistLinks
                artistsInput={selectedAlbum.primaryArtists}
                onArtistPress={handleArtistPress}
                baseTextStyle={styles.albumArtistText}
                touchableTextStyle={styles.albumArtistLinkStyle}
                separatorTextStyle={styles.albumArtistSeparatorStyle}
                maxArtistsToShow={2}
                disabled={true}
              />
              <View style={styles.albumStats}>
                <Text style={styles.albumStatText}>
                  {selectedAlbum.year} • {selectedAlbum?.songs?.length || "0"}{" "}
                  songs • {secondsToMinuteSecond(totalDuration)}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.controlsContainer}>
            <TouchableOpacity
              style={styles.playButton}
              onPress={() =>
                selectedAlbum?.songs?.[0] &&
                handlePlaySong(selectedAlbum.songs[0], selectedAlbum.songs)
              }
              disabled={
                !selectedAlbum?.songs || selectedAlbum.songs.length === 0
              }
            >
              <FontAwesome name="play" size={28} color="#000" />
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    // In the `ListContentHeader` component...
    if (selectedView === "artist" && selectedArtist) {
      // The top songs will be rendered by the FlatList itself.
      // This component will now render the artist info, albums, and playlists as the header.
      const topFiveSongs = selectedArtist.topSongs?.slice(0, 5) || [];

      return (
        <>
          {/* This View is a placeholder to push the content down below the banner */}
          <View style={{ height: HEADER_MAX_HEIGHT - 35 }} />

          {/* --- POPULAR SONGS SECTION --- */}
          <View style={styles.artistSectionContainer}>
            <Text style={styles.artistSectionTitle}>Popular</Text>
            {topFiveSongs.map((song, index) => (
              <TouchableOpacity
                key={song.id}
                style={styles.popularSongItem}
                onPress={() => handlePlaySong(song, selectedArtist.topSongs)}
              >
                <Text style={styles.popularSongIndex}>{index + 1}</Text>
                <Image
                  source={{ uri: getImageUrl(song.image, "150x150") }}
                  style={styles.popularSongArtwork}
                />
                <View style={styles.popularSongInfo}>
                  <Text style={styles.popularSongTitle} numberOfLines={1}>
                    {sanitizeSongTitle(song.name || song.title)}
                  </Text>
                  {song.playCount > 0 && (
                    <Text style={styles.popularSongPlayCount}>
                      {formatPlayCount(song.playCount)} plays
                    </Text>
                  )}
                </View>
                <TouchableOpacity style={{ padding: 10 }}>
                  <FontAwesome
                    name="ellipsis-h"
                    size={18}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>

          {/* --- DISCOGRAPHY (ALBUMS) SECTION --- */}
          {selectedArtist.albums && selectedArtist.albums.length > 0 && (
            <View style={styles.artistSectionContainer}>
              <Text style={styles.artistSectionTitle}>Discography</Text>
              <View style={styles.albumGridContainer}>
                {selectedArtist.albums.slice(0, 4).map((album) => (
                  <TouchableOpacity
                    key={album.id}
                    style={styles.albumGridItem}
                    onPress={() => handleAlbumPress(album)}
                  >
                    <Image
                      source={{ uri: getImageUrl(album.image, "500x500") }}
                      style={styles.albumGridImage}
                    />
                    <Text style={styles.albumGridTitle} numberOfLines={2}>
                      {album.name}
                    </Text>
                    <Text style={styles.albumGridSubtitle}>{album.year}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* --- FEATURING (PLAYLISTS) SECTION --- */}
          {selectedArtist.playlists && selectedArtist.playlists.length > 0 && (
            <View style={styles.artistSectionContainer}>
              <Text style={styles.artistSectionTitle}>
                Featuring {selectedArtist.name}
              </Text>
              <FlatList
                horizontal
                data={selectedArtist.playlists}
                renderItem={({ item }) =>
                  renderPlaylistItemInternal(item, "list", false)
                }
                keyExtractor={(item) => `artist-playlist-${item.id}`}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 15 }}
              />
            </View>
          )}

          {/* --- ABOUT SECTION --- */}

          {selectedArtist.bio && (
            <View style={styles.artistSectionContainer}>
              <Text style={styles.artistSectionTitle}>About</Text>
              {/* The call is now simpler, with no extra props needed */}
              <ArtistBio
                bio={selectedArtist.bio}
                styles={styles}
                colors={colors}
              />
            </View>
          )}
        </>
      );
    }
    return null;
  };

  // --- DEBUG: renderSongItem render ---
  const renderSongItem = useCallback(
    ({ item }: ListRenderItemInfo<ApiSong>): React.ReactElement => {
      const isFavorite = favorites.some((s) => s.id === item.id);

      return (
        <TouchableOpacity
          style={styles.songItem}
          activeOpacity={0.7}
          onPress={() => {
            console.log("DEBUG: renderSongItem onPress triggered", {
              songName: item.name || item.title,
              songId: item.id,
            });

            let sourceList: ApiSong[] | undefined;
            if (selectedView === "album" && selectedAlbum?.songs)
              sourceList = selectedAlbum.songs;
            else if (selectedView === "playlist" && selectedPlaylist?.songs)
              sourceList = selectedPlaylist.songs;
            else if (selectedView === "artist" && selectedArtist?.topSongs)
              sourceList = selectedArtist.topSongs;
            else if (
              expandedHomepageSection?.type === "trending" &&
              homePageModules?.trending?.songs
            )
              sourceList = homePageModules.trending.songs;
            else sourceList = recommendedSongs;

            console.log("DEBUG: renderSongItem onPress", {
              songName: item.name || item.title,
              songId: item.id,
              sourceListLength: sourceList?.length,
              sourceListType:
                selectedView === "album"
                  ? "album"
                  : selectedView === "playlist"
                  ? "playlist"
                  : selectedView === "artist"
                  ? "artist"
                  : expandedHomepageSection?.type === "trending"
                  ? "trending"
                  : "recommended",
            });

            handlePlaySong(item, sourceList);
          }}
          onPressIn={() =>
            console.log("DEBUG: Touch started on song:", item.name)
          }
          onPressOut={() =>
            console.log("DEBUG: Touch ended on song:", item.name)
          }
        >
          <Image
            source={{ uri: getImageUrl(item.image, "150x150") }}
            style={styles.songArtwork}
            resizeMode="cover"
          />
          <View style={styles.songItemInfo}>
            <Text style={styles.songItemTitle} numberOfLines={1}>
              {sanitizeSongTitle(item.name || item.title)}
            </Text>
            <View pointerEvents="none">
              <ClickableArtistLinks
                artistsInput={item.primaryArtists || item.subtitle}
                onArtistPress={handleArtistPress}
                baseTextStyle={styles.songItemArtistBase}
                touchableTextStyle={styles.songItemArtistLink}
                separatorTextStyle={styles.songItemArtistSeparatorText}
                maxArtistsToShow={3}
                disabled={true}
              />
            </View>
          </View>
          <TouchableOpacity
            onPress={() => openAddToPlaylistModal(item)}
            style={{ padding: 10 }}
          >
            <FontAwesome name="plus-circle" size={22} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => toggleFavorite(item)}
            style={{ padding: 5 }}
            activeOpacity={0.7}
          >
            <FontAwesome
              name={isFavorite ? "heart" : "heart-o"}
              size={20}
              color={isFavorite ? colors.primary : colors.textSecondary}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      );
    },
    [
      favorites,
      selectedView,
      selectedAlbum,
      selectedPlaylist,
      selectedArtist,
      expandedHomepageSection,
      homePageModules,
      recommendedSongs,
      handlePlaySong,
      getImageUrl,
      handleArtistPress,
      colors.primary,
      colors.textSecondary,
      openAddToPlaylistModal,
      toggleFavorite,
    ]
  );

  // Move listPaddingTop and flatListContentContainerStyle to the top, before any early returns
  let listPaddingTop = 0;
  if (selectedView === "main" && !expandedHomepageSection) {
    listPaddingTop = HEADER_MAX_HEIGHT;
  } else {
    listPaddingTop = 0;
  }

  // Memoize contentContainerStyle to prevent FlatList from resetting scroll position
  const flatListContentContainerStyle = useMemo(
    () => ({
      paddingTop: listPaddingTop,
      paddingBottom: currentSong ? 140 : 80,
    }),
    [currentSong, listPaddingTop]
  );

  let flatListData: any[] = useMemo(() => {
    if (!expandedHomepageSection) {
      if (selectedView === "album" && selectedAlbum?.songs)
        return selectedAlbum.songs;
      if (selectedView === "playlist" && selectedPlaylist?.songs)
        return selectedPlaylist.songs;
      if (selectedView === "artist" && selectedArtist?.topSongs) return [];
      if (selectedView === "main") return recommendedSongs;
    }
    return recommendedSongs;
  }, [
    selectedView,
    selectedAlbum,
    selectedPlaylist,
    selectedArtist,
    recommendedSongs,
    expandedHomepageSection,
  ]);

  if (
    (isLoading || !sWritten) &&
    recommendedSongs.length === 0 &&
    !homePageModules &&
    selectedView === "main" &&
    !expandedHomepageSection
  ) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.centered]}>
        <SLiquidLoading size={48} color="#FFA500" background="#fff" />
        <Text style={styles.loadingText}>Loading music...</Text>
      </SafeAreaView>
    );
  }
  const currentViewIsLoading =
    isLoading &&
    ((selectedView === "playlist" && !selectedPlaylist) ||
      (selectedView === "album" && !selectedAlbum) ||
      (selectedView === "artist" && !selectedArtist) ||
      (selectedView === "main" &&
        !homePageModules &&
        !expandedHomepageSection));
  const showErrorScreen =
    error &&
    ((selectedView === "main" &&
      !expandedHomepageSection &&
      !homePageModules &&
      recommendedSongs.length === 0) ||
      (selectedView === "playlist" && !selectedPlaylist) ||
      (selectedView === "album" && !selectedAlbum) ||
      (selectedView === "artist" && !selectedArtist));

  if (showErrorScreen && !currentViewIsLoading) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.centered]}>
        <Text style={styles.errorText}>
          {error || "An unknown error occurred."}
        </Text>
        <TouchableOpacity
          onPress={() => {
            setError(null);
            if (selectedView === "main" && !expandedHomepageSection)
              loadSavedData(selectedLanguage);
            else if (selectedView === "playlist" && selectedPlaylist?.id)
              handlePlaylistPress(selectedPlaylist);
            else if (selectedView === "album" && selectedAlbum?.id)
              handleAlbumPress(selectedAlbum);
            else if (selectedView === "artist" && selectedArtist)
              handleArtistPress(selectedArtist);
            else loadSavedData(selectedLanguage);
          }}
          style={styles.retryButton}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // --- DEBUG: SettingsOverlay render ---
  const SettingsOverlay = () => {
    const { audioOutput, setAudioOutput, songQuality, setSongQuality } =
      usePlayer();
    const settingsAnim = useSharedValue(0);

    useEffect(() => {
      settingsAnim.value = withTiming(isSettingsVisible ? 1 : 0, {
        duration: 350,
        easing: Easing.out(Easing.exp),
      });
    }, [isSettingsVisible, settingsAnim]);

    const overlayStyle = useAnimatedStyle(() => ({
      opacity: settingsAnim.value,
    }));

    const containerStyle = useAnimatedStyle(() => ({
      transform: [
        { translateY: interpolate(settingsAnim.value, [0, 1], [400, 0]) },
      ],
      opacity: settingsAnim.value,
    }));

    const handleSetTheme = async (newTheme: Theme) => {
      setTheme(newTheme);
      setAppearanceMode("normal");
      await AsyncStorage.setItem(STORAGE_KEYS.APP_THEME, newTheme);
      await AsyncStorage.setItem(STORAGE_KEYS.APPEARANCE_MODE, "normal");
    };

    const handleSetAppearance = async (newMode: AppearanceMode) => {
      setAppearanceMode(newMode);
      await AsyncStorage.setItem(STORAGE_KEYS.APPEARANCE_MODE, newMode);
    };

    const handleSetThemeMode = async (mode) => {
      setThemeMode(mode);
      await AsyncStorage.setItem("theme-mode", mode);
      if (mode === "manual") {
        await AsyncStorage.setItem("app-theme", theme);
      }
    };

    const handleToggleFloatingNotifications = async (newValue: boolean) => {
      setShowFloatingNotifications(newValue);
      await AsyncStorage.setItem(
        STORAGE_KEYS.SHOW_FLOATING_NOTIFICATIONS,
        JSON.stringify(newValue)
      );
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const handleToggleShakeNext = async (newValue: boolean) => {
      setIsShakeNextEnabled(newValue);
      await AsyncStorage.setItem(
        STORAGE_KEYS.SHAKE_NEXT_ENABLED,
        JSON.stringify(newValue)
      );
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const handleToggleKeepAwake = async (newValue: boolean) => {
      setIsKeepAwakeEnabled(newValue);
      await AsyncStorage.setItem(
        STORAGE_KEYS.KEEP_AWAKE_ENABLED,
        JSON.stringify(newValue)
      );
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    if (!isSettingsVisible && settingsAnim.value === 0) return null;

    return (
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.settingsBackdrop, overlayStyle]}
        pointerEvents={isSettingsVisible ? "auto" : "none"}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => setIsSettingsVisible(false)}
        />
        <Animated.View style={[styles.settingsContainer, containerStyle]}>
          <View style={styles.settingsHandlebarContainer}>
            <View style={styles.settingsHandlebar} />
          </View>
          <Text style={styles.settingsTitle}>Settings</Text>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Theme Mode</Text>
            <View style={styles.settingControl}>
              <TouchableOpacity
                style={[
                  styles.themeButton,
                  themeMode === "auto" && styles.themeButtonActive,
                ]}
                onPress={() => handleSetThemeMode("auto")}
              >
                <Text
                  style={[
                    styles.themeButtonText,
                    themeMode === "auto" && styles.themeButtonTextActive,
                  ]}
                >
                  Auto
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.themeButton,
                  themeMode === "reverse" && styles.themeButtonActive,
                ]}
                onPress={() => handleSetThemeMode("reverse")}
              >
                <Text
                  style={[
                    styles.themeButtonText,
                    themeMode === "reverse" && styles.themeButtonTextActive,
                  ]}
                >
                  Reverse
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.themeButton,
                  themeMode === "manual" && styles.themeButtonActive,
                ]}
                onPress={() => handleSetThemeMode("manual")}
              >
                <Text
                  style={[
                    styles.themeButtonText,
                    themeMode === "manual" && styles.themeButtonTextActive,
                  ]}
                >
                  Manual
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          {themeMode === "manual" && (
            <>
              <View style={styles.settingRow}>
                <FontAwesome
                  name="paint-brush"
                  size={20}
                  color={colors.textSecondary}
                  style={styles.settingIcon}
                />
                <Text style={styles.settingLabel}>Appearance</Text>
                <View style={styles.settingControl}>
                  <TouchableOpacity
                    style={[
                      styles.themeButton,
                      theme === "light" && styles.themeButtonActive,
                    ]}
                    onPress={() => handleSetTheme("light")}
                  >
                    <Text
                      style={[
                        styles.themeButtonText,
                        theme === "light" && styles.themeButtonTextActive,
                      ]}
                    >
                      Light
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.themeButton,
                      theme === "dark" && styles.themeButtonActive,
                    ]}
                    onPress={() => handleSetTheme("dark")}
                  >
                    <Text
                      style={[
                        styles.themeButtonText,
                        theme === "dark" && styles.themeButtonTextActive,
                      ]}
                    >
                      Dark
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.settingRow}>
                <FontAwesome
                  name="star"
                  size={20}
                  color={colors.textSecondary}
                  style={styles.settingIcon}
                />
                <Text style={styles.settingLabel}>Visual Mode</Text>
              </View>
              <View style={styles.visualModeContainer}>
                <View style={styles.modeRow}>
                  <TouchableOpacity
                    style={[
                      styles.modeButton,
                      appearanceMode === "normal" && styles.modeButtonActive,
                    ]}
                    onPress={() => handleSetAppearance("normal")}
                  >
                    <FontAwesome
                      name="circle"
                      size={16}
                      color={
                        appearanceMode === "normal"
                          ? "#fff"
                          : colors.textSecondary
                      }
                    />
                    <Text
                      style={[
                        styles.modeButtonText,
                        appearanceMode === "normal" &&
                          styles.modeButtonTextActive,
                      ]}
                    >
                      Normal
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.modeButton,
                      appearanceMode === "vivid" && styles.modeButtonActive,
                    ]}
                    onPress={() => handleSetAppearance("vivid")}
                  >
                    <FontAwesome
                      name="paint-brush"
                      size={16}
                      color={
                        appearanceMode === "vivid"
                          ? "#fff"
                          : colors.textSecondary
                      }
                    />
                    <Text
                      style={[
                        styles.modeButtonText,
                        appearanceMode === "vivid" &&
                          styles.modeButtonTextActive,
                      ]}
                    >
                      Vivid
                    </Text>
                  </TouchableOpacity>
                </View>
                {theme === "light" && (
                  <View style={styles.modeRow}>
                    <TouchableOpacity
                      style={[
                        styles.modeButton,
                        appearanceMode === "realistic" &&
                          styles.modeButtonActive,
                      ]}
                      onPress={() => handleSetAppearance("realistic")}
                    >
                      <FontAwesome
                        name="play-circle"
                        size={16}
                        color={
                          appearanceMode === "realistic"
                            ? "#fff"
                            : colors.textSecondary
                        }
                      />
                      <Text
                        style={[
                          styles.modeButtonText,
                          appearanceMode === "realistic" &&
                            styles.modeButtonTextActive,
                        ]}
                      >
                        Animate
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.modeButton,
                        appearanceMode === "fluid" && styles.modeButtonActive,
                      ]}
                      onPress={() => handleSetAppearance("fluid")}
                    >
                      <FontAwesome
                        name="tint"
                        size={16}
                        color={
                          appearanceMode === "fluid"
                            ? "#fff"
                            : colors.textSecondary
                        }
                      />
                      <Text
                        style={[
                          styles.modeButtonText,
                          appearanceMode === "fluid" &&
                            styles.modeButtonTextActive,
                        ]}
                      >
                        Fluid
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
                {theme === "dark" && (
                  <View style={styles.modeRow}>
                    <TouchableOpacity
                      style={[
                        styles.modeButton,
                        appearanceMode === "ambience" &&
                          styles.modeButtonActive,
                      ]}
                      onPress={() => handleSetAppearance("ambience")}
                    >
                      <FontAwesome
                        name="moon-o"
                        size={16}
                        color={
                          appearanceMode === "ambience"
                            ? "#fff"
                            : colors.textSecondary
                        }
                      />
                      <Text
                        style={[
                          styles.modeButtonText,
                          appearanceMode === "ambience" &&
                            styles.modeButtonTextActive,
                        ]}
                      >
                        Ambience
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </>
          )}
          {(themeMode === "auto" || themeMode === "reverse") && (
            <Text style={styles.settingDescription}>
              {themeMode === "auto"
                ? "Theme follows ambient light sensor: dark in dark rooms, light in bright rooms."
                : "Theme is opposite of ambient light: dark in bright rooms, light in dark rooms."}
            </Text>
          )}

          <View style={styles.settingRow}>
            <FontAwesome
              name="volume-up"
              size={20}
              color={colors.textSecondary}
              style={styles.settingIcon}
            />
            <Text style={styles.settingLabel}>Audio Output</Text>
            <View style={styles.settingControl}>
              <TouchableOpacity
                style={[
                  styles.themeButton,
                  audioOutput === "speaker" && styles.themeButtonActive,
                ]}
                onPress={() => setAudioOutput("speaker")}
              >
                <Text
                  style={[
                    styles.themeButtonText,
                    audioOutput === "speaker" && styles.themeButtonTextActive,
                  ]}
                >
                  Speaker
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.themeButton,
                  audioOutput === "earpiece" && styles.themeButtonActive,
                ]}
                onPress={() => setAudioOutput("earpiece")}
              >
                <Text
                  style={[
                    styles.themeButtonText,
                    audioOutput === "earpiece" && styles.themeButtonTextActive,
                  ]}
                >
                  Earpiece
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.settingRow}>
            <FontAwesome
              name="music"
              size={20}
              color={colors.textSecondary}
              style={styles.settingIcon}
            />
            <Text style={styles.settingLabel}>Song Quality</Text>
            <TouchableOpacity
              style={styles.qualityDropdownButton}
              onPress={() => setIsQualityDropdownOpen(!isQualityDropdownOpen)}
            >
              <Text style={styles.qualityDropdownText}>
                {songQuality === "320kbps"
                  ? "Pro HD+"
                  : songQuality === "160kbps"
                  ? "High"
                  : songQuality === "96kbps"
                  ? "Medium"
                  : "Low"}
              </Text>
              <FontAwesome
                name={isQualityDropdownOpen ? "chevron-up" : "chevron-down"}
                size={16}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {isQualityDropdownOpen && (
            <View style={styles.qualityDropdownOptions}>
              <TouchableOpacity
                style={[
                  styles.qualityOption,
                  songQuality === "320kbps" && styles.qualityOptionSelected,
                ]}
                onPress={() => {
                  setSongQuality("320kbps");
                  setIsQualityDropdownOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.qualityOptionText,
                    songQuality === "320kbps" &&
                      styles.qualityOptionTextSelected,
                  ]}
                >
                  Pro HD+ (320kbps)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.qualityOption,
                  songQuality === "160kbps" && styles.qualityOptionSelected,
                ]}
                onPress={() => {
                  setSongQuality("160kbps");
                  setIsQualityDropdownOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.qualityOptionText,
                    songQuality === "160kbps" &&
                      styles.qualityOptionTextSelected,
                  ]}
                >
                  High (160kbps)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.qualityOption,
                  songQuality === "96kbps" && styles.qualityOptionSelected,
                ]}
                onPress={() => {
                  setSongQuality("96kbps");
                  setIsQualityDropdownOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.qualityOptionText,
                    songQuality === "96kbps" &&
                      styles.qualityOptionTextSelected,
                  ]}
                >
                  Medium (96kbps)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.qualityOption,
                  songQuality === "48kbps" && styles.qualityOptionSelected,
                ]}
                onPress={() => {
                  setSongQuality("48kbps");
                  setIsQualityDropdownOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.qualityOptionText,
                    songQuality === "48kbps" &&
                      styles.qualityOptionTextSelected,
                  ]}
                >
                  Low (48kbps)
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.settingRow}>
            <FontAwesome
              name="bell" // Choose an appropriate icon
              size={20}
              color={colors.textSecondary}
              style={styles.settingIcon}
            />
            <Text style={styles.settingLabel}>
              Pop-up Notifications
              <Text
                style={{
                  fontSize: 10,
                  color: colors.primary,
                  fontWeight: "bold",
                  marginLeft: 2,
                  position: "relative",
                  top: -8,
                }}
              >
                {" "}
                β
              </Text>
            </Text>
            <Switch
              trackColor={{ false: colors.separator, true: colors.primary }}
              thumbColor={colors.card}
              ios_backgroundColor={colors.separator}
              onValueChange={handleToggleFloatingNotifications}
              value={showFloatingNotifications}
            />
          </View>

          <View style={styles.settingRow}>
            <FontAwesome
              name="moon-o"
              size={20}
              color={colors.textSecondary}
              style={styles.settingIcon}
            />
            <Text style={styles.settingLabel}>Keep Screen Awake</Text>
            <Switch
              trackColor={{ false: colors.separator, true: colors.primary }}
              thumbColor={colors.card}
              ios_backgroundColor={colors.separator}
              onValueChange={handleToggleKeepAwake}
              value={isKeepAwakeEnabled}
            />
          </View>

          <View style={styles.settingRow}>
            <FontAwesome
              name="random"
              size={20}
              color={colors.textSecondary}
              style={styles.settingIcon}
            />
            <Text style={styles.settingLabel}>
              Shake to Next Song
              <Text
                style={{
                  fontSize: 10,
                  color: colors.primary,
                  fontWeight: "bold",
                  marginLeft: 2,
                  position: "relative",
                  top: -8,
                }}
              >
                {" "}
                β
              </Text>
            </Text>
            <Switch
              trackColor={{ false: colors.separator, true: colors.primary }}
              thumbColor={colors.card}
              ios_backgroundColor={colors.separator}
              onValueChange={handleToggleShakeNext}
              value={isShakeNextEnabled}
            />
          </View>

          <TouchableOpacity
            style={styles.settingsCloseButton}
            onPress={() => setIsSettingsVisible(false)}
          >
            <Text style={styles.settingsCloseButtonText}>Done</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    );
  };

  // --- DEBUG: AmbienceBackground render ---
  const AmbienceBackground = () => {
    const { currentSong } = usePlayer();
    const [dominantColor, setDominantColor] = useState<string | null>(null);

    useEffect(() => {
      if (currentSong?.dominantColor) {
        setDominantColor(currentSong.dominantColor);
      } else {
        setDominantColor(null);
      }
    }, [currentSong]);

    const anim = useSharedValue(0);
    useEffect(() => {
      anim.value = withRepeat(
        withTiming(1, { duration: 8000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    }, []);

    const animatedStyle = useAnimatedStyle(() => {
      const scale = interpolate(anim.value, [0, 1], [1, 2.5]);
      const opacity = interpolate(anim.value, [0, 0.5, 1], [0.15, 0.4, 0.15]);
      return {
        opacity: dominantColor ? opacity : 0,
        transform: [{ scale }],
      };
    });

    return (
      <View
        style={[
          StyleSheet.absoluteFill,
          { justifyContent: "center", alignItems: "center" },
        ]}
        pointerEvents="none"
      >
        <Animated.View
          style={[
            styles.ambienceCircle,
            { backgroundColor: dominantColor || "transparent" },
            animatedStyle,
          ]}
        />
      </View>
    );
  };

  // --- DEBUG: VividBackground render ---
  const VividBackground = () => {
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <LinearGradient
          colors={[
            "#FFADAD",
            "#FFD6A5",
            "#FDFFB6",
            "#CAFFBF",
            "#9BF6FF",
            "#A0C4FF",
            "#BDB2FF",
            "#FFC6FF",
          ]}
          style={StyleSheet.absoluteFill}
        />
      </View>
    );
  };

  // --- Animated Vivid Background with realistic oil-on-water effect ---
  const AnimatedVividBackground = () => {
    // Multiple animation values for organic liquid flow
    const flowAnim1 = useSharedValue(0);
    const flowAnim2 = useSharedValue(0);
    const flowAnim3 = useSharedValue(0);
    const morphAnim = useSharedValue(0);

    useEffect(() => {
      // Organic flow animations with different timings
      flowAnim1.value = withRepeat(
        withTiming(1, { duration: 20000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );

      flowAnim2.value = withRepeat(
        withTiming(1, { duration: 25000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );

      flowAnim3.value = withRepeat(
        withTiming(1, { duration: 18000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );

      morphAnim.value = withRepeat(
        withTiming(1, { duration: 15000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    }, []);

    const liquidFlowStyle1 = useAnimatedStyle(() => {
      const translateX = interpolate(
        flowAnim1.value,
        [0, 1],
        [-width * 0.3, width * 0.3]
      );
      const translateY = interpolate(
        flowAnim1.value,
        [0, 1],
        [0, height * 0.2]
      );
      const scaleX = interpolate(flowAnim1.value, [0, 0.5, 1], [1, 1.3, 1]);
      const scaleY = interpolate(flowAnim1.value, [0, 0.5, 1], [1, 0.8, 1]);
      const rotate = interpolate(flowAnim1.value, [0, 1], [0, Math.PI * 0.1]);
      const opacity = interpolate(
        flowAnim1.value,
        [0, 0.3, 0.7, 1],
        [0.4, 0.7, 0.6, 0.4]
      );

      return {
        transform: [
          { translateX },
          { translateY },
          { scaleX },
          { scaleY },
          { rotate: `${rotate}rad` },
        ],
        opacity,
      } as any;
    });

    const liquidFlowStyle2 = useAnimatedStyle(() => {
      const translateX = interpolate(
        flowAnim2.value,
        [0, 1],
        [width * 0.2, -width * 0.2]
      );
      const translateY = interpolate(
        flowAnim2.value,
        [0, 1],
        [height * 0.3, 0]
      );
      const scaleX = interpolate(flowAnim2.value, [0, 0.5, 1], [1.2, 0.9, 1.2]);
      const scaleY = interpolate(flowAnim2.value, [0, 0.5, 1], [0.8, 1.1, 0.8]);
      const rotate = interpolate(flowAnim2.value, [0, 1], [0, -Math.PI * 0.15]);
      const opacity = interpolate(
        flowAnim2.value,
        [0, 0.4, 0.8, 1],
        [0.3, 0.6, 0.5, 0.3]
      );

      return {
        transform: [
          { translateX },
          { translateY },
          { scaleX },
          { scaleY },
          { rotate: `${rotate}rad` },
        ],
        opacity,
      } as any;
    });

    const liquidFlowStyle3 = useAnimatedStyle(() => {
      const translateX = interpolate(
        flowAnim3.value,
        [0, 1],
        [-width * 0.4, width * 0.4]
      );
      const translateY = interpolate(
        flowAnim3.value,
        [0, 1],
        [height * 0.5, height * 0.1]
      );
      const scaleX = interpolate(flowAnim3.value, [0, 0.5, 1], [0.9, 1.2, 0.9]);
      const scaleY = interpolate(flowAnim3.value, [0, 0.5, 1], [1.1, 0.8, 1.1]);
      const rotate = interpolate(flowAnim3.value, [0, 1], [0, Math.PI * 0.2]);
      const opacity = interpolate(
        flowAnim3.value,
        [0, 0.2, 0.6, 1],
        [0.2, 0.5, 0.4, 0.2]
      );

      return {
        transform: [
          { translateX },
          { translateY },
          { scaleX },
          { scaleY },
          { rotate: `${rotate}rad` },
        ],
        opacity,
      } as any;
    });

    const morphingStyle = useAnimatedStyle(() => {
      const translateX = interpolate(
        morphAnim.value,
        [0, 1],
        [width * 0.1, -width * 0.1]
      );
      const translateY = interpolate(
        morphAnim.value,
        [0, 1],
        [0, height * 0.4]
      );
      const scaleX = interpolate(morphAnim.value, [0, 0.5, 1], [1, 1.4, 1]);
      const scaleY = interpolate(morphAnim.value, [0, 0.5, 1], [1, 0.7, 1]);
      const rotate = interpolate(morphAnim.value, [0, 1], [0, -Math.PI * 0.1]);
      const opacity = interpolate(
        morphAnim.value,
        [0, 0.5, 1],
        [0.3, 0.6, 0.3]
      );

      return {
        transform: [
          { translateX },
          { translateY },
          { scaleX },
          { scaleY },
          { rotate: `${rotate}rad` },
        ],
        opacity,
      } as any;
    });

    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* Base gradient background */}
        <LinearGradient
          colors={[
            "#FFADAD",
            "#FFD6A5",
            "#FDFFB6",
            "#CAFFBF",
            "#9BF6FF",
            "#A0C4FF",
            "#BDB2FF",
            "#FFC6FF",
          ]}
          style={StyleSheet.absoluteFill}
        />

        {/* Organic liquid flow blobs - using organic shapes */}
        <Animated.View
          style={[StyleSheet.absoluteFill, liquidFlowStyle1] as any}
        >
          <View style={styles.organicBlob1}>
            <LinearGradient
              colors={["#FF6B9D", "#C44569", "#F8B500", "#FF6B9D"]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
          </View>
        </Animated.View>

        <Animated.View
          style={[StyleSheet.absoluteFill, liquidFlowStyle2] as any}
        >
          <View style={styles.organicBlob2}>
            <LinearGradient
              colors={["#4ECDC4", "#44A08D", "#00B4DB", "#4ECDC4"]}
              style={StyleSheet.absoluteFill}
              start={{ x: 1, y: 0 }}
              end={{ x: 0, y: 1 }}
            />
          </View>
        </Animated.View>

        <Animated.View
          style={[StyleSheet.absoluteFill, liquidFlowStyle3] as any}
        >
          <View style={styles.organicBlob3}>
            <LinearGradient
              colors={["#A8E6CF", "#7FCDCD", "#FFD93D", "#A8E6CF"]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
            />
          </View>
        </Animated.View>

        <Animated.View style={[StyleSheet.absoluteFill, morphingStyle] as any}>
          <View style={styles.organicBlob4}>
            <LinearGradient
              colors={["#FF8E8E", "#FFB6B6", "#FFD4D4", "#FF8E8E"]}
              style={StyleSheet.absoluteFill}
              start={{ x: 1, y: 0.5 }}
              end={{ x: 0, y: 0.5 }}
            />
          </View>
        </Animated.View>
      </View>
    );
  };

  // --- Realistic Oil on Water Background with organic liquid flow ---
  const RealisticOilOnWater = () => {
    const liquidFlow1 = useSharedValue(0);
    const liquidFlow2 = useSharedValue(0);
    const liquidFlow3 = useSharedValue(0);
    const liquidFlow4 = useSharedValue(0);

    useEffect(() => {
      // Natural liquid flow with organic timing
      liquidFlow1.value = withRepeat(
        withTiming(1, { duration: 30000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );

      liquidFlow2.value = withRepeat(
        withTiming(1, { duration: 25000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );

      liquidFlow3.value = withRepeat(
        withTiming(1, { duration: 35000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );

      liquidFlow4.value = withRepeat(
        withTiming(1, { duration: 20000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    }, []);

    const organicFlow1 = useAnimatedStyle(() => {
      const translateX = interpolate(
        liquidFlow1.value,
        [0, 1],
        [-width * 0.2, width * 0.2]
      );
      const translateY = interpolate(
        liquidFlow1.value,
        [0, 1],
        [0, height * 0.15]
      );
      const scaleX = interpolate(
        liquidFlow1.value,
        [0, 0.3, 0.7, 1],
        [1, 1.4, 0.8, 1]
      );
      const scaleY = interpolate(
        liquidFlow1.value,
        [0, 0.3, 0.7, 1],
        [1, 0.7, 1.3, 1]
      );
      const rotate = interpolate(
        liquidFlow1.value,
        [0, 1],
        [0, Math.PI * 0.05]
      );
      const opacity = interpolate(
        liquidFlow1.value,
        [0, 0.2, 0.5, 0.8, 1],
        [0.3, 0.6, 0.8, 0.5, 0.3]
      );

      return {
        transform: [
          { translateX },
          { translateY },
          { scaleX },
          { scaleY },
          { rotate: `${rotate}rad` },
        ],
        opacity,
      } as any;
    });

    const organicFlow2 = useAnimatedStyle(() => {
      const translateX = interpolate(
        liquidFlow2.value,
        [0, 1],
        [width * 0.15, -width * 0.15]
      );
      const translateY = interpolate(
        liquidFlow2.value,
        [0, 1],
        [height * 0.2, 0]
      );
      const scaleX = interpolate(
        liquidFlow2.value,
        [0, 0.4, 0.8, 1],
        [1.2, 0.9, 1.1, 1.2]
      );
      const scaleY = interpolate(
        liquidFlow2.value,
        [0, 0.4, 0.8, 1],
        [0.8, 1.2, 0.9, 0.8]
      );
      const rotate = interpolate(
        liquidFlow2.value,
        [0, 1],
        [0, -Math.PI * 0.08]
      );
      const opacity = interpolate(
        liquidFlow2.value,
        [0, 0.3, 0.6, 0.9, 1],
        [0.2, 0.5, 0.7, 0.4, 0.2]
      );

      return {
        transform: [
          { translateX },
          { translateY },
          { scaleX },
          { scaleY },
          { rotate: `${rotate}rad` },
        ],
        opacity,
      } as any;
    });

    const organicFlow3 = useAnimatedStyle(() => {
      const translateX = interpolate(
        liquidFlow3.value,
        [0, 1],
        [-width * 0.3, width * 0.3]
      );
      const translateY = interpolate(
        liquidFlow3.value,
        [0, 1],
        [height * 0.4, height * 0.05]
      );
      const scaleX = interpolate(
        liquidFlow3.value,
        [0, 0.5, 1],
        [0.9, 1.2, 0.9]
      );
      const scaleY = interpolate(
        liquidFlow3.value,
        [0, 0.5, 1],
        [1.1, 0.8, 1.1]
      );
      const rotate = interpolate(
        liquidFlow3.value,
        [0, 1],
        [0, Math.PI * 0.12]
      );
      const opacity = interpolate(
        liquidFlow3.value,
        [0, 0.25, 0.5, 0.75, 1],
        [0.2, 0.5, 0.4, 0.2]
      );

      return {
        transform: [
          { translateX },
          { translateY },
          { scaleX },
          { scaleY },
          { rotate: `${rotate}rad` },
        ],
        opacity,
      } as any;
    });

    const organicFlow4 = useAnimatedStyle(() => {
      const translateX = interpolate(
        liquidFlow4.value,
        [0, 1],
        [width * 0.1, -width * 0.1]
      );
      const translateY = interpolate(
        liquidFlow4.value,
        [0, 1],
        [0, height * 0.3]
      );
      const scaleX = interpolate(liquidFlow4.value, [0, 0.5, 1], [1, 1.5, 1]);
      const scaleY = interpolate(liquidFlow4.value, [0, 0.5, 1], [1, 0.6, 1]);
      const rotate = interpolate(
        liquidFlow4.value,
        [0, 1],
        [0, -Math.PI * 0.06]
      );
      const opacity = interpolate(
        liquidFlow4.value,
        [0, 0.4, 0.7, 1],
        [0.25, 0.55, 0.45, 0.25]
      );

      return {
        transform: [
          { translateX },
          { translateY },
          { scaleX },
          { scaleY },
          { rotate: `${rotate}rad` },
        ],
        opacity,
      } as any;
    });

    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* Base gradient background */}
        <LinearGradient
          colors={[
            "#FFADAD",
            "#FFD6A5",
            "#FDFFB6",
            "#CAFFBF",
            "#9BF6FF",
            "#A0C4FF",
            "#BDB2FF",
            "#FFC6FF",
          ]}
          style={StyleSheet.absoluteFill}
        />

        {/* Organic liquid blobs with realistic flow */}
        <Animated.View style={[StyleSheet.absoluteFill, organicFlow1] as any}>
          <View style={styles.realisticBlob1}>
            <LinearGradient
              colors={["#FF6B9D", "#C44569", "#F8B500", "#FF6B9D"]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
          </View>
        </Animated.View>

        <Animated.View style={[StyleSheet.absoluteFill, organicFlow2] as any}>
          <View style={styles.realisticBlob2}>
            <LinearGradient
              colors={["#4ECDC4", "#44A08D", "#00B4DB", "#4ECDC4"]}
              style={StyleSheet.absoluteFill}
              start={{ x: 1, y: 0 }}
              end={{ x: 0, y: 1 }}
            />
          </View>
        </Animated.View>

        <Animated.View style={[StyleSheet.absoluteFill, organicFlow3] as any}>
          <View style={styles.realisticBlob3}>
            <LinearGradient
              colors={["#A8E6CF", "#7FCDCD", "#FFD93D", "#A8E6CF"]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
            />
          </View>
        </Animated.View>

        <Animated.View style={[StyleSheet.absoluteFill, organicFlow4] as any}>
          <View style={styles.realisticBlob4}>
            <LinearGradient
              colors={["#FF8E8E", "#FFB6B6", "#FFD4D4", "#FF8E8E"]}
              style={StyleSheet.absoluteFill}
              start={{ x: 1, y: 0.5 }}
              end={{ x: 0, y: 0.5 }}
            />
          </View>
        </Animated.View>
      </View>
    );
  };

  // --- Dynamic Color Mixing Background (Super Alive) ---
  const SingleFluidOilOnWater = () => {
    console.log("RENDER: Dynamic Color Mixing");

    const colorFlow = useSharedValue(0);
    const colorPush = useSharedValue(0);
    const colorSwirl = useSharedValue(0);
    const colorBend = useSharedValue(0);
    const colorSplash = useSharedValue(0);

    useEffect(() => {
      // Super fast and alive color mixing
      colorFlow.value = withRepeat(
        withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );

      colorPush.value = withRepeat(
        withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );

      colorSwirl.value = withRepeat(
        withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );

      colorBend.value = withRepeat(
        withTiming(1, { duration: 3500, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );

      colorSplash.value = withRepeat(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    }, []);

    const colorFlowStyle = useAnimatedStyle(() => {
      const startX = interpolate(colorFlow.value, [0, 1], [0, 1]);
      const startY = interpolate(colorFlow.value, [0, 1], [0, 1]);
      const endX = interpolate(colorFlow.value, [0, 1], [1, 0]);
      const endY = interpolate(colorFlow.value, [0, 1], [1, 0]);

      return {
        start: { x: startX, y: startY },
        end: { x: endX, y: endY },
      } as any;
    });

    const colorPushStyle = useAnimatedStyle(() => {
      const startX = interpolate(colorPush.value, [0, 1], [1, 0]);
      const startY = interpolate(colorPush.value, [0, 1], [1, 0]);
      const endX = interpolate(colorPush.value, [0, 1], [0, 1]);
      const endY = interpolate(colorPush.value, [0, 1], [0, 1]);

      return {
        start: { x: startX, y: startY },
        end: { x: endX, y: endY },
      } as any;
    });

    const colorSwirlStyle = useAnimatedStyle(() => {
      const startX = interpolate(colorSwirl.value, [0, 0.5, 1], [0, 1, 0]);
      const startY = interpolate(colorSwirl.value, [0, 0.5, 1], [0, 0, 1]);
      const endX = interpolate(colorSwirl.value, [0, 0.5, 1], [1, 0, 1]);
      const endY = interpolate(colorSwirl.value, [0, 0.5, 1], [1, 1, 0]);

      return {
        start: { x: startX, y: startY },
        end: { x: endX, y: endY },
      } as any;
    });

    const colorBendStyle = useAnimatedStyle(() => {
      const startX = interpolate(
        colorBend.value,
        [0, 0.25, 0.5, 0.75, 1],
        [0, 0.5, 1, 0.5, 0]
      );
      const startY = interpolate(
        colorBend.value,
        [0, 0.25, 0.5, 0.75, 1],
        [0, 0, 0.5, 1, 1]
      );
      const endX = interpolate(
        colorBend.value,
        [0, 0.25, 0.5, 0.75, 1],
        [1, 0.5, 0, 0.5, 1]
      );
      const endY = interpolate(
        colorBend.value,
        [0, 0.25, 0.5, 0.75, 1],
        [1, 1, 0.5, 0, 0]
      );

      return {
        start: { x: startX, y: startY },
        end: { x: endX, y: endY },
      } as any;
    });

    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* Base gradient background */}
        <LinearGradient
          colors={[
            "#FFADAD",
            "#FFD6A5",
            "#FDFFB6",
            "#CAFFBF",
            "#9BF6FF",
            "#A0C4FF",
            "#BDB2FF",
            "#FFC6FF",
          ]}
          style={StyleSheet.absoluteFill}
        />

        {/* Dynamic color mixing layers - super alive! */}

        {/* Pink pushing from top-left */}
        <Animated.View style={[StyleSheet.absoluteFill, colorFlowStyle] as any}>
          <LinearGradient
            colors={[
              "rgba(255, 107, 157, 0.9)", // Bright Pink
              "rgba(255, 107, 157, 0.3)", // Fading Pink
              "rgba(255, 107, 157, 0.1)", // Very light Pink
              "transparent",
            ]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        </Animated.View>

        {/* Teal pushing from bottom-right */}
        <Animated.View style={[StyleSheet.absoluteFill, colorPushStyle] as any}>
          <LinearGradient
            colors={[
              "rgba(78, 205, 196, 0.9)", // Bright Teal
              "rgba(78, 205, 196, 0.3)", // Fading Teal
              "rgba(78, 205, 196, 0.1)", // Very light Teal
              "transparent",
            ]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        </Animated.View>

        {/* Gold swirling in center */}
        <Animated.View
          style={[StyleSheet.absoluteFill, colorSwirlStyle] as any}
        >
          <LinearGradient
            colors={[
              "rgba(248, 181, 0, 0.8)", // Bright Gold
              "rgba(248, 181, 0, 0.4)", // Medium Gold
              "rgba(248, 181, 0, 0.2)", // Light Gold
              "transparent",
            ]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        </Animated.View>

        {/* Blue bending and flowing */}
        <Animated.View style={[StyleSheet.absoluteFill, colorBendStyle] as any}>
          <LinearGradient
            colors={[
              "rgba(0, 180, 219, 0.8)", // Bright Blue
              "rgba(0, 180, 219, 0.4)", // Medium Blue
              "rgba(0, 180, 219, 0.2)", // Light Blue
              "transparent",
            ]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        </Animated.View>
      </View>
    );
  };

  const handleDeleteFavorite = async (song: ApiSong) => {
    const newFavorites = favorites.filter((s) => s.id !== song.id);
    setFavorites(newFavorites);
    await AsyncStorage.setItem(
      STORAGE_KEYS.USER_FAVORITES,
      JSON.stringify(newFavorites)
    );
    setDeleteModalVisible(false);
    setItemToDelete(null);
  };
  const handleDeletePlaylistSong = async (
    playlistId: string,
    song: ApiSong
  ) => {
    const newPlaylists = userPlaylists.map((p) => {
      if (p.id === playlistId) {
        return { ...p, songs: (p.songs || []).filter((s) => s.id !== song.id) };
      }
      return p;
    });
    setUserPlaylists(newPlaylists);
    await AsyncStorage.setItem(
      STORAGE_KEYS.USER_PLAYLISTS,
      JSON.stringify(newPlaylists)
    );
    setDeleteModalVisible(false);
    setItemToDelete(null);
    setDeletePlaylistId(null);
  };
  return (
    <AnimatedGestureHandlerRootView
      style={[{ flex: 1 }, animatedBackgroundStyle]}
    >
      <StatusBar style={colors.statusBar} />
      {appearanceMode === "ambience" && theme === "dark" && (
        <AmbienceBackground />
      )}
      {appearanceMode === "vivid" && theme === "light" && <VividBackground />}
      {appearanceMode === "realistic" && theme === "light" && (
        <AnimatedVividBackground />
      )}
      {appearanceMode === "fluid" && theme === "light" && (
        <SingleFluidOilOnWater />
      )}

      <SafeAreaView style={styles.safeArea}>
        <Modal
          visible={isAddToPlaylistModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setIsAddToPlaylistModalVisible(false)}
        >
          <View style={styles.settingsBackdrop}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setIsAddToPlaylistModalVisible(false)}
            />
            <View style={styles.settingsContainer}>
              <Text style={styles.settingsTitle}>Add to Playlist</Text>
              <TouchableOpacity
                style={styles.createPlaylistModalButton}
                onPress={handleCreatePlaylistFromModal}
              >
                <FontAwesome name="plus" size={16} color={colors.primary} />
                <Text style={styles.createPlaylistModalButtonText}>
                  Create New Playlist
                </Text>
              </TouchableOpacity>
              <FlatList
                data={userPlaylists}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.playlistItemText}
                    onPress={() => addToPlaylist(item.id)}
                  >
                    <Text style={{ color: colors.text }}>{item.name}</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>
                    You haven&apos;t created any playlists yet.
                  </Text>
                }
              />
            </View>
          </View>
        </Modal>
        <TutorialOverlay
          isVisible={isTutorialVisible}
          onClose={handleCloseTutorial}
          styles={styles}
        />
        <VoiceSearch
          isVisible={isVoiceSearchVisible}
          onClose={() => {
            setIsVoiceSearchVisible(false);
            // Stop the mic search sound when modal is closed
            if (micSearchSound.playing) {
              micSearchSound.pause();
              micSearchSound.seekTo(0);
            }
          }}
          onSearchResult={handleVoiceSearchResult}
          colors={colors}
        />
        {selectedView === "main" && !expandedHomepageSection && (
          <Animated.View style={[styles.header, headerAnimatedStyle]}>
            <GestureDetector gesture={gesture}>
              <Animated.View style={{ flex: 1 }}>
                <Animated.Image
                  source={{ uri: activeSongArtwork }}
                  style={styles.headerBackground}
                  resizeMode="cover"
                  blurRadius={15}
                />
                <Animated.View
                  style={[styles.headerContent, headerContentAnimatedStyle]}
                >
                  <View style={styles.headerTopRow}>
                    <Text style={styles.mainHeaderTitle}>Suman Music</Text>
                  </View>

                  <View style={styles.touchableHeaderWrapper}>
                    <View style={styles.headerTopContent}>
                      <Image
                        source={{ uri: activeSongArtwork }}
                        style={styles.headerArtwork}
                        resizeMode="cover"
                      />
                      <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle} numberOfLines={2}>
                          {activeSongTitle}
                        </Text>
                        <Text style={styles.headerSubtitle} numberOfLines={1}>
                          {activeSongArtistDisplay}
                        </Text>
                      </View>
                    </View>
                  </View>
                </Animated.View>
                <Animated.View
                  style={[waveStyle, { overflow: "hidden" }]}
                  pointerEvents="none"
                >
                  <LinearGradient
                    colors={[
                      "rgba(255,255,255,0.0)",
                      "rgba(255,255,255,0.4)",
                      "rgba(255,255,255,0.0)",
                    ]}
                    style={{ flex: 1, width: "40%" }}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                  />
                </Animated.View>
                <Animated.View style={rippleStyle} pointerEvents="none" />
              </Animated.View>
            </GestureDetector>

            {/* Control buttons outside gesture area */}
            <View style={styles.headerControlsOverlay}>
              <View style={styles.headerTopControls}>
                <View style={{ flex: 1 }} />
                <TouchableOpacity
                  onPress={toggleSearchOverlay}
                  style={styles.mainHeaderSearchIcon}
                >
                  <FontAwesome
                    name="search"
                    size={22}
                    color={colors.headerText}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.headerBottomControls}>
                <View style={styles.bottomLeftControls}>
                  <TouchableOpacity
                    style={styles.bottomLeftControlButton}
                    onPress={playerActions.togglePlaybackMode}
                    disabled={!currentSong}
                  >
                    <FontAwesome
                      name={
                        playerActions.playbackMode === "shuffle"
                          ? "random"
                          : "repeat"
                      }
                      size={18}
                      color={
                        playerActions.playbackMode !== "normal" && currentSong
                          ? colors.primary
                          : colors.headerText
                      }
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.bottomLeftControlButton}
                    onPress={navigateToEQ}
                  >
                    <FontAwesome
                      name="sliders"
                      size={20}
                      color={colors.headerText}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Animated.View>
        )}
        {/* // ✅ CORRECT - This condition is now false for the artist page */}
        {((selectedView !== "main" && selectedView !== "artist") ||
          expandedHomepageSection) && <ViewSpecificHeader />}
        {currentViewIsLoading && (
          <View
            style={[
              styles.centered,
              {
                paddingTop:
                  selectedView === "main" && !expandedHomepageSection
                    ? HEADER_MAX_HEIGHT + 20
                    : HEADER_MIN_HEIGHT + 20,
                flex: 1,
                backgroundColor: "transparent",
              },
            ]}
          >
            <SLiquidLoading
              size={60}
              color="#FFA500"
              background="transparent"
            />
            <Text style={styles.loadingText}>
              {selectedView === "main" && !expandedHomepageSection
                ? "Loading songs..."
                : `Loading ${
                    selectedView === "main" && expandedHomepageSection
                      ? expandedHomepageSection.type
                      : selectedView
                  }...`}
            </Text>
          </View>
        )}
        {selectedView === "artist" && selectedArtist && (
          <>
            {/* --- STICKY HEADER (only visible on scroll) --- */}
            <Animated.View
              style={[styles.artistStickyHeader, stickyHeaderStyle]}
            >
              <Text style={styles.artistStickyTitle}>
                {selectedArtist.name}
              </Text>
            </Animated.View>

            {/* --- COLLAPSING BANNER --- */}
            <Animated.View
              style={[styles.header, { height: HEADER_MAX_HEIGHT }]}
            >
              <Animated.Image
                source={{ uri: getImageUrl(selectedArtist.image, "500x500") }}
                style={[styles.artistHeaderImage, artistHeaderImageStyle]}
              />
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.8)"]}
                style={styles.artistHeaderGradient}
              />
              <Animated.Text
                style={[styles.artistHeaderTitle, artistTitleStyle]}
              >
                {selectedArtist.name}
              </Animated.Text>
            </Animated.View>

            {/* --- FLOATING ACTION BUTTON --- */}
            <TouchableOpacity
              style={styles.artistFab}
              onPress={() =>
                selectedArtist.topSongs?.[0] &&
                handlePlaySong(
                  shuffleArray(selectedArtist.topSongs)[0],
                  shuffleArray(selectedArtist.topSongs)
                )
              }
            >
              <FontAwesome name="random" size={24} color="#000" />
            </TouchableOpacity>

            {/* --- BACK BUTTON (always visible on artist page) --- */}
            <TouchableOpacity
              onPress={handleBack}
              style={styles.artistBackButton}
            >
              <FontAwesome name="arrow-left" size={22} color={"#FFF"} />
            </TouchableOpacity>
          </>
        )}
        {!currentViewIsLoading && (
          <Animated.FlatList
            ref={flatListRef}
            style={{ backgroundColor: "transparent" }}
            data={flatListData}
            renderItem={renderSongItem}
            keyExtractor={(item: ApiSong, idx: number) =>
              `song-item-${item.id || idx}-${selectedView}-${item.name}`
            }
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            ListHeaderComponent={
              !currentViewIsLoading ? (
                <ListContentHeader favorites={favorites} />
              ) : null
            }
            contentContainerStyle={flatListContentContainerStyle}
            ListEmptyComponent={
              !(
                selectedView === "main" &&
                expandedHomepageSection?.type === "trending"
              ) ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    {isLoading
                      ? "Loading songs..."
                      : selectedView === "album"
                      ? "No songs in this album"
                      : selectedView === "playlist"
                      ? "No songs in this playlist"
                      : selectedView === "artist"
                      ? ""
                      : "No songs available for current selection."}
                  </Text>
                </View>
              ) : null
            }
          />
        )}
        {currentSong && (
          <Animated.View
            style={[
              styles.miniPlayer,
              miniPlayerAnimatedStyle,
              (selectedView !== "main" || expandedHomepageSection) &&
                styles.miniPlayerFullWidth,
            ]}
          >
            <TouchableOpacity
              style={styles.miniPlayerContent}
              onPress={() => router.push("/player" as any)}
            >
              <Image
                source={{
                  uri: getImageUrl(currentSong.image, "500x500"),
                }}
                style={styles.miniPlayerArtwork}
              />
              <View style={{ flex: 1, marginLeft: 10, marginRight: 10 }}>
                <Text style={styles.miniPlayerTitle} numberOfLines={1}>
                  {sanitizeSongTitle(currentSong.name || currentSong.title)}
                </Text>
                <ClickableArtistLinks
                  artistsInput={
                    currentSong.primaryArtists || currentSong.subtitle
                  }
                  onArtistPress={(artist) => {
                    const targetViewIsArtist =
                      selectedView === "artist" &&
                      (typeof artist === "string"
                        ? selectedArtist?.name === artist
                        : selectedArtist?.id === artist.id);
                    if (targetViewIsArtist) return;

                    handleBack();
                    setTimeout(() => handleArtistPress(artist), 50);
                  }}
                  baseTextStyle={styles.miniPlayerArtistBase}
                  touchableTextStyle={styles.miniPlayerArtistLink}
                  separatorTextStyle={styles.miniPlayerArtistSeparatorText}
                  maxArtistsToShow={1}
                  disabled={true}
                />
              </View>
              <TouchableOpacity
                onPress={playerActions.togglePlayPause}
                style={{ padding: 10 }}
              >
                <FontAwesome
                  name={isPlaying ? "pause" : "play"}
                  size={22}
                  color={colors.text}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={playerActions.nextSong}
                style={{ padding: 10, marginLeft: 5 }}
              >
                <FontAwesome
                  name="step-forward"
                  size={20}
                  color={colors.text}
                />
              </TouchableOpacity>
            </TouchableOpacity>
          </Animated.View>
        )}
        
        {/* Beautiful AI Mic Search Button */}
        <TouchableOpacity
          style={styles.aiMicButton}
          onPress={handleMicSearch}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={[colors.primary + "EE", colors.primary]}
            style={styles.aiMicGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.aiMicContent}>
              <View style={styles.micIconContainer}>
                <FontAwesome
                  name="microphone"
                  size={20}
                  color="#FFFFFF"
                />
              </View>
              <Text style={styles.aiMicText}>Search</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
        
      </SafeAreaView>
      <SearchOverlay
        isVisible={isSearchOverlayVisible}
        onClose={toggleSearchOverlay}
        onPlaySong={handlePlaySong}
        getImageUrl={getImageUrl}
        getArtistNameFromPrimary={getArtistNameFromPrimary}
        processRawSong={processRawSong}
        onAlbumPress={handleAlbumPress}
        styles={styles}
        initialQuery={voiceSearchQuery}
        onArtistPress={(artist) => {
          setIsSearchOverlayVisible(false);
          setTimeout(() => {
            const targetViewIsArtist =
              selectedView === "artist" &&
              (typeof artist === "string"
                ? selectedArtist?.name === artist
                : selectedArtist?.id === artist.id);
            if (targetViewIsArtist) return;

            handleBack();
            setTimeout(() => handleArtistPress(artist), 50);
          }, 250);
        }}
      />
      <SettingsOverlay />
      <LibraryModal
        isVisible={isLibraryModalVisible}
        onClose={() => setIsLibraryModalVisible(false)}
        styles={styles}
        colors={colors}
        userPlaylists={userPlaylists}
        favorites={favorites}
        selectedPlaylist={selectedPlaylist}
        handlePlaylistPress={handlePlaylistPress}
        handlePlaySong={handlePlaySong}
        createPlaylist={createPlaylist}
        getImageUrl={getImageUrl}
        getArtistNameFromPrimary={getArtistNameFromPrimary}
        setFavorites={setFavorites}
        setUserPlaylists={setUserPlaylists}
        setDeleteModalVisible={setDeleteModalVisible}
        setItemToDelete={setItemToDelete}
        setDeleteType={setDeleteType}
        setDeletePlaylistId={setDeletePlaylistId}
      />

      <Animated.View style={[styles.libraryFab, animatedLibraryButton]}>
        <Pressable
          onPress={() => setIsLibraryModalVisible(true)}
          onPressIn={() => (libraryButtonOpacity.value = withTiming(1))}
          onPressOut={() => (libraryButtonOpacity.value = withTiming(1))}
        >
          <FontAwesome name="book" size={24} color={colors.textSecondary} />
        </Pressable>
      </Animated.View>
      {deleteModalVisible && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setDeleteModalVisible(false)}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(30,30,40,0.25)",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Animated.View
              // entering={Animated.FadeIn?.duration ? Animated.FadeIn.duration(250) : undefined}/z
              style={{
                width: 340,
                backgroundColor: "#fff",
                borderRadius: 24,
                padding: 28,
                alignItems: "center",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.18,
                shadowRadius: 24,
                elevation: 12,
              }}
            >
              <View
                style={{
                  backgroundColor: "#FFF3E6",
                  borderRadius: 50,
                  padding: 18,
                  marginBottom: 18,
                }}
              >
                <FontAwesome
                  name="exclamation-triangle"
                  size={38}
                  color="#FFA500"
                />
              </View>
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: "bold",
                  color: "#222",
                  marginBottom: 10,
                  textAlign: "center",
                }}
              >
                Remove Song?
              </Text>
              <Text
                style={{
                  color: "#666",
                  fontSize: 16,
                  marginBottom: 28,
                  textAlign: "center",
                  lineHeight: 22,
                }}
              >
                Are you sure you want to remove this song from{" "}
                {deleteType === "favorite" ? "your Favorites" : "this Playlist"}
                ? This action cannot be undone.
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  width: "100%",
                  justifyContent: "space-between",
                }}
              >
                <TouchableOpacity
                  style={{
                    flex: 1,
                    backgroundColor: "#F3F4F6",
                    paddingVertical: 14,
                    borderRadius: 12,
                    marginRight: 10,
                    alignItems: "center",
                  }}
                  onPress={() => setDeleteModalVisible(false)}
                >
                  <Text
                    style={{ color: "#555", fontWeight: "600", fontSize: 16 }}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    backgroundColor: "#FFA500",
                    paddingVertical: 14,
                    borderRadius: 12,
                    alignItems: "center",
                    shadowColor: "#FFA500",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.15,
                    shadowRadius: 6,
                    elevation: 2,
                  }}
                  onPress={() => {
                    if (deleteType === "favorite" && itemToDelete)
                      handleDeleteFavorite(itemToDelete);
                    else if (
                      deleteType === "playlistSong" &&
                      deletePlaylistId &&
                      itemToDelete
                    )
                      handleDeletePlaylistSong(deletePlaylistId, itemToDelete);
                  }}
                >
                  <Text
                    style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}
                  >
                    Delete
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        </Modal>
      )}

      <NotificationCardPage
        songs={recommendedSongs} // Pass your song data here
        onSwipeRight={toggleFavorite} // Pass the favorite function
        onPlaySong={handlePlaySong} // Pass the play song function
        getImageUrl={getImageUrl} // Pass the getImageUrl function
      />

      <FloatingNotification
        songImage={floatingNotifSongDetails.image}
        songTitle={floatingNotifSongDetails.title}
        artistName={floatingNotifSongDetails.artist}
        isVisible={showFloatingNotif}
        onHide={() => setShowFloatingNotif(false)}
        colors={colors}
      />
    </AnimatedGestureHandlerRootView>
  );
};

// --- DEBUG: HomeScreen.displayName set ---
HomeScreen.displayName = "HomeScreen";

const secondsToMinuteSecond = (
  sInput: number | string | undefined = 0
): string => {
  const s = typeof sInput === "string" ? parseInt(sInput) : Number(sInput);
  if (s === undefined || isNaN(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const rS = Math.floor(s % 60);
  return `${m}:${rS.toString().padStart(2, "0")}`;
};
const calculateTotalDuration = (songs: ApiSong[] | undefined = []): number => {
  if (!songs) return 0;
  return songs.reduce((t, s) => {
    const dV =
      typeof s.duration === "string"
        ? parseInt(s.duration)
        : Number(s.duration);
    return t + (isNaN(dV) ? 0 : dV || 0);
  }, 0);
};

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: "transparent" },
    centered: { justifyContent: "center", alignItems: "center", flex: 1 },
    loadingText: { color: colors.text, marginTop: 10, fontSize: 16 },
    errorText: {
      color: "#ff4444",
      fontSize: 16,
      textAlign: "center",
      paddingHorizontal: 20,
      marginBottom: 10,
    },
    retryButton: {
      marginTop: 12,
      backgroundColor: colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 8,
    },
    retryButtonText: { color: "white", fontSize: 16, fontWeight: "600" },
    header: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      width: "100%",
      backgroundColor: "transparent",
      overflow: "hidden",
    },
    headerControlsOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: HEADER_MAX_HEIGHT,
      flexDirection: "column",
      justifyContent: "space-between",
      paddingHorizontal: 15,
      paddingTop: Platform.OS === "ios" ? 35 : 15,
      paddingBottom: 10,
      zIndex: 10,
    },
    headerTopControls: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      width: "100%",
      paddingTop: Platform.OS === "ios" ? 35 : 25,
      marginBottom: 10,
    },
    headerBottomControls: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "flex-start",
      width: "100%",
    },
    headerBackground: {
      width: "100%",
      height: HEADER_MAX_HEIGHT,
      position: "absolute",
      opacity: 0.5,
    },
    headerContent: {
      height: "100%",
      alignItems: "center",
      paddingHorizontal: 15,
      backgroundColor: "rgba(0,0,0,0.3)",
      paddingTop: Platform.OS === "ios" ? 5 : 5,
    },
    headerTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      width: "100%",
      paddingTop: Platform.OS === "ios" ? 35 : 25,
      marginBottom: 10,
    },
    mainHeaderTitle: {
      color: colors.headerText,
      fontSize: 20,
      fontWeight: "bold",
    },
    mainHeaderSearchIcon: { paddingTop: 10, paddingRight: 10 },
    headerTopContent: {
      flexDirection: "row",
      alignItems: "center",
      width: "100%",
    },
    headerArtwork: {
      width: 100,
      height: 100,
      borderRadius: 8,
      marginRight: 15,
      backgroundColor: "#2a2a2a",
    },
    headerTextContainer: { flex: 1, justifyContent: "center" },
    headerTitle: {
      color: colors.headerText,
      fontSize: 22,
      fontWeight: "bold",
      marginBottom: 5,
    },
    headerSubtitle: { color: "#ddd", fontSize: 15 },
    touchableHeaderWrapper: {
      flex: 1,
      width: "100%",
      justifyContent: "space-between",
      paddingBottom: 10,
      overflow: "hidden",
    },
    bottomLeftControls: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-start",
      width: "100%",
      paddingLeft: 5,
      marginTop: 10,
    },
    bottomLeftControlButton: {
      padding: 10,
      marginRight: 15,
    },
    viewHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 15,
      backgroundColor: "transparent",
      borderBottomWidth: 1,
      borderBottomColor: colors.separator,
      height: HEADER_MIN_HEIGHT,
      paddingTop: Platform.OS === "ios" ? 30 : 0,
      zIndex: 5,
    },
    backButton: {
      paddingHorizontal: 5,
      minWidth: 30,
      alignItems: "flex-start",
      justifyContent: "center",
      height: "100%",
    },
    viewTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "bold",
      flex: 1,
      textAlign: "center",
      marginHorizontal: 5,
    },
    headerSearchIcon: {
      paddingHorizontal: 5,
      minWidth: 30,
      alignItems: "flex-end",
      justifyContent: "center",
      height: "100%",
    },
    languageSelectorContainer: { marginBottom: 15, marginTop: 5 },
    languageListContent: { paddingHorizontal: 10, paddingVertical: 5 },
    languageChip: {
      backgroundColor: colors.chip,
      paddingVertical: 8,
      paddingHorizontal: 15,
      borderRadius: 20,
      marginRight: 10,
    },
    languageChipSelected: { backgroundColor: colors.chipSelected },
    languageChipText: { color: colors.chipText, fontSize: 14 },
    languageChipTextSelected: {
      color: colors.chipTextSelected,
      fontWeight: "bold",
    },
    sectionContainer: { marginBottom: 20 },
    sectionTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "bold",
      marginLeft: 15,
      marginBottom: 12,
    },
    playlistItem: { marginRight: 12, width: 150 },
    playlistImage: {
      width: 150,
      height: 150,
      borderRadius: 8,
      backgroundColor: "#2a2a2a",
    },
    playlistTextContainer: { marginTop: 8, width: "100%" },
    playlistTitle: {
      color: colors.text,
      fontWeight: "600",
      fontSize: 14,
      textAlign: "left",
    },
    playlistSubtitle: {
      color: colors.textSecondary,
      fontSize: 12,
      textAlign: "left",
      marginTop: 3,
      lineHeight: 16,
    },
    playlistArtistLinkStyle: { color: "#87CEFA", fontWeight: "500" },
    playlistSeparator: { color: colors.textSecondary },
    songItemHorizontal: { width: 130, marginRight: 10 },
    songArtworkHorizontal: {
      width: 130,
      height: 130,
      borderRadius: 6,
      marginBottom: 8,
      backgroundColor: "#2a2a2a",
    },
    songItemTitleHorizontal: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "600",
    },
    songItemArtistHorizontalBase: {
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 16,
    },
    songItemArtistHorizontalLink: { color: "#87CEFA" },
    songItemArtistHorizontalSeparatorText: { color: colors.textSecondary },
    songItem: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: 10,
      marginVertical: 6,
      paddingVertical: 8,
      paddingHorizontal: 5,
      backgroundColor: `${colors.itemCard}80`,
      borderRadius: 8,
    },
    songArtwork: {
      width: 48,
      height: 48,
      borderRadius: 4,
      backgroundColor: "#2a2a2a",
    },
    songItemInfo: { flex: 1, marginLeft: 12, marginRight: 8 },
    songItemTitle: { color: colors.text, fontWeight: "600", fontSize: 15 },
    songItemArtistBase: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
    songItemArtistLink: { color: "#87CEFA", fontWeight: "500" },
    songItemArtistSeparatorText: { color: colors.textSecondary },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: 50,
      minHeight: 200,
    },
    emptyText: {
      color: colors.textSecondary,
    },
    miniPlayerTitle: { color: colors.text, fontWeight: "bold", fontSize: 15 },
    miniPlayerArtistBase: {
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 16,
    },
    miniPlayerArtistLink: { color: "#87CEFA" },
    miniPlayerArtistSeparatorText: { color: colors.textSecondary },
    albumDetailContainer: { paddingBottom: 10 },
    albumHeaderContent: {
      flexDirection: "row",
      alignItems: "flex-start",
      paddingHorizontal: 15,
      paddingTop: 20,
      paddingBottom: 15,
    },
    albumDetailImage: {
      width: width * 0.35,
      height: width * 0.35,
      borderRadius: 8,
      marginRight: 15,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 5,
      elevation: 6,
      backgroundColor: "#2a2a2a",
    },
    albumDetailInfo: { flex: 1, justifyContent: "flex-start" },
    albumType: {
      color: "#fff",
      fontSize: 12,
      fontWeight: "bold",
      textTransform: "uppercase",
      opacity: 0.8,
      marginBottom: 4,
    },
    albumDetailTitle: {
      color: "#fff",
      fontSize: 20,
      fontWeight: "bold",
      marginBottom: 6,
    },
    albumArtistText: {
      color: "#eee",
      fontSize: 14,
      opacity: 0.9,
      marginBottom: 8,
      lineHeight: 20,
    },
    albumArtistLinkStyle: { color: "#87CEFA", fontWeight: "bold" },
    albumArtistSeparatorStyle: { color: "#eee", opacity: 0.9 },
    playlistDescriptionText: {
      color: "#ddd",
      fontSize: 13,
      opacity: 0.8,
      marginBottom: 8,
    },
    albumStats: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
    albumStatText: { color: "#eee", fontSize: 12, opacity: 0.8 },
    controlsContainer: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 15,
      paddingVertical: 10,
      marginTop: 5,
    },
    playButton: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: "#1DB954",
      justifyContent: "center",
      alignItems: "center",
      marginRight: 15,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 3,
      elevation: 4,
    },
    playButtonText: { color: colors.text, fontSize: 16, fontWeight: "bold" },
    artistDetailContainer: { paddingBottom: 20 },
    artistHeaderContent: {
      alignItems: "center",
      paddingHorizontal: 15,
      paddingTop: 20,
      paddingBottom: 20,
    },
    artistDetailImage: {
      width: width * 0.45,
      height: width * 0.45,
      borderRadius: (width * 0.45) / 2,
      marginBottom: 15,
      backgroundColor: "#2a2a2a",
    },
    artistDetailInfo: { alignItems: "center", flex: 1 },
    artistDetailName: {
      color: "#fff",
      fontSize: 24,
      fontWeight: "bold",
      textAlign: "center",
      marginBottom: 8,
    },
    bioText: {
      color: colors.textSecondary,
      fontSize: 15,
      lineHeight: 24,
      paddingHorizontal: 15,
    },
    bioListItem: {
      marginBottom: 20,
      paddingHorizontal: 15,
    },
    bioListTitleContainer: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 8,
    },
    bioListIcon: {
      marginRight: 10,
    },
    bioListTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "bold",
      flex: 1,
    },
    bioListText: {
      color: colors.textSecondary,
      fontSize: 15,
      lineHeight: 22,
      paddingLeft: 28, // Indent text under the icon
    },
    searchOverlayContainer: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.95)",
      zIndex: 1000,
    },
    searchSafeArea: { flex: 1, backgroundColor: colors.searchBar },
    searchBar: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 10,
      paddingTop: Platform.OS === "ios" ? 20 : 25,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.separator,
      backgroundColor: colors.searchBar,
    },
    searchInputField: {
      flex: 1,
      height: 45,
      color: colors.text,
      fontSize: 18,
      marginLeft: 10,
      marginRight: 5,
    },
    searchIcon: {
      color: colors.text,
    },
    searchActionIcon: { padding: 8 },
    searchResultItem: {
      flexDirection: "row",
      paddingVertical: 10,
      paddingHorizontal: 15,
      alignItems: "center",
      borderBottomWidth: 1,
      borderBottomColor: colors.separator,
    },
    searchResultImage: {
      width: 50,
      height: 50,
      borderRadius: 4,
      marginRight: 12,
      backgroundColor: "#2a2a2a",
    },
    searchResultTextContainer: { flex: 1 },
    searchResultTitle: { color: colors.text, fontSize: 16, fontWeight: "500" },
    searchResultArtistBase: {
      color: colors.textSecondary,
      fontSize: 13,
      marginTop: 2,
      lineHeight: 16,
    },
    searchResultArtistLink: { color: "#87CEFA" },
    searchResultArtistSeparatorText: { color: colors.textSecondary },
    noResultsText: {
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: 30,
      fontSize: 16,
      paddingHorizontal: 20,
    },
    webSearchActive: {
      backgroundColor: "rgba(255, 102, 0, 0.2)",
      borderRadius: 20,
    },
    sourceTag: {
      backgroundColor: "rgba(255, 102, 0, 0.8)",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 8,
      marginLeft: 10,
    },
    sourceTagText: { color: "#fff", fontSize: 9, fontWeight: "bold" },
    sectionHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingRight: 15,
    },
    viewAllButtonText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: "600",
    },
    expandedControlsContainer: {
      flexDirection: "row",
      alignItems: "center",
    },
    controlIconWrapper: {
      padding: 5,
    },
    expandedListContentContainer: {
      paddingHorizontal: 5,
      paddingBottom: 10,
    },
    gridItemPlaylist: {
      width: (width - 30) / 2,
      marginHorizontal: 7.5,
      marginBottom: 15,
    },
    gridItemAlbum: {
      width: (width - 30) / 2,
      marginHorizontal: 7.5,
      marginBottom: 15,
    },
    gridItemImage: {
      width: "100%",
      height: (width - 30) / 2 - 15,
      borderRadius: 8,
      backgroundColor: "#2a2a2a",
    },
    gridItemTextContainer: {
      marginTop: 8,
      width: "100%",
    },
    gridItemTitle: {
      color: colors.text,
      fontWeight: "600",
      fontSize: 13,
      textAlign: "left",
      marginBottom: 2,
    },
    gridItemSubtitle: {
      color: colors.textSecondary,
      fontSize: 11,
      textAlign: "left",
      lineHeight: 14,
    },
    expandedListItemContainer: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      paddingHorizontal: 10,
      marginHorizontal: 5,
      marginBottom: 6,
      backgroundColor: colors.itemCard,
      borderRadius: 6,
    },
    expandedListItemImage: {
      width: 50,
      height: 50,
      borderRadius: 4,
      marginRight: 12,
      backgroundColor: "#2a2a2a",
    },
    expandedListItemTextInfo: {
      flex: 1,
      justifyContent: "center",
    },
    expandedListItemTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "600",
      marginBottom: 1,
    },
    expandedListItemSubtitle: {
      color: colors.textSecondary,
      fontSize: 12,
    },
    expandedListItemIcon: {
      marginLeft: 10,
      padding: 5,
    },
    settingsBackdrop: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.settingsBackdrop,
      justifyContent: "flex-end",
      zIndex: 1100,
    },
    settingsContainer: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
      paddingBottom: 40,
    },
    settingsHandlebarContainer: {
      alignItems: "center",
      paddingVertical: 12,
    },
    settingsHandlebar: {
      width: 40,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: "#C0C0C0",
    },
    settingsTitle: {
      color: colors.text,
      fontSize: 22,
      fontWeight: "bold",
      textAlign: "center",
      marginBottom: 25,
    },
    settingRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 15,
      borderBottomWidth: 1,
      borderBottomColor: colors.separator,
    },
    settingIcon: {
      marginRight: 15,
    },
    settingLabel: {
      flex: 1,
      fontSize: 16,
      color: colors.text,
    },
    settingControl: {
      flexDirection: "row",
      borderWidth: 1,
      borderColor: colors.separator,
      borderRadius: 8,
      overflow: "hidden",
    },
    themeButton: {
      paddingVertical: 6,
      paddingHorizontal: 15,
    },
    themeButtonActive: {
      backgroundColor: colors.primary,
    },
    themeButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    themeButtonTextActive: {
      color: colors.chipTextSelected,
    },
    settingsCloseButton: {
      marginTop: 30,
      backgroundColor: colors.primary,
      padding: 15,
      borderRadius: 10,
      alignItems: "center",
    },
    settingsCloseButtonText: {
      color: "white",
      fontSize: 16,
      fontWeight: "bold",
    },
    ambienceCircle: {
      width: width * 2,
      height: width * 2,
      borderRadius: width,
      position: "absolute",
    },
    primaryColor: {
      color: colors.primary,
    },
    placeholderText: {
      color: colors.placeholder,
    },
    organicBlob1: {
      width: width * 0.8,
      height: height * 0.4,
      borderRadius: width * 0.4,
      overflow: "hidden",
      position: "absolute",
      top: height * 0.1,
      left: width * 0.1,
    },
    organicBlob2: {
      width: width * 0.6,
      height: height * 0.3,
      borderRadius: width * 0.3,
      overflow: "hidden",
      position: "absolute",
      top: height * 0.4,
      right: width * 0.1,
    },
    organicBlob3: {
      width: width * 0.7,
      height: height * 0.35,
      borderRadius: width * 0.35,
      overflow: "hidden",
      position: "absolute",
      bottom: height * 0.2,
      left: width * 0.15,
    },
    organicBlob4: {
      width: width * 0.5,
      height: height * 0.25,
      borderRadius: width * 0.25,
      overflow: "hidden",
      position: "absolute",
      top: height * 0.6,
      left: width * 0.25,
    },
    realisticBlob1: {
      width: width * 0.9,
      height: height * 0.45,
      borderRadius: width * 0.45,
      overflow: "hidden",
      position: "absolute",
      top: height * 0.05,
      left: width * 0.05,
    },
    realisticBlob2: {
      width: width * 0.7,
      height: height * 0.35,
      borderRadius: width * 0.35,
      overflow: "hidden",
      position: "absolute",
      top: height * 0.35,
      right: width * 0.05,
    },
    realisticBlob3: {
      width: width * 0.8,
      height: height * 0.4,
      borderRadius: width * 0.4,
      overflow: "hidden",
      position: "absolute",
      bottom: height * 0.15,
      left: width * 0.1,
    },
    realisticBlob4: {
      width: width * 0.6,
      height: height * 0.3,
      borderRadius: width * 0.3,
      overflow: "hidden",
      position: "absolute",
      top: height * 0.55,
      left: width * 0.2,
    },
    singleFluidBlob: {
      width: width * 1.2,
      height: height * 0.6,
      borderRadius: width * 0.6,
      overflow: "hidden",
      position: "absolute",
      top: height * 0.2,
      left: -width * 0.1,
    },
    visualModeContainer: {
      marginBottom: 15,
    },
    modeRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 5,
    },
    modeButton: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderRadius: 20,
      borderColor: colors.separator,
      backgroundColor: colors.card,
      flex: 1,
      marginHorizontal: 5,
      justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    modeButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 4,
    },
    modeButtonText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: "600",
      marginLeft: 6,
    },
    modeButtonTextActive: {
      color: colors.chipTextSelected,
      fontWeight: "700",
    },
    modeButtonPlaceholder: {
      flex: 1,
      marginHorizontal: 5,
    },
    modeDescriptionContainer: {
      marginBottom: 15,
      paddingHorizontal: 10,
    },
    modeDescription: {
      color: colors.textSecondary,
      fontSize: 12,
      textAlign: "center",
      fontStyle: "italic",
      lineHeight: 16,
    },
    largeFluidBlob: {
      width: width * 1.8,
      height: height * 1.2,
      borderRadius: width * 0.9,
      overflow: "hidden",
      position: "absolute",
      top: -height * 0.1,
      left: -width * 0.4,
    },
    qualityDropdownButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderRadius: 8,
      borderColor: colors.textSecondary,
      backgroundColor: colors.card,
    },
    qualityDropdownText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "600",
    },
    qualityDropdownOptions: {
      position: "absolute",
      top: 100,
      left: 0,
      right: 0,
      backgroundColor: colors.card,
      borderRadius: 8,
      paddingVertical: 10,
      paddingHorizontal: 15,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 5,
    },
    qualityOption: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 4,
      marginBottom: 5,
    },
    qualityOptionSelected: {
      backgroundColor: colors.primary,
    },
    qualityOptionText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "600",
    },
    qualityOptionTextSelected: {
      color: colors.chipTextSelected,
    },
    tutorialOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.8)",
      justifyContent: "center",
      alignItems: "center",
    },
    tutorialContent: {
      backgroundColor: colors.card,
      borderRadius: 15,
      padding: 20,
      width: "90%",
      alignItems: "center",
    },
    tutorialTitle: {
      fontSize: 22,
      fontWeight: "bold",
      color: colors.text,
      marginBottom: 20,
    },
    tutorialItem: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: 15,
      width: "100%",
    },
    tutorialTextContainer: {
      marginLeft: 15,
      flex: 1,
    },
    tutorialItemTitle: {
      fontSize: 16,
      fontWeight: "bold",
      color: colors.text,
    },
    tutorialItemDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 2,
    },
    tutorialCloseButton: {
      marginTop: 20,
      backgroundColor: colors.primary,
      paddingVertical: 12,
      paddingHorizontal: 30,
      borderRadius: 25,
    },
    tutorialCloseButtonText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "bold",
    },
    playlistItemText: {
      color: colors.text,
      fontSize: 16,
      padding: 15,
      borderBottomWidth: 1,
      borderBottomColor: colors.separator,
    },
    libraryFab: {
      position: "absolute",
      bottom: 55,
      right: 20,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.fab,
      justifyContent: "center",
      alignItems: "center",
      zIndex: 100,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 8,
    },
    libraryModalBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.5)",
      zIndex: 1199,
    },
    libraryModalContainer: {
      flex: 1,
      justifyContent: "flex-end",
      margin: 10,
      marginBottom: 20,
      zIndex: 1200,
    },
    libraryModalContent: {
      backgroundColor: colors.card,
      borderRadius: 20,
      maxHeight: "85%",
      overflow: "hidden",
    },
    libraryModalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.separator,
    },
    libraryModalTitle: {
      fontSize: 22,
      fontWeight: "bold",
      color: colors.text,
    },
    libraryModalCloseButton: {
      padding: 5,
    },
    libraryTabContainer: {
      flexDirection: "row",
      justifyContent: "space-around",
      borderBottomWidth: 1,
      borderBottomColor: colors.separator,
    },
    libraryTab: {
      flex: 1,
      paddingVertical: 15,
      alignItems: "center",
      borderBottomWidth: 2,
      borderBottomColor: "transparent",
    },
    libraryTabActive: {
      borderBottomColor: colors.primary,
    },
    libraryTabText: {
      fontSize: 16,
      color: colors.textSecondary,
      fontWeight: "500",
    },
    libraryTabTextActive: {
      color: colors.primary,
      fontWeight: "700",
    },
    createPlaylistButton: {
      flexDirection: "row",
      alignItems: "center",
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.separator,
    },
    createPlaylistButtonText: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: "600",
      marginLeft: 15,
    },
    libraryPlaylistItem: {
      flexDirection: "row",
      alignItems: "center",
      padding: 15,
      borderBottomWidth: 1,
      borderBottomColor: colors.separator,
    },
    libraryItemTitle: {
      fontSize: 16,
      color: colors.text,
      fontWeight: "600",
    },
    libraryItemSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    librarySongArtwork: {
      width: 45,
      height: 45,
      borderRadius: 4,
      marginRight: 15,
      backgroundColor: "#2a2a2a",
    },
    librarySongInfo: {
      flex: 1,
    },
    libraryEmptyText: {
      textAlign: "center",
      color: colors.textSecondary,
      padding: 30,
      fontSize: 16,
    },
    createPlaylistModalButton: {
      flexDirection: "row",
      alignItems: "center",
      padding: 15,
      borderBottomWidth: 1,
      borderColor: colors.separator,
    },
    createPlaylistModalButtonText: {
      color: colors.primary,
      fontSize: 16,
      marginLeft: 10,
    },
    settingDescription: {
      color: colors.textSecondary,
      fontSize: 12,
      textAlign: "center",
      marginBottom: 10,
    },
    sectionHeader: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "bold",
      paddingHorizontal: 15,
      paddingTop: 15,
      paddingBottom: 10,
      backgroundColor: colors.searchBar,
    },
    searchArtistImage: {
      width: 50,
      height: 50,
      borderRadius: 25, // This makes it a circle
      marginRight: 12,
      backgroundColor: "#2a2a2a",
    },
    artistStickyHeader: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: HEADER_MIN_HEIGHT,
      backgroundColor: colors.header,
      justifyContent: "flex-end",
      alignItems: "center",
      paddingBottom: 12,
      zIndex: 10,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 5,
    },
    artistStickyTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "bold",
    },
    artistHeaderImage: {
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: HEADER_MAX_HEIGHT * 1.5, // Make image taller for parallax
      backgroundColor: colors.card,
    },
    artistHeaderGradient: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      height: "50%",
    },
    artistHeaderTitle: {
      position: "absolute",
      bottom: 20,
      left: 20,
      right: 20,
      color: "white",
      fontSize: 48,
      fontWeight: "bold",
      textShadowColor: "rgba(0, 0, 0, 0.75)",
      textShadowOffset: { width: -1, height: 1 },
      textShadowRadius: 10,
    },
    artistFab: {
      position: "absolute",
      top: HEADER_MAX_HEIGHT - 28,
      right: 20,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: "#1DB954",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 20,
      shadowColor: "#000",
      shadowRadius: 5,
      shadowOpacity: 0.3,
      elevation: 8,
    },
    artistBackButton: {
      position: "absolute",
      top: Platform.OS === "ios" ? 45 : 35,
      left: 15,
      zIndex: 20,
      backgroundColor: "rgba(0,0,0,0.3)",
      borderRadius: 20,
      width: 40,
      height: 40,
      justifyContent: "center",
      alignItems: "center",
    },
    artistSectionContainer: {
      paddingTop: 20,
      backgroundColor: colors.background, // Ensure content has a solid background
    },
    artistSectionTitle: {
      color: colors.text,
      fontSize: 22,
      fontWeight: "bold",
      marginLeft: 15,
      marginBottom: 15,
    },
    popularSongItem: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: 15,
      marginBottom: 10,
    },
    popularSongIndex: {
      color: colors.textSecondary,
      fontSize: 16,
      fontWeight: "bold",
      width: 25,
      textAlign: "center",
    },
    popularSongArtwork: {
      width: 45,
      height: 45,
      borderRadius: 4,
      marginHorizontal: 10,
    },
    popularSongInfo: {
      flex: 1,
    },
    popularSongTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "600",
    },
    popularSongPlayCount: {
      color: colors.textSecondary,
      fontSize: 13,
      marginTop: 2,
    },
    albumGridContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      paddingHorizontal: 15,
    },
    albumGridItem: {
      width: "48%",
      marginBottom: 20,
    },
    albumGridImage: {
      width: "100%",
      height: width / 2 - 30,
      borderRadius: 8,
      backgroundColor: colors.separator,
    },
    albumGridTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "600",
      marginTop: 8,
    },
    albumGridSubtitle: {
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: 2,
    },
    showMoreButton: {
      paddingHorizontal: 15,
      marginTop: 10,
    },
    showMoreButtonText: {
      color: colors.primary,
      fontSize: 15,
      fontWeight: "bold",
    },
    miniPlayer: {
      position: "absolute",
      bottom: Platform.OS === "ios" ? 70 : 150,
      left: "28.7%",
      right: "4%",
      width: "67%",
      backgroundColor: colors.miniPlayer,
      borderWidth: 1,
      borderColor: colors.separator,
      borderRadius: 10,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 8,
      zIndex: 50,
    },
    miniPlayerFullWidth: {
      left: "31%",
      right: "5%",
      width: "65%",
    },
    miniPlayerContent: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      paddingHorizontal: 10,
    },
    miniPlayerArtwork: {
      width: 45,
      height: 45,
      borderRadius: 4,
      backgroundColor: "#2a2a2a",
    },
    // Beautiful AI Mic Button Styles
    aiMicButton: {
      position: "absolute",
      bottom: 50,
      alignSelf: "center",
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.5,
      shadowRadius: 16,
      elevation: 12,
      borderRadius: 30,
      overflow: "hidden",
    },
    aiMicGradient: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 30,
    },
    aiMicContent: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    micIconContainer: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: "rgba(255,255,255,0.2)",
      justifyContent: "center",
      alignItems: "center",
    },
    aiMicText: {
      color: "#FFFFFF",
      fontSize: 18,
      fontWeight: "700",
      letterSpacing: 0.5,
    },
    micSearchBarContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.searchBar,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginHorizontal: 15,
      marginBottom: 15,
    },
    micSearchBar: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      padding: 8,
    },
    searchBarText: {
      color: colors.text,
      fontSize: 16,
    },
    waveOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: 8,
      overflow: "hidden",
    },
    waveGradient: {
      flex: 1,
    },
  });

export default HomeScreen;
