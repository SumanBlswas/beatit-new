// components/NfcShareButton.tsx

/**
 * NFC Share Button Component
 * Button to initiate NFC sharing for the current song
 */

import FontAwesome from '@expo/vector-icons/FontAwesome';
import React from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TextStyle,
    TouchableOpacity,
    ViewStyle,
} from 'react-native';

interface NfcShareButtonProps {
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: string;
  size?: 'small' | 'medium' | 'large';
}

export const NfcShareButton: React.FC<NfcShareButtonProps> = ({
  onPress,
  disabled = false,
  loading = false,
  style,
  textStyle,
  icon = 'share-alt',
  size = 'medium',
}) => {
  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return { button: styles.buttonSmall, icon: 16, text: styles.textSmall };
      case 'large':
        return { button: styles.buttonLarge, icon: 28, text: styles.textLarge };
      default:
        return { button: styles.buttonMedium, icon: 20, text: styles.textMedium };
    }
  };

  const sizeStyles = getSizeStyles();

  return (
    <TouchableOpacity
      style={[
        styles.button,
        sizeStyles.button,
        disabled && styles.buttonDisabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <>
          <FontAwesome
            name={icon as any}
            size={sizeStyles.icon}
            color={disabled ? '#888' : '#fff'}
            style={styles.icon}
          />
          <Text
            style={[
              styles.text,
              sizeStyles.text,
              disabled && styles.textDisabled,
              textStyle,
            ]}
          >
            Share via NFC
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1DB954',
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  buttonSmall: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  buttonMedium: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
  },
  buttonLarge: {
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 30,
  },
  buttonDisabled: {
    backgroundColor: '#444',
    opacity: 0.6,
  },
  icon: {
    marginRight: 8,
  },
  text: {
    color: '#fff',
    fontWeight: '600',
  },
  textSmall: {
    fontSize: 12,
  },
  textMedium: {
    fontSize: 14,
  },
  textLarge: {
    fontSize: 16,
  },
  textDisabled: {
    color: '#888',
  },
});
