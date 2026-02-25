/**
 * Tests for the API reference page helpers.
 *
 * These tests exercise the pure buildCurl function without mounting Vue
 * components or making real network calls.
 */

import { describe, it, expect } from 'vitest'

// ─── buildCurl (mirrors page logic) ───────────────────────────────────────────

type EndpointType = 'sentiment' | 'toxicity'

const SAMPLE_PAYLOAD = JSON.stringify(
  {
    messages: [
      { role: 'user', content: 'I love this platform. The response time is excellent.' },
      { role: 'assistant', content: 'Thank you! I am happy to help.' },
    ],
  },
  null,
  2,
)

function buildCurl(type: EndpointType, baseUrl = '<BASE_URL>', apiKey = '<YOUR_API_KEY>'): string {
  return `curl -X POST ${baseUrl}/api/v1/analysis/${type} \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${apiKey}" \\
  -d '${SAMPLE_PAYLOAD.replace(/'/g, "'\\''")}'`
}

describe('buildCurl', () => {
  it('includes the correct endpoint path for sentiment', () => {
    const curl = buildCurl('sentiment')
    expect(curl).toContain('/api/v1/analysis/sentiment')
  })

  it('includes the correct endpoint path for toxicity', () => {
    const curl = buildCurl('toxicity')
    expect(curl).toContain('/api/v1/analysis/toxicity')
  })

  it('includes the X-API-Key header placeholder', () => {
    const curl = buildCurl('sentiment')
    expect(curl).toContain('X-API-Key: <YOUR_API_KEY>')
  })

  it('uses the provided API key when given', () => {
    const curl = buildCurl('sentiment', 'https://example.com', 'my-secret-key')
    expect(curl).toContain('X-API-Key: my-secret-key')
  })

  it('uses the provided base URL when given', () => {
    const curl = buildCurl('toxicity', 'https://api.example.com')
    expect(curl).toContain('https://api.example.com/api/v1/analysis/toxicity')
  })

  it('includes Content-Type header', () => {
    const curl = buildCurl('sentiment')
    expect(curl).toContain('Content-Type: application/json')
  })

  it('includes a messages array in the payload', () => {
    const curl = buildCurl('sentiment')
    expect(curl).toContain('"messages"')
  })

  it('uses POST method', () => {
    const curl = buildCurl('sentiment')
    expect(curl).toContain('curl -X POST')
  })

  it('produces different commands for sentiment and toxicity', () => {
    const sentimentCurl = buildCurl('sentiment')
    const toxicityCurl = buildCurl('toxicity')
    expect(sentimentCurl).not.toBe(toxicityCurl)
  })
})

// ─── Messages JSON validation (mirrors page logic) ───────────────────────────

function validateMessages(raw: string): { ok: true; messages: unknown[] } | { ok: false; error: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  }
  catch {
    return { ok: false, error: 'Invalid JSON in the Messages field.' }
  }
  if (!Array.isArray(parsed)) {
    return { ok: false, error: 'Messages must be a JSON array.' }
  }
  return { ok: true, messages: parsed }
}

describe('validateMessages', () => {
  it('accepts a valid messages array', () => {
    const result = validateMessages('[{"role":"user","content":"Hello"}]')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.messages).toHaveLength(1)
  })

  it('rejects invalid JSON', () => {
    const result = validateMessages('{not valid')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('Invalid JSON')
  })

  it('rejects a JSON object (not array)', () => {
    const result = validateMessages('{"role":"user","content":"Hello"}')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('array')
  })

  it('accepts an empty array', () => {
    const result = validateMessages('[]')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.messages).toHaveLength(0)
  })

  it('accepts multiple messages', () => {
    const raw = JSON.stringify([
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello' },
    ])
    const result = validateMessages(raw)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.messages).toHaveLength(2)
  })
})
