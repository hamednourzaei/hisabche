// ============================================
// API bootstrap — reuses the shared axios client from @hisabche/api.
// Only the base URL is re-pointed; Vite does not inline NEXT_PUBLIC_*.
//
// In Electron the renderer is subject to browser CORS, so outbound HTTP is
// routed through the main-process proxy (bridge().http.request) which has no
// such restriction. When the bridge is absent (tests, browser preview) axios
// falls back to its default direct transport.
// ============================================

import { apiClient } from '@hisabche/api'
import { bridge } from './bridge'

const FALLBACK_API_URL = 'https://api.hisabche.com/api'

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? FALLBACK_API_URL

apiClient.defaults.baseURL = API_BASE_URL

function buildUrl(baseURL: string | undefined, path: string | undefined, params: unknown): string {
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

const bridgeHttp = bridge()?.http
if (bridgeHttp) {
  apiClient.defaults.adapter = async (config) => {
    // Concatenate, don't resolve: `new URL('/auth/login', '…/api')` drops the
    // '/api' path segment of the base URL and every request 404s.
    const url = buildUrl(config.baseURL, config.url, config.params)
    const headers: Record<string, string> = {}
    const configHeaders = config.headers as Record<string, string> | undefined
    if (configHeaders) {
      for (const [key, value] of Object.entries(configHeaders)) {
        if (typeof value === 'string') headers[key] = value
      }
    }

    const body =
      config.data !== undefined
        ? typeof config.data === 'string'
          ? config.data
          : JSON.stringify(config.data)
        : null

    const res = await bridgeHttp.request({
      url,
      method: (config.method ?? 'get').toUpperCase() as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
      headers,
      body,
    })

    let data: unknown
    try {
      data = res.data ? JSON.parse(res.data) : null
    } catch {
      data = res.data
    }

    return {
      data,
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
      config,
    }
  }
}

export { apiClient }
