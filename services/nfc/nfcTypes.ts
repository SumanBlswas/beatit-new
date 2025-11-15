// services/nfc/nfcTypes.ts

/**
 * NFC Payload structure for song handoff
 */
export interface NfcPayload {
  session: string;      // UUID for single-use tracking
  songId: string;       // Song ID to play
  expiry: number;       // Unix timestamp (milliseconds)
  sig?: string;         // Optional HMAC signature (base64)
  secretPublic?: string; // Optional public portion of ephemeral secret for verification
}

/**
 * Result of NFC payload validation
 */
export interface NfcValidationResult {
  valid: boolean;
  error?: string;
  payload?: NfcPayload;
}

/**
 * NFC Share state
 */
export type NfcShareState = 'idle' | 'waiting' | 'success' | 'error' | 'cancelled';

/**
 * NFC configuration
 */
export interface NfcConfig {
  appScheme: string;        // e.g., 'beatit'
  appHost: string;          // e.g., 'nfc'
  appPath: string;          // e.g., '/pair'
  mimeType: string;         // e.g., 'application/beatit.nfc'
  expiryDurationMs: number; // Default: 120000 (2 minutes)
  enableSignature: boolean;  // Whether to use HMAC signatures
}
