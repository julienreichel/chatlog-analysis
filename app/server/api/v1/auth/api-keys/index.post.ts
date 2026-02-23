/**
 * POST /v1/auth/api-keys
 *
 * Creates a new API key for the authenticated Cognito user.
 * The plaintext key is returned once in this response and is NEVER stored.
 *
 * Protected: requires a valid Cognito JWT in the Authorization header.
 */
import { createApiKeyRecord } from '~/server/utils/dynamodb'
import { generateApiKey, hashApiKey } from '~/server/utils/key-utils'
import { getCognitoUserId } from '~/server/utils/cognito-auth'

export default defineEventHandler(async (event) => {
  const userId = await getCognitoUserId(event)

  const body = await readBody(event).catch(() => ({}))
  const label: string | undefined = typeof body?.label === 'string' ? body.label : undefined

  const config = useRuntimeConfig()
  const { dynamoTableName, awsRegion, apiKeyHmacSecret } = config

  // Generate & hash
  const plaintextKey = generateApiKey()
  const keyHash = hashApiKey(plaintextKey, apiKeyHmacSecret)

  // Persist (only the hash)
  const metadata = await createApiKeyRecord(userId, keyHash, dynamoTableName, awsRegion, label)

  setResponseStatus(event, 201)

  return {
    // Return the plaintext key exactly once
    key: plaintextKey,
    ...metadata,
  }
})
