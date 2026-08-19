export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

// This page used to render the shared `AuthContainer` for visual consistency
// with the web app. That looked right and was silently broken: AuthContainer
// authenticates against the Fastify backend (auth.slice.ts → POST
// /api/auth/login) and keeps the resulting JWT in the zustand store, while this
// app's middleware (proxy.ts) authorizes with `supabase.auth.getUser()`, i.e.
// it reads a Supabase session cookie that the backend login never sets.
//
// The result was a login that appeared to succeed and then bounced straight
// back to /login forever, with no error shown — the two systems disagreed about
// what "signed in" means.
//
// LoginClient signs in through Supabase, so it sets the cookie the middleware,
// lib/admin-auth.ts and lib/supabase-server.ts are all built around. It already
// existed for exactly this purpose and was simply never imported.
import { Suspense } from 'react'
import { LoginClient } from './login-client'

export default function AdminLoginPage() {
  // LoginClient reads `?error=admin_required` with `useSearchParams()`, which
  // Next requires to sit inside a Suspense boundary — without one, path
  // generation for this route crashes the render worker and the page 500s.
  return (
    <Suspense fallback={null}>
      <LoginClient />
    </Suspense>
  )
}
