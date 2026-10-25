# Technical SEO audit — Hisabche public web

Date: 25 Oct 2026
Source of truth: a **production build** served on `http://localhost:3111` and the
**real HTTP responses** it returned — not code reading.
Generator: `scripts/seo/crawl-inventory.mjs`
Raw output: `docs/SEO/URL-INVENTORY.csv`, `docs/SEO/audit-summary.json`.

> Status vocabulary: `VERIFIED` = measured from a real 200/404/redirect response
> here. `IMPLEMENTED_NOT_EXTERNALLY_VERIFIED` = code + tests green, Google has not
> recrawled. `REQUIRES_GOOGLE` = only Search Console can confirm.

## 1. How the inventory was built

1. `cd apps/web && pnpm run build` → 128 static pages, Next.js 16.2.6.
2. `pnpm exec next start -p 3111`.
3. The crawler reads `sitemap.xml` (and any sitemap index), discovers every
   `app/[lang]/**/page.tsx` outside `(dashboard)`, adds all 28 `moved` redirect
   sources from `next.config.js` (locale-scoped and bare), then fetches every URL
   with `redirect: 'manual'` and records the **full chain**.
4. For each response it parses canonical, `meta robots`, `X-Robots-Tag`,
   hreflang, `<title>`, `<h1>` count, JSON-LD and every internal `<a href>`, and
   counts real inbound links from the crawled HTML.
5. Canonical comparison is by **pathname**, because the canonical host is
   `https://hisabche.com` while the crawl runs on localhost. Sitemap entries are
   rewritten to the crawl origin so no request accidentally goes to production.

## 2. Before / after

| Metric                                                         |   Before |                After | Note                                                                     |
| -------------------------------------------------------------- | -------: | -------------------: | ------------------------------------------------------------------------ |
| Crawl URLs                                                     |      301 |                  262 | Before mixed production-host sitemap URLs with localhost; now one origin |
| HTTP 500                                                       |        6 |                **0** | `/blog` and `/market`; relative server fetch                             |
| HTTP 200                                                       |      295 |                  259 |                                                                          |
| HTTP 404                                                       |        0 |                    3 | `/fa/market`, `/af/market`, `/en/market` — marketplace correctly closed  |
| Sitemap URLs                                                   |      123 |                  123 |                                                                          |
| Sitemap not 200 / noindex / non-self-canonical                 |        — |        **0 / 0 / 0** |                                                                          |
| hreflang issues                                                |        — |                **0** | every target 200 + indexable                                             |
| Broken canonical targets                                       |        — |                **0** |                                                                          |
| Duplicate titles (same path)                                   |      42* |                **0** | *before number was inflated by host mixing                               |
| Indexable rows (unique pages)                                  |      165 | **126 (123 unique)** | 123 in the sitemap + the 3 `/xx/docs` 308 sources                        |
| `noindex` pages                                                |      136 |                  136 | all intentional (see policy)                                             |
| Indexable pages with ≠1 `<h1>`                                 |        0 |                **0** |                                                                          |
| robots-blocked indexable pages                                 |        — |                **0** |                                                                          |
| Indexable thin pages                                           |        — |                    3 | only `/contact` ×3 (34–35 words, real address/phone)                     |
| Important orphans                                              |        — |                **0** |                                                                          |
| JSON-LD invalid / forbidden (`Review`, `Rating`, fake `Offer`) |        — |            **0 / 0** |                                                                          |
| Internal links in raw HTML                                     |   2,784* |                2,760 | *before included the `/` clone of `/fa`                                  |
| Average / max crawl depth                                      | 1.79 / 3 |         **1.80 / 3** |                                                                          |
| Links through a redirect                                       |        0 |                **0** |                                                                          |

## 3. The fifteen audit questions

1. **Redirects — how many, and do any loop or end badly?**
   28 permanent (`moved`) redirect pairs × 3 locales, plus each bare source. Every
   recorded chain ends in 200. No loop, no 404 destination. The bare form is
   `307 → /{locale}/…` (locale middleware, `localePrefix: 'always'`) then
   `308 → final`. The locale hop is inherent to the proxy and cannot be removed
   without changing locale resolution; `VERIFIED`.
2. **404s — which URLs, and are they real?**
   Only the three closed marketplace hubs. Unknown blog slugs and unknown market
   sellers/listings return a real 404 (`/fa/blog/anything-unknown`,
   `/fa/market/unknown-seller`), not a 200 empty shell. `VERIFIED`.
3. **Wrong canonicals — how many?** 0. Every 200 indexable page is absolute and self-referential by path; 0
   canonical targets answer anything but 200. `VERIFIED`.
4. **In and out of the sitemap — mismatches?**
   123 in the sitemap, all 200, all self-canonical, all indexable. 0 sitemap URLs
   are redirects, 404s or `noindex`. The only indexable URLs outside the sitemap
   are the three `/xx/docs` 308 sources, which are the entry article under
   another name — correctly excluded. `VERIFIED`.
5. **Orphans — important pages with no inbound link?** 0. Every sitemap page has at least 19 inbound links in the raw HTML; average
   inbound on indexable pages is 20.95. `VERIFIED`.
6. **Query-only URLs — are any indexable?** 0. `?tab=`, `?view=`, `?type=` exist only on dashboard pages, which are
   `noindex` and disallowed. `?utm_*` is never canonicalised to. `VERIFIED`.
