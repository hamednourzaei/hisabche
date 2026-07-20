// ============================================
// Token Provider — مستقل از همه لایه‌ها
// بدون وابستگی به Zustand، React، یا هر کتابخانه دیگر
// ============================================

type TokenGetter = () => string | null

let tokenGetter: TokenGetter | null = null

/**
 * ثبت یک تابع برای دریافت token.
 * فقط یک بار از سمت Store صدا زده می‌شود.
 */
export function registerTokenGetter(fn: TokenGetter): void {
  tokenGetter = fn
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