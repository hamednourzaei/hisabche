import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createAdminSupabaseServer } from './lib/supabase-server'

const PUBLIC_FILE = /\.(.*)$/
const LOCALES = ['fa', 'en'] as const
const DEFAULT_LOCALE = 'fa'

function getLocaleSegment(pathname: string): string | null {
  const firstSegment = pathname.split('/').filter(Boolean)[0]
  if (LOCALES.includes(firstSegment as (typeof LOCALES)[number])) {
    return firstSegment
  }
  return null
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

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
    redirect.searchParams.set('callbackUrl', pathname)
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

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo-icon.svg).*)'],
}
