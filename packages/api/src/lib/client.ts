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
const BASE_URL = env.NEXT_PUBLIC_API_URL || 'https://api.hisabche.com/api'
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

// ✅ صبر با سقف زمانی؛ اگر Store هیچ‌وقت آماده نشد (مثلاً کاربر مهمان)،
// درخواست بعد از timeout بدون توکن ارسال می‌شود (نه اینکه برای همیشه بلاک بماند)
function waitForTokenReady(): Promise<void> {
  return Promise.race([
    tokenReady,
    new Promise<void>((resolve) => setTimeout(resolve, TOKEN_READY_TIMEOUT_MS)),
  ])
}

// ============================================
// Request Interceptor
// ============================================
apiClient.interceptors.request.use(
  async (config) => {
    // ✅ صبر می‌کنیم تا Store توکن‌گیر را ثبت کند (یا سقف زمانی برسد)
    // این کار جلوی 401 کاذب ناشی از race بین mount شدن صفحه و hydrate شدن session را می‌گیرد
    await waitForTokenReady()

    // ✅ فقط از Token Provider می‌خوانیم
    const token = getToken()

    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    } else {
      devLog('[API Client] no token — unauthenticated request')
    }

    // ✅ زبان از لایه‌ی storage خوانده می‌شود (localStorage روی وب،
    // SecureStore روی موبایل) — این فایل دیگر پلتفرم را نمی‌شناسد.
    config.headers['Accept-Language'] = readStorage(STORAGE_KEYS.language) || 'fa-AF'

    // ✅ FIX: قبلاً limit=50 روی axios instance به‌صورت گلوبال ست شده بود و
    // به تمام درخواست‌ها (حتی POST و درخواست‌های تک‌آیتمی مثل GET /:id) اضافه
    // می‌شد. حالا فقط برای GET و فقط وقتی خودِ درخواست limit مشخص نکرده باشد.
    if (config.method?.toLowerCase() === 'get' && config.params?.limit === undefined) {
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
    const responseData = error.response?.data as any

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
      code: responseData?.code || 'UNKNOWN_ERROR',
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

    return Promise.reject(apiError)
  },
)

export default apiClient
