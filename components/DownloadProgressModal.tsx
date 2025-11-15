import { FontAwesome } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
    ActivityIndicator,
    Dimensions,
    Modal,
    StyleSheet,
    Text,
    View,
} from "react-native";

interface DownloadProgressModalProps {
  visible: boolean;
  current: number;
  total: number;
  currentSongName: string;
}

const { width } = Dimensions.get("window");

export function DownloadProgressModal({
  visible,
  current,
  total,
  currentSongName,
}: DownloadProgressModalProps) {
  const progress = total > 0 ? (current / total) * 100 : 0;
  const isComplete = current === total && total > 0;

  return (
    <Modal transparent visible={visible} animationType="fade">
      <BlurView intensity={80} style={styles.overlay}>
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={isComplete ? ["#00ff88", "#00cc6a"] : ["#ff0066", "#9900ff"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradient}
          >
            {/* Icon */}
            <View style={styles.iconContainer}>
              {isComplete ? (
                <FontAwesome name="check-circle" size={64} color="#fff" />
              ) : (
                <FontAwesome name="download" size={64} color="#fff" />
              )}
            </View>

            {/* Title */}
            <Text style={styles.title}>
              {isComplete ? "Download Complete!" : "Downloading..."}
            </Text>

            {/* Current Song */}
            <Text style={styles.songName} numberOfLines={1}>
              {currentSongName}
            </Text>

            {/* Progress */}
            <Text style={styles.progressText}>
              {current} / {total} songs
            </Text>

            {/* Progress Bar */}
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
            </View>

            {/* Percentage */}
            <Text style={styles.percentageText}>{Math.round(progress)}%</Text>

            {/* Spinner */}
            {!isComplete && (
              <ActivityIndicator
                size="large"
                color="#fff"
                style={styles.spinner}
              />
            )}
          </LinearGradient>
        </View>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  modalContainer: {
    width: width * 0.85,
    maxWidth: 400,
    borderRadius: 24,
    overflow: "hidden",
    elevation: 20,
    shadowColor: "#ff0066",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  gradient: {
    padding: 32,
    alignItems: "center",
  },
  iconContainer: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#fff",
    marginBottom: 16,
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  songName: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.95)",
    textAlign: "center",
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  progressText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 16,
  },
  progressBarContainer: {
    width: "100%",
    height: 8,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 12,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#fff",
    borderRadius: 4,
  },
  percentageText: {
    fontSize: 16,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.9)",
    marginBottom: 16,
  },
  spinner: {
    marginTop: 8,
  },
});
