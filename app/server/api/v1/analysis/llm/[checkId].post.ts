/**
 * POST /v1/analysis/llm/:checkId
 *
 * Runs a user-defined LLM check against a conversation using Amazon Bedrock
 * (amazon.nova-lite-v1:0). The check must return valid JSON; otherwise the call fails.
 * Protected via X-API-Key middleware (see server/middleware/api-key-auth.ts).
 *
 * Request body:
 *   conversationId? (string)
 *   messages: Array<{ role: string, content: string, timestamp?: string }>
 *   model?, channel?, tags?
 *
 * Response: { requestId, callId, endpointType, createdAt, durationMs,
 *             conversationId?, checkId, checkName, result: <parsed JSON> }
 */
import { createAnalysisCall, getLlmCheckById, MAX_PAYLOAD_BYTES, type DiscussionMessage, type DiscussionMetadata } from '~/server/utils/dynamodb'
import { invokeNovaLite } from '~/server/utils/bedrockClient'

export default defineEventHandler(async (event) => {
  const startMs = Date.now()
  const checkId = getRouterParam(event, 'checkId')

  if (!checkId) {
    throw createError({ statusCode: 400, message: '`checkId` is required' })
  }

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

  // Load LLM check configuration from DynamoDB
  const check = await getLlmCheckById(checkId, config.dynamoTableName, config.awsRegion)
  if (!check) {
    throw createError({ statusCode: 404, message: `LLM check '${checkId}' not found` })
  }

  // Format conversation for the LLM
  const conversationText = messages
    .map(m => `[${m.role}]${m.timestamp ? ` (${m.timestamp})` : ''}: ${m.content}`)
    .join('\n')

  const systemPrompt = check.outputSchema
    ? `${check.prompt}\n\nExpected output schema:\n${check.outputSchema}\n\nYou MUST respond with valid JSON only. Do not include any explanation or markdown.`
    : `${check.prompt}\n\nYou MUST respond with valid JSON only. Do not include any explanation or markdown.`

  // Call Bedrock
  let rawResponse: string
  try {
    rawResponse = await invokeNovaLite(systemPrompt, conversationText, config.awsRegion)
  }
  catch (err) {
    console.error('[llm] Bedrock error', { userId, checkId, messageCount: messages.length, err })
    throw createError({ statusCode: 502, message: 'Upstream LLM service error' })
  }

  // Strip optional markdown code fences (```json ... ``` or ``` ... ```)
  const stripped = rawResponse.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

  // Parse and validate JSON response
  let result: unknown
  try {
    result = JSON.parse(stripped)
  }
  catch {
    console.error('[llm] Non-JSON response from Bedrock', { userId, checkId, rawLength: rawResponse.length })
    throw createError({ statusCode: 422, message: 'LLM response is not valid JSON' })
  }

  const results = { checkId, checkName: check.name, result }

  const record = await createAnalysisCall(
    userId,
    'llm',
    messages,
    results,
    config.dynamoAnalysisTableName,
    config.awsRegion,
    conversationId,
    metadata,
  )

  const durationMs = Date.now() - startMs
  console.info('[llm] completed', { requestId: record.callId, userId, checkId, messageCount: messages.length, durationMs })

  return {
    requestId: record.callId,
    callId: record.callId,
    endpointType: 'llm' as const,
    createdAt: record.createdAt,
    durationMs,
    ...(conversationId ? { conversationId } : {}),
    checkId,
    checkName: check.name,
    result,
  }
})
