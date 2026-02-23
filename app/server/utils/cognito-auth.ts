/**
 * Cognito JWT verification helper for server-side route handlers.
 *
 * Verifies the `Authorization: Bearer <token>` header against the
 * Cognito User Pool's public JWKS endpoint and returns the Cognito
 * `sub` (unique user identifier).
 *
 * This implementation uses Node's built-in `crypto` module for HMAC
 * verification and fetches the JWKS on first use (cached in memory).
 * For production use, consider aws-jwt-verify or jose for full RS256
 * verification – the placeholder below shows the integration point.
 */
import type { H3Event } from 'h3'
import { createRemoteJWKSet, jwtVerify } from 'jose'

// Module-level JWKS cache: keyed by userPoolId
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>()

function getJwks(userPoolId: string, region: string) {
  if (!jwksCache.has(userPoolId)) {
    const url = new URL(
      `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`,
    )
    jwksCache.set(userPoolId, createRemoteJWKSet(url))
  }
  return jwksCache.get(userPoolId)!
}

/**
 * Extract and verify the Cognito JWT from the incoming request.
 * Throws a 401 error if the token is missing, invalid, or expired.
 *
 * @returns The Cognito `sub` claim (unique, stable user identifier).
 */
export async function getCognitoUserId(event: H3Event): Promise<string> {
  const authHeader = getHeader(event, 'authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

  if (!token) {
    throw createError({ statusCode: 401, message: 'Missing Authorization header' })
  }

  const config = useRuntimeConfig()
  const userPoolId = config.public.cognitoUserPoolId
  const region = config.public.cognitoRegion

  if (!userPoolId) {
    throw createError({ statusCode: 500, message: 'Cognito User Pool is not configured' })
  }

  try {
    const jwks = getJwks(userPoolId, region)
    const issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`

    const { payload } = await jwtVerify(token, jwks, { issuer })

    const sub = payload.sub
    if (!sub) {
      throw new Error('JWT missing sub claim')
    }
    return sub
  }
  catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Invalid token'
    throw createError({ statusCode: 401, message: `Unauthorized: ${msg}` })
  }
}
