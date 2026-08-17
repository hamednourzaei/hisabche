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
}

const withNextIntl = require('next-intl/plugin')('./i18n/request.ts')

module.exports = withNextIntl(nextConfig)
