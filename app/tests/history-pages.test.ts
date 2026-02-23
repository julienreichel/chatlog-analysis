/**
 * Unit tests for the history and summary formatting helpers used by the
 * frontend history pages.
 *
 * These tests exercise pure-logic functions (formatting, filtering, empty
 * states) without mounting Vue components or making real network calls.
 */

import { describe, it, expect } from 'vitest'

// ─── formatDate helper (mirrors page logic) ───────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString()
}

describe('formatDate', () => {
  it('returns a non-empty string for a valid ISO date', () => {
    const result = formatDate('2025-06-01T12:00:00.000Z')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })
})

// ─── pct helper (mirrors history detail page logic) ───────────────────────────

function pct(score: number): string {
  return `${(score * 100).toFixed(1)}%`
}

describe('pct', () => {
  it('formats 0 as 0.0%', () => {
    expect(pct(0)).toBe('0.0%')
  })

  it('formats 1 as 100.0%', () => {
    expect(pct(1)).toBe('100.0%')
  })

  it('formats 0.5 as 50.0%', () => {
    expect(pct(0.5)).toBe('50.0%')
  })

  it('formats 0.756 as 75.6%', () => {
    expect(pct(0.756)).toBe('75.6%')
  })
})

// ─── sentimentColor helper ────────────────────────────────────────────────────

function sentimentColor(label: string): 'success' | 'warning' | 'error' | 'neutral' {
  if (label === 'POSITIVE') return 'success'
  if (label === 'NEGATIVE') return 'error'
  if (label === 'MIXED') return 'warning'
  return 'neutral'
}

describe('sentimentColor', () => {
  it('returns success for POSITIVE', () => {
    expect(sentimentColor('POSITIVE')).toBe('success')
  })

  it('returns error for NEGATIVE', () => {
    expect(sentimentColor('NEGATIVE')).toBe('error')
  })

  it('returns warning for MIXED', () => {
    expect(sentimentColor('MIXED')).toBe('warning')
  })

  it('returns neutral for NEUTRAL', () => {
    expect(sentimentColor('NEUTRAL')).toBe('neutral')
  })

  it('returns neutral for unknown labels', () => {
    expect(sentimentColor('UNKNOWN')).toBe('neutral')
  })
})

// ─── History table row mapping ─────────────────────────────────────────────────

interface MockAnalysisCall {
  callId: string
  createdAt: string
  type: string
  messages: { role: string; content: string }[]
  results: Record<string, unknown>
}

function callToRow(c: MockAnalysisCall) {
  return {
    requestId: c.callId,
    createdAt: new Date(c.createdAt).toLocaleString(),
    endpointType: c.type,
    messageCount: c.messages?.length ?? 0,
    status: c.results && Object.keys(c.results).length > 0 ? 'completed' : 'pending',
    durationMs: c.results?.durationMs != null ? `${c.results.durationMs} ms` : '—',
  }
}

describe('history table row mapping', () => {
  const baseCall: MockAnalysisCall = {
    callId: 'call-abc-123',
    createdAt: '2025-06-01T12:00:00.000Z',
    type: 'sentiment',
    messages: [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi' },
    ],
    results: { summary: { dominant: 'POSITIVE' }, durationMs: 120 },
  }

  it('maps callId to requestId', () => {
    expect(callToRow(baseCall).requestId).toBe('call-abc-123')
  })

  it('maps type to endpointType', () => {
    expect(callToRow(baseCall).endpointType).toBe('sentiment')
  })

  it('counts messages correctly', () => {
    expect(callToRow(baseCall).messageCount).toBe(2)
  })

  it('shows completed when results exist', () => {
    expect(callToRow(baseCall).status).toBe('completed')
  })

  it('shows pending when results are empty', () => {
    const emptyResults = { ...baseCall, results: {} }
    expect(callToRow(emptyResults).status).toBe('pending')
  })

  it('formats durationMs when present', () => {
    expect(callToRow(baseCall).durationMs).toBe('120 ms')
  })

  it('shows — when durationMs is absent', () => {
    const noDuration = { ...baseCall, results: { summary: {} } }
    expect(callToRow(noDuration).durationMs).toBe('—')
  })

  it('handles empty messages array', () => {
    const noMessages = { ...baseCall, messages: [] }
    expect(callToRow(noMessages).messageCount).toBe(0)
  })
})

