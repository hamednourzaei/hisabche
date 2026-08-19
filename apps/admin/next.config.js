/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@hisabche/ui',
    '@hisabche/api',
    '@hisabche/auth',
    '@hisabche/auth-core',
    '@hisabche/validation',
    '@hisabche/formatting',
    '@hisabche/i18n',
    '@hisabche/store',
  ],
  images: {
    formats: ['image/avif', 'image/webp'],
  },

  // The admin panel must never be indexed. app/robots.ts disallows crawling and
  // app/[lang]/layout.tsx sets a noindex meta tag; this header makes the
  // directive part of the response itself, so it also covers non-HTML responses
  // and crawlers that ignore robots.txt.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
}

const withNextIntl = require('next-intl/plugin')('./i18n/request.ts')

module.exports = withNextIntl(nextConfig)
