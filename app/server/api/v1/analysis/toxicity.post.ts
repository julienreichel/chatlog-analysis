/**
 * POST /v1/analysis/toxicity
 *
 * Analyzes the toxicity of a structured discussion (per-message + summary)
 * using Amazon Comprehend DetectToxicContent.
 * Protected via X-API-Key middleware (see server/middleware/api-key-auth.ts).
 *
 * Request body:
 *   conversationId? (string)
 *   messages: Array<{ role: string, content: string, timestamp?: string }>
 *   model?, channel?, tags?
 *
 * Response: { requestId, callId, endpointType, createdAt, durationMs,
 *             conversationId?, messages: [...], summary: {...} }
 */
import { createAnalysisCall, MAX_PAYLOAD_BYTES, type DiscussionMessage, type DiscussionMetadata } from '~/server/utils/dynamodb'
import { detectToxicContentBatch } from '~/server/utils/comprehendClient'

// Maximum number of text segments accepted by DetectToxicContent in a single call.
const COMPREHEND_TOXICITY_BATCH_SIZE = 10
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

  // Run Comprehend DetectToxicContent in batches of 10 (API limit)
  let toxicityResults: Awaited<ReturnType<typeof detectToxicContentBatch>>
  try {
    const batches: string[][] = []
    for (let i = 0; i < messages.length; i += COMPREHEND_TOXICITY_BATCH_SIZE) {
      batches.push(messages.slice(i, i + COMPREHEND_TOXICITY_BATCH_SIZE).map(m => m.content))
    }
    const batchResults = await Promise.all(
      batches.map(batch => detectToxicContentBatch(batch, config.awsRegion)),
    )
    toxicityResults = batchResults.flat()
  }
  catch (err) {
    console.error('[toxicity] Comprehend error', { userId, messageCount: messages.length, err })
    throw createError({ statusCode: 502, message: 'Upstream analysis service error' })
  }

  const responseMessages = messages.map((msg, i) => ({
    index: i,
    role: msg.role,
    contentLength: msg.content.length,
    ...(msg.timestamp ? { timestamp: msg.timestamp } : {}),
    toxicity: toxicityResults[i],
  }))

  const summary = aggregateToxicity(toxicityResults.map(r => r.toxicity))

  const results = { messages: responseMessages, summary }

  const record = await createAnalysisCall(
    userId,
    'toxicity',
    messages,
    results,
    config.dynamoAnalysisTableName,
    config.awsRegion,
    conversationId,
    metadata,
  )

  const durationMs = Date.now() - startMs
  console.info('[toxicity] completed', { requestId: record.callId, userId, messageCount: messages.length, durationMs })

  return {
    requestId: record.callId,
    callId: record.callId,
    endpointType: 'toxicity' as const,
    createdAt: record.createdAt,
    durationMs,
    ...(conversationId ? { conversationId } : {}),
    messages: responseMessages,
    summary,
  }
})

// ─── Aggregation helpers ──────────────────────────────────────────────────────

export function aggregateToxicity(scores: number[]): {
  maxToxicity: number
  avgToxicity: number
  countAbove50: number
  countAbove80: number
} {
  if (scores.length === 0) {
    return { maxToxicity: 0, avgToxicity: 0, countAbove50: 0, countAbove80: 0 }
  }
  const maxToxicity = Math.max(...scores)
  const avgToxicity = scores.reduce((a, b) => a + b, 0) / scores.length
  const countAbove50 = scores.filter(s => s > 0.5).length
  const countAbove80 = scores.filter(s => s > 0.8).length
  return { maxToxicity, avgToxicity, countAbove50, countAbove80 }
}
