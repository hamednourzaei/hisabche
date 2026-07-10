// apps/web/proxy.ts
import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './app/[lang]/i18n-config';

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'as-needed',
  localeDetection: true,
});

export default intlMiddleware;

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|assets|favicon|android-chrome|apple-touch-icon|site.webmanifest|manifest.json|logo-icon|og-image|robots.txt|sitemap.xml).*)',
  ],
};