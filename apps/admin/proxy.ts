import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createAdminSupabaseServer } from './lib/supabase-server'

// ============================================
// V63 · S-4 — security headers live here, not in next.config.js.
//
// A Content-Security-Policy with a NONCE has to be generated per response and
// handed to Next through the request headers (`x-nonce` + a CSP request
// header); a static CSP in next.config.js either needs 'unsafe-inline' (which
// removes most of its value) or breaks Next's own inline bootstrap. The other
// headers are static and stay in next.config.js — one place each.
//
// The console renders rich HTML (TipTap blog/CMS previews), so `script-src`
// is the header that matters: `'strict-dynamic'` with a nonce means an
// injected <script> tag cannot execute even if it reaches the DOM.
// ============================================

function extraConnectSources(): string[] {
  const sources = new Set<string>()
  for (const raw of [
    process.env.NEXT_PUBLIC_API_URL,
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_URL,
  ]) {
    if (!raw) continue
    try {
      const url = new URL(raw)
      sources.add(url.origin)
      if (url.protocol === 'https:') sources.add(`wss://${url.host}`)
    } catch {
      // A malformed value is a configuration error, not a reason to widen the
      // policy: the platform is reached on the same origin as the app.
    }
  }
  return [...sources]
}

function buildCsp(nonce: string): string {
  const connect = ["'self'", ...extraConnectSources()].join(' ')
  const dev = process.env.NODE_ENV !== 'production'
  return [
    "default-src 'self'",
    // Next injects its bootstrap inline; the nonce lets exactly those run.
    // 'unsafe-eval' is development-only (React refresh needs it) and never
    // shipped: a production build must not eval.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    // Columns, spacing and TipTap's inline styles are style attributes. A
    // style nonce would require rewriting every component; 'unsafe-inline'
    // for styles does not permit script execution.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src ${connect}`,
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    ...(dev ? [] : ['upgrade-insecure-requests']),
  ].join('; ')
}

/** Headers every admin response carries, redirects included. */
function staticSecurityHeaders(): Array<[string, string]> {
  return [
    // Two years, subdomains, preload-eligible. The console is never served over
    // plain HTTP; a downgrade would leak the session cookie.
    ['Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload'],
    // The console never needs a camera, a microphone or the location.
    ['Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()'],
    // Keep the admin origin in its own browsing context group.
    ['Cross-Origin-Opener-Policy', 'same-origin'],
    ['X-DNS-Prefetch-Control', 'off'],
    ['X-Content-Type-Options', 'nosniff'],
    ['X-Frame-Options', 'DENY'],
  ]
}

function applyStaticHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of staticSecurityHeaders()) response.headers.set(key, value)
  return response
}

