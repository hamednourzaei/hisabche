/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@hisabche/ui', '@hisabche/i18n', '@hisabche/store',
  '@hisabche/validation', '@hisabche/api', '@hisabche/auth',
  ],
  images: {
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
    optimizeCss: true,
  },
  turbopack: {},
  poweredByHeader: false,
  compress: true,
  productionBrowserSourceMaps: false,
  async headers() {
    return [
      {
        source: '/:all*(svg|jpg|png|webp|avif|woff2|css|js)',
        locale: false,
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ]
  },
  async redirects() {
    return [{ source: '/dashboard', destination: '/', permanent: true }]
  },
}

module.exports = nextConfig