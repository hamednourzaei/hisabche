#!/usr/bin/env node
/**
 * Real-HTTP SEO inventory for the Hisabche web app.
 *
 *   node scripts/seo/crawl-inventory.mjs --base http://localhost:3111
 *
 * What it does (no guesses):
 *  1. reads /sitemap.xml (following a sitemap index),
 *  2. discovers static routes from app/[lang]/**\/page.tsx outside (dashboard),
 *  3. adds the intentional redirects from next.config.js and the home page,
 *  4. fetches every URL with redirect: 'manual' and records the full chain,
 *  5. parses canonical, robots meta, X-Robots-Tag, hreflang, title, h1, JSON-LD,
 *  6. crawls the returned HTML for internal links and counts real inbound links,
 *  7. writes docs/SEO/URL-INVENTORY.csv and docs/SEO/audit-summary.json.
 *
 * Read-only: it never writes to the site or the database.
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const args = new Map()
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i], process.argv[i + 1])
const BASE = (args.get('--base') ?? 'http://localhost:3111').replace(/\/$/, '')
const OUT = path.resolve(ROOT, args.get('--out') ?? 'docs/SEO/URL-INVENTORY.csv')
const SUMMARY = path.resolve(ROOT, args.get('--summary') ?? 'docs/SEO/audit-summary.json')
const LOCALES = ['fa', 'af', 'en']

// ── route discovery ────────────────────────────────────────────────────────
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

const appDir = path.join(ROOT, 'apps/web/app')
const langDir = path.join(appDir, '[lang]')
const pageFiles = walk(langDir).filter((f) => f.endsWith(`${path.sep}page.tsx`))

function routeOf(file) {
  const rel = path.relative(langDir, path.dirname(file)).split(path.sep).join('/')
  if (rel === '') return ''
  return '/' + rel
}

const staticRoutes = new Set()
const dynamicRoutes = []
for (const file of pageFiles) {
  const route = routeOf(file)
  if (route.includes('(dashboard)')) continue
  const cleaned = route.replace(/\/?\(dashboard\)/g, '')
  if (cleaned.includes('[')) {
    dynamicRoutes.push(cleaned)
    continue
  }
  staticRoutes.add(cleaned)
}

// intentional redirects, parsed from next.config.js (the single source)
const config = fs.readFileSync(path.join(ROOT, 'apps/web/next.config.js'), 'utf8')
const movedBlock = config.slice(config.indexOf('const moved ='), config.indexOf('return moved.map'))
const redirects = []
for (const m of movedBlock.matchAll(/\[\s*'([^']+)'\s*,\s*'([^']+)'\s*\]/g)) {
  redirects.push({ from: m[1], to: m[2] })
}

// ── sitemap ────────────────────────────────────────────────────────────────
async function fetchText(url, opts = {}) {
  const res = await fetch(url, { redirect: 'manual', ...opts })
  const body = await res.text()
  return { res, body }
}

// Sitemap entries carry the production origin. Every request in this crawl must
// go to the server under test, so the host is rewritten and the path kept.
function toCrawlOrigin(loc) {
  try {
    const parsed = new URL(loc)
    return `${BASE}${parsed.pathname}${parsed.search}`
  } catch {
    return loc
  }
}

async function readSitemap() {
  const urls = []
  const queue = [`${BASE}/sitemap.xml`]
  const seen = new Set()
  while (queue.length) {
    const next = queue.shift()
    if (seen.has(next)) continue
    seen.add(next)
    try {
      const { res, body } = await fetchText(next)
      if (!res.ok) continue
      if (/<sitemapindex/i.test(body)) {
        for (const m of body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) queue.push(m[1])
      } else {
        for (const m of body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g))
          urls.push(toCrawlOrigin(m[1]))
      }
    } catch (error) {
      console.warn(`[sitemap] ${next}: ${error.message}`)
    }
  }
  return urls
}

// ── html parsing ───────────────────────────────────────────────────────────
const decode = (s) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')

function attr(tag, name) {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'))
  return m ? decode(m[2] ?? m[3] ?? '') : ''
}

function parseHtml(html) {
  const head = html.slice(0, html.indexOf('</head>') + 7)
  const canonicalTag = head.match(/<link[^>]+rel=["']canonical["'][^>]*>/i)?.[0] ?? ''
  const canonical = canonicalTag ? attr(canonicalTag, 'href') : ''

  const robotsTags = [...head.matchAll(/<meta[^>]+name=["']robots["'][^>]*>/gi)].map((m) =>
    attr(m[0], 'content'),
  )
  const robotsMeta = robotsTags.join(' ')

  const hreflang = {}
  for (const m of head.matchAll(/<link[^>]+rel=["']alternate["'][^>]*>/gi)) {
    const tag = m[0]
    const h = attr(tag, 'hreflang')
    const href = attr(tag, 'href')
    if (h && href) hreflang[h] = href
  }

  const title = decode((head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim())

  let body = html.slice(html.indexOf('</head>') + 7)
  body = body.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
  const main = body.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? body
  const text = decode(main.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
  const wordCount = text.split(/\s+/).filter((w) => w.length > 1).length

  const h1s = [...body.matchAll(/<h1[\s>][\s\S]*?<\/h1>/gi)]
  const h1 = h1s.length
    ? decode(h1s[0][0].replace(/<[^>]+>/g, ' '))
        .replace(/\s+/g, ' ')
        .trim()
    : ''

  const jsonLd = []
  for (const m of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const parsed = JSON.parse(m[1].trim())
      const list = Array.isArray(parsed) ? parsed : parsed['@graph'] ? parsed['@graph'] : [parsed]
      for (const node of list)
        if (node && node['@type']) jsonLd.push([].concat(node['@type']).join('|'))
    } catch {
      jsonLd.push('INVALID')
    }
  }

  const links = []
  for (const m of body.matchAll(/<a[^>]+href=["']([^"']+)["']/gi)) links.push(decode(m[1]))

  return {
    canonical,
    robotsMeta,
    hreflang,
    title,
    h1Count: h1s.length,
    h1,
    wordCount,
    jsonLd,
    links,
  }
}

// ── crawl ──────────────────────────────────────────────────────────────────
// A single global 300-word threshold is wrong: a legal page with 120 precise
// words is not thin, and a blog post with 250 is. The bar follows page type.
const THIN_WORDS = {
  landing: 300,
  feature: 150,
  docs: 80,
  blog: 200,
  legal: 40,
  company: 60,
  market: 100,
  auth: 0,
  token: 0,
  other: 80,
}

function contentQuality(type, wordCount) {
  const bar = THIN_WORDS[type] ?? 100
  return wordCount < bar ? `thin (${wordCount}w, bar ${bar})` : `${wordCount}w`
}

function pageType(route) {
  if (route === '') return 'landing'
  if (route.startsWith('/features/')) return 'feature'
  if (route.startsWith('/docs')) return 'docs'
  if (route.startsWith('/blog')) return 'blog'
  if (route.startsWith('/market')) return 'market'
  if (route.startsWith('/legal/')) return 'legal'
  if (route === '/about' || route === '/contact') return 'company'
  if (
    route === '/login' ||
    route === '/signup' ||
    route === '/forgot-password' ||
    route === '/reset-password' ||
    route === '/accept-invite'
  )
    return 'auth'
  if (
    route.includes('/public-invoice') ||
    route.includes('/portal') ||
    route.includes('/my-attendance') ||
    route.includes('/public-task') ||
    route.includes('/feedback')
  )
    return 'token'
  if (route.includes('[')) return 'dynamic'
  return 'other'
}

function priority(route, type) {
  if (type === 'landing') return 'P0'
  if (type === 'feature' || type === 'docs' || type === 'blog') return 'P1'
  if (type === 'company' || type === 'legal') return 'P2'
  if (type === 'token' || type === 'auth') return 'P3'
  return 'P2'
}

const sitemapUrls = await readSitemap()
const sitemapSet = new Set(sitemapUrls)

const candidates = new Map() // url -> { route, locale }
for (const route of staticRoutes) {
  for (const locale of LOCALES) candidates.set(`${BASE}/${locale}${route}`, { route, locale })
}
for (const url of sitemapUrls) {
  try {
    const u = new URL(url)
    const seg = u.pathname.split('/').filter(Boolean)
    const locale = LOCALES.includes(seg[0]) ? seg[0] : '?'
    const route = '/' + seg.slice(1).join('/')
    candidates.set(url, { route: route === '/' ? '' : route, locale })
  } catch {
    /* ignore malformed sitemap loc */
  }
}
for (const { from } of redirects) {
  for (const locale of LOCALES) {
    const route = '/' + from.replace('/:id', '/sample-id')
    candidates.set(`${BASE}/${locale}${route}`, { route, locale })
  }
}
// Redirect sources are locale-scoped in next.config.js; a bare path is also a real
// URL a person types, so record what it actually answers.
for (const { from } of redirects)
  candidates.set(`${BASE}/${from}`, { route: '/' + from, locale: '?' })

