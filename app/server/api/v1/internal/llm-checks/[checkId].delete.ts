/**
 * DELETE /api/v1/internal/llm-checks/:checkId
 *
 * Deletes an LLM check configuration for the Cognito-authenticated user.
 * Protected via Cognito JWT (Bearer token) for use by the frontend dashboard.
 *
 * Response: { success: true }
 */
import { deleteLlmCheck } from '~/server/utils/dynamodb'
import { getCognitoUserId } from '~/server/utils/cognito-auth'

export default defineEventHandler(async (event) => {
  const userId = await getCognitoUserId(event)
  const checkId = getRouterParam(event, 'checkId')

  if (!checkId) {
    throw createError({ statusCode: 400, message: '`checkId` is required' })
  }

  const config = useRuntimeConfig()

  try {
    await deleteLlmCheck(userId, checkId, config.dynamoTableName, config.awsRegion)
  }
  catch {
    throw createError({ statusCode: 404, message: 'LLM check not found or already deleted' })
  }

  return { success: true }
})
