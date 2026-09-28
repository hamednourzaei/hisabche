// ============================================
// packages/ui/src/lib/oauth-labels.ts
//
// Words for what the OAuth service returns. Both lists are CLOSED: the values
// come from the server, and t() throws on a key that does not exist.
// ============================================

import { OAUTH_APP_STATUSES, OAUTH_ERROR_CODES } from '@hisabche/validation'
import { apiErrorMessage } from '@hisabche/api'

type T = (key: string) => string

export function oauthStatusLabel(t: T, status: string): string {
  return (OAUTH_APP_STATUSES as readonly string[]).includes(status)
    ? t(`oauth.status.${status}`)
    : status
}

/** The sentence for a refusal: the shared one if the code is known, else what the server wrote. */
export function oauthErrorMessage(t: T, error: unknown, fallback: string): string {
  const code = (error as { response?: { data?: { code?: unknown } } } | null)?.response?.data?.code
  return typeof code === 'string' && (OAUTH_ERROR_CODES as readonly string[]).includes(code)
    ? t(`oauth.error.${code}`)
    : apiErrorMessage(error, fallback)
}
