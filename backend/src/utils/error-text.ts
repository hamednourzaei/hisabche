// ============================================
// backend/src/utils/error-text.ts
//
// The message of something thrown, read without `catch (err: any)` (13 Nov 2026).
// A caught value is `unknown`: an Error gives its message, anything else its text.
// ============================================

export function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
