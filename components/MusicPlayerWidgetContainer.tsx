import { usePlayer, useProgress } from '@/context/PlayerContext';
import React from 'react';
import MusicPlayerWidget from './MusicPlayerWidget';

const MusicPlayerWidgetContainer: React.FC = () => {
  const {
    currentSong,
    isPlaying,
    nextSong,
    previousSong,
    togglePlayPause,
  } = usePlayer();
  const { playbackPosition, playbackDuration } = useProgress();

  // Calculate progress as a fraction (0 to 1)
  const progress = playbackDuration > 0 ? playbackPosition / playbackDuration : 0;

  // Get album art (handle array or string)
  let albumArt = '';
  if (Array.isArray(currentSong?.image)) {
    albumArt = currentSong.image[0]?.link || '';
  } else if (typeof currentSong?.image === 'string') {
    albumArt = currentSong.image;
  }

  // Get artist (handle array or string)
  let artist = '';
  if (typeof currentSong?.primaryArtists === 'string') {
    artist = currentSong.primaryArtists;
  } else if (Array.isArray(currentSong?.primaryArtists)) {
    artist = currentSong.primaryArtists.map((a: any) => a.name || a).join(', ');
  }

  return (
    <MusicPlayerWidget
      songTitle={currentSong?.title || currentSong?.name}
      artist={artist}
      albumArt={albumArt}
      isPlaying={isPlaying}
      progress={progress}
      onPlayPause={togglePlayPause}
      onNext={nextSong}
      onPrev={previousSong}
      onOpenApp={() => {}}
    />
  );
};

export default MusicPlayerWidgetContainer;
