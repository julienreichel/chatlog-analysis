/**
 * POST /v1/analysis/toxicity
 *
 * Analyzes the toxicity of a structured discussion (per-message + summary).
 * Protected via X-API-Key middleware (see server/middleware/api-key-auth.ts).
 *
 * Request body:
 *   conversationId? (string)
 *   messages: Array<{ role: string, content: string, timestamp?: string }>
 *   model?, channel?, tags?
 *
 * Response: { callId, createdAt, conversationId?, perMessage: [...], summary: {...} }
 *
 * NOTE: This is a stub implementation.  Replace the body of `analyzeToxicity`
 * with a real model call (e.g., a moderation API or ML model).
 */
import { createAnalysisCall, MAX_PAYLOAD_BYTES, type DiscussionMessage, type DiscussionMetadata } from '~/server/utils/dynamodb'

export default defineEventHandler(async (event) => {
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

  const perMessage = messages.map(msg => ({
    role: msg.role,
    content: msg.content,
    ...(msg.timestamp ? { timestamp: msg.timestamp } : {}),
    ...analyzeToxicity(msg.content),
  }))

  const maxScore = perMessage.reduce((max, r) => Math.max(max, r.score), 0)
  const summary = {
    toxic: perMessage.some(r => r.toxic),
    maxScore,
    toxicMessageCount: perMessage.filter(r => r.toxic).length,
  }

  const results = { perMessage, summary }

  const config = useRuntimeConfig()
  const userId = event.context.userId as string
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

  return {
    callId: record.callId,
    createdAt: record.createdAt,
    ...(conversationId ? { conversationId } : {}),
    perMessage,
    summary,
  }
})

// ─── Stub implementation ──────────────────────────────────────────────────────

interface ToxicityResult {
  toxic: boolean
  score: number
  categories: {
    insult: number
    threat: number
    profanity: number
  }
}

function analyzeToxicity(text: string): ToxicityResult {
  // TODO: replace with real moderation API call
  const lower = text.toLowerCase()
  const insultWords = (lower.match(/\b(idiot|stupid|dumb|moron|fool)\b/g) ?? []).length
  const threatWords = (lower.match(/\b(kill|hurt|destroy|attack|threaten)\b/g) ?? []).length
  const profanityWords = (lower.match(/\b(damn|hell|crap)\b/g) ?? []).length

  const maxWords = Math.max(text.split(/\s+/).length, 1)
  const insult = Math.min(insultWords / maxWords, 1)
  const threat = Math.min(threatWords / maxWords, 1)
  const profanity = Math.min(profanityWords / maxWords, 1)
  const score = Math.min((insult + threat + profanity) / 3, 1)

  return {
    toxic: score > 0.1,
    score,
    categories: { insult, threat, profanity },
  }
}
