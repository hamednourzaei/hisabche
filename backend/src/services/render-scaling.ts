// ============================================
// backend/src/services/render-scaling.ts
//
// «Add a server to the load balancer» from the admin panel: Render's own API
// sets how many instances the web service runs, and Render's load balancer
// spreads traffic across them. Nothing else here changes.
//
// Needs, in Render's environment (never in the repo):
//   RENDER_API_KEY     an API key of the Render account (Account → API Keys)
//   RENDER_SERVICE_ID  the service id, `srv-…` (from the service URL)
// Without them the page says «not configured» — it never pretends.
//
// ⚠️ MAX_INSTANCES caps what one click can do: every instance costs money on
// Render, and the multi-instance plan says 1 → 2, measure, then more.
// ⚠️ RATE_LIMIT_INSTANCE_COUNT is not changed from here (it is read at
// start-up); the page reminds the admin to set it.
// ============================================

const API = 'https://api.render.com/v1'
export const MAX_INSTANCES = 5

export class ScalingError extends Error {
  constructor(
    readonly code: 'SCALING_NOT_CONFIGURED' | 'SCALING_PROVIDER_ERROR' | 'SCALING_OUT_OF_RANGE',
    readonly status: number,
    readonly detail = '',
  ) {
    super(code)
  }
}

function credentials(): { key: string; service: string } {
  const key = process.env.RENDER_API_KEY?.trim()
  const service = process.env.RENDER_SERVICE_ID?.trim()
  if (!key || !service) throw new ScalingError('SCALING_NOT_CONFIGURED', 503)
  return { key, service }
}

async function call(path: string, init: RequestInit = {}): Promise<unknown> {
  const { key } = credentials()
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      authorization: `Bearer ${key}`,
    },
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, 300)
    throw new ScalingError('SCALING_PROVIDER_ERROR', 502, `${response.status} ${detail}`)
  }
  return response.status === 204 ? null : response.json().catch(() => null)
}

export function isScalingConfigured(): boolean {
  return Boolean(process.env.RENDER_API_KEY?.trim() && process.env.RENDER_SERVICE_ID?.trim())
}

/** How many instances Render is set to run. */
export async function getInstanceCount(): Promise<number | null> {
  const { service } = credentials()
  const body = (await call(`/services/${service}`)) as {
    serviceDetails?: { numInstances?: number }
  } | null
  return body?.serviceDetails?.numInstances ?? null
}

export async function setInstanceCount(count: number): Promise<void> {
  if (!Number.isInteger(count) || count < 1 || count > MAX_INSTANCES) {
    throw new ScalingError('SCALING_OUT_OF_RANGE', 400)
  }
  const { service } = credentials()
  await call(`/services/${service}/scale`, {
    method: 'POST',
    body: JSON.stringify({ numInstances: count }),
  })
}
