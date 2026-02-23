/**
 * GET /api/v1/internal/history/:requestId
 *
 * Returns the details of a single analysis call for the Cognito-authenticated user.
 * Protected via Cognito JWT (Bearer token) for use by the frontend dashboard.
 *
 * Response: AnalysisCallRecord (with full results)
 */
import { getAnalysisCallById } from '~/server/utils/dynamodb'
import { getCognitoUserId } from '~/server/utils/cognito-auth'

export default defineEventHandler(async (event) => {
  const userId = await getCognitoUserId(event)
  const requestId = getRouterParam(event, 'requestId')

  if (!requestId) {
    throw createError({ statusCode: 400, message: 'requestId is required' })
  }

  const config = useRuntimeConfig()
  const record = await getAnalysisCallById(requestId, config.dynamoAnalysisTableName, config.awsRegion)

  if (!record) {
    throw createError({ statusCode: 404, message: 'Call not found' })
  }

  if (record.userId !== userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  return record
})
