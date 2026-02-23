/**
 * GET /api/v1/internal/history
 *
 * Returns the Cognito-authenticated user's analysis call history, newest first.
 * Protected via Cognito JWT (Bearer token) for use by the frontend dashboard.
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
