// services/nfc/nfcCrypto.ts

/**
 * Offline NFC Cryptography Utilities
 * Provides HMAC-SHA256 signing and verification for NFC payloads
 * NOTE: This is a simplified offline security approach with limited protection.
 * For production use, consider additional security measures.
 */

import { NfcPayload } from './nfcTypes';

/**
 * Generate a random ephemeral secret (base64)
 */
export function generateEphemeralSecret(): string {
  // Generate 32 random bytes
  const array = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    // Fallback for environments without crypto.getRandomValues
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return arrayBufferToBase64(array);
}

/**
 * Compute SHA-256 hash of input string
 */
async function sha256(message: string): Promise<ArrayBuffer> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const msgBuffer = new TextEncoder().encode(message);
    return await crypto.subtle.digest('SHA-256', msgBuffer);
  } else {
    // Fallback: Simple hash (NOT SECURE - for demo only)
    console.warn('crypto.subtle not available, using insecure fallback hash');
    return simpleHash(message);
  }
}

/**
 * Simple fallback hash (NOT CRYPTOGRAPHICALLY SECURE)
 */
function simpleHash(str: string): ArrayBuffer {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Convert to ArrayBuffer (simulated)
  const buffer = new ArrayBuffer(32);
  const view = new DataView(buffer);
  view.setInt32(0, hash);
  return buffer;
}

/**
 * Compute HMAC-SHA256
 */
async function hmacSha256(key: string, message: string): Promise<ArrayBuffer> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const enc = new TextEncoder();
    const keyBuffer = enc.encode(key);
    const msgBuffer = enc.encode(message);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    return await crypto.subtle.sign('HMAC', cryptoKey, msgBuffer);
  } else {
    // Fallback: Use simple hash (NOT SECURE)
    console.warn('crypto.subtle not available, using insecure fallback HMAC');
    return sha256(key + message);
  }
}

/**
 * Convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert base64 string to ArrayBuffer
 * (Currently unused but kept for future enhancements)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Create a deterministic payload string for signing
 */
function createPayloadString(payload: Omit<NfcPayload, 'sig' | 'secretPublic'>): string {
  return `${payload.session}|${payload.songId}|${payload.expiry}`;
}

/**
 * Sign an NFC payload
 * @param payload - The payload to sign (without sig and secretPublic)
 * @param secret - Ephemeral secret for signing
 * @returns Promise<{ sig: string, secretPublic: string }>
 */
export async function signPayload(
  payload: Omit<NfcPayload, 'sig' | 'secretPublic'>,
  secret: string
): Promise<{ sig: string; secretPublic: string }> {
  const payloadString = createPayloadString(payload);
  
  // Compute HMAC signature
  const sigBuffer = await hmacSha256(secret, payloadString);
  const sig = arrayBufferToBase64(sigBuffer);
  
  // Compute public portion (SHA-256 of secret)
  const secretPublicBuffer = await sha256(secret);
  const secretPublic = arrayBufferToBase64(secretPublicBuffer);
  
  return { sig, secretPublic };
}

/**
 * Verify an NFC payload signature
 * NOTE: This is a simplified verification. In a real system, you'd need
 * a way to securely share the verification key.
 * 
 * For offline-only scenarios, we use a two-step approach:
 * 1. The payload includes secretPublic = SHA256(secret)
 * 2. We verify that SHA256(secret) matches secretPublic (but we don't have secret)
 * 
 * This provides minimal tamper detection but is NOT cryptographically strong.
 * A determined attacker could forge payloads.
 * 
 * @param payload - The full payload including sig and secretPublic
 * @param providedSecret - Optional: If the receiver somehow has the secret (not typical for offline)
 * @returns Promise<boolean>
 */
export async function verifyPayload(
  payload: NfcPayload,
  providedSecret?: string
): Promise<boolean> {
  if (!payload.sig || !payload.secretPublic) {
    // If no signature provided, we can't verify
    return false;
  }
  
  // If we have the secret (unlikely in offline guest scenario), verify fully
  if (providedSecret) {
    const payloadString = createPayloadString({
      session: payload.session,
      songId: payload.songId,
      expiry: payload.expiry,
    });
    
    const expectedSigBuffer = await hmacSha256(providedSecret, payloadString);
    const expectedSig = arrayBufferToBase64(expectedSigBuffer);
    
    const secretPublicBuffer = await sha256(providedSecret);
    const expectedSecretPublic = arrayBufferToBase64(secretPublicBuffer);
    
    return expectedSig === payload.sig && expectedSecretPublic === payload.secretPublic;
  }
  
  // Offline verification: We can't fully verify without the secret.
  // We can only check that the signature and secretPublic are present and non-empty.
  // This provides minimal assurance but prevents completely empty/malformed payloads.
  
  // In a more sophisticated offline system, you might:
  // - Include a pre-shared key in the app
  // - Use asymmetric cryptography (public/private key pairs)
  // - Include additional metadata to validate
  
  // For this demo, we'll accept payloads with valid-looking signatures
  // and rely on expiry + session deduplication for security.
  
  return payload.sig.length > 0 && payload.secretPublic.length > 0;
}

/**
 * Generate a UUID v4 (for session IDs)
 */
export function generateUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback UUID v4 generation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
