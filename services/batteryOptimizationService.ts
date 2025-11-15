// services/batteryOptimizationService.ts

/**
 * Battery Optimization Service
 * Checks and requests battery optimization exemption for background playback
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';

/**
 * Check if the app is battery optimized (restricted)
 * Returns true if battery optimization is enabled (bad for background playback)
 */
export async function isBatteryOptimizationEnabled(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }

  // Note: There's no direct API to check battery optimization status
  // We prompt users to check manually
  return true; // Assume optimization is enabled until checked
}

/**
 * Open battery optimization settings for the app
 */
export async function openBatteryOptimizationSettings(): Promise<void> {
  if (Platform.OS !== 'android') {
    console.log('Battery optimization is Android-only');
    return;
  }

  try {
    // Open general app settings where battery options can be found
    await Linking.openSettings();
    console.log('Opened app settings');
  } catch (error) {
    console.error('Failed to open settings:', error);
    throw error;
  }
}

/**
 * Open app info settings (where battery optimization can be found)
 */
export async function openAppInfoSettings(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  try {
    await Linking.openSettings();
  } catch (error) {
    console.error('Failed to open app info settings:', error);
    throw error;
  }
}

/**
 * Get battery optimization instructions for different manufacturers
 */
export function getBatteryOptimizationInstructions(manufacturer?: string): string {
  const brand = manufacturer?.toLowerCase() || '';
  
  if (brand.includes('xiaomi') || brand.includes('redmi') || brand.includes('poco')) {
    return `For Xiaomi/Redmi/POCO devices:

📱 METHOD 1 - Security App:
1. Open "Security" app
2. Tap "Battery" → "App battery saver"
3. Find "BeatIt" in the list
4. Select "No restrictions"

📱 METHOD 2 - Settings:
1. Settings → Apps → Manage Apps
2. Find and tap "BeatIt"
3. Tap "Battery saver"
4. Select "No restrictions"
5. Also enable "Autostart" (very important!)

📱 METHOD 3 - Recent Apps:
1. Open Recent Apps (square button)
2. Find BeatIt app
3. Long press on it
4. Tap the lock icon 🔒

This ensures music keeps playing on lock screen!`;
  }
  
  if (brand.includes('oppo') || brand.includes('realme')) {
    return `For OPPO/Realme devices:

📱 Battery Settings:
1. Settings → Battery → Battery Optimization
2. Tap "All apps" dropdown → Select "All apps"
3. Find "BeatIt"
4. Select "Don't optimize"

📱 App Management:
1. Settings → App Management → App List
2. Find "BeatIt" → Tap it
3. Go to "Startup Manager"
4. Enable "Auto-start"

📱 Recent Apps Lock:
1. Open Recent Apps
2. Find BeatIt
3. Pull down to lock it 🔒

Prevents app from closing during playback!`;
  }
  
  if (brand.includes('vivo')) {
    return `For Vivo devices:

📱 Background Settings:
1. Settings → Battery
2. Tap "Background power consumption management"
3. Find "BeatIt" app
4. Select "Allow"
5. Enable "High background power consumption"

📱 Auto-start:
1. Settings → More Settings → Permission
2. Tap "Autostart"
3. Enable for "BeatIt"

Keeps music playing without interruption!`;
  }
  
  if (brand.includes('samsung')) {
    return `For Samsung devices:

📱 Battery Settings:
1. Settings → Apps → BeatIt
2. Tap "Battery"
3. Select "Unrestricted"
4. Disable "Put app to sleep"

📱 Background Usage:
1. Go back to BeatIt app settings
2. Tap "Mobile data"
3. Enable "Allow background data usage"

📱 Lock in Recent Apps:
1. Open Recent Apps
2. Find BeatIt
3. Tap the 3-dot menu
4. Select "Lock this app" 🔒

Ensures continuous playback!`;
  }
  
  if (brand.includes('oneplus')) {
    return `For OnePlus devices:

📱 Battery Optimization:
1. Settings → Battery → Battery Optimization
2. Tap "Not optimized" dropdown
3. Select "All apps"
4. Find "BeatIt" → Select "Don't optimize"

📱 Recent Apps:
1. Open Recent Apps
2. Find BeatIt
3. Tap and hold → Lock 🔒

Prevents battery saver from stopping music!`;
  }
  
  if (brand.includes('huawei') || brand.includes('honor')) {
    return `For Huawei/Honor devices:

📱 App Launch:
1. Settings → Battery → App Launch
2. Find "BeatIt" app
3. Turn OFF "Manage automatically"
4. Enable ALL three options:
   ✓ Auto-launch
   ✓ Secondary launch
   ✓ Run in background

📱 Battery Settings:
1. Settings → Apps → Apps → BeatIt
2. Battery → "Don't allow"
3. Select "Don't restrict"

Critical for background playback!`;
  }
  
  if (brand.includes('motorola') || brand.includes('moto')) {
    return `For Motorola devices:

📱 Battery Optimization:
1. Settings → Apps & notifications
2. Tap "Advanced" → "Special app access"
3. Tap "Battery optimization"
4. Tap "Not optimized" → "All apps"
5. Find "BeatIt" → Select "Don't optimize"

Simple and effective!`;
  }
  
  if (brand.includes('nokia')) {
    return `For Nokia devices:

📱 Battery Optimization:
1. Settings → Apps & notifications
2. Tap "Advanced" → "Special app access"
3. Tap "Battery optimization"
4. Find "BeatIt"
5. Select "Don't optimize"

Keeps music playing smoothly!`;
  }
  
  // Generic instructions
  return `To prevent music from stopping on lock screen:

📱 STEP 1 - Battery Optimization:
1. Open Settings → Apps
2. Find "BeatIt" app
3. Look for "Battery" or "Power usage"
4. Select "Unrestricted" or "No restrictions"

📱 STEP 2 - Auto-start (if available):
1. In app settings, find "Autostart"
2. Enable it for BeatIt

📱 STEP 3 - Lock in Recent Apps:
1. Open Recent Apps (square/multitasking button)
2. Find BeatIt app card
3. Long press or tap menu
4. Select "Lock" or look for lock icon 🔒

This prevents the system from killing the app!`;
}