async function crawl(startUrl, maxHops = 5) {
  const chain = []
  let url = startUrl
  let res
  for (let hop = 0; hop <= maxHops; hop++) {
    try {
      res = await fetch(url, {
        redirect: 'manual',
        headers: { 'user-agent': 'HisabcheSEOCrawl/1.0' },
      })
    } catch (error) {
      return { status: 0, chain, html: '', error: error.message, finalUrl: url }
    }
    chain.push({ url, status: res.status, location: res.headers.get('location') ?? '' })
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      url = new URL(res.headers.get('location'), url).toString()
      continue
    }
    break
  }
  const html = res && res.status === 200 ? await res.text() : ''
  return {
    status: res ? res.status : 0,
    chain,
    html,
    finalUrl: url,
    xRobots: res ? (res.headers.get('x-robots-tag') ?? '') : '',
    contentType: res ? (res.headers.get('content-type') ?? '') : '',
  }
}

const rows = []
const inbound = new Map()
const internalEdges = []
const batch = [...candidates.keys()]
let done = 0

async function run(url, meta) {
  const result = await crawl(url)
  const parsed = result.html ? parseHtml(result.html) : null
  const final = new URL(result.finalUrl)
  const route = meta.route
  const type = pageType(route)

  let indexable = false
  let noindexReason = ''
  if (result.status !== 200) noindexReason = `status ${result.status}`
  else if (/noindex/i.test(parsed.robotsMeta)) noindexReason = 'meta robots noindex'
  else if (/noindex/i.test(result.xRobots)) noindexReason = 'X-Robots-Tag noindex'
  else if (type === 'token') noindexReason = 'token page'
  else indexable = true

  if (result.status === 200 && parsed) {
    for (const href of parsed.links) {
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:'))
        continue
      let target
      try {
        target = new URL(href, result.finalUrl)
      } catch {
        continue
      }
      if (target.origin !== new URL(BASE).origin) continue
      const clean = target.origin + target.pathname.replace(/\/$/, '') || target.origin
      if (clean === url.replace(/\/$/, '')) continue
      inbound.set(clean, (inbound.get(clean) ?? 0) + 1)
      internalEdges.push({ from: url, to: clean })
    }
  }

  const canonical = parsed?.canonical ?? ''
  // Compare what Google compares: the PATH. The canonical host is fixed to the
  // public production origin (SITE_URL), while this crawl runs on localhost, so
  // comparing hosts would mark every correct page as non-self-canonical.
  let canonicalPath = ''
  let canonicalAbsolute = false
  try {
    const c = new URL(canonical)
    canonicalPath = c.pathname.replace(/\/$/, '')
    canonicalAbsolute = c.protocol === 'http:' || c.protocol === 'https:'
  } catch {
    canonicalPath = ''
  }
  const finalPath = final.pathname.replace(/\/$/, '')
  const selfCanonical = canonicalPath !== '' && canonicalPath === finalPath

  rows.push({
    url,
    route,
    page_type: type,
    locale: meta.locale,
    status: result.status,
    redirect_chain: result.chain
      .map((h) => `${h.status} ${h.url}${h.location ? ` -> ${h.location}` : ''}`)
      .join(' | '),
    canonical,
    robots_meta: parsed?.robotsMeta ?? '',
    x_robots: result.xRobots,
    indexable: indexable ? 'yes' : 'no',
    crawlable: type === 'token' ? 'no' : 'yes',
    in_sitemap: sitemapSet.has(url) ? 'yes' : 'no',
    inbound_internal_links: 0,
    parent: '',
    content_quality: parsed ? contentQuality(type, parsed.wordCount) : 'n/a',
    structured_data: parsed ? parsed.jsonLd.join(', ') : '',
    noindex_reason: noindexReason,
    priority: priority(route, type),
    title: parsed?.title ?? '',
    h1_count: parsed?.h1Count ?? 0,
    h1: parsed?.h1 ?? '',
    hreflang: parsed
      ? Object.entries(parsed.hreflang)
          .map(([k, v]) => `${k}=${v}`)
          .join(' | ')
      : '',
    _hreflang: parsed?.hreflang ?? {},
    self_canonical: selfCanonical ? 'yes' : canonical ? 'no' : 'none',
    canonical_absolute: canonicalAbsolute ? 'yes' : canonical ? 'no' : 'none',
    final_url: result.finalUrl,
  })

  done++
  if (done % 20 === 0) console.log(`[crawl] ${done}/${batch.length}`)
}

