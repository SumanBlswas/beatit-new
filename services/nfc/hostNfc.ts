// services/nfc/hostNfc.ts

/**
 * NFC Host (Device A) - Song Sharing via NFC
 * Writes NDEF records to NFC tags or sends via peer-to-peer
 */

import NfcManager, { Ndef, NfcTech } from 'react-native-nfc-manager';
import { generateEphemeralSecret, generateUuid, signPayload } from './nfcCrypto';
import { NfcConfig, NfcPayload } from './nfcTypes';

// Default NFC configuration
const DEFAULT_CONFIG: NfcConfig = {
  appScheme: 'beatit',
  appHost: 'nfc',
  appPath: '/pair',
  mimeType: 'application/beatit.nfc',
  expiryDurationMs: 120000, // 2 minutes
  enableSignature: true,
};

let currentConfig: NfcConfig = DEFAULT_CONFIG;

/**
 * Initialize NFC Manager
 */
export async function initializeNfc(): Promise<boolean> {
  try {
    console.log('Checking NFC support...');
    const isSupported = await NfcManager.isSupported();
    console.log('NFC.isSupported() returned:', isSupported);
    
    if (!isSupported) {
      console.warn('❌ NFC is not supported on this device');
      console.warn('💡 This usually means you are using Expo Go');
      console.warn('📱 Build a dev build to enable NFC support');
      return false;
    }
    
    console.log('Starting NFC Manager...');
    await NfcManager.start();
    console.log('✅ NFC Manager started successfully');
    return true;
  } catch (error: any) {
    console.error('❌ Failed to initialize NFC:', error);
    console.error('Error message:', error?.message);
    console.error('Error stack:', error?.stack);
    return false;
  }
}

/**
 * Update NFC configuration
 */
export function updateNfcConfig(config: Partial<NfcConfig>): void {
  currentConfig = { ...currentConfig, ...config };
}

/**
 * Get current NFC configuration
 */
export function getNfcConfig(): NfcConfig {
  return { ...currentConfig };
}

/**
 * Create an NFC payload for a song
 */
export async function createNfcPayload(songId: string): Promise<NfcPayload> {
  const session = generateUuid();
  const expiry = Date.now() + currentConfig.expiryDurationMs;
  
  const basePayload = {
    session,
    songId,
    expiry,
  };
  
  if (currentConfig.enableSignature) {
    const secret = generateEphemeralSecret();
    const { sig, secretPublic } = await signPayload(basePayload, secret);
    return {
      ...basePayload,
      sig,
      secretPublic,
    };
  }
  
  return basePayload;
}

/**
 * Convert NFC payload to URI format
 */
function payloadToUri(payload: NfcPayload): string {
  const { appScheme, appHost, appPath } = currentConfig;
  const params = new URLSearchParams({
    session: payload.session,
    songId: payload.songId,
    expiry: payload.expiry.toString(),
    ...(payload.sig && { sig: payload.sig }),
    ...(payload.secretPublic && { secretPublic: payload.secretPublic }),
  });
  
  return `${appScheme}://${appHost}${appPath}?${params.toString()}`;
}

/**
 * Convert NFC payload to JSON format
 */
function payloadToJson(payload: NfcPayload): string {
  return JSON.stringify(payload);
}

/**
 * Write NFC payload to a tag using URI format
 * @param songId - The song ID to share
 * @returns Promise<void>
 */
export async function writeNfcPayloadUri(songId: string): Promise<void> {
  try {
    console.log('Creating NFC payload for song:', songId);
    const payload = await createNfcPayload(songId);
    const uri = payloadToUri(payload);
    console.log('Generated NFC URI:', uri);
    
    // Request NFC technology
    console.log('Requesting NFC technology...');
    await NfcManager.requestTechnology(NfcTech.Ndef);
    console.log('NFC technology acquired');
    
    // Create NDEF URI record
    const uriRecord = Ndef.uriRecord(uri);
    
    // Create Android Application Record (AAR) to prefer opening the app
    const aarRecord = Ndef.androidApplicationRecord('com.anonymous.beatit');
    
    // Write the NDEF message
    console.log('Writing NDEF message...');
    const bytes = Ndef.encodeMessage([uriRecord, aarRecord]);
    await NfcManager.ndefHandler.writeNdefMessage(bytes);
    
    console.log('✅ Successfully wrote NFC payload (URI format)');
  } catch (error: any) {
    console.error('❌ Failed to write NFC payload (URI):', error);
    console.error('Error message:', error?.message);
    console.error('Error type:', error?.constructor?.name);
    throw error;
  } finally {
    // Clean up
    console.log('Cleaning up NFC technology request...');
    await NfcManager.cancelTechnologyRequest();
  }
}

/**
 * Write NFC payload to a tag using MIME/JSON format
 * @param songId - The song ID to share
 * @returns Promise<void>
 */
export async function writeNfcPayloadMime(songId: string): Promise<void> {
  try {
    const payload = await createNfcPayload(songId);
    const jsonData = payloadToJson(payload);
    
    // Request NFC technology
    await NfcManager.requestTechnology(NfcTech.Ndef);
    
    // Create NDEF MIME record using the record() method
    const textEncoder = new TextEncoder();
    const payloadBytes = textEncoder.encode(jsonData);
    const mimeRecord = Ndef.record(
      Ndef.TNF_MIME_MEDIA,
      currentConfig.mimeType,
      [],
      Array.from(payloadBytes)
    );
    
    // Create Android Application Record (AAR)
    const aarRecord = Ndef.androidApplicationRecord('com.anonymous.beatit');
    
    // Write the NDEF message
    const bytes = Ndef.encodeMessage([mimeRecord, aarRecord]);
    await NfcManager.ndefHandler.writeNdefMessage(bytes);
    
    console.log('Successfully wrote NFC payload (MIME format):', jsonData);
  } catch (error) {
    console.error('Failed to write NFC payload (MIME):', error);
    throw error;
  } finally {
    // Clean up
    await NfcManager.cancelTechnologyRequest();
  }
}

/**
 * Default write function (uses URI format)
 */
export async function writeNfcPayload(songId: string): Promise<void> {
  return writeNfcPayloadUri(songId);
}

/**
 * Set up NFC push (for Android Beam / P2P)
 * Note: Android Beam is deprecated in Android 10+
 * This function is kept for API completeness but may not work on newer devices
 */
export async function setupNfcPush(songId: string): Promise<void> {
  try {
    const payload = await createNfcPayload(songId);
    const uri = payloadToUri(payload);
    
    console.log('NFC push setup (Android Beam deprecated):', uri);
    console.warn('Android Beam is not supported on Android 10+. Use writeNfcPayload instead.');
  } catch (error) {
    console.error('Failed to set NFC push message:', error);
    throw error;
  }
}

/**
 * Cancel NFC operation
 */
export async function cancelNfcOperation(): Promise<void> {
  try {
    await NfcManager.cancelTechnologyRequest();
  } catch (error) {
    console.error('Failed to cancel NFC operation:', error);
  }
}

/**
 * Check if NFC is enabled
 */
export async function isNfcEnabled(): Promise<boolean> {
  try {
    return await NfcManager.isEnabled();
  } catch (error) {
    console.error('Failed to check NFC status:', error);
    return false;
  }
}

/**
 * Open NFC settings
 */
export async function openNfcSettings(): Promise<void> {
  try {
    await NfcManager.goToNfcSetting();
  } catch (error) {
    console.error('Failed to open NFC settings:', error);
    throw error;
  }
}
