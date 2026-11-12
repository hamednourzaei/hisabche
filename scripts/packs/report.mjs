#!/usr/bin/env node
// ============================================
// scripts/packs/report.mjs
//
// Reads Vite's `manifest.json` (or `.vite/manifest.json`) from an output
// directory, computes raw + gzip sizes for core entry, each feature pack,
// each locale chunk, and shared chunks, and writes `pack-report.json`.
// ============================================

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const targetDir = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve('apps/desktop/out/renderer')

const manifestCandidates = [
  path.join(targetDir, '.vite/manifest.json'),
  path.join(targetDir, 'manifest.json'),
]
const manifestPath = manifestCandidates.find((p) => fs.existsSync(p))
if (!manifestPath) {
  console.error(`[packs/report] No manifest.json found in ${targetDir}`)
  process.exit(1)
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

const seenFiles = new Set()
const buckets = {
  coreEntry: { rawBytes: 0, gzipBytes: 0, files: [] },
  packs: {},
  locales: {},
  shared: { rawBytes: 0, gzipBytes: 0, files: [] },
  totalJs: { rawBytes: 0, gzipBytes: 0, fileCount: 0 },
}

function measureFile(relFile) {
  const full = path.join(targetDir, relFile)
  if (!fs.existsSync(full)) return null
  const buf = fs.readFileSync(full)
  return {
    file: relFile,
    rawBytes: buf.length,
    gzipBytes: zlib.gzipSync(buf, { level: 9 }).length,
  }
}

for (const entry of Object.values(manifest)) {
  if (!entry || typeof entry.file !== 'string' || !entry.file.endsWith('.js')) continue
  if (seenFiles.has(entry.file)) continue
  seenFiles.add(entry.file)

  const stats = measureFile(entry.file)
  if (!stats) continue

  buckets.totalJs.rawBytes += stats.rawBytes
  buckets.totalJs.gzipBytes += stats.gzipBytes
  buckets.totalJs.fileCount += 1

  const base = path.basename(entry.file)
  if (entry.isEntry) {
    buckets.coreEntry.rawBytes += stats.rawBytes
    buckets.coreEntry.gzipBytes += stats.gzipBytes
    buckets.coreEntry.files.push(stats)
  } else if (base.startsWith('pack-')) {
    const packId = base.replace(/^pack-/, '').replace(/-[^-]+\.js$/, '')
    buckets.packs[packId] ??= { rawBytes: 0, gzipBytes: 0, files: [] }
    buckets.packs[packId].rawBytes += stats.rawBytes
    buckets.packs[packId].gzipBytes += stats.gzipBytes
    buckets.packs[packId].files.push(stats)
  } else if (base.startsWith('locale-')) {
    const locale = base.replace(/^locale-/, '').replace(/-[^-]+\.js$/, '')
    buckets.locales[locale] ??= { rawBytes: 0, gzipBytes: 0, files: [] }
    buckets.locales[locale].rawBytes += stats.rawBytes
    buckets.locales[locale].gzipBytes += stats.gzipBytes
    buckets.locales[locale].files.push(stats)
  } else {
    buckets.shared.rawBytes += stats.rawBytes
    buckets.shared.gzipBytes += stats.gzipBytes
    buckets.shared.files.push(stats)
  }
}

const reportOut = path.join(targetDir, 'pack-report.json')
fs.writeFileSync(reportOut, JSON.stringify(buckets, null, 2) + '\n', 'utf8')

console.log(`[packs/report] ${targetDir}`)
console.log(
  `  totalJs: ${buckets.totalJs.fileCount} files, raw=${buckets.totalJs.rawBytes} B, gzip=${buckets.totalJs.gzipBytes} B`,
)
console.log(
  `  coreEntry: raw=${buckets.coreEntry.rawBytes} B, gzip=${buckets.coreEntry.gzipBytes} B`,
)
for (const [id, info] of Object.entries(buckets.packs)) {
  console.log(`  pack[${id}]: raw=${info.rawBytes} B, gzip=${info.gzipBytes} B`)
}
for (const [loc, info] of Object.entries(buckets.locales)) {
  console.log(`  locale[${loc}]: raw=${info.rawBytes} B, gzip=${info.gzipBytes} B`)
}
console.log(
  `  shared: ${buckets.shared.files.length} files, raw=${buckets.shared.rawBytes} B, gzip=${buckets.shared.gzipBytes} B`,
)
