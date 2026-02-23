/**
 * POST /v1/analysis/toxicity
 *
 * Analyzes the toxicity level of a chat message or conversation snippet.
 * Protected via X-API-Key middleware (see server/middleware/api-key-auth.ts).
 *
 * Request body: { text: string }
 * Response:     { toxic: boolean, score: number, categories: {...} }
 *
 * NOTE: This is a stub implementation.  Replace the body of `analyzeToxicity`
 * with a real model call (e.g., a moderation API or ML model).
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body?.text || typeof body.text !== 'string') {
    throw createError({ statusCode: 400, message: '`text` string is required' })
  }

  const result = analyzeToxicity(body.text)
  return result
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
