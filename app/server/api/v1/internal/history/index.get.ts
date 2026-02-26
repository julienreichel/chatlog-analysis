/**
 * GET /api/v1/internal/history
 *
 * Returns the Cognito-authenticated user's analysis call history grouped by
 * discussion content (SHA-256 hash of messages).  Calls sharing the same
 * conversation are combined into a single DiscussionGroup so the dashboard
 * shows one row per unique discussion rather than one row per API call.
 *
 * Query params:
 *   limit?  (number, default 20, max 100) – max raw records fetched per page
 *   cursor? (string) – opaque pagination cursor from a previous response
 *
 * Response: { groups: DiscussionGroup[], nextCursor?: string }
 */
import { listAnalysisCalls, computeDiscussionHash } from '~/server/utils/dynamodb'
import type { DiscussionGroup } from '~/server/utils/dynamodb'
import { getCognitoUserId } from '~/server/utils/cognito-auth'

export default defineEventHandler(async (event) => {
  const userId = await getCognitoUserId(event)

  const query = getQuery(event)
  const rawLimit = Number(query.limit)
  const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 20
  const cursor = typeof query.cursor === 'string' ? query.cursor : undefined

  const config = useRuntimeConfig()
  const { calls, nextCursor } = await listAnalysisCalls(
    userId,
    config.dynamoAnalysisTableName,
    config.awsRegion,
    limit,
    cursor,
  )

  // Group calls by discussion hash (same conversation content → same group)
  const groupMap = new Map<string, DiscussionGroup>()

  for (const call of calls) {
    const hash = computeDiscussionHash(call.messages)
    const existing = groupMap.get(hash)

    const callSummary = {
      callId: call.callId,
      type: call.type,
      createdAt: call.createdAt,
      results: call.results,
    }

    if (existing) {
      existing.calls.push(callSummary)
      if (call.createdAt > existing.latestCallAt) {
        existing.latestCallAt = call.createdAt
      }
      if (!existing.types.includes(call.type)) {
        existing.types.push(call.type)
      }
    }
    else {
      groupMap.set(hash, {
        discussionHash: hash,
        messages: call.messages,
        latestCallAt: call.createdAt,
        calls: [callSummary],
        types: [call.type],
      })
    }
  }

  const groups = Array.from(groupMap.values())

  return { groups, nextCursor }
})

