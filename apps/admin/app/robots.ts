// apps/admin/app/robots.ts
import type { MetadataRoute } from 'next'

/**
 * The platform admin panel must never appear in any index.
 *
 * Without this file Next serves no robots.txt at all, i.e. fully permissive,
 * and the only protection was the `robots: { index: false }` meta tag in
 * app/[lang]/layout.tsx — which is applied after a crawler has already fetched
 * the page. A blanket Disallow stops the crawl.
 *
 * No sitemap is declared, deliberately: there is nothing here to index.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', disallow: '/' }],
  }
}
