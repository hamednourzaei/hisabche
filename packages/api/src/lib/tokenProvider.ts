// ============================================
// Token Provider — مستقل از همه لایه‌ها
// بدون وابستگی به Zustand، React، یا هر کتابخانه دیگر
// ============================================

type TokenGetter = () => string | null

let tokenGetter: TokenGetter | null = null
let isReady = false
let resolveReady: (() => void) | null = null

/**
 * Hydration finished BEFORE a getter existed, so readiness is owed.
 *
 * ⚠️ THE ORDER IS NOT UNDER THE STORE'S CONTROL. zustand-persist with
 * synchronous storage runs `onRehydrateStorage` DURING `create()` — which is
 * before the next statement in the store's module body, where
 * `registerTokenGetter` is called. Announcing readiness there released every
 * waiting request while `tokenGetter` was still null, so they went out with no
 * Authorization header and took a 401: the exact bug the split was meant to
 * fix, moved one line earlier.
 *
 * Holding the promise until BOTH have happened makes the order irrelevant.
 */
let readyPending = false

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
  // Hydration already announced itself and was held. Release it now that
  // there is something to read the token from.
  if (readyPending) {
    readyPending = false
    settle()
  }
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

  // ⚠️ A READY SIGNAL WITH NO GETTER IS WORSE THAN NO SIGNAL. It would release
  // the request interceptor to send with no token. Remember it instead, and
  // `registerTokenGetter` releases it a moment later.
  if (!tokenGetter) {
    readyPending = true
    return
  }

  settle()
}

function settle(): void {
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
