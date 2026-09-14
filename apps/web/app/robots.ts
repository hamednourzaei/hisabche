// apps/web/app/robots.ts
import type { MetadataRoute } from 'next'
import { SITE_URL } from './[lang]/i18n-config'

/**
 * Two things this file must get right, both of which it previously got wrong:
 *
 * 1. `/_next/` must NOT be disallowed. Those are the JS and CSS chunks the page
 *    needs to render. Blocking them means any crawler outside the two
 *    explicitly-allowed groups below sees an empty shell, and it contradicts
 *    Google's own guidance. Only `/_next/data/` (RSC payloads, never a landing
 *    page) is excluded.
 *
 * 2. Token-gated pages that render real customer data — /public-invoice/[token]
 *    and /public-task/[token] — are disallowed. They already emit
 *    `robots: { index: false }`, but a meta tag only takes effect *after* the
 *    crawler has fetched and parsed the page, i.e. after a shopkeeper's invoice
 *    has been served to it. A Disallow stops the fetch.
 *
 * Note the authenticated app is listed here as defence in depth only. The real
 * boundary is server-side authorization plus the per-route `noindex`; robots.txt
 * is a crawl directive, not an access control, and a disallowed URL can still be
 * indexed URL-only from an external link.
 */
export default function robots(): MetadataRoute.Robots {
  const disallow = [
    '/api/',
    '/_next/data/',
    // Token-shared customer data — must not be fetched at all.
    '/public-invoice/',
    '/public-task/',
    '/*/public-invoice/',
    '/*/public-task/',
    // Authenticated surfaces.
    '/*/dashboard',
    '/*/invoices',
    '/*/customers',
    '/*/warehouse',
    '/*/settings',
    '/*/billing',
    '/*/crm',
    '/*/accounting',
    '/*/purchasing',
    '/*/manufacturing',
    '/*/human-resources',
    '/*/team-and-payroll',
    '/*/permissions',
    '/*/approvals',
    '/*/activities',
    '/*/sync-center',
    '/*/quick-invoice',
    '/*/workflow-templates',
    '/*/onboarding',
    '/*/accept-invite',
    // Stray Vercel smoke-test file in public/.
    '/test.html',
  ]

  return {
    rules: [
      { userAgent: '*', allow: '/', disallow },
      { userAgent: 'Googlebot', allow: '/', disallow },
      { userAgent: 'Bingbot', allow: '/', disallow },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    // No `host:` directive. It is not part of the robots.txt standard — it was a
    // Yandex extension — and Search Console flags it as "Rule ignored by
    // Googlebot". Canonical host is already enforced properly by the apex→www
    // 308 redirect in next.config.js and by the self-referencing canonical tags,
    // which is what Google actually reads.
  }
}
