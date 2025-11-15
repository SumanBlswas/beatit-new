import { NativeModules, Platform } from 'react-native';

const { PlaybackInfoModule } = NativeModules;

export async function updateMusicWidget({ songTitle, artist, albumArtPath, isPlaying, progress }) {
  if (Platform.OS !== 'android' || !PlaybackInfoModule) return;
  return new Promise((resolve) => {
    PlaybackInfoModule.setPlaybackInfo(
      {
        songTitle: songTitle || '',
        artist: artist || '',
        albumArtPath: albumArtPath || '',
        isPlaying: !!isPlaying,
        progress: Math.round((progress || 0) * 100),
      },
      (result) => {
        resolve(result);
        // Send broadcast to update widget
        if (Platform.OS === 'android') {
          try {
            const intent = new global.android.content.Intent('android.appwidget.action.APPWIDGET_UPDATE');
            intent.setPackage(global.android.context.getPackageName());
            global.android.context.sendBroadcast(intent);
          } catch (e) {
            // Ignore if not available
          }
        }
      }
    );
  });
}