const CONCURRENCY = 4
let cursor = 0
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (cursor < batch.length) {
      const i = cursor++
      const url = batch[i]
      await run(url, candidates.get(url))
    }
  }),
)

for (const row of rows) {
  const key = row.url.replace(/\/$/, '')
  row.inbound_internal_links = inbound.get(key) ?? 0
  const edge = internalEdges.find((e) => e.to === key)
  if (edge) {
    const parent = new URL(edge.from)
    row.parent = parent.pathname
  }
}

// ── canonical target status ────────────────────────────────────────────────
// A canonical that points at a redirect or a 404 is worse than none. Resolve
// every distinct target against the same server and record what it answers.
const canonicalTargets = new Map()
for (const row of rows) {
  if (!row.canonical) continue
  try {
    const local = `${BASE}${new URL(row.canonical).pathname}`
    if (!canonicalTargets.has(local)) canonicalTargets.set(local, 0)
  } catch {
    /* non-absolute canonical already flagged */
  }
}
for (const target of [...canonicalTargets.keys()]) {
  try {
    const res = await fetch(target, { redirect: 'manual' })
    canonicalTargets.set(target, res.status)
  } catch {
    canonicalTargets.set(target, 0)
  }
}
for (const row of rows) {
  let status = 0
  try {
    status = canonicalTargets.get(`${BASE}${new URL(row.canonical).pathname}`) ?? 0
  } catch {
    status = 0
  }
  row.canonical_target_status = row.canonical ? status : ''
  row.canonical_target_ok = !row.canonical ? 'n/a' : status === 200 ? 'yes' : 'no'
}

