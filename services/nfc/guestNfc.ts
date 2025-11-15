// services/nfc/guestNfc.ts

/**
 * NFC Guest (Device B) - Receiving and Playing Songs via NFC
 * Handles NDEF tag discovery and payload validation
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NfcManager, { Ndef, NfcEvents, NfcTech } from 'react-native-nfc-manager';
import { verifyPayload } from './nfcCrypto';
import { NfcPayload, NfcValidationResult } from './nfcTypes';

// Set to track used session IDs (prevent replay attacks)
const USED_SESSIONS_KEY = 'nfc_used_sessions';
const MAX_STORED_SESSIONS = 100;

/**
 * Load used sessions from storage
 */
async function loadUsedSessions(): Promise<Set<string>> {
  try {
    const stored = await AsyncStorage.getItem(USED_SESSIONS_KEY);
    if (stored) {
      const sessions = JSON.parse(stored);
      return new Set(sessions);
    }
  } catch (error) {
    console.error('Failed to load used sessions:', error);
  }
  return new Set();
}

/**
 * Save used sessions to storage
 */
async function saveUsedSessions(sessions: Set<string>): Promise<void> {
  try {
    // Limit the number of stored sessions to prevent unbounded growth
    const sessionsArray = Array.from(sessions).slice(-MAX_STORED_SESSIONS);
    await AsyncStorage.setItem(USED_SESSIONS_KEY, JSON.stringify(sessionsArray));
  } catch (error) {
    console.error('Failed to save used sessions:', error);
  }
}

/**
 * Mark a session as used
 */
async function markSessionAsUsed(session: string): Promise<void> {
  const usedSessions = await loadUsedSessions();
  usedSessions.add(session);
  await saveUsedSessions(usedSessions);
}

/**
 * Check if a session has been used
 */
async function isSessionUsed(session: string): Promise<boolean> {
  const usedSessions = await loadUsedSessions();
  return usedSessions.has(session);
}

/**
 * Parse NFC payload from URI format
 */
