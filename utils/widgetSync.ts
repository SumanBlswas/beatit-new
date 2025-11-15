import { useEffect } from 'react';
import { updateActivity } from 'react-native-widget-extension';
import { usePlayerWithProgress } from '../context/PlayerContext';

/**
 * Hook to sync current playback state to widget shared storage
 * Updates widget data whenever song or playback state changes
 */
export function useWidgetSync() {
  const {
    currentSong,
    isPlaying,
    playbackPosition,
    playbackDuration,
  } = usePlayerWithProgress();

  useEffect(() => {
    // Only sync if a song is loaded
    if (currentSong) {
      updateActivity({
        title: currentSong.title || currentSong.name || '',
        artist: currentSong.primaryArtists || '',
        albumArt:
          Array.isArray(currentSong.image)
            ? currentSong.image[0]?.link || ''
            : currentSong.image || '',
        isPlaying,
        progress:
          playbackDuration > 0
            ? playbackPosition / playbackDuration
            : 0,
      });
    } else {
      updateActivity({
        title: '',
        artist: '',
        albumArt: '',
        isPlaying: false,
        progress: 0,
      });
    }
  }, [currentSong, isPlaying, playbackPosition, playbackDuration]);
}
