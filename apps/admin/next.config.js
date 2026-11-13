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

  async redirects() {
    return [
      {
        source: '/:lang(fa|af|en)/workspaces',
        destination: '/:lang/customers?tab=workspaces',
        permanent: true,
      },
      {
        source: '/:lang(fa|af|en)/users',
        destination: '/:lang/customers?tab=users',
        permanent: true,
      },
      {
        source: '/:lang(fa|af|en)/subscriptions',
        destination: '/:lang/revenue?tab=subscriptions',
        permanent: true,
      },
      {
        source: '/:lang(fa|af|en)/wallet',
        destination: '/:lang/revenue?tab=wallet',
        permanent: true,
      },
      {
        source: '/:lang(fa|af|en)/ai',
        destination: '/:lang/product?tab=ai',
        permanent: true,
      },
      {
        source: '/:lang(fa|af|en)/oauth-apps',
        destination: '/:lang/product?tab=oauth',
        permanent: true,
      },
      {
        source: '/:lang(fa|af|en)/market',
        destination: '/:lang/product?tab=market',
        permanent: true,
      },
      {
        source: '/:lang(fa|af|en)/servers',
        destination: '/:lang/operations?tab=servers',
        permanent: true,
      },
      {
        source: '/:lang(fa|af|en)/blog',
        destination: '/:lang/content?tab=blog',
        permanent: true,
      },
      {
        source: '/:lang(fa|af|en)/audit-logs',
        destination: '/:lang/security?tab=audit',
        permanent: true,
      },
    ]
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
          // V63 · S-4. The nonce-bearing CSP is generated per response in
          // proxy.ts (a static one cannot carry a nonce); these are static and
          // cover responses the middleware does not see, e.g. static assets.
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
          },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ],
      },
    ]
  },
}

const withNextIntl = require('next-intl/plugin')('./i18n/request.ts')

module.exports = withNextIntl(nextConfig)
