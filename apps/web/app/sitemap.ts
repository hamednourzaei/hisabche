// ============================================
// apps/web/src/app/sitemap.ts
// ============================================

import { MetadataRoute } from 'next'

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.hisabche.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date().toISOString()

  const staticPages = [
    { url: baseUrl, lastModified: now, changeFrequency: 'weekly' as const, priority: 1.0 },
    { url: `${baseUrl}/dashboard`, lastModified: now, changeFrequency: 'daily' as const, priority: 0.9 },
    { url: `${baseUrl}/invoices`, lastModified: now, changeFrequency: 'daily' as const, priority: 0.9 },
    { url: `${baseUrl}/godam`, lastModified: now, changeFrequency: 'daily' as const, priority: 0.9 },
    { url: `${baseUrl}/baqidari`, lastModified: now, changeFrequency: 'daily' as const, priority: 0.9 },
    { url: `${baseUrl}/settings`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.5 },
    { url: `${baseUrl}/login`, lastModified: now, changeFrequency: 'yearly' as const, priority: 0.3 },
    { url: `${baseUrl}/quick-invoice`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.8 },
    { url: `${baseUrl}/onboarding`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.6 },
  ]

  return staticPages
}