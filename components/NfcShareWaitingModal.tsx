// components/NfcShareWaitingModal.tsx

/**
 * NFC Share Waiting Modal
 * Displays while waiting for NFC tap to complete share operation
 */

import FontAwesome from '@expo/vector-icons/FontAwesome';
import React from 'react';
import {
    ActivityIndicator,
    Animated,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { NfcShareState } from '../services/nfc/nfcTypes';

interface NfcShareWaitingModalProps {
  visible: boolean;
  shareState: NfcShareState;
  onCancel: () => void;
  onClose: () => void;
  songTitle?: string;
}

export const NfcShareWaitingModal: React.FC<NfcShareWaitingModalProps> = ({
  visible,
  shareState,
  onCancel,
  onClose,
  songTitle = 'this song',
}) => {
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (shareState === 'waiting') {
      // Start pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [shareState, pulseAnim]);

  const getContent = () => {
    switch (shareState) {
      case 'waiting':
        return {
          icon: 'wifi',
          title: 'Waiting for NFC Tap',
          message: `Tap another device to the back of your phone to share "${songTitle}"`,
          color: '#1DB954',
          showCancel: true,
          showLoader: true,
        };
      case 'success':
        return {
          icon: 'check-circle',
          title: 'Shared Successfully!',
          message: 'The song has been shared via NFC',
          color: '#1DB954',
          showCancel: false,
          showLoader: false,
        };
      case 'error':
        return {
          icon: 'exclamation-triangle',
          title: 'Share Failed',
          message: 'Failed to share via NFC. Please try again.',
          color: '#E74C3C',
          showCancel: false,
          showLoader: false,
        };
      case 'cancelled':
        return {
          icon: 'times-circle',
          title: 'Share Cancelled',
          message: 'NFC share operation was cancelled',
          color: '#95A5A6',
          showCancel: false,
          showLoader: false,
        };
      default:
        return null;
    }
  };

  const content = getContent();

  if (!content) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (shareState === 'waiting') {
          onCancel();
        } else {
          onClose();
        }
      }}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Animated.View
            style={[
              styles.iconContainer,
              { backgroundColor: content.color },
              shareState === 'waiting' && { transform: [{ scale: pulseAnim }] },
            ]}
          >
            <FontAwesome name={content.icon as any} size={48} color="#fff" />
          </Animated.View>

          <Text style={styles.title}>{content.title}</Text>
          <Text style={styles.message}>{content.message}</Text>

          {content.showLoader && (
            <ActivityIndicator
              size="large"
              color={content.color}
              style={styles.loader}
            />
          )}

          <View style={styles.buttonContainer}>
            {content.showCancel ? (
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={onCancel}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.button, { backgroundColor: content.color }]}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={styles.buttonText}>OK</Text>
              </TouchableOpacity>
            )}
          </View>

          {shareState === 'waiting' && (
            <View style={styles.instructionContainer}>
              <FontAwesome name="mobile-phone" size={32} color="#666" />
              <Text style={styles.arrowText}> ⟷ </Text>
              <FontAwesome name="mobile-phone" size={32} color="#666" />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 30,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: '#aaa',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  loader: {
    marginVertical: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    marginTop: 10,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 25,
    minWidth: 120,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#555',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  instructionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
  },
  arrowText: {
    fontSize: 24,
    color: '#666',
    marginHorizontal: 16,
  },
});