function parsePayloadFromUri(uri: string): NfcPayload | null {
  try {
    const url = new URL(uri);
    const params = url.searchParams;
    
    const session = params.get('session');
    const songId = params.get('songId');
    const expiry = params.get('expiry');
    
    if (!session || !songId || !expiry) {
      console.error('Missing required URI parameters');
      return null;
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
    
    return payload;
  } catch (error) {
    console.error('Failed to parse URI payload:', error);
    return null;
  }
}

/**
 * Parse NFC payload from JSON format
 */
function parsePayloadFromJson(json: string): NfcPayload | null {
  try {
    const payload = JSON.parse(json) as NfcPayload;
    
    if (!payload.session || !payload.songId || !payload.expiry) {
      console.error('Missing required JSON fields');
      return null;
    }
    
    return payload;
  } catch (error) {
    console.error('Failed to parse JSON payload:', error);
    return null;
  }
}

/**
 * Parse NDEF message and extract NFC payload
 */
export function parseNdefMessage(ndefMessage: any[]): NfcPayload | null {
  try {
    if (!ndefMessage || ndefMessage.length === 0) {
      console.error('Empty NDEF message');
      return null;
    }
    
    for (const record of ndefMessage) {
      // Try parsing as URI
      if (record.tnf === Ndef.TNF_WELL_KNOWN && record.type) {
        const typeStr = Ndef.text.decodePayload(new Uint8Array(record.type));
        if (typeStr === 'U') {
          // URI record
          const uri = Ndef.uri.decodePayload(new Uint8Array(record.payload));
          if (uri && (uri.startsWith('beatit://') || uri.startsWith('http'))) {
            const payload = parsePayloadFromUri(uri);
            if (payload) return payload;
          }
        }
      }
      
      // Try parsing as MIME type
      if (record.tnf === Ndef.TNF_MIME_MEDIA) {
        const mimeType = Ndef.text.decodePayload(new Uint8Array(record.type));
        if (mimeType === 'application/beatit.nfc') {
          const jsonStr = Ndef.text.decodePayload(new Uint8Array(record.payload));
          const payload = parsePayloadFromJson(jsonStr);
          if (payload) return payload;
        }
      }
      
      // Try parsing as text (fallback)
      if (record.tnf === Ndef.TNF_WELL_KNOWN) {
        const typeStr = Ndef.text.decodePayload(new Uint8Array(record.type));
        if (typeStr === 'T') {
          const text = Ndef.text.decodePayload(new Uint8Array(record.payload));
          // Try parsing as JSON
          const payload = parsePayloadFromJson(text);
          if (payload) return payload;
        }
      }
    }
    
    console.error('No valid NFC payload found in NDEF message');
    return null;
  } catch (error) {
    console.error('Failed to parse NDEF message:', error);
    return null;
  }
}

/**
 * Validate an NFC payload
 */
export async function validateNfcPayload(payload: NfcPayload): Promise<NfcValidationResult> {
  // Check required fields
  if (!payload.session || !payload.songId || !payload.expiry) {
    return {
      valid: false,
      error: 'Invalid NFC payload: missing required fields',
    };
  }
  
  // Check expiry
  if (payload.expiry < Date.now()) {
    return {
      valid: false,
      error: 'NFC payload has expired',
    };
  }
  
  // Check if session has been used (prevent replay attacks)
  const sessionUsed = await isSessionUsed(payload.session);
  if (sessionUsed) {
    return {
      valid: false,
      error: 'NFC payload has already been used',
    };
  }
  
  // Verify signature if present
  if (payload.sig || payload.secretPublic) {
    const signatureValid = await verifyPayload(payload);
    if (!signatureValid) {
      return {
        valid: false,
        error: 'Invalid NFC payload signature',
      };
    }
  }
  
  // Mark session as used
  await markSessionAsUsed(payload.session);
  
  return {
    valid: true,
    payload,
  };
}

/**
 * Start listening for NFC tags
 * @param onTagReceived - Callback when a valid tag is received
 * @returns Promise<void>
 */
export async function startNfcListener(
  onTagReceived: (payload: NfcPayload) => Promise<void>
): Promise<void> {
  try {
    const isSupported = await NfcManager.isSupported();
    if (!isSupported) {
      throw new Error('NFC is not supported on this device');
    }
    
    await NfcManager.start();
    
    // Register event listener for NDEF discovery
    NfcManager.setEventListener(NfcEvents.DiscoverTag, async (tag) => {
      try {
        console.log('NFC tag discovered:', tag);
        
        if (tag.ndefMessage && tag.ndefMessage.length > 0) {
          const payload = parseNdefMessage(tag.ndefMessage);
          
          if (payload) {
            const validation = await validateNfcPayload(payload);
            
            if (validation.valid && validation.payload) {
              await onTagReceived(validation.payload);
            } else {
              console.error('NFC validation failed:', validation.error);
              throw new Error(validation.error);
            }
          }
        }
      } catch (error) {
        console.error('Error processing NFC tag:', error);
        throw error;
      } finally {
        // Clean up
        NfcManager.unregisterTagEvent().catch(() => {});
      }
    });
    
    // Start scanning for tags
    await NfcManager.registerTagEvent();
    
    console.log('NFC listener started');
  } catch (error) {
    console.error('Failed to start NFC listener:', error);
    throw error;
  }
}

/**
 * Stop listening for NFC tags
 */
export async function stopNfcListener(): Promise<void> {
  try {
    console.log('Stopping NFC listener...');
    
    // Cancel any pending technology requests first
    try {
      await NfcManager.cancelTechnologyRequest();
      console.log('Cancelled pending NFC technology request');
    } catch {
      // It's okay if there's nothing to cancel
      console.log('No pending technology request to cancel');
    }
    
    // Unregister tag event listener
    await NfcManager.unregisterTagEvent();
    NfcManager.setEventListener(NfcEvents.DiscoverTag, null);
    
    console.log('NFC listener stopped successfully');
  } catch (error) {
    console.error('Failed to stop NFC listener:', error);
    throw error;
  }
}

/**
 * Read an NFC tag once (one-time read)
 * @returns Promise<NfcPayload | null>
 */
export async function readNfcTag(): Promise<NfcPayload | null> {
  try {
    await NfcManager.requestTechnology(NfcTech.Ndef);
    
    const tag = await NfcManager.getTag();
    
    if (tag && tag.ndefMessage && tag.ndefMessage.length > 0) {
      const payload = parseNdefMessage(tag.ndefMessage);
      
      if (payload) {
        const validation = await validateNfcPayload(payload);
        
        if (validation.valid && validation.payload) {
          return validation.payload;
        } else {
          throw new Error(validation.error);
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Failed to read NFC tag:', error);
    throw error;
  } finally {
    await NfcManager.cancelTechnologyRequest();
  }
}

/**
 * Clear used sessions (for testing or maintenance)
 */
export async function clearUsedSessions(): Promise<void> {
  try {
    await AsyncStorage.removeItem(USED_SESSIONS_KEY);
    console.log('Used sessions cleared');
  } catch (error) {
    console.error('Failed to clear used sessions:', error);
  }
}
