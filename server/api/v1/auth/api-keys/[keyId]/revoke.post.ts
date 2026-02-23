/**
 * POST /v1/auth/api-keys/:keyId/revoke
 *
 * Revokes a specific API key for the authenticated Cognito user.
 * Revoked keys are immediately rejected on all analysis endpoints.
 *
 * Protected: requires a valid Cognito JWT in the Authorization header.
 */
import { revokeApiKey } from '~/server/utils/dynamodb'
import { getCognitoUserId } from '~/server/utils/cognito-auth'

export default defineEventHandler(async (event) => {
  const userId = await getCognitoUserId(event)
  const keyId = getRouterParam(event, 'keyId')

  if (!keyId) {
    throw createError({ statusCode: 400, message: 'Missing keyId' })
  }

  const config = useRuntimeConfig()
  const { dynamoTableName, awsRegion } = config

  try {
    await revokeApiKey(userId, keyId, dynamoTableName, awsRegion)
  }
  catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('ConditionalCheckFailedException')) {
      throw createError({ statusCode: 404, message: 'Key not found' })
    }
    throw err
  }

  return { success: true, keyId }
})
