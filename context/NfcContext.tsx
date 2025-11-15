// context/NfcContext.tsx

/**
 * NFC Context Provider
 * Manages NFC state, handles tag reading, and integrates with PlayerContext
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Alert, AppState, Linking, Platform } from 'react-native';
import { BeautifulAlert } from '../components/BeautifulAlert';
import { ApiSong } from '../services/apiTypes';
import * as downloadService from '../services/downloadService';
import {
    startNfcListener,
    stopNfcListener,
    validateNfcPayload,
} from '../services/nfc/guestNfc';
import {
    cancelNfcOperation,
    initializeNfc,
    isNfcEnabled,
    openNfcSettings,
    writeNfcPayload,
} from '../services/nfc/hostNfc';
import { NfcPayload, NfcShareState } from '../services/nfc/nfcTypes';
import { usePlayer } from './PlayerContext';

// Settings keys
const NFC_AUTO_ACCEPT_KEY = 'nfc_auto_accept';
const NFC_ENABLED_KEY = 'nfc_enabled';

interface NfcContextType {
  // State
  nfcSupported: boolean;
  nfcEnabled: boolean;
  nfcListening: boolean;
  shareState: NfcShareState;
  autoAcceptNfc: boolean;
  lastReceivedPayload: NfcPayload | null;
  
  // Host (sharing) functions
  shareViaNfc: (songId: string) => Promise<void>;
  cancelShare: () => Promise<void>;
  
  // Guest (receiving) functions
  enableNfcListener: () => Promise<void>;
  disableNfcListener: () => Promise<void>;
  
  // Settings
  setAutoAcceptNfc: (enabled: boolean) => Promise<void>;
  checkNfcStatus: () => Promise<void>;
  openNfcSettingsApp: () => Promise<void>;
  
  // Manual handling
  handleNfcUrl: (url: string) => Promise<void>;
}

const NfcContext = createContext<NfcContextType | undefined>(undefined);

interface AlertConfig {
  visible: boolean;
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  buttons: {
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
  }[];
}

export const NfcProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { playSong, queue } = usePlayer();
  
  const [nfcSupported, setNfcSupported] = useState(false);
  const [nfcEnabled, setNfcEnabled] = useState(false);
  const [nfcListening, setNfcListening] = useState(false);
  const [shareState, setShareState] = useState<NfcShareState>('idle');
  const [autoAcceptNfc, setAutoAcceptNfcState] = useState(false);
  const [lastReceivedPayload, setLastReceivedPayload] = useState<NfcPayload | null>(null);
  
  // Beautiful Alert state
  const [alertConfig, setAlertConfig] = useState<AlertConfig>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
    buttons: [{ text: 'OK' }],
  });

  const showAlert = useCallback((config: Omit<AlertConfig, 'visible'>) => {
    setAlertConfig({ ...config, visible: true });
  }, []);

  const hideAlert = useCallback(() => {
    setAlertConfig(prev => ({ ...prev, visible: false }));
  }, []);
  
  /**
   * Initialize NFC on mount
   */
  useEffect(() => {
    const initNfc = async () => {
      if (Platform.OS !== 'android') {
        console.log('NFC is only supported on Android');
        return;
      }
      
      console.log('Initializing NFC...');
      const supported = await initializeNfc();
      console.log('NFC supported:', supported);
      setNfcSupported(supported);
      
      if (!supported) {
        console.warn('⚠️ NFC NOT SUPPORTED - You are likely using Expo Go!');
        console.warn('📱 To use NFC, build a development build:');
        console.warn('   eas build --profile development --platform android');
        console.warn('   OR: npx expo run:android');
      }
      
      if (supported) {
        const enabled = await isNfcEnabled();
        console.log('NFC enabled:', enabled);
        setNfcEnabled(enabled);
        
        // Load settings
        const autoAccept = await AsyncStorage.getItem(NFC_AUTO_ACCEPT_KEY);
        setAutoAcceptNfcState(autoAccept === 'true');
        
        const nfcEnabledSetting = await AsyncStorage.getItem(NFC_ENABLED_KEY);
        if (nfcEnabledSetting !== 'false' && enabled) {
          // Auto-start NFC listener if enabled
          console.log('Starting NFC listener...');
          startNfcListener(onNfcTagReceived).then(() => {
            console.log('NFC listener started successfully');
            setNfcListening(true);
          }).catch((error) => {
            console.error('Failed to start NFC listener:', error);
          });
        }
      } else {
        console.warn('NFC initialization failed - you may be using Expo Go. Build a dev build to use NFC.');
      }
    };
    
    initNfc();
    
    // Clean up on unmount
    return () => {
      stopNfcListener().catch(console.error);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  /**
   * Handle app state changes (restart NFC listener when app comes to foreground)
   */
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'active' && nfcSupported) {
        // Re-check NFC status when app becomes active
        const enabled = await isNfcEnabled();
        const wasEnabled = nfcEnabled;
        
        console.log('App became active. NFC was enabled:', wasEnabled, ', now enabled:', enabled);
        setNfcEnabled(enabled);
        
        // Show helpful message if NFC was just enabled
        if (!wasEnabled && enabled) {
          showAlert({
            title: 'NFC Enabled',
            message: 'NFC is now enabled! You can now share songs with other devices.',
            type: 'success',
            buttons: [{ text: 'Great!', style: 'default' }],
          });
        }
        
        // Restart listener if it was enabled before
        const nfcEnabledSetting = await AsyncStorage.getItem(NFC_ENABLED_KEY);
        if (nfcEnabledSetting !== 'false' && enabled && !nfcListening) {
          console.log('Restarting NFC listener...');
          startNfcListener(onNfcTagReceived).then(() => {
            console.log('NFC listener restarted');
            setNfcListening(true);
          }).catch((error) => {
            console.error('Failed to restart NFC listener:', error);
          });
        }
      }
    });
    
    return () => {
      subscription.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nfcSupported, nfcEnabled, nfcListening, showAlert]);
  
  /**
   * Find song by ID in downloaded songs or queue
   */
  const findSongById = useCallback(async (songId: string): Promise<ApiSong | undefined> => {
    // First check downloaded songs
    const downloadedSongs = await downloadService.getDownloadedSongs();
    const downloadedSong = downloadedSongs.find((s) => s.id === songId);
    
    if (downloadedSong) {
      // Return as ApiSong (DownloadedSong extends ApiSong)
      return downloadedSong as ApiSong;
    }
    
    // Check current queue
    const queueSong = queue.find((s) => s.id === songId);
    
    return queueSong;
  }, [queue]);
  
  /**
   * Handle deep link URLs from NFC intents
   */
  const handleNfcUrl = useCallback(async (url: string) => {
    try {
      // Parse URL to extract payload
      const urlObj = new URL(url);
      const params = urlObj.searchParams;
      
      const session = params.get('session');
      const songId = params.get('songId');
      const expiry = params.get('expiry');
      
      if (!session || !songId || !expiry) {
        Alert.alert('Error', 'Invalid NFC link');
        return;
      }
      
      const payload: NfcPayload = {
        session,
        songId,
        expiry: parseInt(expiry, 10),
      };
      
      const sig = params.get('sig');
      const secretPublic = params.get('secretPublic');
      
      if (sig) payload.sig = sig;
      if (secretPublic) payload.secretPublic = secretPublic;
      
      // Validate payload
      const validation = await validateNfcPayload(payload);
      
      if (!validation.valid) {
        Alert.alert('Error', validation.error || 'Invalid NFC payload');
        return;
      }
      
      // Handle the validated payload - playSongFromNfc will be called
      setLastReceivedPayload(payload);
      
      if (autoAcceptNfc) {
        // Auto-play without confirmation
        const song = await findSongById(payload.songId);
        if (!song) {
          Alert.alert(
            'Song Not Available',
            'This song is not available locally. Please download it first or ensure it is in your current playlist.',
            [{ text: 'OK' }]
          );
          return;
        }
        await playSong(song);
        Alert.alert(
          '🎵 Playing Shared Song',
          `Now playing: ${song.name || song.title}`,
          [{ text: 'OK' }]
        );
      } else {
        // Show confirmation prompt
        Alert.alert(
          '🎵 NFC Song Share',
          'Someone wants to share a song with you. Play it now?',
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Play',
              onPress: async () => {
                const song = await findSongById(payload.songId);
                if (!song) {
                  Alert.alert(
                    'Song Not Available',
                    'This song is not available locally.',
                    [{ text: 'OK' }]
                  );
                  return;
                }
                await playSong(song);
                Alert.alert(
                  '🎵 Playing Shared Song',
                  `Now playing: ${song.name || song.title}`,
                  [{ text: 'OK' }]
                );
              },
            },
          ]
        );
      }
    } catch {
      Alert.alert('Error', 'Failed to process NFC link');
    }
  }, [autoAcceptNfc, findSongById, playSong]);
  
  useEffect(() => {
    const handleUrl = async (event: { url: string }) => {
      if (event.url.startsWith('beatit://nfc/pair')) {
        await handleNfcUrl(event.url);
      }
    };
    
    // Handle initial URL (app opened via NFC)
    Linking.getInitialURL().then((url) => {
      if (url && url.startsWith('beatit://nfc/pair')) {
        handleNfcUrl(url);
      }
    });
    
    // Handle URL while app is running
    const subscription = Linking.addEventListener('url', handleUrl);
    
    return () => {
      subscription.remove();
    };
  }, [handleNfcUrl]);
  
  /**
   * Check NFC status
   */
  const checkNfcStatus = useCallback(async () => {
    if (!nfcSupported) return;
    
    const enabled = await isNfcEnabled();
    setNfcEnabled(enabled);
  }, [nfcSupported]);
  
  /**
   * Open NFC settings
   */
  const openNfcSettingsApp = useCallback(async () => {
    try {
      await openNfcSettings();
    } catch {
      Alert.alert('Error', 'Failed to open NFC settings');
    }
  }, []);
  
  /**
   * Play song from NFC payload
   */
  const playSongFromNfc = useCallback(async (payload: NfcPayload) => {
    try {
      const song = await findSongById(payload.songId);
      
      if (!song) {
        Alert.alert(
          'Song Not Available',
          'This song is not available locally. Please download it first or ensure it is in your current playlist.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      // Play the song
      await playSong(song);
      
      // Show confirmation
      Alert.alert(
        '🎵 Playing Shared Song',
        `Now playing: ${song.name || song.title}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Failed to play song from NFC:', error);
      Alert.alert('Error', 'Failed to play the shared song');
    }
  }, [findSongById, playSong]);
  
  /**
   * Handle NFC tag received (guest side)
   */
  const onNfcTagReceived = useCallback(async (payload: NfcPayload) => {
    setLastReceivedPayload(payload);
    
    if (autoAcceptNfc) {
      // Auto-play without confirmation
      await playSongFromNfc(payload);
    } else {
      // Show confirmation prompt
      showAlert({
        title: '🎵 NFC Song Share',
        message: 'Someone wants to share a song with you. Would you like to play it now?',
        type: 'info',
        buttons: [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Play', 
            style: 'default',
            onPress: async () => {
              await playSongFromNfc(payload);
            },
          },
        ],
      });
    }
  }, [autoAcceptNfc, playSongFromNfc, showAlert]);
  
  /**
   * Enable NFC listener (guest side)
   */
  const enableNfcListener = useCallback(async () => {
    if (!nfcSupported) {
      showAlert({
        title: 'NFC Not Supported',
        message: 'NFC is not supported on this device or you are using Expo Go. Please build a development build.',
        type: 'warning',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      return;
    }
    
    if (!nfcEnabled) {
      showAlert({
        title: 'NFC Disabled',
        message: 'Please enable NFC in your device settings to receive shared songs.',
        type: 'warning',
        buttons: [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', style: 'default', onPress: openNfcSettingsApp },
        ],
      });
      return;
    }
    
    try {
      await startNfcListener(onNfcTagReceived);
      setNfcListening(true);
      await AsyncStorage.setItem(NFC_ENABLED_KEY, 'true');
    } catch (error) {
      console.error('Failed to enable NFC listener:', error);
      showAlert({
        title: 'Error',
        message: 'Failed to enable NFC listener. Please try again.',
        type: 'error',
        buttons: [{ text: 'OK', style: 'default' }],
      });
    }
  }, [nfcSupported, nfcEnabled, onNfcTagReceived, openNfcSettingsApp, showAlert]);
  
  /**
   * Disable NFC listener
   */
  const disableNfcListener = useCallback(async () => {
    try {
      await stopNfcListener();
      setNfcListening(false);
      await AsyncStorage.setItem(NFC_ENABLED_KEY, 'false');
    } catch (error) {
      console.error('Failed to disable NFC listener:', error);
    }
  }, []);
  
  /**
   * Share song via NFC (host side)
   */
  const shareViaNfc = useCallback(async (songId: string) => {
    if (!nfcSupported) {
      showAlert({
        title: 'NFC Not Available',
        message: 'NFC is not available. This usually means:\n\n• You are using Expo Go (not supported)\n• NFC hardware is not present\n\nPlease build a development build using:\n\neas build --profile development --platform android',
        type: 'warning',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      return;
    }
    
    // Re-check NFC status in real-time
    const currentlyEnabled = await isNfcEnabled();
    console.log('NFC currently enabled:', currentlyEnabled);
    
    if (!currentlyEnabled) {
      setNfcEnabled(false);
      showAlert({
        title: 'NFC Disabled',
        message: 'NFC is currently disabled on your device. Please enable it in Settings to share songs.',
        type: 'warning',
        buttons: [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', style: 'default', onPress: openNfcSettingsApp },
        ],
      });
      return;
    }
    
    // Update state if it was stale
    if (!nfcEnabled) {
      setNfcEnabled(true);
    }
    
    // Store listener state to restore it later
    const wasListening = nfcListening;
    
    try {
      console.log('Starting NFC write operation for song:', songId);
      setShareState('waiting');
      
      // CRITICAL: Stop the NFC listener before writing
      // NFC Manager can only handle one operation at a time
      if (wasListening) {
        console.log('Temporarily stopping NFC listener for write operation...');
        await stopNfcListener();
        setNfcListening(false);
        
        // Wait a bit to ensure the listener is fully released
        console.log('Waiting for NFC to be fully released...');
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      // Now write the payload
      await writeNfcPayload(songId);
      
      console.log('NFC write successful');
      setShareState('success');
      
      // Reset state after 2 seconds
      setTimeout(() => {
        setShareState('idle');
      }, 2000);
      
      showAlert({
        title: 'Ready to Share!',
        message: 'Hold another NFC-enabled device close to the back of this phone to share this song.',
        type: 'success',
        buttons: [{ text: 'Got it', style: 'default' }],
      });
    } catch (error: any) {
      console.error('Failed to share via NFC:', error);
      console.error('Error details:', JSON.stringify(error));
      console.error('Error constructor name:', error?.constructor?.name);
      
      // Check if operation was cancelled by user
      const wasCancelled = error?.constructor?.name === 'UserCancel' ||
                          error?.message?.includes('cancelled') || 
                          error?.message?.includes('cancel') ||
                          error?.toString()?.toLowerCase()?.includes('cancel');
      
      if (wasCancelled) {
        console.log('NFC operation was cancelled by user - no error alert needed');
        setShareState('cancelled');
        setTimeout(() => {
          setShareState('idle');
        }, 1000);
        return; // Don't show error alert for user cancellation
      }
      
      // Show error state for actual errors
      setShareState('error');
      
      setTimeout(() => {
        setShareState('idle');
      }, 2000);
      
      // Show more specific error message
      let errorMessage = 'Failed to initiate NFC sharing. ';
      
      if (error?.message?.includes('not supported')) {
        errorMessage += 'You may be using Expo Go. Please build a development build.';
      } else if (error?.message?.includes('timeout')) {
        errorMessage += 'Timeout - no NFC tag detected.';
      } else if (error?.message?.includes('one request at a time')) {
        errorMessage += 'NFC is busy. Please try again.';
      } else {
        errorMessage += 'Make sure:\n\n1. NFC is enabled in Settings\n2. No other apps are using NFC\n3. You built a development build (not Expo Go)';
      }
      
      showAlert({
        title: 'NFC Error',
        message: errorMessage,
        type: 'error',
        buttons: [{ text: 'OK', style: 'default' }],
      });
    } finally {
      // CRITICAL: Restart the listener if it was running before
      if (wasListening) {
        console.log('Restarting NFC listener after write operation...');
        try {
          await startNfcListener(onNfcTagReceived);
          setNfcListening(true);
          console.log('NFC listener restarted successfully');
        } catch (error) {
          console.error('Failed to restart NFC listener:', error);
        }
      }
    }
  }, [nfcSupported, nfcEnabled, nfcListening, onNfcTagReceived, openNfcSettingsApp, showAlert]);
  
  /**
   * Cancel NFC share operation
   */
  const cancelShare = useCallback(async () => {
    try {
      await cancelNfcOperation();
      setShareState('cancelled');
      
      setTimeout(() => {
        setShareState('idle');
      }, 1000);
    } catch (error) {
      console.error('Failed to cancel NFC operation:', error);
    }
  }, []);
  
  /**
   * Set auto-accept NFC setting
   */
  const setAutoAcceptNfc = useCallback(async (enabled: boolean) => {
    setAutoAcceptNfcState(enabled);
    await AsyncStorage.setItem(NFC_AUTO_ACCEPT_KEY, enabled.toString());
  }, []);
  
  const value: NfcContextType = {
    nfcSupported,
    nfcEnabled,
    nfcListening,
    shareState,
    autoAcceptNfc,
    lastReceivedPayload,
    shareViaNfc,
    cancelShare,
    enableNfcListener,
    disableNfcListener,
    setAutoAcceptNfc,
    checkNfcStatus,
    openNfcSettingsApp,
    handleNfcUrl,
  };
  
  return (
    <NfcContext.Provider value={value}>
      {children}
      <BeautifulAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        buttons={alertConfig.buttons.map(btn => ({
          ...btn,
          onPress: () => {
            btn.onPress?.();
            hideAlert();
          }
        }))}
        onClose={hideAlert}
      />
    </NfcContext.Provider>
  );
};

/**
 * Custom hook to use NFC context
 */
export const useNfc = (): NfcContextType => {
  const context = useContext(NfcContext);
  if (!context) {
    throw new Error('useNfc must be used within an NfcProvider');
  }
  return context;
};