// ── hreflang pair validation ───────────────────────────────────────────────
const indexableByPath = new Map()
for (const row of rows) {
  if (row.status !== 200) continue
  const p = new URL(row.final_url).pathname.replace(/\/$/, '')
  indexableByPath.set(p, indexableByPath.get(p) === 'yes' ? 'yes' : row.indexable)
}
const hreflangIssues = []
for (const row of rows) {
  if (row.indexable !== 'yes' || !row._hreflang) continue
  for (const [code, href] of Object.entries(row._hreflang)) {
    let pathname
    try {
      pathname = new URL(href).pathname.replace(/\/$/, '')
    } catch {
      hreflangIssues.push({ url: row.url, code, target: href, reason: 'invalid URL' })
      continue
    }
    if (indexableByPath.get(pathname) !== 'yes') {
      hreflangIssues.push({ url: row.url, code, target: href, reason: 'target not 200/indexable' })
    }
  }
  // Bidirectional: the current page must be listed by its own cluster. We only
  // verify the same-cluster targets we crawled; a missing pair is reported.
  const cluster = Object.values(row._hreflang).map((h) => {
    try {
      return new URL(h).pathname.replace(/\/$/, '')
    } catch {
      return ''
    }
  })
  if (!cluster.includes(new URL(row.final_url).pathname.replace(/\/$/, ''))) {
    hreflangIssues.push({
      url: row.url,
      code: 'self',
      target: row.url,
      reason: 'self not in hreflang cluster',
    })
  }
}

// ── robots.txt against the real crawl ──────────────────────────────────────
let robotsText = ''
try {
  robotsText = await (await fetch(`${BASE}/robots.txt`, { redirect: 'manual' })).text()
} catch {
  /* reported below */
}
const disallowRules = robotsText
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => /^disallow:/i.test(l))
  .map((l) => l.split(':').slice(1).join(':').trim())
  .filter(Boolean)
const robotsBlockedIndexable = []
for (const row of rows) {
  if (row.indexable !== 'yes') continue
  const pathname = new URL(row.final_url).pathname
  const blockedBy = disallowRules.find((rule) => {
    const clean = rule.replace(/\*$/, '')
    if (!pathname.startsWith(clean)) return false
    // `*/invoices` also matches `/fa/docs/invoices`; that is the documented BUG-085
    // behaviour and a real block, so it counts.
    return true
  })
  if (blockedBy) robotsBlockedIndexable.push({ url: row.url, rule: blockedBy })
}

for (const row of rows) delete row._hreflang

const columns = [
  'url',
  'route',
  'page_type',
  'locale',
  'status',
  'redirect_chain',
  'canonical',
  'robots_meta',
  'x_robots',
  'indexable',
  'crawlable',
  'in_sitemap',
  'inbound_internal_links',
  'parent',
  'content_quality',
  'structured_data',
  'noindex_reason',
  'priority',
  'title',
  'h1_count',
  'h1',
  'hreflang',
  'self_canonical',
  'canonical_absolute',
  'canonical_target_status',
  'canonical_target_ok',
  'final_url',
]
const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
const csv = [
  columns.join(','),
  ...rows.map((r) => columns.map((c) => csvCell(r[c])).join(',')),
].join('\n')
fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, csv + '\n', 'utf8')

