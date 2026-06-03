/** @type {import('next').NextConfig} */
const nextConfig = {
  // =========================
  // CORE RUNTIME
  // =========================
  output: 'standalone',
  reactStrictMode: true,

  poweredByHeader: false,
  compress: true,

  // جلوگیری از crashهای production روی errorهای async
  productionBrowserSourceMaps: false,

  // =========================
  // BUILD STABILITY (مهم‌ترین بخش)
  // =========================
  generateBuildId: async () => {
    return `hisabche-${Date.now()}`
  },

  // =========================
  // PACKAGES OPTIMIZATION
  // =========================
  transpilePackages: [
    '@hisabche/ui',
    '@hisabche/i18n',
    '@hisabche/store',
    '@hisabche/validation',
    '@hisabche/api',
    '@hisabche/auth',
  ],

  // =========================
  // IMAGES (LCP optimization)
  // =========================
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96],
    dangerouslyAllowSVG: false,
  },

  // =========================
  // COMPILER OPTIMIZATION
  // =========================
  compiler: {
    removeConsole:
      process.env.NODE_ENV === 'production'
        ? {
            exclude: ['error'],
          }
        : false,
  },

  // =========================
  // EXPERIMENTAL (SAFE MODE)
  // =========================
  experimental: {
    optimizePackageImports: [
      '@hisabche/ui',
      'lucide-react',
    ],
  },

  // =========================
  // HEADERS (SAFE CACHE STRATEGY)
  // =========================
  async headers() {
    return [
     
      // 🔥 images
      {
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400',
          },
        ],
      },

      // 🔥 security headers (Vercel-level baseline)
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ]
  },

  // =========================
  // PERFORMANCE SAFETY
  // =========================
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
}

module.exports = nextConfig