// The recordings the reels need, discovered from the reels themselves — never typed by hand.
// Usage:  node scripts/capture-manifest.mjs            (prints the table)
//         node scripts/capture-manifest.mjs --write    (rewrites the table in docs/CAPTURE-MANIFEST.md)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { captureManifestOf, capturesDir } from './product-capture.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** One row per FILE the owner has to record (a file used by several scenes is recorded once, long enough for all). */
export function filesToRecord(rows) {
  const byFile = new Map()
  for (const r of rows) {
    const entry = byFile.get(r.file) ?? {
      file: r.file,
      route: r.route,
      minSeconds: 0,
      reels: new Set(),
      screenStates: new Set(),
      present: r.present,
      problem: r.problem,
    }
    entry.minSeconds = Math.max(entry.minSeconds, r.minSeconds)
    entry.reels.add(r.reel)
    if (r.screenState) entry.screenStates.add(r.screenState)
    byFile.set(r.file, entry)
  }
  return [...byFile.values()].map((e) => ({
    ...e,
    reels: [...e.reels].sort(),
    screenStates: [...e.screenStates],
  }))
}

export function renderManifest(rows) {
  if (!rows.length) return '_No reel asks for a recording._'
  const head =
    '| File | Product page | Record at least | Reels | Status | What the screen must show |\n| --- | --- | ---: | --- | --- | --- |'
  const body = filesToRecord(rows)
    .map(
      (e) =>
        `| \`${e.file}\` | \`${e.route}\` | ${e.minSeconds}s | ${e.reels.join(', ')} | ${e.present ? 'present' : `**missing** (${e.problem})`} | ${e.screenStates.join(' / ') || '—'} |`,
    )
    .join('\n')
  return `### Files to record\n\n${head}\n${body}\n\n### Every scene that uses a recording\n\n${renderScenes(rows)}`
}

function renderScenes(rows) {
  const head =
    '| Reel | At (s) | File | Product page | Min. recording | Status | Screen state the recording must show |\n| --- | ---: | --- | --- | ---: | --- | --- |'
  const body = rows
    .map(
      (r) =>
        `| ${r.reel} | ${r.at} | \`${r.file}\` | \`${r.route}\` | ${r.minSeconds}s | ${r.present ? 'present' : `**missing** (${r.problem})`} | ${r.screenState ?? '—'} |`,
    )
    .join('\n')
  return rows.length ? `${head}\n${body}` : '_No reel asks for a recording._'
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const server = await createServer({
    root: ROOT,
    server: { middlewareMode: true, hmr: false, watch: null },
    logLevel: 'error',
  })
  let rows
  try {
    const { REELS } = await server.ssrLoadModule('/src/reels/index.ts')
    rows = captureManifestOf(REELS)
  } finally {
    await server.close()
  }
  const missing = rows.filter((r) => !r.present)
  console.log(`captures folder: ${capturesDir()}`)
  console.log(
    `${rows.length} captures asked for · ${rows.length - missing.length} present · ${missing.length} missing`,
  )
  for (const r of missing)
    console.log(
      `  reel ${r.reel} @${r.at}s  ${r.file}  ${r.route}  ≥${r.minSeconds}s  (${r.problem})`,
    )
  if (process.argv.includes('--write')) {
    const file = path.join(ROOT, 'docs', 'CAPTURE-MANIFEST.md')
    const text = fs.readFileSync(file, 'utf8')
    const begin = '<!-- MANIFEST:BEGIN -->'
    const end = '<!-- MANIFEST:END -->'
    const from = text.indexOf(begin)
    const to = text.indexOf(end)
    if (from < 0 || to < from) throw new Error('docs/CAPTURE-MANIFEST.md has no MANIFEST markers')
    const table = renderManifest(rows)
    fs.writeFileSync(file, `${text.slice(0, from + begin.length)}\n${table}\n${text.slice(to)}`)
    console.log(`manifest written inside ${file}`)
  }
}