/** A rendered page: static headers + a fresh nonce for its CSP. */
function pageResponse(req: NextRequest): NextResponse {
  const nonce = btoa(crypto.randomUUID())
  const csp = buildCsp(nonce)

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-nonce', nonce)
  // Next reads this request header to attach the nonce to its own scripts.
  requestHeaders.set('Content-Security-Policy', csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  applyStaticHeaders(response)
  response.headers.set('Content-Security-Policy', csp)
  // ⚠️ V63 · S-4 — an admin page is personalised and contains customer data.
  // A shared proxy or a disk cache must never hold it; `no-store` is the only
  // directive that forbids writing it to disk at all.
  response.headers.set('Cache-Control', 'no-store, max-age=0')
  return response
}

const PUBLIC_FILE = /\.(.*)$/
const LOCALES = ['fa', 'af', 'en'] as const
const DEFAULT_LOCALE = 'fa'

const OLD_ROUTE_REDIRECTS: Record<string, string> = {
  // `/fa` alone has no page — it was a 404.
  '/': '/dashboard?tab=overview',
  '/dashboard': '/dashboard?tab=overview',
  '/workspaces': '/customers?tab=workspaces',
  '/users': '/customers?tab=users',
  '/subscriptions': '/revenue?tab=subscriptions',
  '/wallet': '/revenue?tab=wallet',
  '/ai': '/product?tab=ai',
  '/oauth-apps': '/product?tab=oauth',
  '/market': '/product?tab=market',
  '/servers': '/operations?tab=servers',
  '/blog': '/content?tab=blog',
  '/audit-logs': '/security?tab=audit',
}

function getLocaleSegment(pathname: string): string | null {
  const firstSegment = pathname.split('/').filter(Boolean)[0]
  if (LOCALES.includes(firstSegment as (typeof LOCALES)[number])) {
    return firstSegment
  }
  return null
}

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl

  // Allow static files and Next.js internals
  if (PUBLIC_FILE.test(pathname)) {
    return applyStaticHeaders(NextResponse.next())
  }

  // Check if the URL already has a locale segment
  const locale = getLocaleSegment(pathname)

  if (!locale) {
    // Root path or un-prefixed path — redirect to default locale
    const redirect = req.nextUrl.clone()
    redirect.pathname = `/${DEFAULT_LOCALE}${pathname === '/' ? '' : pathname}`
    return applyStaticHeaders(NextResponse.redirect(redirect))
  }

  // Strip the locale to get the app-level pathname
  const appPath = `/${pathname.split('/').slice(2).join('/')}`

  // Check redirects for old routes
  if (OLD_ROUTE_REDIRECTS[appPath]) {
    const target = OLD_ROUTE_REDIRECTS[appPath]!
    const [targetPath, targetQuery] = target.split('?')
    const [qKey, qVal] = (targetQuery ?? '').split('=')

    const isSamePath = appPath === targetPath
    const hasSameQuery = qKey ? req.nextUrl.searchParams.get(qKey) === qVal : true

    if (!isSamePath || !hasSameQuery) {
      const redirect = req.nextUrl.clone()
      redirect.pathname = `/${locale}${targetPath}`
      if (qKey && qVal && !redirect.searchParams.has(qKey)) {
        redirect.searchParams.set(qKey, qVal)
      }
      return applyStaticHeaders(NextResponse.redirect(redirect, 301))
    }
  }

  // Public routes that don't require admin auth (app-level, without locale prefix)
  // A television cannot hold an admin session with MFA. `/wall` is public by
  // design and its only credential is a scoped, expiring wall token that
  // reaches aggregate monitor counts and nothing else (V63 · M-6).
  const PUBLIC_ROUTES = ['/login', '/signup', '/reset-password', '/api/public', '/wall']

  const isPublic = PUBLIC_ROUTES.some((r) => appPath.startsWith(r))
  if (isPublic) {
    return pageResponse(req)
  }

  // Authenticate against the existing Supabase session
  const supabase = await createAdminSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const redirect = req.nextUrl.clone()
    redirect.pathname = `/${locale}/login`
    redirect.searchParams.set('callbackUrl', pathname + search)
    return applyStaticHeaders(NextResponse.redirect(redirect))
  }

  // 🔐 PLATFORM ADMIN CHECK
  const emails = (process.env.ADMIN_ALLOWED_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

  const userEmail = user.email ? user.email.toLowerCase() : ''

  if (!emails.includes(userEmail)) {
    const redirect = req.nextUrl.clone()
    redirect.pathname = `/${locale}/login`
    redirect.searchParams.set('error', 'admin_required')
    return applyStaticHeaders(NextResponse.redirect(redirect, 302))
  }

  // 🔐 MANDATORY MFA (AAL2) CHECK FOR ADMIN
  // The level is a claim of the session's access token. The previous check read
  // `user.app_metadata.aal`, which Supabase never writes — so in production
  // every admin, including the owner, was sent back to the login page forever.
  // `getUser()` above has already verified this session with Supabase.
  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  const hasAal2 = assurance?.currentLevel === 'aal2'

  if (process.env.NODE_ENV === 'production' && !hasAal2) {
    const redirect = req.nextUrl.clone()
    redirect.pathname = `/${locale}/login`
    redirect.searchParams.set('error', 'mfa_required')
    return applyStaticHeaders(NextResponse.redirect(redirect, 302))
  }

  return pageResponse(req)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo-icon.svg).*)'],
}