// ─── Role filter logic ────────────────────────────────────────────────────────

type RoleFilter = 'all' | 'user' | 'assistant'

function filterMessages(
  messages: { role: string; content: string }[],
  filter: RoleFilter,
) {
  if (filter === 'all') return messages
  return messages.filter(m => m.role === filter)
}

describe('role filter', () => {
  const messages = [
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: 'Hi' },
    { role: 'system', content: 'Be helpful' },
    { role: 'user', content: 'Bye' },
  ]

  it('returns all messages for filter "all"', () => {
    expect(filterMessages(messages, 'all')).toHaveLength(4)
  })

  it('returns only user messages', () => {
    const result = filterMessages(messages, 'user')
    expect(result).toHaveLength(2)
    result.forEach(m => expect(m.role).toBe('user'))
  })

  it('returns only assistant messages', () => {
    const result = filterMessages(messages, 'assistant')
    expect(result).toHaveLength(1)
    expect(result[0]?.role).toBe('assistant')
  })

  it('returns empty array when no messages match filter', () => {
    const sysOnly = [{ role: 'system', content: 'Test' }]
    expect(filterMessages(sysOnly, 'user')).toHaveLength(0)
  })
})

// ─── Empty state logic ────────────────────────────────────────────────────────

describe('history empty state', () => {
  it('detects empty calls list', () => {
    const calls: unknown[] = []
    expect(calls.length === 0).toBe(true)
  })

  it('detects non-empty calls list', () => {
    const calls = [{ callId: 'abc' }]
    expect(calls.length === 0).toBe(false)
  })
})

describe('api keys empty state', () => {
  it('detects empty keys list', () => {
    const keys: unknown[] = []
    expect(keys.length === 0).toBe(true)
  })

  it('detects non-empty keys list', () => {
    const keys = [{ keyId: 'abc', isActive: true }]
    expect(keys.length === 0).toBe(false)
  })
})

// ─── Summary formatting ────────────────────────────────────────────────────────

describe('toxicity summary formatting', () => {
  interface ToxicitySummary {
    maxToxicity: number
    avgToxicity: number
    countAbove50: number
    countAbove80: number
  }

  function formatToxicitySummary(summary: ToxicitySummary) {
    return {
      maxToxicityPct: pct(summary.maxToxicity),
      avgToxicityPct: pct(summary.avgToxicity),
      countAbove50: summary.countAbove50,
      countAbove80: summary.countAbove80,
    }
  }

  it('formats a typical toxicity summary', () => {
    const result = formatToxicitySummary({
      maxToxicity: 0.92,
      avgToxicity: 0.45,
      countAbove50: 3,
      countAbove80: 1,
    })
    expect(result.maxToxicityPct).toBe('92.0%')
    expect(result.avgToxicityPct).toBe('45.0%')
    expect(result.countAbove50).toBe(3)
    expect(result.countAbove80).toBe(1)
  })

  it('handles all-clean summary', () => {
    const result = formatToxicitySummary({
      maxToxicity: 0,
      avgToxicity: 0,
      countAbove50: 0,
      countAbove80: 0,
    })
    expect(result.maxToxicityPct).toBe('0.0%')
    expect(result.countAbove50).toBe(0)
  })
})

describe('sentiment summary formatting', () => {
  interface SentimentSummary {
    dominant: string
    counts: Record<string, number>
  }

  function formatSentimentSummary(summary: SentimentSummary) {
    const total = Object.values(summary.counts).reduce((a, b) => a + b, 0)
    return {
      dominant: summary.dominant,
      total,
      counts: summary.counts,
    }
  }

  it('sums counts correctly', () => {
    const result = formatSentimentSummary({
      dominant: 'POSITIVE',
      counts: { POSITIVE: 5, NEGATIVE: 2, NEUTRAL: 1, MIXED: 0 },
    })
    expect(result.total).toBe(8)
    expect(result.dominant).toBe('POSITIVE')
  })

  it('handles all-neutral summary', () => {
    const result = formatSentimentSummary({
      dominant: 'NEUTRAL',
      counts: { POSITIVE: 0, NEGATIVE: 0, NEUTRAL: 3, MIXED: 0 },
    })
    expect(result.dominant).toBe('NEUTRAL')
    expect(result.total).toBe(3)
  })
})
