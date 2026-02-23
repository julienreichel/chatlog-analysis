/**
 * GET /v1/auth/calls
 *
 * Returns the authenticated Cognito user's analysis call history, newest first.
 * Protected via Cognito JWT in Authorization header.
 *
 * Query params:
 *   limit? (number, default 50, max 100)
 *
 * Response: { calls: AnalysisCallRecord[] }
 */
import { listAnalysisCalls } from '~/server/utils/dynamodb'
import { getCognitoUserId } from '~/server/utils/cognito-auth'

export default defineEventHandler(async (event) => {
  const userId = await getCognitoUserId(event)

  const query = getQuery(event)
  const rawLimit = Number(query.limit)
  const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 50

  const config = useRuntimeConfig()
  const calls = await listAnalysisCalls(userId, config.dynamoAnalysisTableName, config.awsRegion, limit)

  return { calls }
})
