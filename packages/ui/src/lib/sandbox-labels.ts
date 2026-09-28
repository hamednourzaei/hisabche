// ============================================
// packages/ui/src/lib/sandbox-labels.ts
//
// Words for the sandbox service's refusals. A CLOSED list: the code comes
// from the server, and t() throws on a key that does not exist.
// ============================================

import { SANDBOX_ERROR_CODES } from '@hisabche/validation'
import { apiErrorMessage } from '@hisabche/api'

export function sandboxErrorMessage(
  t: (key: string) => string,
  error: unknown,
  fallback: string,
): string {
  const code = (error as { response?: { data?: { code?: unknown } } } | null)?.response?.data?.code
  return typeof code === 'string' && (SANDBOX_ERROR_CODES as readonly string[]).includes(code)
    ? t(`sandbox.error.${code}`)
    : apiErrorMessage(error, fallback)
}
