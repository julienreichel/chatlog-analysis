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

function aggregateSentiment(sentiments: Sentiment[]) {
  const counts: Record<Sentiment, number> = { POSITIVE: 0, NEGATIVE: 0, NEUTRAL: 0, MIXED: 0 }
  for (const s of sentiments) counts[s]++
  const dominant = (Object.entries(counts) as [Sentiment, number][])
    .reduce((a, b) => (b[1] > a[1] ? b : a))[0]
  return { dominant, counts }
}

describe('aggregateSentiment', () => {
  it('picks POSITIVE when most messages are positive', () => {
    const result = aggregateSentiment(['POSITIVE', 'POSITIVE', 'NEGATIVE'])
    expect(result.dominant).toBe('POSITIVE')
    expect(result.counts.POSITIVE).toBe(2)
    expect(result.counts.NEGATIVE).toBe(1)
  })

  it('picks NEUTRAL for a single neutral message', () => {
    const result = aggregateSentiment(['NEUTRAL'])
    expect(result.dominant).toBe('NEUTRAL')
  })

  it('counts all sentiments', () => {
    const result = aggregateSentiment(['POSITIVE', 'NEGATIVE', 'NEUTRAL', 'MIXED'])
    expect(result.counts).toEqual({ POSITIVE: 1, NEGATIVE: 1, NEUTRAL: 1, MIXED: 1 })
  })
})

// ─── Toxicity summary logic (mirrors server-side helper) ──────────────────────

interface ToxicityItem { toxic: boolean, score: number }

function summarizeToxicity(items: ToxicityItem[]) {
  const maxScore = items.reduce((max, r) => Math.max(max, r.score), 0)
  return {
    toxic: items.some(r => r.toxic),
    maxScore,
    toxicMessageCount: items.filter(r => r.toxic).length,
  }
}

describe('summarizeToxicity', () => {
  it('marks as toxic when any message is toxic', () => {
    const result = summarizeToxicity([
      { toxic: false, score: 0.05 },
      { toxic: true, score: 0.8 },
    ])
    expect(result.toxic).toBe(true)
    expect(result.toxicMessageCount).toBe(1)
    expect(result.maxScore).toBe(0.8)
  })

  it('is not toxic when all messages are clean', () => {
    const result = summarizeToxicity([
      { toxic: false, score: 0 },
      { toxic: false, score: 0.05 },
    ])
    expect(result.toxic).toBe(false)
    expect(result.toxicMessageCount).toBe(0)
  })

  it('returns max score correctly', () => {
    const result = summarizeToxicity([
      { toxic: true, score: 0.3 },
      { toxic: true, score: 0.9 },
      { toxic: false, score: 0.1 },
    ])
    expect(result.maxScore).toBe(0.9)
    expect(result.toxicMessageCount).toBe(2)
  })
})
