# Suman Music App

A React Native music streaming application with YouTube integration.

## Features

- **Music Streaming**: Stream music from various sources
- **YouTube Integration**: Search and play YouTube music videos directly in the app
- **Multi-language Support**: Support for multiple Indian languages
- **Dark/Light Theme**: Customizable appearance modes
- **Gesture Controls**: Tap, swipe, and long-press gestures for music control
- **NFC Support**: Tap NFC tags to control playback
- **Accelerometer Controls**: Shake device to skip songs
- **Search**: Search local music library and YouTube videos
- **Playlists & Albums**: Browse and play music collections
- **Artist Pages**: View artist details and top songs

## YouTube Integration

The app now includes YouTube video playback functionality:

1. **YouTube Search**: Toggle the globe/YouTube icon in the search bar to switch between local music search and YouTube search
2. **Video Playback**: Click on any YouTube result to open the video player
3. **Full-screen Mode**: Videos play in full-screen mode with controls
4. **Popular Songs**: Pre-loaded popular music videos for quick access

### How to Use YouTube Search

1. Open the search overlay (tap the search icon)
2. Tap the globe icon to switch to YouTube search mode (icon changes to YouTube)
3. Type your search query
4. Results will show YouTube videos with a "YT" badge
5. Tap any result to play the video in the built-in player

## Installation

```bash
npm install
npx expo start
```

## Dependencies

- React Native
- Expo
- react-native-webview (for YouTube player)
- react-native-gesture-handler
- react-native-reanimated
- @react-native-async-storage/async-storage
- expo-haptics
- expo-sensors
- react-native-nfc-manager

## API Integration

The app uses the Suman API for music data and DuckDuckGo API for YouTube search results.

## License

MIT License
# beatit
