// components/BeautifulAlert.tsx

/**
 * Beautiful Alert Component
 * Custom alert modal with beautiful design
 */

import FontAwesome from "@expo/vector-icons/FontAwesome";
import { BlurView } from "expo-blur";
import React from "react";
import {
  Animated,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { width } = Dimensions.get("window");

interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
}

interface BeautifulAlertProps {
  visible: boolean;
  title: string;
  message: string;
  type?: "success" | "error" | "warning" | "info";
  buttons?: AlertButton[];
  onClose?: () => void;
}

export const BeautifulAlert: React.FC<BeautifulAlertProps> = ({
  visible,
  title,
  message,
  type = "info",
  buttons = [{ text: "OK", style: "default" }],
  onClose,
}) => {
  const [scaleAnim] = React.useState(new Animated.Value(0));

  React.useEffect(() => {
    if (visible) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, scaleAnim]);

  const getIconConfig = () => {
    switch (type) {
      case "success":
        return { name: "check-circle", color: "#1DB954" };
      case "error":
        return { name: "exclamation-circle", color: "#EF4444" };
      case "warning":
        return { name: "exclamation-triangle", color: "#F59E0B" };
      default:
        return { name: "info-circle", color: "#3B82F6" };
    }
  };

  const iconConfig = getIconConfig();

  const handleButtonPress = (button: AlertButton) => {
    button.onPress?.();
    onClose?.();
  };

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <BlurView intensity={20} tint="dark" style={styles.backdrop}>
        <TouchableOpacity
          style={styles.backdropTouchable}
          activeOpacity={1}
          onPress={onClose}
        >
          <Animated.View
            style={[
              styles.alertContainer,
              {
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <TouchableOpacity activeOpacity={1}>
              {/* Icon */}
              <View style={styles.iconContainer}>
                <View
                  style={[
                    styles.iconCircle,
                    { backgroundColor: iconConfig.color + "20" },
                  ]}
                >
                  <FontAwesome
                    name={iconConfig.name as any}
                    size={48}
                    color={iconConfig.color}
                  />
                </View>
              </View>

              {/* Title */}
              <Text style={styles.title}>{title}</Text>

              {/* Message (scrollable, max height, better contrast) */}
              <ScrollView
                style={styles.messageScroll}
                contentContainerStyle={{
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {typeof message === "string" ? (
                  <Text style={styles.message}>{message}</Text>
                ) : (
                  message
                )}
              </ScrollView>

              {/* Buttons */}
              <View style={styles.buttonContainer}>
                {buttons.map((button, index) => {
                  const isCancel = button.style === "cancel";
                  const isDestructive = button.style === "destructive";

                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.button,
                        isCancel && styles.buttonCancel,
                        isDestructive && styles.buttonDestructive,
                        buttons.length === 1 && styles.buttonSingle,
                      ]}
                      onPress={() => handleButtonPress(button)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.buttonText,
                          isCancel && styles.buttonTextCancel,
                          isDestructive && styles.buttonTextDestructive,
                        ]}
                        numberOfLines={1}
                      >
                        {button.text}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </BlurView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  backdropTouchable: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  alertContainer: {
    width: width * 0.85,
    maxWidth: 400,
    backgroundColor: "#1E1E1E",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  iconContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  message: {
    fontSize: 15,
    color: "#F3F3F3",
    textAlign: "center",
    lineHeight: 22,
    // marginBottom handled by ScrollView
    fontWeight: "500",
    letterSpacing: 0.1,
  },
  messageScroll: {
    maxHeight: 180,
    marginBottom: 24,
    alignSelf: "center",
    width: "100%",
    paddingHorizontal: 2,
  },

  buttonContainer: {
    flexDirection: "row",
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#1DB954",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  buttonSingle: {
    flex: 1,
  },
  buttonCancel: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  buttonDestructive: {
    backgroundColor: "#EF4444",
  },
  buttonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
    letterSpacing: 0.1,
  },
  buttonTextCancel: {
    color: "#B3B3B3",
  },
  buttonTextDestructive: {
    color: "#FFFFFF",
  },
});
