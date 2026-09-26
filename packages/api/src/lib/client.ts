import axios, { AxiosInstance, AxiosError } from 'axios'
import { getToken, tokenReady } from './tokenProvider'
import { readStorage, STORAGE_KEYS } from '../storage'
// Side-effect import: auto-registers the browser adapter when localStorage
// exists. On React Native the host app registers a SecureStore adapter.
import '../storage/web'

// ============================================
// Types
// ============================================
export interface ApiResponse<T = unknown> {
  data: T
  message?: string
  status: number
}

export interface ApiError {
  message: string
  code: string
  status: number
  details?: Record<string, string[]>
}

// ============================================
// Client Setup
// ============================================
// Guarded against a renderer without Node globals: the Electron renderer has no
// `process`, so this package must not crash on import there. Host apps that
// need a different base URL re-point `apiClient.defaults.baseURL` after import.
const env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {}

/**
 * Read a build-time public env var.
 *
 * Both bundlers substitute these by matching the *literal* text
 * `process.env.NEXT_PUBLIC_…` / `process.env.EXPO_PUBLIC_…` in the source, so
 * each one has to be written out in full. Reading them through the `env` object
 * above would leave the value `undefined` in any browser or native bundle,
 * where there is no real `process` to fall back on.
 *
 * The `typeof process` guard keeps this safe in the Electron renderer, which
 * has no Node globals.
 */
function publicEnv(): string | undefined {
  const fromNext = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_API_URL : undefined
  const fromExpo = typeof process !== 'undefined' ? process.env.EXPO_PUBLIC_API_URL : undefined

  return normalizeBaseUrl(fromNext || fromExpo)
}

/**
 * Clean a base URL coming from configuration.
 *
 * Exported because host apps re-point `apiClient.defaults.baseURL` from their
 * own config sources; each one has to sanitise the same way or the fix only
 * covers whichever path happens to run.
 *
 * Trims surrounding whitespace: `set VAR=http://host/api && cmd` in Windows
 * cmd.exe swallows the space before `&&` into the value, which turns every
 * request path into `/api%20/auth/login`. A trailing slash is stripped for the
 * same class of reason — it produces `//auth/login`.
 */
export function normalizeBaseUrl(value: string | undefined | null): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed) return undefined

  return trimmed.replace(/\/+$/, '')
}

// Mobile sets EXPO_PUBLIC_API_URL per EAS profile (staging for development and
// preview builds). Before this was read, every mobile build — including local
// `expo start` — talked to the production API regardless of profile.
/**
 * Does this URL address a collection rather than one record?
 *
 * A trailing id segment — uuid, or a bare number — means "one thing", and a
 * pagination default has no meaning there. Everything else is treated as a
 * collection, so a new list endpoint keeps the default without extra wiring.
 */
const ID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$|^\d+$/i

export function isCollectionUrl(url: string | undefined): boolean {
  if (!url) return false

  const path = url.split('?')[0]?.replace(/\/$/, '') ?? ''
  const lastSegment = path.split('/').pop() ?? ''

  return !ID_SEGMENT.test(lastSegment)
}

const BASE_URL = publicEnv() || 'https://api.hisabche.com/api'
const isDev = env.NODE_ENV !== 'production'

// حداکثر زمانی که یک درخواست منتظر آماده شدن Auth Store می‌ماند (میلی‌ثانیه)
const TOKEN_READY_TIMEOUT_MS = 2000

