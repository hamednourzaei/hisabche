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
 *
 * ⚠️ REGISTERING THE GETTER IS NOT THE SAME AS HAVING A SESSION.
 *
 * This used to resolve `tokenReady` too, and the store calls it at module
 * import — BEFORE the persisted session has been read back out of storage. So
 * every request fired during the first paint went out with no Authorization
 * header, took a 401, and was only rescued by the refresh-and-retry path. The
 * screen worked; the console filled with 401s on `/notifications`,
 * `/accounting/accounts`, `/invoices` … on every page load.
 *
 * Readiness is now declared by the store, with `markTokenReady()`, once
 * hydration has actually finished.
 */
export function registerTokenGetter(fn: TokenGetter): void {
  tokenGetter = fn
}

/**
 * The session has been read out of storage (or there is none). Everything
 * waiting on `tokenReady` may now send its request.
 *
 * Idempotent: a second call is a no-op, so the store can call it from both
 * the rehydrate callback and the «storage was empty» path without racing.
 */
export function markTokenReady(): void {
  if (isReady) return
  isReady = true
  resolveReady?.()
  resolveReady = null
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
