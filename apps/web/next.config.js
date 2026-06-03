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
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
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
}

module.exports = nextConfig