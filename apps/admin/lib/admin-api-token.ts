// ============================================
// apps/admin/lib/admin-api-token.ts
// Bridges the admin panel's Supabase session to the shared API client.
//
// There is no second credential to obtain here. The backend's `authenticate`
// middleware (backend/src/middleware/auth.middleware.ts) verifies the bearer
// token with `supabase.auth.getUser(token)`, and `POST /api/auth/login` simply
// returns `session.access_token` — the very same Supabase access token that
// `signInWithPassword` already produced in this app. Web/desktop/mobile keep
// that token in the zustand auth store; the admin panel keeps it in the
// Supabase session cookie/storage instead.
//
// So the only thing missing was wiring: `@hisabche/api` asks a registered
// getter for the token, and nothing in apps/admin ever registered one — every
// `/api/admin/*` call went out with no `Authorization` header and the backend
// answered 401 ("Missing authorization header").
//
// Authorization itself is unchanged and still server-side: `authenticate`
// verifies the signature and `platformAdminGuard` checks ADMIN_ALLOWED_EMAILS
// on the backend.
// ============================================

import { markTokenReady, registerTokenGetter } from '@hisabche/api'
import { createAdminSupabaseClient } from './supabase-client'

let accessToken: string | null = null
let started = false

/**
 * Register a token getter backed by the live Supabase session.
 *
 * The getter must be synchronous (that is the `@hisabche/api` contract), so the
 * current access token is cached here and refreshed from `onAuthStateChange` —
 * which also fires on `TOKEN_REFRESHED`, so a long-lived tab never starts
 * sending an expired token.
 *
 * Readiness is declared only after the first `getSession()` resolves:
 * `markTokenReady()` releases the `tokenReady` promise that the API client
 * awaits, and declaring it earlier would let the first request race out
 * without a header.
 */
export function initAdminApiAuth(): void {
  if (started || typeof window === 'undefined') return
  started = true

  const supabase = createAdminSupabaseClient()

  supabase.auth.onAuthStateChange((_event, session) => {
    accessToken = session?.access_token ?? null
  })

  void supabase.auth.getSession().then(({ data }) => {
    if (data.session) {
      accessToken = data.session.access_token
    }
    registerTokenGetter(() => accessToken)
    markTokenReady()
  })
}