// ── summary for the audit questions ────────────────────────────────────────
const by = (fn) => rows.reduce((acc, r) => ((acc[fn(r)] = (acc[fn(r)] ?? 0) + 1), acc), {})
const indexable = rows.filter((r) => r.indexable === 'yes')
const summary = {
  generatedAt: new Date().toISOString(),
  base: BASE,
  totals: {
    urls: rows.length,
    sitemapUrls: sitemapUrls.length,
    staticRoutes: staticRoutes.size,
    redirects: redirects.length,
    dynamicRoutes,
    status: by((r) => r.status),
    pageType: by((r) => r.page_type),
    locale: by((r) => r.locale),
    indexable: indexable.length,
    noindex: rows.filter((r) => r.indexable === 'no').length,
    thin: rows.filter((r) => String(r.content_quality).startsWith('thin')).length,
    missingCanonical: rows.filter((r) => r.status === 200 && !r.canonical).length,
    notSelfCanonical: rows.filter((r) => r.self_canonical === 'no').map((r) => r.url),
    canonicalNotAbsolute: rows
      .filter((r) => r.status === 200 && r.canonical && r.canonical_absolute === 'no')
      .map((r) => r.url),
    canonicalTargetBroken: rows
      .filter((r) => r.canonical_target_ok === 'no')
      .map((r) => ({
        url: r.url,
        canonical: r.canonical,
        targetStatus: r.canonical_target_status,
      })),
    noH1: rows.filter((r) => r.status === 200 && r.h1_count === 0).map((r) => r.url),
    multiH1: rows.filter((r) => r.h1_count > 1).map((r) => ({ url: r.url, count: r.h1_count })),
    duplicateTitlesSamePath: (() => {
      const groups = new Map()
      for (const r of rows) {
        // A redirect source and its destination share a final URL; that is not a
        // duplicate title, it is one page. Only count direct, indexable hits.
        if (!r.title) continue
        if (r.indexable !== 'yes') continue
        if (r.url.replace(/\/$/, '') !== r.final_url.replace(/\/$/, '')) continue
        const p = new URL(r.final_url).pathname
        const key = `${p}::${r.title}`
        groups.set(key, (groups.get(key) ?? 0) + 1)
      }
      return [...groups.entries()]
        .filter(([, n]) => n > 1)
        .map(([key, n]) => ({ pathTitle: key, count: n }))
    })(),
    hreflangIssues,
    robotsBlockedIndexable,
    robotsDisallowRules: [...new Set(disallowRules)],
    sitemapNot200: rows.filter((r) => r.in_sitemap === 'yes' && r.status !== 200).map((r) => r.url),
    sitemapNoindex: rows
      .filter((r) => r.in_sitemap === 'yes' && r.indexable === 'no')
      .map((r) => r.url),
    sitemapNonSelfCanonical: rows
      .filter((r) => r.in_sitemap === 'yes' && r.self_canonical !== 'yes')
      .map((r) => r.url),
    orphanIndexable: indexable
      .filter(
        (r) =>
          r.inbound_internal_links === 0 &&
          r.url.replace(/\/$/, '') === r.final_url.replace(/\/$/, ''),
      )
      .map((r) => r.url),
    redirectsTo404: rows
      .filter((r) => r.redirect_chain && r.status === 404)
      .map((r) => ({ url: r.url, chain: r.redirect_chain })),
    chains: rows
      .filter((r) => (r.redirect_chain.match(/ -> /g) ?? []).length >= 2)
      .map((r) => ({ url: r.url, chain: r.redirect_chain })),
    queryUrls: rows.filter((r) => r.url.includes('?')).map((r) => r.url),
    jsonLdInvalid: rows.filter((r) => r.structured_data.includes('INVALID')).map((r) => r.url),
    forbiddenSchema: rows
      .filter((r) => /AggregateRating|Review|Offer/i.test(r.structured_data))
      .map((r) => ({ url: r.url, types: r.structured_data })),
  },
}
fs.writeFileSync(SUMMARY, JSON.stringify(summary, null, 2), 'utf8')

console.log(`\nwrote ${OUT}`)
console.log(`wrote ${SUMMARY}`)
console.log(JSON.stringify(summary.totals, null, 2))
