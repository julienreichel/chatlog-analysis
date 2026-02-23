/**
 * GET /v1/analysis/calls/:callId
 *
 * Returns the details of a single analysis call.
 * Protected via X-API-Key middleware.
 *
 * The authenticated user can only retrieve their own calls.
 *
 * Response: AnalysisCallRecord (with full results)
 */
import { getAnalysisCallById } from '~/server/utils/dynamodb'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId as string
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
