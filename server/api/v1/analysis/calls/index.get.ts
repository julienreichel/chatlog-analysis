/**
 * GET /v1/analysis/calls
 *
 * Returns the authenticated user's analysis call history, newest first.
 * Protected via X-API-Key middleware.
 *
 * Query params:
 *   limit? (number, default 50, max 100)
 *
 * Response: { calls: AnalysisCallRecord[] }
 */
import { listAnalysisCalls } from '~/server/utils/dynamodb'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId as string

  const query = getQuery(event)
  const rawLimit = Number(query.limit)
  const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 50

  const config = useRuntimeConfig()
  const calls = await listAnalysisCalls(userId, config.dynamoAnalysisTableName, config.awsRegion, limit)

  return { calls }
})
