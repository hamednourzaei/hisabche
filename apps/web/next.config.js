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
    optimizePackageImports: [
      '@hisabche/ui',
      'lucide-react',
    ],
  },
  
  poweredByHeader: false,
  compress: true,
  
  // فقط فایل‌های استاتیک با hash در اسم فایل
  async headers() {
    return [
      {
        source: '/_next/static/chunks/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/_next/static/media/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/images/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400' },
        ],
      },
    ]
  },
}

module.exports = nextConfig