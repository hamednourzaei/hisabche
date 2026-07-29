// eslint-disable-next-line @typescript-eslint/no-require-imports -- CJS config file, require() is required here
const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
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
      'react-i18next',
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

  async redirects() {
    return [
      {
        // Canonicalize apex domain -> www, preserving the original path (including
        // any locale segment already in it, e.g. /fa/pricing or /en/login).
        // Previously this force-prefixed everything with "/en", which meant a
        // request like hisabche.com/fa/pricing was sent to
        // https://www.hisabche.com/en/fa/pricing — a non-existent, double-locale
        // URL — breaking hreflang targets and any inbound links to the apex domain.
        source: '/:path*',
        has: [{ type: 'host', value: 'hisabche.com' }],
        destination: 'https://www.hisabche.com/:path*',
        permanent: true,
      },
    ]
  },

  async headers() {
    return [
      {
        source: '/fonts/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/images/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/en',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600, stale-while-revalidate=86400' },
        ],
      },
      {
        source: '/',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600, stale-while-revalidate=86400' },
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