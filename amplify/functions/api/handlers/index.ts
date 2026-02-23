import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { getPath, notFound } from '../adapters/lambda.js'
import { handleHealth } from './health.js'

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const path = getPath(event)

  if (path === '/v1/health' || path === '/v1/health/') {
    return handleHealth(event)
  }

  return notFound()
}
