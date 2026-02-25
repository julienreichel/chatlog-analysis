/**
 * Tests for LLM check helpers.
 *
 * These tests exercise the pure-logic portions without making real AWS calls.
 */

import { describe, it, expect } from 'vitest'
import type { LlmCheckRecord, AnalysisType } from '../server/utils/dynamodb'

// ─── LlmCheckRecord contract ──────────────────────────────────────────────────

describe('LlmCheckRecord', () => {
  const baseCheck: LlmCheckRecord = {
    userId: 'user-123',
    checkId: 'check-uuid-abc',
    name: 'Compliance Check',
    prompt: 'Analyse this conversation and return a JSON object with compliant (boolean) and issues (string[]).',
    createdAt: '2025-06-01T12:00:00.000Z',
  }

  it('holds required fields', () => {
    expect(baseCheck.userId).toBe('user-123')
    expect(baseCheck.checkId).toBe('check-uuid-abc')
    expect(baseCheck.name).toBe('Compliance Check')
    expect(typeof baseCheck.prompt).toBe('string')
    expect(baseCheck.prompt.length).toBeGreaterThan(0)
    expect(baseCheck.createdAt).toBe('2025-06-01T12:00:00.000Z')
  })

  it('outputSchema is optional', () => {
    expect(baseCheck.outputSchema).toBeUndefined()
  })

  it('accepts optional outputSchema', () => {
    const check: LlmCheckRecord = { ...baseCheck, outputSchema: '{ "compliant": boolean, "issues": string[] }' }
    expect(check.outputSchema).toBe('{ "compliant": boolean, "issues": string[] }')
  })
})

// ─── AnalysisType includes llm ────────────────────────────────────────────────

describe('AnalysisType', () => {
  it('accepts llm as a valid analysis type', () => {
    const type: AnalysisType = 'llm'
    expect(type).toBe('llm')
  })

  it('accepts sentiment as a valid analysis type', () => {
    const type: AnalysisType = 'sentiment'
    expect(type).toBe('sentiment')
  })

  it('accepts toxicity as a valid analysis type', () => {
    const type: AnalysisType = 'toxicity'
    expect(type).toBe('toxicity')
  })
})

// ─── LLM response JSON parsing ────────────────────────────────────────────────

function parseLlmResponse(raw: string): { ok: true; result: unknown } | { ok: false; error: string } {
  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  try {
    return { ok: true, result: JSON.parse(stripped) }
  }
  catch {
    return { ok: false, error: 'LLM response is not valid JSON' }
  }
}

describe('parseLlmResponse', () => {
  it('parses a plain JSON object response', () => {
    const raw = '{"compliant":true,"issues":[]}'
    const result = parseLlmResponse(raw)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect((result.result as Record<string, unknown>).compliant).toBe(true)
    }
  })

  it('strips markdown code fences (```json ... ```)', () => {
    const raw = '```json\n{"score":95}\n```'
    const result = parseLlmResponse(raw)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect((result.result as Record<string, unknown>).score).toBe(95)
    }
  })

  it('strips plain code fences (``` ... ```)', () => {
    const raw = '```\n{"items":["a","b"]}\n```'
    const result = parseLlmResponse(raw)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect((result.result as Record<string, unknown>).items).toEqual(['a', 'b'])
    }
  })

  it('rejects non-JSON response', () => {
    const raw = 'This conversation is compliant.'
    const result = parseLlmResponse(raw)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('not valid JSON')
    }
  })

  it('accepts a JSON array response', () => {
    const raw = '[{"issue":"profanity","severity":"high"}]'
    const result = parseLlmResponse(raw)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(Array.isArray(result.result)).toBe(true)
    }
  })

  it('rejects partially valid JSON', () => {
    const raw = '{"compliant": true, "issues": ['
    const result = parseLlmResponse(raw)
    expect(result.ok).toBe(false)
  })
})

// ─── buildCurl with llm endpoint ─────────────────────────────────────────────

type EndpointType = 'sentiment' | 'toxicity' | 'llm'

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

function buildCurl(type: EndpointType, baseUrl = 'https://chatlog.example.com', apiKey = '<YOUR_API_KEY>'): string {
  const path = type === 'llm' ? '/api/v1/analysis/llm/<CHECK_ID>' : `/api/v1/analysis/${type}`
  return `curl -X POST ${baseUrl}${path} \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${apiKey}" \\
  -d '${SAMPLE_PAYLOAD.replace(/'/g, "'\\''")}'`
}

describe('buildCurl with llm type', () => {
  it('includes the llm check endpoint path', () => {
    const curl = buildCurl('llm')
    expect(curl).toContain('/api/v1/analysis/llm/<CHECK_ID>')
  })

  it('includes the X-API-Key header', () => {
    const curl = buildCurl('llm')
    expect(curl).toContain('X-API-Key: <YOUR_API_KEY>')
  })

  it('produces a different command from sentiment', () => {
    const llmCurl = buildCurl('llm')
    const sentimentCurl = buildCurl('sentiment')
    expect(llmCurl).not.toBe(sentimentCurl)
  })
})
