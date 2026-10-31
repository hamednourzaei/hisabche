// apps/web/proxy.ts
import createMiddleware from 'next-intl/middleware'
import { NextResponse, type NextRequest } from 'next/server'
import { isPageDisabled } from '@hisabche/ui-contract'
import { locales, defaultLocale } from './app/[lang]/i18n-config'

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  // ✅ همه‌ی زبان‌ها پیشوند می‌گیرند (fa هم /fa). قبلاً fa به‌عنوان زبان
  // پیش‌فرض بدون پیشوند سرو می‌شد و URL هنگام تعویض به فارسی تغییر
  // محسوسی نداشت.
  localePrefix: 'always',
  localeDetection: true,
  // ⚠️ GSC 18 Oct 2026. next-intl added its own `Link:` hreflang header on
  // every page: x-default = https://hisabche.com/ (a 307 redirect) and «af»
  // where the page's own tags say «fa-AF». Two conflicting hreflang sets on one
  // page; the HTML `alternates` (i18n-config `languageAlternates`) are the
  // only ones now.
  alternateLinks: false,
}) as unknown as (req: NextRequest) => NextResponse

/**
 * Where a visitor to a switched-off page (`DISABLED_PAGES` in ui-contract) is
 * sent. The page files stay as they were: this is the door, so a page is
 * switched off in one list and the route files carry no switch of their own.
 */
const DISABLED_PAGE_TARGET: Readonly<Record<string, string>> = {
  '/marketplace': '/settings',
  '/market-seller': '/settings',
}

export default function middleware(req: NextRequest): ReturnType<typeof intlMiddleware> {
  // /<lang>/<page>… — the locale is always in the path (localePrefix: 'always').
  const match = /^\/([a-z]{2})(\/[^/]+)/.exec(req.nextUrl.pathname)
  const page = match?.[2]
  // A page that is switched off but has no entry above still goes somewhere:
  // the settings page. Forgetting the entry must not leave the page reachable.
  const target =
    page && isPageDisabled(page) ? (DISABLED_PAGE_TARGET[page] ?? '/settings') : undefined
  if (match && target) {
    return NextResponse.redirect(new URL(`/${match[1]}${target}`, req.url)) as ReturnType<
      typeof intlMiddleware
    >
  }
  return intlMiddleware(req)
}

export const config = {
  // ✅ FIX: قبلاً فقط یک لیست ثابت از فایل‌های استاتیک (favicon، manifest و..)
  // exclude می‌شد؛ هر فایل دیگری مستقیم زیر public/ (مثل dashboard-desktop.png،
  // dashboard-mobile.png) توسط این middleware به‌عنوان یک "صفحه" در نظر گرفته
  // می‌شد و ریدایرکت ۳۰۷ به /af/dashboard-desktop.png می‌خورد — که چون
  // فایل‌های public همیشه فقط از ریشه سرو می‌شوند نه زیر پیشوند locale، ۴۰۴
  // می‌داد. حالا هر مسیری که یک پسوند فایل استاتیک دارد (نقطه + حروف) به‌طور
  // کلی از این middleware مستثنا می‌شود.
  matcher: ['/((?!api|_next/static|_next/image|.*\\.[a-zA-Z0-9]+$).*)'],
}
