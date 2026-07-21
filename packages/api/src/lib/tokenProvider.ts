// ============================================
// Token Provider — مستقل از همه لایه‌ها
// بدون وابستگی به Zustand، React، یا هر کتابخانه دیگر
// ============================================

type TokenGetter = () => string | null

let tokenGetter: TokenGetter | null = null
let isReady = false
let resolveReady: (() => void) | null = null

/**
 * Promise‌ای که وقتی Store برای اولین‌بار توکن‌گیر را ثبت کند resolve می‌شود.
 * برای جلوگیری از race condition بین mount شدن صفحه و آماده شدن session استفاده می‌شود.
 */
export const tokenReady: Promise<void> = new Promise((resolve) => {
  resolveReady = resolve
})

/**
 * ثبت یک تابع برای دریافت token.
 * فقط یک بار از سمت Store صدا زده می‌شود (پس از hydrate شدن session).
 */
export function registerTokenGetter(fn: TokenGetter): void {
  tokenGetter = fn
  if (!isReady) {
    isReady = true
    resolveReady?.()
    resolveReady = null
  }
}

/**
 * دریافت token فعلی.
 * توسط API client استفاده می‌شود.
 */
export function getToken(): string | null {
  return tokenGetter?.() ?? null
}

/**
 * بررسی وجود token.
 */
export function hasToken(): boolean {
  return getToken() !== null
}

/**
 * آیا Store تاکنون توکن‌گیر را ثبت کرده است؟
 * (برخلاف hasToken، این فقط "آماده بودن" را می‌سنجد، نه وجود توکن معتبر — کاربر مهمان هم می‌تواند ready باشد)
 */
export function isTokenProviderReady(): boolean {
  return isReady
}