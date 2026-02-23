import { describe, it, expect } from 'vitest'
import { getHealth } from '../functions/api/core/health'

describe('getHealth', () => {
  it('returns ok: true', () => {
    const result = getHealth()
    expect(result.ok).toBe(true)
  })

  it('returns a non-empty version string', () => {
    const result = getHealth()
    expect(typeof result.version).toBe('string')
    expect(result.version.length).toBeGreaterThan(0)
  })

  it('matches the HealthResponseSchema shape', () => {
    const result = getHealth()
    expect(result).toMatchObject({ ok: expect.any(Boolean), version: expect.any(String) })
  })
})
