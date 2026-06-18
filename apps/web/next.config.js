/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  productionBrowserSourceMaps: false,

  generateBuildId: async () => {
    return `hisabche-${Date.now()}`
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
    minimumCacheTTL: 60,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96],
    dangerouslyAllowSVG: false,
  },

  compiler: {
    removeConsole:
      process.env.NODE_ENV === 'production'
        ? { exclude: ['error'] }
        : false,
  },

  // ═══════════════════════════════════════════════════════════════
  // MOBILE PERFORMANCE OPTIMIZATIONS
  // ═══════════════════════════════════════════════════════════════
  
  // Browser targets — modern only (no polyfills)
  browsersList: [
    'defaults',
    'not IE 11',
    'not op_mini all',
  ],

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
      'axios',
    ],
    optimizeCss: true,
    // Server Components برای کاهش bundle client
    serverActions: {
      bodySizeLimit: '2mb',
    },
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
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400' }],
      },
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },

  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
}
module.exports = nextConfig