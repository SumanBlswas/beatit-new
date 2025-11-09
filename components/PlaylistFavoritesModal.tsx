import { FontAwesome } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Animated, Dimensions, FlatList, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const { width, height } = Dimensions.get('window');

interface Playlist {
  id: string;
  name: string;
  songs?: any[];
}

interface Song {
  id: string;
  name: string;
  [key: string]: any;
}

interface PlaylistFavoritesModalProps {
  visible: boolean;
  onClose: () => void;
  playlists: Playlist[];
  favorites: Song[];
  onAddToPlaylist: (playlistId: string, song: Song) => void;
  onRemoveFromPlaylist: (playlistId: string, songId: string) => void;
  onRemoveFavorite: (songId: string) => void;
  theme: 'light' | 'dark';
}

const getColors = (theme: 'light' | 'dark') =>
  theme === 'light'
    ? {
        background: '#f7f7f7',
        card: '#fff',
        text: '#222',
        border: '#e0e0e0',
        chevron: '#888',
        close: '#888',
        shadow: '#000',
      }
    : {
        background: '#232323',
        card: '#2d2d2d',
        text: '#f7f7f7',
        border: '#444',
        chevron: '#aaa',
        close: '#aaa',
        shadow: '#000',
      };

const PlaylistFavoritesModal: React.FC<PlaylistFavoritesModalProps> = ({
  visible,
  onClose,
  playlists,
  favorites,
  onAddToPlaylist,
  onRemoveFromPlaylist,
  onRemoveFavorite,
  theme,
}) => {
  const colors = getColors(theme);
  const [chevronOpacity] = useState(new Animated.Value(0.2));

  const handleChevronPressIn = () => {
    Animated.timing(chevronOpacity, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
  };
  const handleChevronPressOut = () => {
    Animated.timing(chevronOpacity, {
      toValue: 0.2,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={[styles.backdrop, { backgroundColor: theme === 'dark' ? 'rgba(20,20,20,0.7)' : 'rgba(240,240,240,0.7)' }]}/>
      <View style={[styles.container, { backgroundColor: colors.background, borderColor: colors.border, shadowColor: colors.shadow }]}>  
        {/* Close Button */}
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <FontAwesome name="close" size={26} color={colors.close} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Your Playlists</Text>
        <FlatList
          data={playlists}
          keyExtractor={item => item.id}
          style={styles.list}
          contentContainerStyle={{ paddingBottom: 20 }}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}> 
              <Text style={[styles.cardTitle, { color: colors.text }]}>{item.name}</Text>
              {/* TODO: Add song list and add/remove logic */}
              <Text style={[styles.cardSubtitle, { color: colors.text, opacity: 0.7 }]}>Songs: {item.songs?.length || 0}</Text>
              {/* Example remove button for playlist (optional) */}
            </View>
          )}
          ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.text, opacity: 0.6 }]}>No playlists yet.</Text>}
        />
        <Text style={[styles.title, { color: colors.text, marginTop: 10 }]}>Favorites</Text>
        <FlatList
          data={favorites}
          keyExtractor={item => item.id}
          style={styles.list}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: 'row', alignItems: 'center' }]}> 
              <Text style={[styles.cardTitle, { color: colors.text, flex: 1 }]} numberOfLines={1}>{item.name}</Text>
              <TouchableOpacity onPress={() => onRemoveFavorite(item.id)}>
                <FontAwesome name="heart" size={20} color={colors.close} style={{ marginLeft: 10 }} />
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.text, opacity: 0.6 }]}>No favorites yet.</Text>}
        />
        {/* Floating Chevron Arrow */}
        <Pressable
          style={styles.chevronContainer}
          onPressIn={handleChevronPressIn}
          onPressOut={handleChevronPressOut}
        >
          <Animated.View style={{ opacity: chevronOpacity }}>
            <FontAwesome name="chevron-right" size={32} color={colors.chevron} />
          </Animated.View>
        </Pressable>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  container: {
    position: 'absolute',
    top: 30,
    left: 15,
    right: 15,
    bottom: 30,
    borderRadius: 22,
    borderWidth: 1,
    zIndex: 2,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
    paddingTop: 24,
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    backgroundColor: 'transparent',
    padding: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  list: {
    maxHeight: height * 0.22,
    marginBottom: 8,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 13,
    fontWeight: '400',
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    marginVertical: 10,
  },
  chevronContainer: {
    position: 'absolute',
    right: -18,
    top: '50%',
    marginTop: -24,
    backgroundColor: 'transparent',
    zIndex: 20,
    padding: 6,
    borderRadius: 20,
  },
});

export default PlaylistFavoritesModal; 