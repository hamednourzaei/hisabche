#!/usr/bin/env node
/**
 * Raw-HTML internal-link audit — no JavaScript, no hydration.
 *
 *   node scripts/seo/internal-link-audit.mjs --base http://localhost:3111
 *
 * It starts from the four real entry points (/ redirects to /fa, plus /fa,
 * /af, /en), reads the SERVER-RENDERED <a href> of every page it reaches, and
 * builds the graph a crawler without JS would see. Output:
 *   docs/SEO/internal-link-report.json
 *   docs/SEO/internal-link-report.md
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const args = new Map()
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i], process.argv[i + 1])
const BASE = (args.get('--base') ?? 'http://localhost:3111').replace(/\/$/, '')
const ORIGIN = new URL(BASE).origin
const OUT_JSON = path.resolve(ROOT, 'docs/SEO/internal-link-report.json')
const OUT_MD = path.resolve(ROOT, 'docs/SEO/internal-link-report.md')
const LOCALES = ['fa', 'af', 'en']
const SEEDS = [`${BASE}/`, `${BASE}/fa`, `${BASE}/af`, `${BASE}/en`]
const MAX_DEPTH = Number(args.get('--depth') ?? 4)
const MAX_PAGES = Number(args.get('--max') ?? 600)

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

function cleanText(html) {
  return decode(html.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
}

function parsePage(html) {
  const head = html.slice(0, html.indexOf('</head>') + 7)
  const canonicalTag = head.match(/<link[^>]+rel=["']canonical["'][^>]*>/i)?.[0] ?? ''
  const canonical = canonicalTag ? attr(canonicalTag, 'href') : ''
  const robotsMeta = [...head.matchAll(/<meta[^>]+name=["']robots["'][^>]*>/gi)]
    .map((m) => attr(m[0], 'content'))
    .join(' ')
  const body = html.slice(html.indexOf('</head>') + 7)

  const links = []
  for (const m of body.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = decode(m[1])
    const text = cleanText(m[2])
    const tag = m[0].slice(0, m[0].indexOf('>') + 1)
    const rel = attr(tag, 'rel')
    links.push({ href, text, rel })
  }
  return { canonical, robotsMeta, links }
}

async function fetchChain(startUrl) {
  const chain = []
  let url = startUrl
  let res
  for (let hop = 0; hop <= 6; hop++) {
    try {
      res = await fetch(url, {
        redirect: 'manual',
        headers: { 'user-agent': 'HisabcheInternalLinkAudit/1.0' },
      })
    } catch (error) {
      return { status: 0, chain, finalUrl: url, html: '', error: error.message, xRobots: '' }
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
    finalUrl: url,
    html,
    xRobots: res ? (res.headers.get('x-robots-tag') ?? '') : '',
  }
}

const norm = (u) => u.replace(/#.*$/, '').replace(/\/$/, '')
const isAsset = (p) =>
  /\.(?:png|jpe?g|webp|svg|gif|ico|css|js|mjs|json|xml|txt|woff2?|ttf|mp4|webm|pdf)$/i.test(p)

const pages = new Map()
const edges = []
const queue = SEEDS.map((url) => ({ url, depth: 0, from: null, anchor: '' }))
const discovered = new Set(queue.map((q) => norm(q.url)))

while (queue.length && pages.size < MAX_PAGES) {
  const item = queue.shift()
  const key = norm(item.url)
  if (pages.has(key)) continue

  const result = await fetchChain(item.url)
  const finalKey = norm(result.finalUrl)
  // `/` and `/fa` are the same page; without this the graph holds two nodes for
  // it and the home page looks orphaned while its clone collects the inbound.
  if (pages.has(finalKey)) {
    discovered.add(finalKey)
    continue
  }
  const parsed = result.html ? parsePage(result.html) : { canonical: '', robotsMeta: '', links: [] }
  const finalPath = new URL(result.finalUrl).pathname
  const locale = LOCALES.find((l) => finalPath === `/${l}` || finalPath.startsWith(`/${l}/`)) ?? ''
  const indexable =
    result.status === 200 && !/noindex/i.test(parsed.robotsMeta) && !/noindex/i.test(result.xRobots)

  const page = {
    url: item.url,
    finalUrl: result.finalUrl,
    status: result.status,
    redirectChain: result.chain.map(
      (h) => `${h.status} ${h.url}${h.location ? ` -> ${h.location}` : ''}`,
    ),
    redirected: result.chain.length > 1,
    canonical: parsed.canonical,
    robotsMeta: parsed.robotsMeta,
    xRobots: result.xRobots,
    indexable,
    locale,
    depth: item.depth,
    discoveredFrom: item.from,
    anchor: item.anchor,
    outbound: 0,
    inbound: 0,
    inboundAnchors: [],
  }
  pages.set(finalKey, page)

  // Same-origin <a href> only. Fragments are not separate pages.
  const seenOnPage = new Set()
  for (const link of parsed.links) {
    if (!link.href || link.href.startsWith('#') || /^(mailto|tel|javascript):/i.test(link.href))
      continue
    let target
    try {
      target = new URL(link.href, result.finalUrl)
    } catch {
      continue
    }
    if (target.origin !== ORIGIN) continue
    if (isAsset(target.pathname)) continue
    const targetKey = norm(target.toString())
    if (targetKey === finalKey || targetKey === key) continue
    if (seenOnPage.has(targetKey)) continue
    seenOnPage.add(targetKey)
    edges.push({ from: item.url, to: targetKey, anchor: link.text, rel: link.rel })
    page.outbound++
    if (item.depth < MAX_DEPTH && !discovered.has(targetKey) && !pages.has(targetKey)) {
      discovered.add(targetKey)
      queue.push({
        url: target.toString(),
        depth: item.depth + 1,
        from: item.url,
        anchor: link.text,
      })
    }
  }
}

// Inbound counts are computed from the graph, so a page is only an orphan if no
// OTHER crawled page links to it.
const byKey = new Map()
for (const page of pages.values()) byKey.set(norm(page.finalUrl), page)
for (const edge of edges) {
  const target = byKey.get(edge.to)
  if (!target) continue
  target.inbound++
  if (edge.anchor) target.inboundAnchors.push(edge.anchor)
}

const all = [...pages.values()]
const important = all.filter((p) => p.locale && p.indexable)
const buckets = { zero: 0, one: 0, three: 0, five: 0 }
for (const p of all) {
  if (p.inbound === 0) buckets.zero++
  if (p.inbound === 1) buckets.one++
  if (p.inbound >= 3) buckets.three++
  if (p.inbound >= 5) buckets.five++
}

const brokenLinks = edges
  .map((e) => ({ edge: e, target: byKey.get(e.to) }))
  .filter((x) => !x.target || (x.target.status !== 200 && x.target.status !== 0))
  .map((x) => ({
    from: x.edge.from,
    to: x.edge.to,
    anchor: x.edge.anchor,
    status: x.target?.status ?? 'unfetched',
  }))

// A link to a page beyond the crawl depth is "unfetched", not broken. Check it.
for (const link of brokenLinks) {
  if (link.status !== 'unfetched') continue
  try {
    const res = await fetch(link.to, { redirect: 'manual' })
    link.status = res.status
  } catch {
    link.status = 0
  }
}
const actuallyBroken = brokenLinks.filter((l) => l.status !== 200)

const throughRedirect = []
for (const e of edges) {
  if (byKey.has(e.to)) continue
  try {
    const res = await fetch(e.to, { redirect: 'manual' })
    if (res.status >= 300 && res.status < 400) {
      throughRedirect.push({ from: e.from, to: e.to, anchor: e.anchor })
    }
  } catch {
    /* a network error is reported by brokenLinks, not here */
  }
}

