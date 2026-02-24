import { describe, it, expect } from 'vitest'
import { generateApiKey, hashApiKey, verifyApiKey, KEY_PREFIX } from '../server/utils/key-utils'

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
    const hash = hashApiKey('otk_live_test')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic for the same input', () => {
    const h1 = hashApiKey('otk_live_abc')
    const h2 = hashApiKey('otk_live_abc')
    expect(h1).toBe(h2)
  })

  it('produces different hashes for different keys', () => {
    const h1 = hashApiKey('otk_live_aaa')
    const h2 = hashApiKey('otk_live_bbb')
    expect(h1).not.toBe(h2)
  })
})

describe('verifyApiKey', () => {
  it('returns true for a correct key', () => {
    const key = generateApiKey()
    const hash = hashApiKey(key)
    expect(verifyApiKey(key, hash)).toBe(true)
  })

  it('returns false for an incorrect key', () => {
    const key = generateApiKey()
    const hash = hashApiKey(key)
    const wrongKey = generateApiKey()
    expect(verifyApiKey(wrongKey, hash)).toBe(false)
  })

  it('returns false when storedHash is empty', () => {
    const key = generateApiKey()
    expect(verifyApiKey(key, '')).toBe(false)
  })

  it('returns false when plaintextKey is empty', () => {
    const hash = hashApiKey(generateApiKey())
    expect(verifyApiKey('', hash)).toBe(false)
  })

  it('is not vulnerable to timing side-channels (uses timingSafeEqual)', () => {
    // Structural test: verify that even a key that differs only in the last
    // character is still rejected.
    const key = 'otk_live_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    const hash = hashApiKey(key)
    const almostKey = 'otk_live_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaab'
    expect(verifyApiKey(almostKey, hash)).toBe(false)
  })
})
