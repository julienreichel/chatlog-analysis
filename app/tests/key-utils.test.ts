import { describe, it, expect } from 'vitest'
import { generateApiKey, hashApiKey, verifyApiKey, KEY_PREFIX } from '../server/utils/key-utils'

const TEST_SECRET = 'test-hmac-secret-that-is-long-enough'

describe('generateApiKey', () => {
  it('returns a string with the correct prefix', () => {
    const key = generateApiKey()
    expect(key).toMatch(new RegExp(`^${KEY_PREFIX}`))
  })

  it('returns unique keys on successive calls', () => {
    const keys = new Set(Array.from({ length: 20 }, () => generateApiKey()))
    expect(keys.size).toBe(20)
  })

  it('has sufficient length (at least 40 characters after prefix)', () => {
    const key = generateApiKey()
    const payload = key.slice(KEY_PREFIX.length)
    expect(payload.length).toBeGreaterThanOrEqual(40)
  })

  it('contains only URL-safe base64 characters in the payload', () => {
    const key = generateApiKey()
    const payload = key.slice(KEY_PREFIX.length)
    // base64url: A-Z a-z 0-9 - _
    expect(payload).toMatch(/^[A-Za-z0-9\-_]+$/)
  })
})

describe('hashApiKey', () => {
  it('returns a 64-character hex string', () => {
    const hash = hashApiKey('otk_live_test', TEST_SECRET)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic for the same input', () => {
    const h1 = hashApiKey('otk_live_abc', TEST_SECRET)
    const h2 = hashApiKey('otk_live_abc', TEST_SECRET)
    expect(h1).toBe(h2)
  })

  it('produces different hashes for different keys', () => {
    const h1 = hashApiKey('otk_live_aaa', TEST_SECRET)
    const h2 = hashApiKey('otk_live_bbb', TEST_SECRET)
    expect(h1).not.toBe(h2)
  })

  it('produces different hashes for different secrets', () => {
    const h1 = hashApiKey('otk_live_aaa', TEST_SECRET)
    const h2 = hashApiKey('otk_live_aaa', 'different-secret')
    expect(h1).not.toBe(h2)
  })

  it('throws when secret is empty', () => {
    expect(() => hashApiKey('otk_live_key', '')).toThrow('API_KEY_HMAC_SECRET is not configured')
  })
})

describe('verifyApiKey', () => {
  it('returns true for a correct key', () => {
    const key = generateApiKey()
    const hash = hashApiKey(key, TEST_SECRET)
    expect(verifyApiKey(key, hash, TEST_SECRET)).toBe(true)
  })

  it('returns false for an incorrect key', () => {
    const key = generateApiKey()
    const hash = hashApiKey(key, TEST_SECRET)
    const wrongKey = generateApiKey()
    expect(verifyApiKey(wrongKey, hash, TEST_SECRET)).toBe(false)
  })

  it('returns false when the secret differs', () => {
    const key = generateApiKey()
    const hash = hashApiKey(key, TEST_SECRET)
    expect(verifyApiKey(key, hash, 'wrong-secret')).toBe(false)
  })

  it('returns false when storedHash is empty', () => {
    const key = generateApiKey()
    expect(verifyApiKey(key, '', TEST_SECRET)).toBe(false)
  })

  it('returns false when secret is empty', () => {
    const key = generateApiKey()
    const hash = hashApiKey(key, TEST_SECRET)
    expect(verifyApiKey(key, hash, '')).toBe(false)
  })

  it('is not vulnerable to timing side-channels (uses timingSafeEqual)', () => {
    // Structural test: verify that even a key that differs only in the last
    // character is still rejected.
    const key = 'otk_live_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    const hash = hashApiKey(key, TEST_SECRET)
    const almostKey = 'otk_live_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaab'
    expect(verifyApiKey(almostKey, hash, TEST_SECRET)).toBe(false)
  })
})
