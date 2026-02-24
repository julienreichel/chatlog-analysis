/**
 * API key generation and hashing utilities.
 *
 * Keys are generated as cryptographically random bytes and encoded in
 * base64url with a recognizable prefix (otk_live_).  The raw key is
 * returned to the user exactly once; only the SHA-256 digest is
 * persisted in DynamoDB.
 *
 * SECURITY NOTES
 * - Never log or return the plaintext key after initial issuance.
 * - Keys carry 288 bits of entropy (36 random bytes), making SHA-256
 *   digests safe against brute-force and rainbow-table attacks without
 *   requiring a separate HMAC secret.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

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
 * SHA-256 hash a plaintext key.
 * Returns a hex string suitable for storage in DynamoDB.
 */
export function hashApiKey(plaintextKey: string): string {
  return createHash('sha256').update(plaintextKey).digest('hex')
}

/**
 * Constant-time comparison of a candidate plaintext key against a stored
 * hash.  Returns `true` only when the digests match.
 */
export function verifyApiKey(plaintextKey: string, storedHash: string): boolean {
  if (!storedHash) return false
  try {
    const candidate = Buffer.from(hashApiKey(plaintextKey), 'hex')
    const stored = Buffer.from(storedHash, 'hex')
    if (candidate.length !== stored.length) return false
    return timingSafeEqual(candidate, stored)
  }
  catch {
    return false
  }
}
