/** @type {import('next').NextConfig} */
const nextConfig = {
output: 'standalone',
  reactStrictMode: true,
  transpilePackages: [
    '@hisabche/ui', '@hisabche/i18n', '@hisabche/store',
    '@hisabche/validation', '@hisabche/api', '@hisabche/auth',
  ],
  images: {
    formats: ['image/webp', 'image/avif'],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  experimental: {
    optimizeCss: true,
  },
  poweredByHeader: false,
  compress: true,
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
    return [
      { source: '/dashboard', destination: '/', permanent: true },
    ]
  },
}

module.exports = nextConfig