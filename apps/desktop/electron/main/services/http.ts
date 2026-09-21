// ============================================
// Outbound HTTP proxy (main process).
//
// Electron renderers are subject to browser CORS, which blocks direct calls to
// the production API from a dev-time origin (e.g. http://localhost:5173). The
// main process runs in Node and has no such restriction, so API traffic is
// routed through here over IPC. The renderer never sends cookies; auth is an
// explicit Authorization header, and requests are scoped to the app's own
// domains plus http(s) so a compromised renderer can't reach arbitrary hosts
// beyond what the contract permits.
// ============================================

import { httpRequestSchema, type HttpRequestResponse } from '@hisabche/app-bridge'

const ALLOWED_HOSTS = [
  'api.hisabche.com',
  'hisabche.com',
  'localhost',
  '127.0.0.1',
  '10.0.2.2', // Android emulator host alias, harmless on desktop
]

function isAllowed(url: URL): boolean {
  return (
    (url.protocol === 'https:' || url.protocol === 'http:') &&
    ALLOWED_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))
  )
}

export async function httpRequest(input: unknown): Promise<HttpRequestResponse> {
  const parsed = httpRequestSchema.parse(input)

  const url = new URL(parsed.url)
  if (!isAllowed(url)) {
    throw new Error(`FORBIDDEN: host not allowed: ${url.hostname}`)
  }

  const response = await fetch(parsed.url, {
    method: parsed.method,
    headers: parsed.headers ?? {},
    ...(parsed.body != null ? { body: parsed.body } : {}),
  })

  const headers: Record<string, string> = {}
  response.headers.forEach((value, key) => {
    headers[key] = value
  })

  return {
    status: response.status,
    statusText: response.statusText,
    headers,
    data: await response.text(),
  }
}
