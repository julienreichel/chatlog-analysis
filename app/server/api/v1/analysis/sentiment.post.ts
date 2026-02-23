/**
 * POST /v1/analysis/sentiment
 *
 * Analyzes the sentiment of a structured discussion (per-message + summary)
 * using Amazon Comprehend DetectSentiment.
 * Protected via X-API-Key middleware (see server/middleware/api-key-auth.ts).
 *
 * Request body:
 *   conversationId? (string)
 *   languageCode?   (string, default 'en')
 *   messages: Array<{ role: string, content: string, timestamp?: string }>
 *   model?, channel?, tags?
 *
 * Response: { requestId, callId, endpointType, createdAt, durationMs,
 *             conversationId?, messages: [...], summary: {...} }
 */
import { createAnalysisCall, MAX_PAYLOAD_BYTES, type DiscussionMessage, type DiscussionMetadata } from '~/server/utils/dynamodb'
import { detectSentiment, type SentimentLabel } from '~/server/utils/comprehendClient'

export default defineEventHandler(async (event) => {
  const startMs = Date.now()
  const body = await readBody(event)

  if (JSON.stringify(body ?? {}).length > MAX_PAYLOAD_BYTES) {
    throw createError({ statusCode: 413, message: 'Payload too large (max 256 KB)' })
  }

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

  const languageCode: string = typeof body.languageCode === 'string' ? body.languageCode : 'en'
  const conversationId: string | undefined = typeof body.conversationId === 'string' ? body.conversationId : undefined
  const metadata: DiscussionMetadata | undefined = (body.model || body.channel || body.tags)
    ? {
        ...(typeof body.model === 'string' ? { model: body.model } : {}),
        ...(typeof body.channel === 'string' ? { channel: body.channel } : {}),
        ...(Array.isArray(body.tags) ? { tags: body.tags as string[] } : {}),
      }
    : undefined

  const config = useRuntimeConfig()
  const userId = event.context.userId as string

  // Run Comprehend DetectSentiment per message
  let sentimentResults: Awaited<ReturnType<typeof detectSentiment>>[]
  try {
    sentimentResults = await Promise.all(
      messages.map(msg => detectSentiment(msg.content, config.awsRegion, languageCode)),
    )
  }
  catch (err) {
    console.error('[sentiment] Comprehend error', { userId, messageCount: messages.length, err })
    throw createError({ statusCode: 502, message: 'Upstream analysis service error' })
  }

  const responseMessages = messages.map((msg, i) => ({
    index: i,
    role: msg.role,
    contentLength: msg.content.length,
    ...(msg.timestamp ? { timestamp: msg.timestamp } : {}),
    sentiment: sentimentResults[i],
  }))

  const allSentiments = sentimentResults.map(r => r.sentiment)
  const summary = aggregateSentiment(allSentiments, sentimentResults.map(r => r.scores))

  const results = { messages: responseMessages, summary }

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

  const durationMs = Date.now() - startMs
  console.info('[sentiment] completed', { requestId: record.callId, userId, messageCount: messages.length, durationMs })

  return {
    requestId: record.callId,
    callId: record.callId,
    endpointType: 'sentiment' as const,
    createdAt: record.createdAt,
    durationMs,
    ...(conversationId ? { conversationId } : {}),
    messages: responseMessages,
    summary,
  }
})

// ─── Aggregation helpers ──────────────────────────────────────────────────────

type Sentiment = SentimentLabel

export function aggregateSentiment(
  sentiments: Sentiment[],
  scores: Record<Sentiment, number>[],
): {
  dominant: Sentiment
  counts: Record<Sentiment, number>
  avgScores: Record<Sentiment, number>
} {
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
