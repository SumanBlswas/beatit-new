import { NativeModules, Platform } from "react-native";

const { EqualizerModule } = NativeModules as any;

export const isNativeEqualizerAvailable = () => {
  return Platform.OS === "android" && !!EqualizerModule;
};

export const initEqualizer = async (sessionId?: number) => {
  if (!isNativeEqualizerAvailable()) return false;
  try {
    if (typeof EqualizerModule.init === "function") {
      await EqualizerModule.init(sessionId ?? 0);
      return true;
    }
  } catch (e) {
    console.warn("initEqualizer failed:", e);
  }
  return false;
};

export const setEqualizerGains = (gains: number[]) => {
  if (!isNativeEqualizerAvailable()) return false;
  try {
    if (typeof EqualizerModule.setGains === "function") {
      // Ensure we pass a plain array of numbers
      EqualizerModule.setGains(gains.map((g) => Number(g)));
      return true;
    }
  } catch (e) {
    console.warn("setEqualizerGains failed:", e);
  }
  return false;
};

export const enableEqualizer = (enabled: boolean) => {
  if (!isNativeEqualizerAvailable()) return false;
  try {
    if (typeof EqualizerModule.setEnabled === "function") {
      EqualizerModule.setEnabled(!!enabled);
      return true;
    }
  } catch (e) {
    console.warn("enableEqualizer failed:", e);
  }
  return false;
};

export const releaseEqualizer = () => {
  if (!isNativeEqualizerAvailable()) return false;
  try {
    if (typeof EqualizerModule.release === "function") {
      EqualizerModule.release();
      return true;
    }
  } catch (e) {
    console.warn("releaseEqualizer failed:", e);
  }
  return false;
};

export default {
  isNativeEqualizerAvailable,
  initEqualizer,
  setEqualizerGains,
  enableEqualizer,
  releaseEqualizer,
};
