/**
 * API Key Generation and Validation Utilities
 */

import crypto from 'crypto';

/**
 * Calculate CRC32 checksum for a string
 */
function calculateCRC32(str: string): number {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }

  let crc = 0xFFFFFFFF;
  for (let i = 0; i < str.length; i++) {
    const byte = str.charCodeAt(i);
    crc = table[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/**
 * Generate a secure API key with sk_ prefix and checksum
 * Format: sk_XXXXXXXXXXXXXXXXXXXXXXXXXXXX_CCCC
 * - sk_: prefix (2 chars + underscore)
 * - X: 28 random base64url characters
 * - C: 4 character checksum (base36)
 */
export function generateApiKey(): string {
  // Generate 21 random bytes (will become 28 base64url characters)
  const randomBytes = crypto.randomBytes(21);

  // Convert to base64url format (URL-safe)
  const randomString = randomBytes
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  // Calculate checksum of the random string
  const crc = calculateCRC32(randomString);
  const checksum = crc.toString(36).padStart(4, '0').slice(-4);

  return `sk_${randomString}_${checksum}`;
}

/**
 * Hash an API key for secure storage
 * Uses SHA-256 for one-way hashing
 */
export function hashApiKey(apiKey: string): string {
  return crypto
    .createHash('sha256')
    .update(apiKey)
    .digest('hex');
}

/**
 * Verify if a plain API key matches a hashed version
 */
export function verifyApiKey(plainKey: string, hashedKey: string): boolean {
  const computedHash = hashApiKey(plainKey);

  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(computedHash, 'hex'),
      Buffer.from(hashedKey, 'hex')
    );
  } catch (error) {
    // If lengths don't match, timingSafeEqual throws
    return false;
  }
}

/**
 * Validate API key format and checksum
 */
export function isValidApiKeyFormat(apiKey: string): boolean {
  // Must match format: sk_<28 base64url chars>_<4 checksum chars>
  const pattern = /^sk_([A-Za-z0-9_-]{28})_([a-z0-9]{4})$/;
  const match = apiKey.match(pattern);
  
  if (!match) {
    return false;
  }

  const [, randomString, providedChecksum] = match;
  
  // Verify checksum
  const calculatedCrc = calculateCRC32(randomString);
  const calculatedChecksum = calculatedCrc.toString(36).padStart(4, '0').slice(-4);
  
  return providedChecksum === calculatedChecksum;
}

/**
 * Generate a unique ID for API key records
 */
export function generateApiKeyId(): string {
  return `apk_${crypto.randomBytes(12).toString('hex')}`;
}