7. **Duplicates — title/canonical?**
   0 duplicate titles on the same path after excluding redirect sources. `fa` and
   `af` are separate locales with separate copy, not duplicates. `VERIFIED`.
8. **Middleware — does it add hops or break locale?**
   Yes, one 307 for a bare path; that is the documented `localePrefix: 'always'`
   behaviour. Internal links never use the bare form, so users and crawlers
   entering through a link pay 0 hops (`linksThroughRedirect: 0`). `VERIFIED`.
9. **Auth-dependent URLs — are any indexable?**
   115 dashboard URLs, all `noindex` + `robots.txt` disallowed. `VERIFIED`.
10. **Locale-dependent URLs — complete?**
    78 inventory rows per locale, symmetric. All three locales are live. `VERIFIED`.
11. **hreflang — bidirectional and valid?**
    0 issues. Every hreflang target is 200, indexable, self-canonical; each page
    lists itself in its cluster; `x-default` present where defined. `VERIFIED`.
12. **robots.txt — does it block anything it shouldn't?**
    0 indexable URLs match a `Disallow`. The sitemap is declared. `_next/static`
    is open; only `_next/data` is closed. Token pages are disallowed so customer
    data is never fetched. `VERIFIED` (unit guard + real robots.txt).
13. **JSON-LD — valid types and no invented data?**
    0 invalid blocks, 0 `AggregateRating`, 0 `Review`, 0 fake `Offer`. The landing
    previously emitted `Organization`/`WebSite` twice and `FAQPage` twice; fixed.
    `VERIFIED` (source guard + crawl).
14. **Headings — one meaningful h1 per public page?**
    Every indexable page has exactly one `<h1>`; the landing's h1 is rendered by
    the server component `journey-hero.tsx`, not by the 3D scene. 21 private/auth
    pages have no h1, which is correct. `VERIFIED`.
15. **Content quality — thin or duplicate?**
    Only `/contact` ×3 is below the company-page bar (34–35 words) and it carries
    the real address/phone; kept and documented. 121 other "thin" rows are
    dashboard/auth pages that are not indexable. `VERIFIED`.

## 4. The ~120 "Discovered – currently not indexed" URLs

The Search Console export is not in the repository. The table was reconstructed
from the 123 sitemap URLs and their measured inbound links/content:
`docs/SEO/DISCOVERED-DECISIONS.csv` (one row per URL, columns include the
verdict and the reason).

| Verdict                  |                           Count | Basis                                                             |
| ------------------------ | ------------------------------: | ----------------------------------------------------------------- |
| `keep`                   |                             123 | 200, self-canonical, indexable, ≥19 inbound, unique h1            |
| `keep+strengthen`        |                               0 | no sitemap page is below 19 inbound                               |
| `canonical-to-X`         |                               0 | no duplicate intent found                                         |
| `exclude`                | 0 sitemap / 3 `/docs` redirects | the three rows outside the sitemap are the 308 sources, not pages |
| `thin→fix content first` |           0 sitemap / 3 contact | contact is legitimate company info                                |

**This is the important finding:** the not-indexed cohort is **not** caused by
missing links or thin content. Every sitemap page is linked, canonical and has one
h1. The remaining explanation is crawl timing/authority for a young property —
`REQUIRES_GOOGLE`. If the owner supplies the real Search Console CSV later, drop
it next to this file and map its URLs to the `verdict` column; the table is keyed
by URL, so no rewrite is needed.

## 5. Defects found and fixed

| #   | Defect                                                               | Evidence                                                                                     | Fix                                                                                                                                                              |
| --- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `/blog` and `/market` returned **HTTP 500**                          | Server log: `TypeError: Failed to parse URL from /api/blog/...`; crawl 6 × 500               | `apps/web/lib/blog-api.ts` + `market-api.ts`: server base must be absolute; relative `NEXT_PUBLIC_API_URL=/api` now falls back to `https://api.hisabche.com/api` |
| 2   | Upstream timeout turned a public page into 500 under concurrency     | `TimeoutError: The operation was aborted` in the same log                                    | one retry for network/timeout; a real HTTP error still throws (never rendered as empty)                                                                          |
| 3   | Landing JSON-LD duplicated `Organization`, `WebSite`, `FAQPage`      | Crawl: `Organization, WebSite, Organization, WebSite, SoftwareApplication, FAQPage, FAQPage` | `app/[lang]/page.tsx` now emits only `SoftwareApplication`; layout owns the site graph, `faq-scene` owns FAQ                                                     |
| 4   | Docs `BreadcrumbList` middle item pointed at `/docs` (a 308)         | `/fa/docs` answers 308                                                                       | breadcrumb is now Home → article                                                                                                                                 |
| 5   | Public header linked `/login` and `/signup` without `rel="nofollow"` | Raw HTML                                                                                     | `public-auth-actions.tsx` adds `rel="nofollow"`                                                                                                                  |

## 6. What was not changed, and why

- The 28 intentional `moved` redirects stay; the two lists (web + app-shell) must
  remain identical (`route-parity`).
- The locale 307 on bare URLs stays; removing it would change locale resolution.
- `/docs` stays a 308; it is out of the sitemap and no breadcrumb targets it.
- The empty blog hub stays `noindex` while it has no posts; it flips to `index`
  automatically on the first post.
- No new pages were created. There is no `/pricing` page, no industry pages and
  no product/category pages in this product; inventing them would be fake
  content (`landing-claims`).
