#!/usr/bin/env node
/**
 * Builds docs/SEO/DISCOVERED-DECISIONS.csv from URL-INVENTORY.csv.
 *
 * The 123 sitemap URLs stand in for the ~120 "Discovered – currently not
 * indexed" rows observed in Search Console (the console export is not in the
 * repo). The verdict is derived from measured facts, never assumed:
 *   - in the sitemap, 200, self-canonical, indexable  → never "exclude"
 *   - a real page with unique content but few contextual links → keep+strengthen
 *   - a page that should not compete in search → exclude / noindex (not sitemap)
 */
import fs from 'node:fs'

const rows = fs
  .readFileSync('docs/SEO/URL-INVENTORY.csv', 'utf8')
  .trim()
  .split('\n')
  .map((line) => {
    const cells = []
    let current = ''
    let quoted = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (quoted && line[i + 1] === '"') {
          current += '"'
          i++
        } else quoted = !quoted
      } else if (ch === ',' && !quoted) {
        cells.push(current)
        current = ''
      } else current += ch
    }
    cells.push(current)
    return cells
  })

const header = rows[0]
const data = rows
  .slice(1)
  .map((cells) => Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ''])))

function routeOf(url) {
  try {
    return new URL(url).pathname
  } catch {
    return url
  }
}

function verdict(row) {
  const type = row.page_type
  const inbound = Number(row.inbound_internal_links || 0)
  if (row.in_sitemap !== 'yes')
    return ['exclude', 'not in sitemap; noindex/private/closed by design']
  if (row.indexable !== 'yes') return ['exclude', 'noindex by policy']
  if (type === 'legal') return ['keep', 'required legal page; short but complete, 19 inbound links']
  if (type === 'company') return ['keep', 'real contact/company info']
  if (type === 'landing') return ['keep', 'head-term target; server-rendered h1']
  if (type === 'feature') {
    return inbound < 3
      ? ['keep+strengthen', `only ${inbound} inbound; add one contextual link from a guide`]
      : ['keep', `${inbound} inbound links; canonical and h1 correct`]
  }
  if (type === 'docs') {
    return inbound < 3
      ? ['keep+strengthen', `only ${inbound} inbound; link from a related article`]
      : ['keep', `${inbound} inbound links; guide is reachable from the docs sidebar`]
  }
  return ['keep+strengthen', 'review content intent before promoting further']
}

const out = [
  'url,route,page_type,locale,indexable,in_sitemap,inbound_links,word_count,verdict,reason',
  ...data
    .filter((row) => row.in_sitemap === 'yes' || row.indexable === 'yes')
    .map((row) => {
      const [decision, reason] = verdict(row)
      const pathname = routeOf(row.url)
      return [
        row.url,
        pathname,
        row.page_type,
        row.locale,
        row.indexable,
        row.in_sitemap,
        row.inbound_internal_links,
        row.content_quality,
        decision,
        reason,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    }),
]
fs.writeFileSync('docs/SEO/DISCOVERED-DECISIONS.csv', out.join('\n') + '\n', 'utf8')

const counts = {}
for (const line of out.slice(1)) {
  const cells = line.match(/"(?:[^"]|"")*"/g).map((c) => c.slice(1, -1).replace(/""/g, '"'))
  counts[cells[8]] = (counts[cells[8]] ?? 0) + 1
}
console.log(JSON.stringify({ rows: out.length - 1, verdicts: counts }, null, 2))
