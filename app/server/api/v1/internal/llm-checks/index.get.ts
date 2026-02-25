/**
 * GET /api/v1/internal/llm-checks
 *
 * Returns all LLM check configurations for the Cognito-authenticated user.
 * Protected via Cognito JWT (Bearer token) for use by the frontend dashboard.
 *
 * Response: { checks: LlmCheckRecord[] }
 */
import { listLlmChecks } from '~/server/utils/dynamodb'
import { getCognitoUserId } from '~/server/utils/cognito-auth'

export default defineEventHandler(async (event) => {
  const userId = await getCognitoUserId(event)

  const config = useRuntimeConfig()
  const checks = await listLlmChecks(userId, config.dynamoTableName, config.awsRegion)

  return { checks }
})
