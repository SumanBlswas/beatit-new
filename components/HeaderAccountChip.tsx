import { useAuth } from '@/context/AuthContext';
import { emit } from '@/utils/eventBus';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Image,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';

export const HeaderAccountChip: React.FC = () => {
  const { userInfo } = useAuth();
  const router = useRouter();

  const handlePress = () => {
    // Navigate to account screen using the proper tab route
    router.push('/(tabs)/account' as any);
  };

  const getAvatarSource = () => {
    if (userInfo?.googlePhotoUrl) {
      return { uri: userInfo.googlePhotoUrl };
    }
    if (userInfo?.avatarUri) {
      return { uri: userInfo.avatarUri };
    }
    // Default avatar based on gender
    if (userInfo?.gender === 'female') {
      return require('@/assets/images/female.png');
    }
    return require('@/assets/images/male.png');
  };

  return (
    <TouchableOpacity 
      onPress={handlePress} 
      activeOpacity={0.7}
      style={styles.container}
    >
      <View ref={ref => {
        // measure and emit layout whenever the ref is attached
        if (!ref) return;
        try {
          // Delay slightly to ensure layout stabilized
          setTimeout(() => {
            ref.measureInWindow((x: number, y: number, width: number, height: number) => {
                emit('headerAvatarLayout', { x, y, width, height });
              });
          }, 50);
        } catch (e) {
          // ignore
        }
      }} style={styles.avatarContainer}>
        <Image 
          source={getAvatarSource()} 
          style={styles.avatar}
          defaultSource={require('@/assets/images/male.png')}
        />
        {userInfo && (
          <View style={styles.onlineIndicator} />
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 10,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#333',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#00ff88',
    borderWidth: 2,
    borderColor: '#000',
  },
});
