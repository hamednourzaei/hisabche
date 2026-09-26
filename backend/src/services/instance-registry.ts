// ============================================
// backend/src/services/instance-registry.ts
//
// Which backend instances are running right now, and how loaded each is —
// for the platform admin's «servers» page.
//
// Every instance writes a heartbeat to Redis every HEARTBEAT_MS with a TTL of
// HEARTBEAT_TTL_S: an instance that stops (crash, redeploy, scale-down)
// disappears from the list by itself within seconds. Nothing here decides
// correctness — it is observation only.
//
// ⚠️ GPU: Render web services have none. The field is `null`, and the page
// says «no GPU» — a made-up 0% would be a number about hardware that does not
// exist (راهنمای سشن G1).
//
// Without Redis there is no shared place to look: the list holds only the
// instance that answered, and says so (`shared: false`).
// ============================================

import { createHash } from 'node:crypto'

import { cacheService } from './cache.service'
import { WORKER_ID } from './distributed-work'
import { createSampler, type SystemSample } from '../utils/system-metrics'

export const HEARTBEAT_MS = 5_000
const HEARTBEAT_TTL_S = 15
const KEY_PREFIX = 'instance:heartbeat:'

export interface InstanceSnapshot extends SystemSample {
  /** A short, stable label — not the hostname. */
  id: string
  commit: string | null
  gpuPercent: null
  isSelf?: boolean
}

/** The public label of this process: a hash, so host names never leave the server. */
export const INSTANCE_LABEL = createHash('sha256').update(WORKER_ID).digest('hex').slice(0, 8)

let timer: NodeJS.Timeout | null = null

export function startInstanceHeartbeat(inflight: () => number): void {
  if (timer) return
  const sample = createSampler(inflight)
  const beat = () => {
    const snapshot: InstanceSnapshot = {
      ...sample(),
      id: INSTANCE_LABEL,
      commit: process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? null,
      gpuPercent: null,
    }
    void cacheService
      .set(`${KEY_PREFIX}${INSTANCE_LABEL}`, snapshot, HEARTBEAT_TTL_S)
      .catch(() => {})
  }
  beat()
  timer = setInterval(beat, HEARTBEAT_MS)
  timer.unref()
}

export function stopInstanceHeartbeat(): void {
  if (timer) clearInterval(timer)
  timer = null
}

/** Every instance that beat within the TTL. */
export async function listInstances(): Promise<{ shared: boolean; instances: InstanceSnapshot[] }> {
  if (!cacheService.isShared) {
    const own = await cacheService.get<InstanceSnapshot>(`${KEY_PREFIX}${INSTANCE_LABEL}`)
    return { shared: false, instances: own ? [{ ...own, isSelf: true }] : [] }
  }
  const keys = await cacheService.keys(`${KEY_PREFIX}*`)
  const rows = await Promise.all(keys.map((key) => cacheService.get<InstanceSnapshot>(key)))
  const instances = rows
    .filter((row): row is InstanceSnapshot => row !== null)
    .map((row) => ({ ...row, isSelf: row.id === INSTANCE_LABEL }))
    .sort((a, b) => a.id.localeCompare(b.id))
  return { shared: true, instances }
}
