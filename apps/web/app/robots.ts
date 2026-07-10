import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/api/', '/_next/'] },
      { userAgent: 'Googlebot', allow: '/' },
    ],
    sitemap: 'https://hisabche.com/sitemap.xml',
  }
}