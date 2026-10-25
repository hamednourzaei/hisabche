# Internal linking — the state before any change

Measured 25 Oct 2026 against the production build served on `http://localhost:3111`
(`cd apps/web && pnpm run build`, then `next start -p 3111`).
No JavaScript was executed: every number below comes from the raw HTML the server
sent, parsed by `scripts/seo/internal-link-audit.mjs`.

## 1. Search Console baseline (provided by the owner, screenshot)

| Item                     |                           Reported value |
| ------------------------ | ---------------------------------------: |
| Internal links (total)   |                                        1 |
| Top linked internal page |       `https://hisabche.com/fa` (1 link) |
| External links           |      2 (scamadviser.com → `/` and `/fa`) |
| Top linking text         | `visit` — external anchor text, not ours |

This is a delayed report. It describes what Google had **crawled and indexed at
the time of the report**, not what the site ships today.

## 2. Our own raw-HTML baseline

Command:

```bash
node scripts/seo/internal-link-audit.mjs --base http://localhost:3111 --depth 3 --max 400
```

Output: `docs/SEO/internal-link-report.json` / `.md`.

| Metric                                             |                                                          Before |
| -------------------------------------------------- | --------------------------------------------------------------: |
| Pages fetched                                      |                                                             181 |
| `<a href>` links in server HTML                    |                                                           2,784 |
| Unique internal targets                            |                                                             183 |
| Pages with 0 inbound                               | 1 (`/fa` — an artefact: `/` and `/fa` were stored as two nodes) |
| Pages with exactly 1 inbound                       |                                                              45 |
| Pages with ≥3 inbound                              |                                                             133 |
| Pages with ≥5 inbound                              |                                                             132 |
| Broken links                                       |          0 real (3 were beyond the depth limit; re-checked 200) |
| Links through a redirect                           |                                                               0 |
| Links to noindex pages                             |                                                             183 |
| Links to non-canonical pages                       |                                                               0 |
| Generic anchors (`visit`, `here`, `click here`, …) |                                                               0 |
| Important orphan pages                             |                                                               0 |
| Average crawl depth                                |                                                            1.79 |
| Maximum crawl depth                                |                                                               3 |
| Average inbound (indexable pages)                  |                                                           20.95 |

The landing page alone (`/fa`) contains **67 `<a href>` elements, 38 unique
targets**, including five feature pages, three guide articles, blog, about,
contact and all ten legal pages. The header renders real locale-prefixed
anchors (`/fa`, `/fa/signup`); the footer renders six feature pages, the guide
entry article, the blog and the ten legal pages.

## 3. Which hypothesis from §0 is the actual cause

| #   | Hypothesis                                                      | Verdict         | Evidence                                                                                                       |
| --- | --------------------------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------- |
| 1   | Links only exist after hydration / `router.push`                | **Rejected**    | 67 `<a href>` in the raw `/fa` HTML with JS disabled                                                           |
| 2   | The 3D landing exposes no linkable content                      | **Rejected**    | `JourneyHero` is a server component; the `<h1>` and the CTA anchors are in the raw HTML                        |
| 3   | Links go to `/` and pass through a redirect                     | **Rejected**    | `linksThroughRedirect: 0`; logo and nav use `/{locale}`                                                        |
| 4   | Important links are `nofollow` or behind `noindex`              | **Partly true** | `/login` and `/signup` were linked without `rel="nofollow"`; the blog hub is `noindex` while it has zero posts |
| 5   | Header/footer expose too few important links                    | **Rejected**    | 6 features + docs + blog + legal in the footer; 5 features in the landing body                                 |
| 6   | `'use client'` / `prefetch={false}` removed links from SSR HTML | **Rejected**    | The anchors are present in the server HTML; `prefetch={false}` only affects prefetching, not the anchor        |

**Conclusion.** The "1 internal link" number is not explained by missing links in
today's HTML. The site ships a dense, crawlable link graph (2,784 links, average
depth 1.79). The report is consistent with a young property whose crawl at the
time covered only one page, plus the external `visit` anchor being attributed
where an internal number was expected. The real, fixable defects we found were:
two public-to-private link pairs without `nofollow`, an empty blog hub that is
`noindex` yet linked site-wide, and the `/` vs `/fa` duplicate node in our own
measurement. None of them required inventing new pages or links.

## 4. Decisions taken from this baseline

- Keep the existing link graph; do not add keyword-stuffed link blocks.
- Add `rel="nofollow"` to `/login` and `/signup` in the public header.
- Keep the empty blog hub `noindex`; document it as intentional and conditional
  (it flips to `index` automatically when the first post is published).
- Fix the measurement, not the site, for the `/` vs `/fa` duplicate.
- Leave the 28 intentional `moved` redirects in place (guard: `route-parity`).
