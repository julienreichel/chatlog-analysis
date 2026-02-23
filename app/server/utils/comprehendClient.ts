/**
 * AWS Comprehend adapter.
 *
 * Wraps DetectSentiment and DetectToxicContent API calls and normalises the
 * responses into the shapes expected by the analysis handlers.
 *
 * Safe logging: this module never logs raw text – only lengths and requestIds.
 */
import {
  ComprehendClient,
  DetectSentimentCommand,
  DetectToxicContentCommand,
  type TextSegment,
} from '@aws-sdk/client-comprehend'

// ─── Types ────────────────────────────────────────────────────────────────────

export type SentimentLabel = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'MIXED'

export interface SentimentResult {
  sentiment: SentimentLabel
  scores: Record<SentimentLabel, number>
}

export interface ToxicityLabelScore {
  name: string
  score: number
}

export interface ToxicityResult {
  /** Overall toxicity score (0–1) returned by Comprehend. */
  toxicity: number
  /** Per-label scores (INSULT, PROFANITY, VIOLENCE_OR_THREAT, etc.). */
  labels: ToxicityLabelScore[]
}

// ─── Client (lazy singleton) ──────────────────────────────────────────────────

let _client: ComprehendClient | null = null

function getClient(region: string): ComprehendClient {
  if (!_client) {
    _client = new ComprehendClient({ region })
  }
  return _client
}

// ─── Public helpers ───────────────────────────────────────────────────────────

/**
 * Call Comprehend DetectSentiment for a single piece of text.
 *
 * @param text          The message content to analyse.
 * @param region        AWS region.
 * @param languageCode  BCP-47 language code (default 'en').
 */
export async function detectSentiment(
  text: string,
  region: string,
  languageCode = 'en',
): Promise<SentimentResult> {
  const client = getClient(region)
  const response = await client.send(
    new DetectSentimentCommand({ Text: text, LanguageCode: languageCode }),
  )

  const sentiment = (response.Sentiment ?? 'NEUTRAL') as SentimentLabel
  const raw = response.SentimentScore ?? {}
  const scores: Record<SentimentLabel, number> = {
    POSITIVE: raw.Positive ?? 0,
    NEGATIVE: raw.Negative ?? 0,
    NEUTRAL: raw.Neutral ?? 0,
    MIXED: raw.Mixed ?? 0,
  }

  return { sentiment, scores }
}

/**
 * Call Comprehend DetectToxicContent for a batch of texts.
 * The API accepts up to 10 text segments per call.
 *
 * Returns results in the same order as the input array.
 *
 * @param languageCode  BCP-47 language code (default 'en'; Comprehend currently
 *                      only supports English for toxicity detection).
 */
export async function detectToxicContentBatch(
  texts: string[],
  region: string,
  languageCode = 'en',
): Promise<ToxicityResult[]> {
  if (texts.length === 0) return []

  const client = getClient(region)
  const segments: TextSegment[] = texts.map(t => ({ Text: t }))

  const response = await client.send(
    new DetectToxicContentCommand({ TextSegments: segments, LanguageCode: languageCode }),
  )

  const resultList = response.ResultList ?? []

  return resultList
    .sort((a, b) => (a.Index ?? 0) - (b.Index ?? 0))
    .map(item => ({
      toxicity: item.Toxicity ?? 0,
      labels: (item.Labels ?? []).map(l => ({
        name: l.Name ?? 'UNKNOWN',
        score: l.Score ?? 0,
      })),
    }))
}