const toNoindex = edges
  .filter((e) => {
    const t = byKey.get(e.to)
    return t && !t.indexable
  })
  .map((e) => ({
    from: e.from,
    to: e.to,
    anchor: e.anchor,
    rel: e.rel,
    status: byKey.get(e.to)?.status,
  }))

const publicToNoindex = toNoindex.filter((e) => {
  if (/\bnofollow\b/i.test(e.rel ?? '')) return false
  const source = byKey.get(norm(e.from))
  return source ? source.indexable : false
})

const toNonCanonical = edges
  .filter((e) => {
    const t = byKey.get(e.to)
    if (!t || !t.canonical) return false
    try {
      return (
        new URL(t.canonical).pathname.replace(/\/$/, '') !==
        new URL(t.finalUrl).pathname.replace(/\/$/, '')
      )
    } catch {
      return false
    }
  })
  .map((e) => ({ from: e.from, to: e.to, anchor: e.anchor }))

const genericAnchors = ['visit', 'here', 'click here', 'read more', 'more', 'بیشتر', 'مشاهده']
const genericLinks = edges.filter((e) => genericAnchors.includes(e.anchor.toLowerCase()))

const depths = all.map((p) => p.depth)
const metrics = {
  totalPagesFetched: all.length,
  totalLinks: edges.length,
  uniqueTargets: new Set(edges.map((e) => e.to)).size,
  inboundBuckets: buckets,
  brokenLinks: actuallyBroken.length,
  linksThroughRedirect: throughRedirect.length,
  linksToNoindex: toNoindex.length,
  linksFromPublicToNoindex: publicToNoindex.length,
  linksToNonCanonical: toNonCanonical.length,
  genericAnchorLinks: genericLinks.length,
  orphanImportantPages: important
    .filter((p) => p.inbound === 0 && !SEEDS.map(norm).includes(norm(p.finalUrl)))
    .map((p) => p.finalUrl),
  averageDepth: depths.length
    ? Number((depths.reduce((a, b) => a + b, 0) / depths.length).toFixed(2))
    : 0,
  maxDepth: depths.length ? Math.max(...depths) : 0,
  averageInboundImportant: important.length
    ? Number((important.reduce((a, p) => a + p.inbound, 0) / important.length).toFixed(2))
    : 0,
}

