/**
 * GET /v1/auth/api-keys
 *
 * Lists all API key metadata for the authenticated Cognito user.
 * Key hashes are never returned.
 *
 * Protected: requires a valid Cognito JWT in the Authorization header.
 */
import { listApiKeys } from '~/server/utils/dynamodb'
import { getCognitoUserId } from '~/server/utils/cognito-auth'

export default defineEventHandler(async (event) => {
  const userId = await getCognitoUserId(event)

  const config = useRuntimeConfig()
  const { dynamoTableName, awsRegion } = config

  const keys = await listApiKeys(userId, dynamoTableName, awsRegion)

  return { keys }
})
