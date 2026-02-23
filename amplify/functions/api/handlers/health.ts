import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { getHealth } from '../core/health.js'
import { ok, methodNotAllowed, getMethod } from '../adapters/lambda.js'

export async function handleHealth(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  if (getMethod(event) !== 'GET') {
    return methodNotAllowed()
  }
  return ok(getHealth())
}
