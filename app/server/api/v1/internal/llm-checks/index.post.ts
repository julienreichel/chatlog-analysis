/**
 * POST /api/v1/internal/llm-checks
 *
 * Creates a new LLM check configuration for the Cognito-authenticated user.
 * Protected via Cognito JWT (Bearer token) for use by the frontend dashboard.
 *
 * Request body:
 *   name        (string, required) – human-readable name for the check
 *   prompt      (string, required) – system prompt instructing the LLM
 *   outputSchema? (string)         – description of the expected JSON output schema
 *
 * Response: LlmCheckRecord
 */
import { createLlmCheck } from '~/server/utils/dynamodb'
import { getCognitoUserId } from '~/server/utils/cognito-auth'

export default defineEventHandler(async (event) => {
  const userId = await getCognitoUserId(event)
  const body = await readBody(event)

  if (typeof body?.name !== 'string' || !body.name.trim()) {
    throw createError({ statusCode: 400, message: '`name` is required' })
  }

  if (typeof body?.prompt !== 'string' || !body.prompt.trim()) {
    throw createError({ statusCode: 400, message: '`prompt` is required' })
  }

  const outputSchema = typeof body.outputSchema === 'string' ? body.outputSchema.trim() || undefined : undefined

  const config = useRuntimeConfig()
  const check = await createLlmCheck(
    userId,
    body.name.trim(),
    body.prompt.trim(),
    config.dynamoTableName,
    config.awsRegion,
    outputSchema,
  )

  return check
})
