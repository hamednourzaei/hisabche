import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createAdminSupabaseServer } from './lib/supabase-server'

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
    return NextResponse.next()
  }

  // Check if the URL already has a locale segment
  const locale = getLocaleSegment(pathname)

  if (!locale) {
    // Root path or un-prefixed path — redirect to default locale
    const redirect = req.nextUrl.clone()
    redirect.pathname = `/${DEFAULT_LOCALE}${pathname === '/' ? '' : pathname}`
    return NextResponse.redirect(redirect)
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
      return NextResponse.redirect(redirect, 301)
    }
  }

  // Public routes that don't require admin auth (app-level, without locale prefix)
  const PUBLIC_ROUTES = ['/login', '/signup', '/reset-password', '/api/public']

  const isPublic = PUBLIC_ROUTES.some((r) => appPath.startsWith(r))
  if (isPublic) {
    return NextResponse.next()
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
    return NextResponse.redirect(redirect)
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
    return NextResponse.redirect(redirect, 302)
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
    return NextResponse.redirect(redirect, 302)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo-icon.svg).*)'],
}
