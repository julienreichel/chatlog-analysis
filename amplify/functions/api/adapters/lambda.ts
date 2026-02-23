import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'

export type RouteHandler = (event: APIGatewayProxyEventV2) => Promise<APIGatewayProxyResultV2>

export function ok(body: unknown, statusCode = 200): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

export function notFound(message = 'Not Found'): APIGatewayProxyResultV2 {
  return ok({ error: message }, 404)
}

export function methodNotAllowed(): APIGatewayProxyResultV2 {
  return ok({ error: 'Method Not Allowed' }, 405)
}

export function getPath(event: APIGatewayProxyEventV2): string {
  return event.rawPath ?? '/'
}

export function getMethod(event: APIGatewayProxyEventV2): string {
  return (event.requestContext?.http?.method ?? 'GET').toUpperCase()
}
