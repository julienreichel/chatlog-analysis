/**
 * POST /v1/analysis/sentiment
 *
 * Analyzes the sentiment of a chat message or conversation snippet.
 * Protected via X-API-Key middleware (see server/middleware/api-key-auth.ts).
 *
 * Request body: { text: string }
 * Response:     { sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'MIXED', scores: {...} }
 *
 * NOTE: This is a stub implementation.  Replace the body of `analyzeSentiment`
 * with a real model call (e.g., AWS Comprehend or an ML service).
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body?.text || typeof body.text !== 'string') {
    throw createError({ statusCode: 400, message: '`text` string is required' })
  }

  const result = analyzeSentiment(body.text)
  return result
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
