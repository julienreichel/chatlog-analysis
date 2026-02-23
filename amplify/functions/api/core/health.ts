import { z } from 'zod'

export const HealthResponseSchema = z.object({
  ok: z.boolean(),
  version: z.string(),
})

export type HealthResponse = z.infer<typeof HealthResponseSchema>

const VERSION = process.env.APP_VERSION ?? '0.1.0'

export function getHealth(): HealthResponse {
  return { ok: true, version: VERSION }
}
