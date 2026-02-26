/**
 * AWS Bedrock adapter.
 *
 * Wraps the Amazon Bedrock InvokeModel API for the amazon.nova-lite-v1:0 model.
 * Expects the model to return a valid JSON string based on a user-supplied prompt.
 *
 * Safe logging: this module never logs raw conversation content.
 */
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime'

export const BEDROCK_MODEL_ID = 'amazon.nova-lite-v1:0'

function isOnDemandUnsupportedError(code?: string, details?: string): boolean {
  if (code !== 'ValidationException' || !details) return false
  return details.includes('on-demand throughput') && details.includes('inference profile')
}

function fallbackInferenceProfileId(region: string): string | undefined {
  const family = region.split('-')[0]
  if (!family) return undefined
  return `${family}.${BEDROCK_MODEL_ID}`
}

export class BedrockInvokeError extends Error {
  code?: string
  details?: string

  constructor(message: string, code?: string, details?: string) {
    super(message)
    this.name = 'BedrockInvokeError'
    this.code = code
    this.details = details
  }
}

// ─── Client (lazy singleton) ──────────────────────────────────────────────────

let _client: BedrockRuntimeClient | null = null

function getClient(region: string): BedrockRuntimeClient {
  if (!_client) {
    _client = new BedrockRuntimeClient({ region })
  }
  return _client
}

// ─── Public helpers ───────────────────────────────────────────────────────────

/**
 * Invoke the Nova Lite model with a system prompt and the conversation as user content.
 * Returns the raw text response from the model.
 *
 * @param systemPrompt  Instruction prompt provided by the user (configures the LLM check).
 * @param conversation  Stringified conversation to analyse.
 * @param region        AWS region.
 */
export async function invokeNovaLite(
  systemPrompt: string,
  conversation: string,
  region: string,
  overrideModelId?: string,
  inferenceProfileId?: string,
): Promise<string> {
  const client = getClient(region)

  const requestBody = {
    system: [{ text: systemPrompt }],
    messages: [
      {
        role: 'user',
        content: [{ text: conversation }],
      },
    ],
    inferenceConfig: {
      maxTokens: 4096,
      temperature: 0,
    },
  }

  const attempt = async (modelId: string) => {
    const command = new InvokeModelCommand({
      modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(requestBody),
    })
    return await client.send(command)
  }

  const primaryModelId = inferenceProfileId || overrideModelId || BEDROCK_MODEL_ID
  let response
  try {
    response = await attempt(primaryModelId)
  }
  catch (err: unknown) {
    const upstream = err as { name?: string, message?: string }
    const code = typeof upstream?.name === 'string' ? upstream.name : undefined
    const details = typeof upstream?.message === 'string' ? upstream.message : undefined
    if (!inferenceProfileId && isOnDemandUnsupportedError(code, details)) {
      const fallbackId = fallbackInferenceProfileId(region)
      if (fallbackId && fallbackId !== primaryModelId) {
        try {
          response = await attempt(fallbackId)
        }
        catch (fallbackErr: unknown) {
          const fallbackUpstream = fallbackErr as { name?: string, message?: string }
          const fallbackCode = typeof fallbackUpstream?.name === 'string' ? fallbackUpstream.name : undefined
          const fallbackDetails = typeof fallbackUpstream?.message === 'string' ? fallbackUpstream.message : undefined
          throw new BedrockInvokeError('Bedrock InvokeModel request failed', fallbackCode, fallbackDetails)
        }
      }
      else {
        throw new BedrockInvokeError('Bedrock InvokeModel request failed', code, details)
      }
    }
    else {
      throw new BedrockInvokeError('Bedrock InvokeModel request failed', code, details)
    }
  }

  const responseBody = JSON.parse(new TextDecoder().decode(response.body))
  // Nova Lite response structure: { output: { message: { content: [{ text: '...' }] } } }
  const text: string = responseBody?.output?.message?.content?.[0]?.text ?? ''
  return text.trim()
}