const devLog = (...args: unknown[]) => {
  if (isDev) console.log(...args)
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

// ============================================
// Helpers
// ============================================
// ✅ callback برای ۴۰۱ — بدون import از Store
let onUnauthorized: (() => void) | null = null

export function setOnUnauthorized(callback: () => void): void {
  onUnauthorized = callback
}

/**
 * Exchanges the stored refresh token for a new access token and returns it,
 * or null when the session cannot be renewed. Registered by the store, like
 * `onUnauthorized`, so this package never imports the store.
 */
let refreshSession: (() => Promise<string | null>) | null = null

export function setRefreshSession(fn: () => Promise<string | null>): void {
  refreshSession = fn
}

// Single flight: ten requests failing together trigger ONE refresh, not ten —
// Supabase rotates refresh tokens, so parallel refreshes would invalidate
// each other and log the user out.
let refreshInFlight: Promise<string | null> | null = null

function refreshOnce(): Promise<string | null> {
  if (!refreshSession) return Promise.resolve(null)
  if (!refreshInFlight) {
    refreshInFlight = refreshSession()
      .catch(() => null)
      .finally(() => {
        refreshInFlight = null
      })
  }
  return refreshInFlight
}

/**
 * The server's code for a write refused because the workspace's subscription
 * has ended (HTTP 402). Stable — the backend guard in
 * `backend/src/middleware/subscription.middleware.ts` sends exactly this.
 */
export const SUBSCRIPTION_EXPIRED_CODE = 'SUBSCRIPTION_EXPIRED'

// Same shape as onUnauthorized: the store registers it, so this package never
// imports the store (which imports this package).
let onSubscriptionExpired: (() => void) | null = null

export function setOnSubscriptionExpired(callback: () => void): void {
  onSubscriptionExpired = callback
}

// ✅ صبر با سقف زمانی؛ اگر Store هیچ‌وقت آماده نشد (مثلاً کاربر مهمان)،
// درخواست بعد از timeout بدون توکن ارسال می‌شود (نه اینکه برای همیشه بلاک بماند)
function waitForTokenReady(): Promise<void> {
  return Promise.race([
    tokenReady,
    new Promise<void>((resolve) => setTimeout(resolve, TOKEN_READY_TIMEOUT_MS)),
  ])
}

/**
 * Whether a JWT's `exp` is past or within 30 seconds. Reads the payload we
 * already hold — not a security check; the server still verifies every token.
 * A token with no readable `exp` is left alone (no answer is not an answer).
 */
export function isExpiring(token: string, now: number = Date.now()): boolean {
  try {
    const payload = token.split('.')[1]
    if (!payload) return false
    const { exp } = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as {
      exp?: unknown
    }
    return typeof exp === 'number' && exp * 1000 - now < 30_000
  } catch {
    return false
  }
}

// ============================================
// Request Interceptor
// ============================================
apiClient.interceptors.request.use(
  async (config) => {
    // ✅ صبر می‌کنیم تا Store توکن‌گیر را ثبت کند (یا سقف زمانی برسد)
    // این کار جلوی 401 کاذب ناشی از race بین mount شدن صفحه و hydrate شدن session را می‌گیرد
    await waitForTokenReady()

    // ⚠️ RENEW BEFORE SENDING, NOT AFTER THE 401.
    //
    // Supabase's auth log showed ~36 `GET /user` → 403 "token is expired" in
    // 13 seconds: every request of a page went out with the stale token, each
    // was verified and refused, and only then did one refresh happen. A token
    // whose `exp` has passed (or is about to) is renewed first — through the
    // same single-flight refresh, so ten requests cause one renewal.
    const current = getToken()
    const isAuthRoute = /\/auth\/(login|signup|refresh|logout)(\/|\?|$)/.test(
      String(config.url ?? ''),
    )
    if (current && !isAuthRoute && refreshSession && isExpiring(current)) {
      await refreshOnce().catch(() => null)
    }

    // ✅ فقط از Token Provider می‌خوانیم
    const token = getToken()
    // A retry after a refresh already carries the renewed token; the store may
    // not have been written yet, and overwriting it here would resend the
    // expired one and end the session for no reason.
    const retried = (config as { _retriedAfterRefresh?: boolean })._retriedAfterRefresh === true

    const keepRenewed = retried && Boolean(config.headers.Authorization)

    if (token && !keepRenewed) {
      config.headers.Authorization = `Bearer ${token}`
    } else {
      devLog('[API Client] no token — unauthenticated request')
    }

    // ✅ زبان از لایه‌ی storage خوانده می‌شود (localStorage روی وب،
    // SecureStore روی موبایل) — این فایل دیگر پلتفرم را نمی‌شناسد.
    config.headers['Accept-Language'] = readStorage(STORAGE_KEYS.language) || 'fa-AF'

    // ✅ FIX: قبلاً limit=50 روی axios instance به‌صورت گلوبال ست شده بود و
    // به تمام درخواست‌ها (حتی POST) اضافه می‌شد. حالا فقط برای GETِ
    // مجموعه‌ای، و فقط وقتی خودِ درخواست limit مشخص نکرده باشد.
    //
    // A single-item read is not a collection: `GET /invoices/:id?limit=50` was
    // reaching production, where the stray parameter became part of the server
    // cache key and made an item read look like a list read.
    if (
      config.method?.toLowerCase() === 'get' &&
      config.params?.limit === undefined &&
      isCollectionUrl(config.url)
    ) {
      config.params = { ...config.params, limit: 50 }
    }

    return config
  },
  (error) => Promise.reject(error),
)

// ============================================
// Response Interceptor
// ============================================
apiClient.interceptors.response.use(
  (response) => response,
  (
    error: AxiosError<{
      message?: string
      code?: string
      details?: Record<string, string[]>
    }>,
  ) => {
    // ⚠️ A request WE cancelled (AbortController / React Query's signal) is
    // passed through untouched. Wrapped like other failures it had no
    // response, so it read as NETWORK_ERROR — which the offline paths treat as
    // "the device is offline, queue it / read the device database".
    if (axios.isCancel(error)) return Promise.reject(error)

    const responseData = error.response?.data as any

    // ─── Expired access token → renew once, retry once ───────────────────
    const original = error.config as
      (typeof error.config & { _retriedAfterRefresh?: boolean }) | undefined
    if (
      error.response?.status === 401 &&
      original &&
      !original._retriedAfterRefresh &&
      // Only the credential endpoints themselves are excluded: a 401 from
      // /auth/login is a wrong password, not an expired session. /auth/me IS
      // renewed — it is what a reload after an hour calls first.
      !/\/auth\/(login|signup|refresh|logout)(\/|\?|$)/.test(String(original.url ?? ''))
    ) {
      original._retriedAfterRefresh = true
      return refreshOnce().then((token) => {
        if (!token) {
          onUnauthorized?.()
          return Promise.reject({
            message: responseData?.error || 'Session expired',
            code: responseData?.code || 'UNAUTHORIZED',
            status: 401,
          } satisfies ApiError)
        }
        original.headers = original.headers ?? {}
        ;(original.headers as Record<string, string>).Authorization = `Bearer ${token}`
        return apiClient.request(original)
      })
    }

    const apiError: ApiError = {
      // ✅ FIX: اکثر route های بک‌اند خطا رو با کلید `error` برمی‌گردونن
      // (مثلاً { error: 'Wrong email' })، نه `message` — قبلاً این‌جا
      // فقط responseData?.message چک می‌شد، پس همیشه به پیام عمومی
      // axios ("Request failed with status code 400") سقوط می‌کرد و
      // پیام واقعی سرور هیچ‌وقت به کاربر نمی‌رسید.
      message:
        responseData?.error ||
        responseData?.message ||
        error.message ||
        'An unexpected error occurred',
      // ⚠️ No response at all is not a server error. It used to arrive as
      // status 500 / UNKNOWN_ERROR — indistinguishable from the server failing
      // — so nothing could decide "the network is down, queue it".
      code: responseData?.code || (error.response ? 'UNKNOWN_ERROR' : 'NETWORK_ERROR'),
      status: error.response?.status || 500,
      details: responseData?.details,
    }

    // ✅ ۴۰۱ → فقط callback صدا می‌شود (بدون logout، بدون loop)
    // ✅ بدون گیت پلتفرم — callback فقط وقتی ثبت شده باشد صدا می‌شود،
    // پس روی سرور بی‌اثر و روی موبایل (که window دارد ولی مرورگر نیست) درست است.
    if (apiError.status === 401) {
      devLog('[API Client] 401 — triggering onUnauthorized callback')
      onUnauthorized?.()
    }

    // 402 alone is not enough: only the subscription lock raises the notice,
    // so an unrelated 402 is never explained as "your subscription ended".
    if (apiError.status === 402 && apiError.code === SUBSCRIPTION_EXPIRED_CODE) {
      onSubscriptionExpired?.()
    }

    return Promise.reject(apiError)
  },
)

export default apiClient
