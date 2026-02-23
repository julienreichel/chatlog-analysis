/**
 * Server middleware: validate X-API-Key on analysis endpoints.
 *
 * Routes under /api/v1/analysis/* require a valid, non-revoked API key
 * supplied in the `X-API-Key` request header.
 *
 * The middleware:
 * 1. Checks that the header is present.
 * 2. Hashes the candidate key with HMAC-SHA-256.
 * 3. Looks up the hash in DynamoDB via the KeyHashIndex GSI.
 * 4. Rejects revoked keys.
 * 5. Fires-and-forgets a `lastUsedAt` update.
 *
 * SECURITY: the raw key value is never logged.
 */
import { getApiKeyByHash, touchLastUsed } from '~/server/utils/dynamodb'
import { hashApiKey } from '~/server/utils/key-utils'

export default defineEventHandler(async (event) => {
  // Only protect analysis routes
  const path = event.path ?? ''
  if (!path.startsWith('/api/v1/analysis')) return

  const candidateKey = getHeader(event, 'x-api-key') ?? ''
  if (!candidateKey) {
    throw createError({ statusCode: 401, message: 'Missing X-API-Key header' })
  }

  const config = useRuntimeConfig()
  const { dynamoTableName, awsRegion, apiKeyHmacSecret } = config

  let keyHash: string
  try {
    keyHash = hashApiKey(candidateKey, apiKeyHmacSecret)
  }
  catch {
    throw createError({ statusCode: 500, message: 'Server misconfiguration' })
  }

  const record = await getApiKeyByHash(keyHash, dynamoTableName, awsRegion)

  if (!record) {
    throw createError({ statusCode: 401, message: 'Invalid API key' })
  }

  if (record.revokedAt) {
    throw createError({ statusCode: 401, message: 'API key has been revoked' })
  }

  // Attach authenticated user identity to event context for downstream handlers.
  event.context.userId = record.userId
  event.context.keyId = record.keyId

  // touchLastUsed is best-effort – don't fail the request if it errors.
  if (record.userId) {
    touchLastUsed(record.userId, record.keyId, dynamoTableName, awsRegion).catch(() => {})
  }
})
