// ============================================
// HTTP through the host (desktop main process / Android native side).
//
// Both hosts make the request outside the page, because the page's origin
// (localhost in dev, file:// in the APK) is one no CORS list can name. This
// adapter turns an axios request into the bridge's `http.request` and back.
//
// ⚠️ BYTES. A binary response (Hisabche Sync Binary) comes back as `bytes`
// from desktop (IPC carries a Uint8Array) and as `bytesBase64` from Android
// (its bridge is JSON). Reading either as text corrupts it — that was a real
// defect, caught before deploy: every Android pull would have failed.
//
// Kept apart from api.ts (which reads Vite's import.meta.env) so it can be
// tested as the code that actually runs.
// ============================================

import { base64ToBytes, type HisabcheBridge } from '@hisabche/app-bridge'

type HostHttp = HisabcheBridge['http']

/** The parts of an axios request config this adapter reads. */
export interface HostRequestConfig {
  baseURL?: string | undefined
  url?: string | undefined
  params?: unknown
  headers?: unknown
  data?: unknown
  method?: string | undefined
  responseType?: string | undefined
}

export function buildUrl(
  baseURL: string | undefined,
  path: string | undefined,
  params: unknown,
): string {
  // Concatenate, don't resolve: `new URL('/auth/login', '…/api')` drops the
  // '/api' path segment of the base URL and every request 404s.
  const relative = path ?? ''
  const absolute = /^https?:\/\//i.test(relative)
    ? relative
    : `${(baseURL ?? '').replace(/\/+$/, '')}/${relative.replace(/^\/+/, '')}`

  if (!params || typeof params !== 'object') return absolute

  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
    if (value !== undefined && value !== null) query.append(key, String(value))
  }
  const search = query.toString()
  if (!search) return absolute

  return absolute + (absolute.includes('?') ? '&' : '?') + search
}

export function createHostHttpAdapter(http: HostHttp) {
  return async <C extends HostRequestConfig>(config: C) => {
    const url = buildUrl(config.baseURL, config.url, config.params)
    const headers: Record<string, string> = {}
    const configHeaders = config.headers as Record<string, unknown> | undefined
    if (configHeaders) {
      for (const [key, value] of Object.entries(configHeaders)) {
        if (typeof value === 'string') headers[key] = value
      }
    }

    // A binary body crosses desktop IPC as bytes, never as a JSON-stringified
    // object of numbered keys.
    const bodyBytes = config.data instanceof Uint8Array ? config.data : undefined
    const body =
      config.data !== undefined && !bodyBytes
        ? typeof config.data === 'string'
          ? config.data
          : JSON.stringify(config.data)
        : null
    const wantsBytes = config.responseType === 'arraybuffer'

    const res = await http.request({
      url,
      method: (config.method ?? 'get').toUpperCase() as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
      headers,
      body,
      ...(bodyBytes ? { bodyBytes } : {}),
      ...(wantsBytes ? { responseType: 'bytes' as const } : {}),
    })

    let data: unknown
    if (wantsBytes) {
      // What axios gives for responseType 'arraybuffer' on the web: an ArrayBuffer.
      const bytes =
        res.bytes ?? (res.bytesBase64 ? base64ToBytes(res.bytesBase64) : new Uint8Array(0))
      data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    } else {
      try {
        data = res.data ? JSON.parse(res.data) : null
      } catch {
        data = res.data
      }
    }

    return { data, status: res.status, statusText: res.statusText, headers: res.headers, config }
  }
}
