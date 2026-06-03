/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  reactStrictMode: true,

  transpilePackages: [
    '@hisabche/ui',
    '@hisabche/i18n',
    '@hisabche/store',
    '@hisabche/validation',
    '@hisabche/api',
    '@hisabche/auth',
  ],

  images: {
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
  },

  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  experimental: {
    optimizePackageImports: [
      '@hisabche/ui',
      'lucide-react',
    ],
  },

  poweredByHeader: false,
  compress: true,

  // 🚨 مهم: حذف headers سنگین روی HTML
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig