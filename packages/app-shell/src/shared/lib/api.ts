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
import { createHostHttpAdapter } from './host-http-adapter'

const FALLBACK_API_URL = 'https://api.hisabche.com/api'

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? FALLBACK_API_URL

apiClient.defaults.baseURL = API_BASE_URL

// The adapter itself lives in host-http-adapter.ts (testable without Vite).
const bridgeHttp = bridge()?.http
if (bridgeHttp) apiClient.defaults.adapter = createHostHttpAdapter(bridgeHttp)

export { apiClient }
