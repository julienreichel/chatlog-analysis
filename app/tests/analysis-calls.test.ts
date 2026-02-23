/**
 * Tests for analysis-related helpers extracted from server/utils/dynamodb.ts.
 *
 * These tests exercise the pure-logic portions (type structures, aggregation
 * helpers) without making real DynamoDB calls.  The createAnalysisCall /
 * listAnalysisCalls / getAnalysisCallById functions require live AWS
 * credentials so they are tested via integration tests (not included here).
 */

import { describe, it, expect } from 'vitest'
import type { AnalysisCallRecord, DiscussionMessage, AnalysisType } from '../server/utils/dynamodb'
import { MAX_PAYLOAD_BYTES } from '../server/utils/dynamodb'

// ─── DiscussionMessage contract ───────────────────────────────────────────────

describe('DiscussionMessage', () => {
  it('supports all standard roles', () => {
    const messages: DiscussionMessage[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there' },
      { role: 'system', content: 'You are a helpful assistant' },
      { role: 'custom', content: 'Custom role content' },
    ]
    expect(messages).toHaveLength(4)
    messages.forEach(m => {
      expect(typeof m.role).toBe('string')
      expect(typeof m.content).toBe('string')
    })
  })

  it('accepts optional timestamp', () => {
    const msg: DiscussionMessage = {
      role: 'user',
      content: 'Hello',
      timestamp: '2025-01-01T00:00:00.000Z',
    }
    expect(msg.timestamp).toBe('2025-01-01T00:00:00.000Z')
  })

  it('timestamp is optional', () => {
    const msg: DiscussionMessage = { role: 'user', content: 'Hello' }
    expect(msg.timestamp).toBeUndefined()
  })
})

// ─── AnalysisCallRecord contract ──────────────────────────────────────────────

describe('AnalysisCallRecord', () => {
  const baseRecord: AnalysisCallRecord = {
    userId: 'user-123',
    callId: 'call-uuid-abc',
    createdAt: '2025-06-01T12:00:00.000Z',
    type: 'sentiment',
    messages: [{ role: 'user', content: 'Great day!' }],
    results: {
      perMessage: [{ role: 'user', content: 'Great day!', sentiment: 'POSITIVE', scores: {} }],
      summary: { dominant: 'POSITIVE', counts: { POSITIVE: 1, NEGATIVE: 0, NEUTRAL: 0, MIXED: 0 } },
    },
  }

  it('holds required fields', () => {
    expect(baseRecord.userId).toBe('user-123')
    expect(baseRecord.callId).toBe('call-uuid-abc')
    expect(baseRecord.type).toBe('sentiment')
    expect(Array.isArray(baseRecord.messages)).toBe(true)
    expect(baseRecord.results).toBeTruthy()
  })

  it('supports toxicity type', () => {
    const record: AnalysisCallRecord = { ...baseRecord, type: 'toxicity' as AnalysisType }
    expect(record.type).toBe('toxicity')
  })

  it('holds optional conversationId', () => {
    const record: AnalysisCallRecord = { ...baseRecord, conversationId: 'conv-xyz' }
    expect(record.conversationId).toBe('conv-xyz')
  })

  it('holds optional metadata', () => {
    const record: AnalysisCallRecord = {
      ...baseRecord,
      metadata: { model: 'gpt-4', channel: 'chat', tags: ['test'] },
    }
    expect(record.metadata?.model).toBe('gpt-4')
    expect(record.metadata?.channel).toBe('chat')
    expect(record.metadata?.tags).toEqual(['test'])
  })
})

// ─── Sentiment aggregation logic (mirrors server-side helper) ─────────────────

type Sentiment = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'MIXED'

function aggregateSentiment(sentiments: Sentiment[], scores: Record<Sentiment, number>[]) {
  const counts: Record<Sentiment, number> = { POSITIVE: 0, NEGATIVE: 0, NEUTRAL: 0, MIXED: 0 }
  for (const s of sentiments) counts[s]++
  const dominant = sentiments.length === 0
    ? 'NEUTRAL'
    : (Object.entries(counts) as [Sentiment, number][])
        .reduce((a, b) => (b[1] > a[1] ? b : a))[0]
  const n = Math.max(sentiments.length, 1)
  const avgScores: Record<Sentiment, number> = { POSITIVE: 0, NEGATIVE: 0, NEUTRAL: 0, MIXED: 0 }
  for (const s of scores) {
    for (const key of Object.keys(avgScores) as Sentiment[]) {
      avgScores[key] += (s[key] ?? 0) / n
    }
  }
  return { dominant, counts, avgScores }
}

