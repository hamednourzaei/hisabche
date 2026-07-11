/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  productionBrowserSourceMaps: false,

  turbopack: {},

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
      '@tanstack/react-query',
      'react-i18next',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-popover',
      'react-hook-form',
      'zod',
    ],
    optimizeCss: true,
    serverActions: { bodySizeLimit: '2mb' },
  },

  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'hisabche.com' }],
        destination: 'https://www.hisabche.com/:path*',
        permanent: true,
      },
    ];
  },

  async headers() {
    return [
      // ─── Static Assets (long cache) ───
      {
        source: '/fonts/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/images/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }],
      },
      {
        source: '/_next/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/favicon.svg',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400' }],
      },
      {
        source: '/site.webmanifest',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400' }],
      },
      // ─── All Routes — Security ───
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // 🆕 Security Headers
          { 
            key: 'Strict-Transport-Security', 
            value: 'max-age=63072000; includeSubDomains; preload' 
          },
          { 
            key: 'Content-Security-Policy', 
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://api.hisabche.com https://*.supabase.co https://www.google-analytics.com; frame-src 'self';" 
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;