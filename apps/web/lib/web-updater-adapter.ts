/**
 * Web Adapter (Slice S3):
 * - Build-ID version-skew detection via /api/version (no-store)
 * - Bounded exponential backoff retry for failed dynamic chunk loads
 * - Strict deferral of reloads while invoice/payment/ledger operations are active
 */

export interface WebSkewCheckResult {
  status: 'UP_TO_DATE' | 'RELOAD_RECOMMENDED' | 'DEFERRED_FINANCIAL_OP' | 'CHECK_FAILED'
  runningBuildId: string
  serverBuildId?: string | undefined
}

export async function checkWebVersionSkew(input: {
  runningBuildId: string
  versionUrl?: string | undefined
  hasActiveFinancialOperation: () => boolean
  fetchFn?: typeof fetch | undefined
}): Promise<WebSkewCheckResult> {
  const fetchImpl = input.fetchFn ?? fetch
  const url = input.versionUrl ?? '/api/version'
  try {
    const res = await fetchImpl(url, { cache: 'no-store' })
    if (!res.ok) {
      return { status: 'CHECK_FAILED', runningBuildId: input.runningBuildId }
    }
    const body = (await res.json()) as { buildId?: string }
    const serverBuildId = typeof body.buildId === 'string' ? body.buildId : undefined
    if (!serverBuildId || serverBuildId === input.runningBuildId) {
      return {
        status: 'UP_TO_DATE',
        runningBuildId: input.runningBuildId,
        serverBuildId,
      }
    }
    if (input.hasActiveFinancialOperation()) {
      return {
        status: 'DEFERRED_FINANCIAL_OP',
        runningBuildId: input.runningBuildId,
        serverBuildId,
      }
    }
    return {
      status: 'RELOAD_RECOMMENDED',
      runningBuildId: input.runningBuildId,
      serverBuildId,
    }
  } catch {
    return { status: 'CHECK_FAILED', runningBuildId: input.runningBuildId }
  }
}

export function isChunkLoadFailure(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const name = err.name ?? ''
  const msg = err.message ?? ''
  return (
    name === 'ChunkLoadError' ||
    msg.includes('Loading chunk') ||
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed')
  )
}

export async function retryChunkLoad<T>(
  loader: () => Promise<T>,
  opts: {
    maxRetries?: number | undefined
    baseDelayMs?: number | undefined
    sleepFn?: ((ms: number) => Promise<void>) | undefined
  } = {},
): Promise<T> {
  const maxRetries = opts.maxRetries ?? 2
  const baseDelayMs = opts.baseDelayMs ?? 150
  const sleep =
    opts.sleepFn ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))

  let lastError: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await loader()
    } catch (err) {
      lastError = err
      if (!isChunkLoadFailure(err) || attempt === maxRetries) {
        throw err
      }
      await sleep(baseDelayMs * Math.pow(2, attempt))
    }
  }
  throw lastError
}