/**
 * Check if we should show battery optimization prompt
 * Shows once per app install or after certain conditions
 */
export async function shouldShowBatteryOptimizationPrompt(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }

  try {
    const PROMPT_SHOWN_KEY = 'battery_optimization_prompt_shown';
    
    const hasShown = await AsyncStorage.getItem(PROMPT_SHOWN_KEY);
    
    if (!hasShown) {
      // Mark as shown
      await AsyncStorage.setItem(PROMPT_SHOWN_KEY, 'true');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking battery optimization prompt:', error);
    return false;
  }
}

/**
 * Get device manufacturer
 */
export async function getDeviceManufacturer(): Promise<string> {
  if (Platform.OS !== 'android') {
    return 'Unknown';
  }

  try {
    // Try to get manufacturer from Platform constants
    // @ts-ignore - Platform.constants may have Manufacturer on Android
    const manufacturer = Platform.constants?.Manufacturer || 
                        // @ts-ignore
                        Platform.constants?.Brand || 
                        'Unknown';
    
    // Normalize manufacturer name
    const normalizedManufacturer = manufacturer.toLowerCase();
    
    if (normalizedManufacturer.includes('xiaomi') || normalizedManufacturer.includes('redmi') || normalizedManufacturer.includes('poco')) {
      return 'Xiaomi';
    } else if (normalizedManufacturer.includes('oppo')) {
      return 'OPPO';
    } else if (normalizedManufacturer.includes('realme')) {
      return 'Realme';
    } else if (normalizedManufacturer.includes('vivo') || normalizedManufacturer.includes('iqoo')) {
      return 'Vivo';
    } else if (normalizedManufacturer.includes('samsung')) {
      return 'Samsung';
    } else if (normalizedManufacturer.includes('oneplus')) {
      return 'OnePlus';
    } else if (normalizedManufacturer.includes('huawei')) {
      return 'Huawei';
    } else if (normalizedManufacturer.includes('honor')) {
      return 'Honor';
    } else if (normalizedManufacturer.includes('motorola') || normalizedManufacturer.includes('moto')) {
      return 'Motorola';
    } else if (normalizedManufacturer.includes('nokia')) {
      return 'Nokia';
    }
    
    return manufacturer;
  } catch (error) {
    console.error('Error getting device manufacturer:', error);
    return 'Unknown';
  }
}

/**
 * Mark that we've shown the playback interruption alert
 */
export async function markPlaybackInterruptionAlertShown(): Promise<void> {
  try {
    const ALERT_SHOWN_KEY = 'playback_interruption_alert_shown';
    await AsyncStorage.setItem(ALERT_SHOWN_KEY, 'true');
  } catch (error) {
    console.error('Error marking alert as shown:', error);
  }
}

/**
 * Check if we should show playback interruption alert
 */
export async function shouldShowPlaybackInterruptionAlert(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }

  try {
    const ALERT_SHOWN_KEY = 'playback_interruption_alert_shown';
    const hasShown = await AsyncStorage.getItem(ALERT_SHOWN_KEY);
    return !hasShown; // Show if not shown before
  } catch (error) {
    console.error('Error checking playback interruption alert:', error);
    return false;
  }
}

/**
 * Get urgent message for when playback is interrupted
 */
export function getPlaybackInterruptionMessage(): string {
  return `🎵 Music Stopping on Lock Screen?

This happens because battery optimization is killing the app in the background.

Fix this now to enjoy uninterrupted playback!`;
}
