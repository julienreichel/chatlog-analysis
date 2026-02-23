/**
 * GET /v1/auth/calls/:callId
 *
 * Returns the details of a single analysis call for the authenticated Cognito user.
 * Protected via Cognito JWT in Authorization header.
 *
 * Response: AnalysisCallRecord (with full results)
 */
import { getAnalysisCallById } from '~/server/utils/dynamodb'
import { getCognitoUserId } from '~/server/utils/cognito-auth'

export default defineEventHandler(async (event) => {
  const userId = await getCognitoUserId(event)
  const callId = getRouterParam(event, 'callId')

  if (!callId) {
    throw createError({ statusCode: 400, message: 'callId is required' })
  }

  const config = useRuntimeConfig()
  const record = await getAnalysisCallById(callId, config.dynamoAnalysisTableName, config.awsRegion)

  if (!record) {
    throw createError({ statusCode: 404, message: 'Call not found' })
  }

  if (record.userId !== userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  return record
})
