# Indexability policy — Hisabche public web

Source of truth: `docs/SEO/URL-INVENTORY.csv` (real HTTP against the production
build on port 3111, 25 Oct 2026) plus the code that produces each page type.
Status of the pages listed in the sitemap: **VERIFIED** (all 123 answer 200,
self-canonical, indexable, no redirect). Index decisions for future pages:
**IMPLEMENTED_NOT_EXTERNALLY_VERIFIED** until Google recrawls.

## 1. Counts (measured)

| Bucket                    |                                               Count |
| ------------------------- | --------------------------------------------------: |
| URLs in the inventory     |                                                 262 |
| URLs in the sitemap       |                                                 123 |
| Unique indexable pages    |    123 (126 rows, 3 are the `/xx/docs` 308 sources) |
| `noindex` pages           |                                                 136 |
| 404                       | 2 (`/fa/market`, `/en/market` — marketplace closed) |
| Redirect sources recorded |                            28 × 3 locales + 28 bare |

The 3 `/xx/docs` rows that look indexable are the 308 redirect to the entry
article; they are the same page as `/xx/docs/getting-started`, not extra pages.

## 2. Index — page by page

| Page type                                        | Decision                      | Reason in code                                                                                                              |
| ------------------------------------------------ | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Landing `/{locale}`                              | **index**                     | The only page targeting the head term; `h1` in server HTML                                                                  |
| `/about`, `/contact`                             | **index**                     | Real company/contact information; thin but legitimate                                                                       |
| `/features/*` (6 slugs × 3)                      | **index**                     | Commercial-intent pages, real product behaviour in `FEATURES`                                                               |
| `/docs/*` (22 × 3)                               | **index**                     | `DOCS_ARTICLES`, each article has unique body + `TechArticle`                                                               |
| `/legal/*` (10 × 3)                              | **index**                     | Required trust pages; short but complete                                                                                    |
| `/blog`                                          | **index when posts exist**    | `blog-shared.tsx` marks the hub thin (noindex) while it has zero posts. It flips automatically on the first published post. |
| `/blog/[slug]`, `/blog/page/N`, tags, categories | **index when content exists** | Sitemap only lists them when the API returns posts (`blogEntries()`)                                                        |
| `/market`                                        | **index only when open**      | Closed → backend 404 → `notFound()`; sitemap conditional                                                                    |
| `/market/[seller]`, `/[listing]`                 | **index when public**         | Data comes from `fetchMarketSitemap`; paused listing leaves the sitemap                                                     |

## 3. `noindex` — classified

Every `noindex` below is **INTENTIONAL**; none is accidental.

| Group                   | Examples                                                                                                            | Why                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Auth doors              | `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/accept-invite`                                        | No content, no search intent; would compete with the landing                                    |
| Private app (dashboard) | `/invoices`, `/customers`, `/warehouse`, `/accounting`, all 115 redirect-resolved dashboard URLs                    | Requires a session; also disallowed in `robots.txt`                                             |
| Token pages             | `/public-invoice/[token]`, `/portal/[token]`, `/my-attendance/[token]`, `/public-task/[token]`, `/feedback/[token]` | Real customer data behind an unguessable token; `Disallow` in robots so the fetch never happens |
| Marketplace closed      | `/market`                                                                                                           | The marketplace is off by default; an empty page must not be indexed (BUG-086)                  |
| Empty blog hub          | `/blog`                                                                                                             | Thin while it has no posts; conditional, not permanent                                          |

`robots.txt` is **not** used to remove a page from the index except for token
pages. Any page that should stay out of results but must be crawled uses
`noindex` and stays crawlable. The sitemap never lists a `noindex` URL.

## 4. Query parameters

| Parameter                   | Page            | Decision                                                                                                   |
| --------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------- |
| `?tab=`, `?view=`, `?type=` | dashboard pages | Private, `noindex`, disallowed in robots. Never linked from a public page except as a `nofollow` app door. |
| `?lang`                     | none            | Not used; the locale is a path segment                                                                     |
| `utm_*`, `fbclid`           | any             | Never canonicalised to; canonical is always the clean path                                                 |
| `/blog/page/N`              | blog pagination | Self-canonical per page (never to page 1), reachable by real links, `noindex` is not needed                |
| tag/category pages          | blog            | Self-canonical, only listed while posts exist; a one-post tag page is thin and is left out of the sitemap  |

## 5. hreflang and fa/af

`fa` and `af` are separate locales with **separate copy**, not machine
translations of one page. The guide and feature pages deliberately use different
Dari framing (see the header of `features/[slug]/page.tsx`). They are therefore
not duplicates and both are indexed.

Every indexable page carries a bidirectional cluster (`fa`, `af`, `en`,
`x-default`) whose targets were verified: **0 hreflang issues** in the crawl —
every target is 200, indexable and self-canonical.

## 6. Canonical

- Absolute (`https://hisabche.com/...`), one per page, self-referential.
- Never points at a redirect, 404 or `noindex` page: **0 broken canonical
  targets** in the crawl.
- The root layout emits no canonical; each page owns its own.
- `/xx/docs` (308) is not in the sitemap and is not a canonical target; the docs
  breadcrumb was corrected to Home → article so it no longer names `/docs`.

## 7. What is deliberately absent

No `/pricing` route (pricing is a landing section), no product/category pages,
no industry pages (the product does not ship industry landing pages), and no
search-results pages. Creating them would be fabricated content and is forbidden
by `landing-claims.test.ts`.
