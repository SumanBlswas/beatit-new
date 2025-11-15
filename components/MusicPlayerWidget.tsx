import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export type MusicPlayerWidgetProps = {
  songTitle?: string;
  artist?: string;
  albumArt?: string;
  isPlaying?: boolean;
  progress?: number;
  onPlayPause?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onOpenApp?: () => void;
};

const MusicPlayerWidget: React.FC<MusicPlayerWidgetProps> = ({
  songTitle,
  artist,
  albumArt,
  isPlaying,
  progress = 0,
  onPlayPause,
  onNext,
  onPrev,
  onOpenApp,
}) => (
  <TouchableOpacity style={styles.container} onPress={onOpenApp} activeOpacity={0.8}>
    <Image
      source={albumArt ? { uri: albumArt } : require('../assets/images/icon.png')}
      style={styles.artwork}
    />
    <View style={styles.info}>
      <Text style={styles.title}>{songTitle || 'No song playing'}</Text>
      <Text style={styles.artist}>{artist || ''}</Text>
      <View style={styles.controls}>
        <TouchableOpacity onPress={onPrev}><Text style={styles.controlIcon}>⏮️</Text></TouchableOpacity>
        <TouchableOpacity onPress={onPlayPause}><Text style={styles.controlIcon}>{isPlaying ? '⏸️' : '▶️'}</Text></TouchableOpacity>
        <TouchableOpacity onPress={onNext}><Text style={styles.controlIcon}>⏭️</Text></TouchableOpacity>
      </View>
      <View style={styles.progressBar}>
        <View style={[styles.progress, { width: `${Math.round(progress * 100)}%` }]} />
      </View>
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    padding: 10,
    borderRadius: 12,
    minWidth: 250,
    minHeight: 100,
  },
  artwork: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#333',
  },
  info: {
    flex: 1,
    marginLeft: 10,
  },
  title: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  artist: {
    color: '#aaa',
    fontSize: 14,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    width: 120,
  },
  controlIcon: {
    fontSize: 20,
    color: '#fff',
    marginHorizontal: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#444',
    borderRadius: 2,
    marginTop: 8,
    width: '100%',
  },
  progress: {
    height: 4,
    backgroundColor: '#1db954',
    borderRadius: 2,
  },
});

export default MusicPlayerWidget;
