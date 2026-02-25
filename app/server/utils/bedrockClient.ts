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

  const command = new InvokeModelCommand({
    modelId: BEDROCK_MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(requestBody),
  })

  const response = await client.send(command)

  const responseBody = JSON.parse(new TextDecoder().decode(response.body))
  // Nova Lite response structure: { output: { message: { content: [{ text: '...' }] } } }
  const text: string = responseBody?.output?.message?.content?.[0]?.text ?? ''
  return text.trim()
}
