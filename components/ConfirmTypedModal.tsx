import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

interface ConfirmTypedModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmWord: string;
  confirmButtonText?: string;
  cancelButtonText?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  dangerMode?: boolean;
}

export const ConfirmTypedModal: React.FC<ConfirmTypedModalProps> = ({
  visible,
  title,
  message,
  confirmWord,
  confirmButtonText = 'Confirm',
  cancelButtonText = 'Cancel',
  onConfirm,
  onCancel,
  dangerMode = true,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);

  const isConfirmEnabled = inputValue.toUpperCase() === confirmWord.toUpperCase();

  const handleConfirm = async () => {
    if (!isConfirmEnabled || loading) return;
    
    setLoading(true);
    try {
      await onConfirm();
    } catch (error) {
      console.error('Confirm action error:', error);
    } finally {
      setLoading(false);
      setInputValue('');
    }
  };

  const handleCancel = () => {
    setInputValue('');
    onCancel();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity 
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleCancel}
        >
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
        </TouchableOpacity>

        <View style={styles.modalContainer}>
          <LinearGradient
            colors={dangerMode ? ['#ff0044', '#ff0066', '#cc0055'] : ['#6366f1', '#8b5cf6', '#a855f7']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientBorder}
          >
            <View style={styles.modalContent}>
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.title}>{title}</Text>
              </View>

              {/* Message */}
              <Text style={styles.message}>{message}</Text>

              {/* Confirmation instruction */}
              <Text style={styles.instruction}>
                Type <Text style={styles.confirmWordHighlight}>{confirmWord}</Text> to confirm
              </Text>

              {/* Input */}
              <View style={styles.inputContainer}>
                <TextInput
                  style={[
                    styles.input,
                    isConfirmEnabled && styles.inputValid
                  ]}
                  value={inputValue}
                  onChangeText={setInputValue}
                  placeholder={`Type "${confirmWord}" here`}
                  placeholderTextColor="#666"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  editable={!loading}
                />
              </View>

              {/* Buttons */}
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleCancel}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <View style={styles.cancelButtonContent}>
                    <Text style={styles.cancelButtonIcon}>✕</Text>
                    <Text style={styles.cancelButtonText}>{cancelButtonText}</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.confirmButton,
                    !isConfirmEnabled && styles.confirmButtonDisabled,
                    dangerMode && styles.confirmButtonDanger
                  ]}
                  onPress={handleConfirm}
                  disabled={!isConfirmEnabled || loading}
                  activeOpacity={0.7}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.confirmButtonText}>{confirmButtonText}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </LinearGradient>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContainer: {
    width: '85%',
    maxWidth: 400,
    borderRadius: 24,
    overflow: 'hidden',
  },
  gradientBorder: {
    padding: 2,
    borderRadius: 24,
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 22,
    padding: 24,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#ccc',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
  },
  instruction: {
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
    marginBottom: 16,
  },
  confirmWordHighlight: {
    color: '#ff0066',
    fontWeight: 'bold',
    fontSize: 16,
  },
  inputContainer: {
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderWidth: 2,
    borderColor: '#333',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
  },
  inputValid: {
    borderColor: '#00ff88',
    backgroundColor: '#002211',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#333',
    borderRadius: 12,
    padding: 16,
      alignItems: 'center',
      justifyContent: 'center',
  },
    cancelButtonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    cancelButtonIcon: {
      fontSize: 18,
      color: '#fff',
      marginRight: 2,
      textAlignVertical: 'center',
      textAlign: 'center',
    },
  cancelButtonText: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '600',
      letterSpacing: 0.2,
      textAlign: 'center',
  },
  confirmButton: {
     flex: 1,
     backgroundColor: '#6366f1',
     borderRadius: 12,
     padding: 16,
     alignItems: 'center',
     justifyContent: 'center',
  },
  confirmButtonDanger: {
    backgroundColor: '#ff0066',
  },
  confirmButtonDisabled: {
    backgroundColor: '#444',
    opacity: 0.5,
  },
  confirmButtonText: {
     color: '#fff',
     fontSize: 13,
     fontWeight: '600',
     letterSpacing: 0.2,
     textAlign: 'center',
  },
});
