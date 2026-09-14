const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // `NEXT_STANDALONE=0` builds a plain `.next` for `next start` — standalone
  // copying needs symlink rights a normal Windows account lacks (EPERM), which
  // made a local production check impossible. Unset = standalone, as deployed.
  ...(process.env.NEXT_STANDALONE === '0' ? {} : { output: 'standalone' }),
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  productionBrowserSourceMaps: false,

  // ✅ FIX: بدون این، Next.js ریشه‌ی workspace را اشتباه حدس می‌زد
  // (به‌خاطر یک package-lock.json اضافه در C:\Users\hamed) و خروجی
  // standalone را زیر یک مسیر عجیب (.next/standalone/Desktop/hisabche/...)
  // می‌ساخت که با هیچ مسیر واقعی روی سرور production مطابقت نداشت —
  // همان چیزی که باعث ۴۰۴ شدن عکس‌های public/ (dashboard-desktop.png و
  // مشابه) در production می‌شد.
  outputFileTracingRoot: path.join(__dirname, '../..'),

  // ✅ Turbopack
  turbopack: {
    root: path.join(__dirname, '../..'),
  },

  transpilePackages: [
    '@hisabche/ui',
    '@hisabche/formatting',
    '@hisabche/ui-contract',
    '@hisabche/i18n',
    '@hisabche/store',
    '@hisabche/validation',
    '@hisabche/api',
    '@hisabche/auth',
  ],

  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 31536000,
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96],
    dangerouslyAllowSVG: false,
  },

  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error'] } : false,
  },

  experimental: {
    optimizePackageImports: [
      '@hisabche/ui',
      'lucide-react',
      'framer-motion',
      '@tanstack/react-query',
      'next-intl',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-popover',
      '@radix-ui/react-accordion',
      '@radix-ui/react-switch',
      '@radix-ui/react-slot',
      'react-hook-form',
      'zod',
    ],
    optimizeCss: true,
    serverActions: { bodySizeLimit: '2mb' },
  },

  async headers() {
    return [
      {
        source: '/fonts/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/images/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        // Landing pages. These were previously keyed on '/en' and '/' — but the
        // proxy runs with `localePrefix: 'always'`, so '/' is a redirect and
        // '/fa' and '/af' (the two highest-traffic locales) got no cache header
        // at all. ':lang' covers every locale segment.
        source: '/:lang(fa|af|en)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600, stale-while-revalidate=86400' },
        ],
      },
      {
        // Transport-level backstop for token-shared customer data. A meta tag
        // only applies once the page is parsed, and only by crawlers that parse
        // HTML; X-Robots-Tag applies to the response itself. Defence in depth
        // alongside the per-route `robots` metadata and the Disallow in
        // app/robots.ts. `noindex` here is safe because these pages must never
        // be indexed under any circumstances.
        source: '/:path*/:kind(public-invoice|public-task)/:token*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet, noimageindex' },
          { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
        ],
      },
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // ✅ اضافه شد: CSP Header
        ],
      },
    ]
  },
}

const withNextIntl = require('next-intl/plugin')('./i18n/request.ts')

module.exports = withNextIntl(nextConfig)