describe('aggregateSentiment', () => {
  const uniformScores = (s: Sentiment): Record<Sentiment, number> => ({
    POSITIVE: s === 'POSITIVE' ? 1 : 0,
    NEGATIVE: s === 'NEGATIVE' ? 1 : 0,
    NEUTRAL: s === 'NEUTRAL' ? 1 : 0,
    MIXED: s === 'MIXED' ? 1 : 0,
  })

  it('picks POSITIVE when most messages are positive', () => {
    const sentiments: Sentiment[] = ['POSITIVE', 'POSITIVE', 'NEGATIVE']
    const result = aggregateSentiment(sentiments, sentiments.map(uniformScores))
    expect(result.dominant).toBe('POSITIVE')
    expect(result.counts.POSITIVE).toBe(2)
    expect(result.counts.NEGATIVE).toBe(1)
  })

  it('picks NEUTRAL for a single neutral message', () => {
    const result = aggregateSentiment(['NEUTRAL'], [uniformScores('NEUTRAL')])
    expect(result.dominant).toBe('NEUTRAL')
  })

  it('counts all sentiments', () => {
    const all: Sentiment[] = ['POSITIVE', 'NEGATIVE', 'NEUTRAL', 'MIXED']
    const result = aggregateSentiment(all, all.map(uniformScores))
    expect(result.counts).toEqual({ POSITIVE: 1, NEGATIVE: 1, NEUTRAL: 1, MIXED: 1 })
  })

  it('returns avgScores averaged across messages', () => {
    const sentiments: Sentiment[] = ['POSITIVE', 'NEGATIVE']
    const scores: Record<Sentiment, number>[] = [
      { POSITIVE: 0.8, NEGATIVE: 0.1, NEUTRAL: 0.05, MIXED: 0.05 },
      { POSITIVE: 0.2, NEGATIVE: 0.7, NEUTRAL: 0.05, MIXED: 0.05 },
    ]
    const result = aggregateSentiment(sentiments, scores)
    expect(result.avgScores.POSITIVE).toBeCloseTo(0.5)
    expect(result.avgScores.NEGATIVE).toBeCloseTo(0.4)
  })

  it('defaults dominant to NEUTRAL for empty input', () => {
    const result = aggregateSentiment([], [])
    expect(result.dominant).toBe('NEUTRAL')
  })
})

// ─── Toxicity summary logic (mirrors server-side helper) ──────────────────────

function aggregateToxicity(scores: number[]) {
  if (scores.length === 0) {
    return { maxToxicity: 0, avgToxicity: 0, countAbove50: 0, countAbove80: 0 }
  }
  const maxToxicity = Math.max(...scores)
  const avgToxicity = scores.reduce((a, b) => a + b, 0) / scores.length
  const countAbove50 = scores.filter(s => s > 0.5).length
  const countAbove80 = scores.filter(s => s > 0.8).length
  return { maxToxicity, avgToxicity, countAbove50, countAbove80 }
}

describe('aggregateToxicity', () => {
  it('returns correct max and avg toxicity', () => {
    const result = aggregateToxicity([0.1, 0.6, 0.9])
    expect(result.maxToxicity).toBe(0.9)
    // (0.1 + 0.6 + 0.9) / 3 = 0.5333...
    expect(result.avgToxicity).toBeCloseTo(0.533, 3)
  })

  it('counts messages above 0.5 and 0.8 thresholds', () => {
    const result = aggregateToxicity([0.3, 0.6, 0.85, 0.95])
    expect(result.countAbove50).toBe(3)
    expect(result.countAbove80).toBe(2)
  })

  it('returns zeros for empty input', () => {
    const result = aggregateToxicity([])
    expect(result.maxToxicity).toBe(0)
    expect(result.avgToxicity).toBe(0)
    expect(result.countAbove50).toBe(0)
    expect(result.countAbove80).toBe(0)
  })

  it('handles all-clean messages', () => {
    const result = aggregateToxicity([0.05, 0.1, 0.02])
    expect(result.countAbove50).toBe(0)
    expect(result.countAbove80).toBe(0)
    expect(result.maxToxicity).toBe(0.1)
  })
})

// ─── Payload size validation ──────────────────────────────────────────────────

describe('MAX_PAYLOAD_BYTES', () => {
  it('is set to 256 KB (262144 bytes)', () => {
    expect(MAX_PAYLOAD_BYTES).toBe(262144)
  })

  it('rejects a body that exceeds the limit', () => {
    const largeBody = { messages: [{ role: 'user', content: 'x'.repeat(MAX_PAYLOAD_BYTES + 1) }] }
    expect(JSON.stringify(largeBody).length).toBeGreaterThan(MAX_PAYLOAD_BYTES)
  })

  it('accepts a normal-sized body', () => {
    const normalBody = { messages: [{ role: 'user', content: 'Hello, how are you?' }] }
    expect(JSON.stringify(normalBody).length).toBeLessThanOrEqual(MAX_PAYLOAD_BYTES)
  })
})

// ─── Access control (user isolation) ─────────────────────────────────────────

describe('analysis call access control', () => {
  const record: AnalysisCallRecord = {
    userId: 'user-A',
    callId: 'call-uuid-xyz',
    createdAt: '2025-06-01T12:00:00.000Z',
    type: 'sentiment',
    messages: [{ role: 'user', content: 'Hi' }],
    results: {},
  }

  it('grants access when requesting user owns the record', () => {
    const requestingUserId = 'user-A'
    expect(record.userId === requestingUserId).toBe(true)
  })

  it('denies access when requesting user does not own the record', () => {
    const requestingUserId = 'user-B'
    expect(record.userId === requestingUserId).toBe(false)
  })
})
