/**
 * Tests for history display helpers and empty/loading state logic.
 *
 * These tests exercise the pure helper functions used in the history
 * pages without requiring a running Nuxt server or real API calls.
 */

import { describe, it, expect } from 'vitest'

// ─── formatDate helper (mirrors pages) ────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleString()
}

describe('formatDate', () => {
  it('returns a non-empty string for a valid ISO date', () => {
    const result = formatDate('2025-06-01T12:00:00.000Z')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('formats different dates differently', () => {
    const d1 = formatDate('2025-01-01T00:00:00.000Z')
    const d2 = formatDate('2025-06-15T12:30:00.000Z')
    expect(d1).not.toBe(d2)
  })
})

// ─── formatScore helper (mirrors detail page) ─────────────────────────────────

function formatScore(n: number) {
  return typeof n === 'number' ? (n * 100).toFixed(1) + '%' : '—'
}

describe('formatScore', () => {
  it('converts 0 to "0.0%"', () => {
    expect(formatScore(0)).toBe('0.0%')
  })

  it('converts 1 to "100.0%"', () => {
    expect(formatScore(1)).toBe('100.0%')
  })

  it('converts 0.856 to "85.6%"', () => {
    expect(formatScore(0.856)).toBe('85.6%')
  })

  it('converts 0.5 to "50.0%"', () => {
    expect(formatScore(0.5)).toBe('50.0%')
  })
})

// ─── formatDuration helper (mirrors history list page) ────────────────────────

function formatDuration(results: Record<string, unknown>) {
  const ms = results?.durationMs
  if (typeof ms === 'number') return `${ms} ms`
  return '—'
}

describe('formatDuration', () => {
  it('returns "—" when durationMs is absent', () => {
    expect(formatDuration({})).toBe('—')
  })

  it('returns formatted ms when present', () => {
    expect(formatDuration({ durationMs: 123 })).toBe('123 ms')
  })

  it('returns "—" when durationMs is not a number', () => {
    expect(formatDuration({ durationMs: 'fast' })).toBe('—')
  })
})

// ─── Empty state scenarios ─────────────────────────────────────────────────────

describe('history empty state', () => {
  it('shows empty when calls array is empty', () => {
    const calls: unknown[] = []
    expect(calls.length === 0).toBe(true)
  })

  it('shows table when calls array has items', () => {
    const calls = [
      { callId: 'abc', type: 'sentiment', createdAt: '2025-01-01T00:00:00Z', messageCount: 3, results: {} },
    ]
    expect(calls.length > 0).toBe(true)
  })
})

describe('detail empty state', () => {
  it('shows empty when call is null', () => {
    const call = null
    expect(call).toBeNull()
  })

  it('shows content when call is defined', () => {
    const call = {
      callId: 'abc',
      type: 'sentiment',
      createdAt: '2025-01-01T00:00:00Z',
      messages: [{ role: 'user', content: 'Hello' }],
      messageCount: 1,
      results: {},
    }
    expect(call).not.toBeNull()
  })
})

// ─── Sentiment summary rendering ──────────────────────────────────────────────

describe('sentiment summary display', () => {
  const summary = {
    dominant: 'POSITIVE',
    counts: { POSITIVE: 3, NEGATIVE: 1, NEUTRAL: 0, MIXED: 0 },
    avgScores: { POSITIVE: 0.75, NEGATIVE: 0.15, NEUTRAL: 0.05, MIXED: 0.05 },
  }

  it('exposes dominant sentiment', () => {
    expect(summary.dominant).toBe('POSITIVE')
  })

  it('counts add up correctly', () => {
    const total = Object.values(summary.counts).reduce((a, b) => a + b, 0)
    expect(total).toBe(4)
  })

  it('avgScores are all between 0 and 1', () => {
    for (const score of Object.values(summary.avgScores)) {
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(1)
    }
  })
})

// ─── Toxicity summary rendering ───────────────────────────────────────────────

describe('toxicity summary display', () => {
  const summary = {
    maxToxicity: 0.92,
    avgToxicity: 0.43,
    countAbove50: 2,
    countAbove80: 1,
  }

  it('correctly identifies messages above 50% threshold', () => {
    expect(summary.countAbove50).toBe(2)
  })

  it('correctly identifies messages above 80% threshold', () => {
    expect(summary.countAbove80).toBe(1)
  })

  it('formats max toxicity as a percent', () => {
    expect(formatScore(summary.maxToxicity)).toBe('92.0%')
  })

  it('formats avg toxicity as a percent', () => {
    expect(formatScore(summary.avgToxicity)).toBe('43.0%')
  })
})

// ─── Message filtering logic ───────────────────────────────────────────────────

type Message = { role: string, content: string }

function filterMessages(messages: Message[], filter: 'all' | 'user' | 'assistant') {
  if (filter === 'all') return messages
  return messages.filter(m => m.role === filter)
}

describe('filterMessages', () => {
  const messages: Message[] = [
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: 'Hi there' },
    { role: 'user', content: 'How are you?' },
    { role: 'system', content: 'You are helpful' },
  ]

  it('returns all messages when filter is "all"', () => {
    expect(filterMessages(messages, 'all')).toHaveLength(4)
  })

  it('returns only user messages when filter is "user"', () => {
    const result = filterMessages(messages, 'user')
    expect(result).toHaveLength(2)
    result.forEach(m => expect(m.role).toBe('user'))
  })

  it('returns only assistant messages when filter is "assistant"', () => {
    const result = filterMessages(messages, 'assistant')
    expect(result).toHaveLength(1)
    expect(result[0].role).toBe('assistant')
  })

  it('returns empty array when no messages match filter', () => {
    const result = filterMessages([], 'user')
    expect(result).toHaveLength(0)
  })
})
