/**
 * POST /v1/analysis/sentiment
 *
 * Analyzes the sentiment of a structured discussion (per-message + summary).
 * Protected via X-API-Key middleware (see server/middleware/api-key-auth.ts).
 *
 * Request body:
 *   conversationId? (string)
 *   messages: Array<{ role: string, content: string, timestamp?: string }>
 *   model?, channel?, tags?
 *
 * Response: { callId, createdAt, conversationId?, perMessage: [...], summary: {...} }
 *
 * NOTE: This is a stub implementation.  Replace the body of `analyzeSentiment`
 * with a real model call (e.g., AWS Comprehend or an ML service).
 */
import { createAnalysisCall, type DiscussionMessage, type DiscussionMetadata } from '~/server/utils/dynamodb'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!Array.isArray(body?.messages) || body.messages.length === 0) {
    throw createError({ statusCode: 400, message: '`messages` array is required and must not be empty' })
  }

  const messages: DiscussionMessage[] = body.messages.map((m: unknown) => {
    if (typeof m !== 'object' || m === null || typeof (m as Record<string, unknown>).content !== 'string') {
      throw createError({ statusCode: 400, message: 'Each message must have a string `content` field' })
    }
    const msg = m as Record<string, unknown>
    return {
      role: typeof msg.role === 'string' ? msg.role : 'unknown',
      content: msg.content as string,
      ...(typeof msg.timestamp === 'string' ? { timestamp: msg.timestamp } : {}),
    }
  })

  const conversationId: string | undefined = typeof body.conversationId === 'string' ? body.conversationId : undefined
  const metadata: DiscussionMetadata | undefined = (body.model || body.channel || body.tags)
    ? {
        ...(typeof body.model === 'string' ? { model: body.model } : {}),
        ...(typeof body.channel === 'string' ? { channel: body.channel } : {}),
        ...(Array.isArray(body.tags) ? { tags: body.tags as string[] } : {}),
      }
    : undefined

  const perMessage = messages.map(msg => ({
    role: msg.role,
    content: msg.content,
    ...(msg.timestamp ? { timestamp: msg.timestamp } : {}),
    ...analyzeSentiment(msg.content),
  }))

  const allSentiments = perMessage.map(r => r.sentiment)
  const summary = aggregateSentiment(allSentiments)

  const results = { perMessage, summary }

  const config = useRuntimeConfig()
  const userId = event.context.userId as string
  const record = await createAnalysisCall(
    userId,
    'sentiment',
    messages,
    results,
    config.dynamoAnalysisTableName,
    config.awsRegion,
    conversationId,
    metadata,
  )

  return {
    callId: record.callId,
    createdAt: record.createdAt,
    ...(conversationId ? { conversationId } : {}),
    perMessage,
    summary,
  }
})

// ─── Stub implementation ──────────────────────────────────────────────────────

type Sentiment = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'MIXED'

interface SentimentResult {
  sentiment: Sentiment
  scores: Record<Sentiment, number>
}

function analyzeSentiment(text: string): SentimentResult {
  // TODO: replace with real NLP / AWS Comprehend call
  const lower = text.toLowerCase()
  const positive = (lower.match(/\b(good|great|love|happy|excellent|awesome)\b/g) ?? []).length
  const negative = (lower.match(/\b(bad|hate|awful|terrible|horrible|sad)\b/g) ?? []).length

  let sentiment: Sentiment = 'NEUTRAL'
  if (positive > negative) sentiment = 'POSITIVE'
  else if (negative > positive) sentiment = 'NEGATIVE'
  else if (positive > 0 && negative > 0) sentiment = 'MIXED'

  const total = Math.max(positive + negative, 1)
  return {
    sentiment,
    scores: {
      POSITIVE: positive / total,
      NEGATIVE: negative / total,
      NEUTRAL: sentiment === 'NEUTRAL' ? 1 : 0,
      MIXED: sentiment === 'MIXED' ? 1 : 0,
    },
  }
}

function aggregateSentiment(sentiments: Sentiment[]): { dominant: Sentiment, counts: Record<Sentiment, number> } {
  const counts: Record<Sentiment, number> = { POSITIVE: 0, NEGATIVE: 0, NEUTRAL: 0, MIXED: 0 }
  for (const s of sentiments) counts[s]++
  const dominant = sentiments.length === 0
    ? 'NEUTRAL'
    : (Object.entries(counts) as [Sentiment, number][])
        .reduce((a, b) => (b[1] > a[1] ? b : a))[0]
  return { dominant, counts }
}