const report = {
  generatedAt: new Date().toISOString(),
  base: BASE,
  seeds: SEEDS,
  metrics,
  pages: all,
  edges,
  brokenLinks,
  throughRedirect,
  toNoindex,
  toNonCanonical,
  genericLinks,
}
fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true })
fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2), 'utf8')

const table = (rows, head) =>
  ['| ' + head.join(' | ') + ' |', '|' + head.map(() => '---').join('|') + '|', ...rows].join('\n')

const topInbound = [...all].sort((a, b) => b.inbound - a.inbound).slice(0, 25)
const md = `# Internal link report (raw HTML, no JavaScript)

Generated: ${report.generatedAt}
Base: ${BASE}
Seeds: ${SEEDS.join(' · ')}
Crawl depth limit: ${MAX_DEPTH}

## Metrics

| Metric | Value |
| --- | ---: |
| Pages fetched | ${metrics.totalPagesFetched} |
| Links found in server HTML | ${metrics.totalLinks} |
| Unique link targets | ${metrics.uniqueTargets} |
| Pages with 0 inbound | ${buckets.zero} |
| Pages with exactly 1 inbound | ${buckets.one} |
| Pages with ≥3 inbound | ${buckets.three} |
| Pages with ≥5 inbound | ${buckets.five} |
| Broken links | ${metrics.brokenLinks} |
| Links through a redirect | ${metrics.linksThroughRedirect} |
| Links to noindex pages | ${metrics.linksToNoindex} |
| … of those, from an indexable page | ${metrics.linksFromPublicToNoindex} |
| Links to non-canonical pages | ${metrics.linksToNonCanonical} |
| Generic anchor links | ${metrics.genericAnchorLinks} |
| Important orphan pages | ${metrics.orphanImportantPages.length} |
| Average crawl depth | ${metrics.averageDepth} |
| Maximum crawl depth | ${metrics.maxDepth} |
| Average inbound (indexable) | ${metrics.averageInboundImportant} |

## Most linked pages

${table(
  topInbound.map((p) => `| ${p.finalUrl} | ${p.inbound} | ${p.depth} | ${p.locale || '-'} |`),
  ['URL', 'Inbound', 'Depth', 'Locale'],
)}

## Important orphan pages

${metrics.orphanImportantPages.length ? metrics.orphanImportantPages.map((u) => `- ${u}`).join('\n') : 'None.'}

## Links through a redirect

${
  throughRedirect.length
    ? throughRedirect
        .slice(0, 60)
        .map((e) => `- ${e.from} → ${e.to} («${e.anchor}»)`)
        .join('\n')
    : 'None.'
}

## Broken links

${
  actuallyBroken.length
    ? actuallyBroken
        .slice(0, 60)
        .map((e) => `- ${e.from} → ${e.to} («${e.anchor}») status ${e.status}`)
        .join('\n')
    : 'None.'
}
`
fs.writeFileSync(OUT_MD, md, 'utf8')

// ── hierarchy inventory ────────────────────────────────────────────────────
function pageTypeOf(pathname) {
  if (/^\/(fa|af|en)$/.test(pathname)) return 'landing'
  if (pathname.includes('/features/')) return 'feature'
  if (pathname.includes('/docs/')) return 'docs'
  if (pathname.includes('/blog')) return 'blog'
  if (pathname.includes('/market')) return 'market'
  if (pathname.includes('/legal/')) return 'legal'
  if (/\/(about|contact)$/.test(pathname)) return 'company'
  if (/\/(login|signup|forgot-password|reset-password|accept-invite)$/.test(pathname)) return 'auth'
  return 'other'
}
function tierOf(type) {
  if (type === 'landing' || type === 'company' || type === 'auth') return 1
  if (type === 'feature' || type === 'blog' || type === 'market') return 2
  if (type === 'docs' || type === 'legal') return 3
  return 3
}
const TARGET_INBOUND = { 1: 1, 2: 3, 3: 1 }
const children = new Map()
for (const e of edges) children.set(e.from, (children.get(e.from) ?? 0) + 1)
const csvEscape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
const invColumns = [
  'url',
  'route',
  'page_type',
  'locale',
  'indexable',
  'canonical',
  'parent',
  'children',
  'inbound_links',
  'outbound_links',
  'tier',
  'target_inbound',
]
const invLines = [invColumns.join(',')]
for (const p of all) {
  const pathname = new URL(p.finalUrl).pathname
  const type = pageTypeOf(pathname)
  const tier = tierOf(type)
  invLines.push(
    [
      p.finalUrl,
      pathname,
      type,
      p.locale,
      p.indexable ? 'yes' : 'no',
      p.canonical,
      p.discoveredFrom ?? '',
      children.get(p.url) ?? 0,
      p.inbound,
      p.outbound,
      tier,
      TARGET_INBOUND[tier],
    ]
      .map(csvEscape)
      .join(','),
  )
}
fs.writeFileSync(
  path.resolve(ROOT, 'docs/SEO/INTERNAL-LINKING-INVENTORY.csv'),
  invLines.join('\n') + '\n',
  'utf8',
)

console.log(`\nwrote ${OUT_JSON}`)
console.log(`wrote ${OUT_MD}`)
console.log(JSON.stringify(metrics, null, 2))
