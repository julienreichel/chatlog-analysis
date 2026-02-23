/**
 * API key generation and hashing utilities.
 *
 * Keys are generated as cryptographically random bytes and encoded in
 * base64url with a recognisable prefix (otk_live_).  The raw key is
 * returned to the user exactly once; only the HMAC-SHA-256 digest is
 * persisted in DynamoDB.
 *
 * SECURITY NOTES
 * - Never log or return the plaintext key after initial issuance.
 * - The HMAC secret must be a strong, environment-specific secret stored
 *   outside source control (see .env.example).
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

/** Prefix applied to every issued key so users can recognise them. */
export const KEY_PREFIX = 'otk_live_'

/** Number of random bytes for the key payload (gives ~48 base64url chars). */
const KEY_BYTES = 36

/**
 * Generate a new plaintext API key.
 * Format: `otk_live_<base64url(36 random bytes)>`
 */
export function generateApiKey(): string {
  const raw = randomBytes(KEY_BYTES).toString('base64url')
  return `${KEY_PREFIX}${raw}`
}

/**
 * HMAC-SHA-256 a plaintext key with the shared server secret.
 * Returns a hex string suitable for storage in DynamoDB.
 *
 * @throws if the HMAC secret is not configured.
 */
export function hashApiKey(plaintextKey: string, secret: string): string {
  if (!secret) {
    throw new Error('API_KEY_HMAC_SECRET is not configured')
  }
  return createHmac('sha256', secret).update(plaintextKey).digest('hex')
}

/**
 * Constant-time comparison of a candidate plaintext key against a stored
 * hash.  Returns `true` only when the digests match.
 */
export function verifyApiKey(plaintextKey: string, storedHash: string, secret: string): boolean {
  if (!secret || !storedHash) return false
  try {
    const candidate = Buffer.from(hashApiKey(plaintextKey, secret), 'hex')
    const stored = Buffer.from(storedHash, 'hex')
    if (candidate.length !== stored.length) return false
    return timingSafeEqual(candidate, stored)
  }
  catch {
    return false
  }
}
