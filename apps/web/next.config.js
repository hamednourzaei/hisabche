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
    // 256/384/512 so a phone-width screenshot (13rem × DPR 2.6 ≈ 550px) is not
    // served from the 640px device size — PageSpeed measured 15 KiB wasted there.
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384, 512],
    dangerouslyAllowSVG: false,
    // Blog covers and in-article images: the public `blog-images` bucket only
    // (docs/blog-migration.sql). Served through the optimiser so a 2 MB upload
    // reaches a phone as a right-sized AVIF/WebP — it is the article's LCP.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/blog-images/**',
      },
    ],
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
    // The three stylesheets (26 KiB) were render-blocking requests on every
    // public page — ~300 ms of FCP on PageSpeed's mobile profile. Inline them.
    inlineCss: true,
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
        // Icons, app screenshots and the manifest sit in the root of public/,
        // which had no rule — Vercel served them `max-age=0, must-revalidate`,
        // so every visit re-checked each one. Names are not content-hashed, so
        // a day plus a week of stale-while-revalidate, not `immutable`.
        source:
          '/:file(favicon\.ico|favicon-.*\.png|android-chrome-.*\.png|apple-touch-icon\.png|logo-icon\.png|dashboard-.*\.png|site\.webmanifest|llms\.txt)',
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
