// V70.1 generator — writes the 60-gap catalog and the 67-industry matrix.
//
//   node scripts/industry/generate-gap-matrix.mjs           # write both documents
//   node scripts/industry/generate-gap-matrix.mjs --check    # compare only, exit 1 on drift
//
// The guard `packages/validation/src/__tests__/competitor-gap-matrix.test.ts` runs --check,
// so a hand-edited document (or a dataset change without regeneration) turns the suite red.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildModel, renderCatalog, renderMatrix } from './gap-matrix.lib.mjs'

const here = dirname(fileURLToPath(import.meta.url))
// `--root <dir>` lets the guard run this generator from a temporary copy of the
// scripts against the real repository — the only way to inject a bad dataset
// without writing into the working tree.
const rootFlag = process.argv.indexOf('--root')
const ROOT =
  rootFlag > -1 && process.argv[rootFlag + 1]
    ? resolve(process.argv[rootFlag + 1])
    : resolve(here, '..', '..')

export const TARGETS = [
  { path: 'docs/architecture/V70-COMPETITOR-GAPS.md', render: renderCatalog },
  { path: 'docs/industries/COMPETITOR-GAP-MATRIX.md', render: renderMatrix },
]

const MIN_GAPS_PER_INDUSTRY = 5

export function expectedFiles(root = ROOT) {
  const model = buildModel(root)

  if (model.gaps.length !== 60) throw new Error(`expected 60 gaps, built ${model.gaps.length}`)

  const ids = model.gaps.map((g) => g.id)
  const unique = new Set(ids)
  if (unique.size !== ids.length) {
    const seen = new Set()
    const dupes = ids.filter((id) => (seen.has(id) ? true : (seen.add(id), false)))
    throw new Error(`duplicate gap ids: ${dupes.join(', ')}`)
  }

  if (model.industries.length !== 67) {
    throw new Error(`expected 67 industries, read ${model.industries.length}`)
  }

  const thin = model.industries.filter((i) => i.gaps.length < MIN_GAPS_PER_INDUSTRY)
  if (thin.length > 0) {
    throw new Error(
      `industries below ${MIN_GAPS_PER_INDUSTRY} gaps: ${thin.map((i) => `${i.id}(${i.gaps.length})`).join(', ')}`,
    )
  }

  const orphans = model.gaps.filter((gap) => !model.industries.some((i) => i.gaps.includes(gap.id)))
  if (orphans.length > 0) {
    throw new Error(`gaps that apply to no industry: ${orphans.map((g) => g.id).join(', ')}`)
  }

  return { model, files: TARGETS.map((t) => ({ path: t.path, content: t.render(model) })) }
}

function main() {
  const check = process.argv.includes('--check')
  const { model, files } = expectedFiles(ROOT)

  const drift = []
  for (const file of files) {
    const abs = join(ROOT, file.path)
    if (check) {
      if (!existsSync(abs)) drift.push(`${file.path} (missing)`)
      else if (readFileSync(abs, 'utf8') !== file.content) drift.push(`${file.path} (differs)`)
    } else {
      writeFileSync(abs, file.content, 'utf8')
    }
  }

  const familyCounts = {}
  for (const gap of model.gaps) familyCounts[gap.family] = (familyCounts[gap.family] ?? 0) + 1

  const coverage = model.industries.map((i) => i.gaps.length)

  console.log(
    `gaps=${model.gaps.length} industries=${model.industries.length} coverage=min:${Math.min(
      ...coverage,
    )}/max:${Math.max(...coverage)} probeNonZero=${model.gaps.filter((g) => g.total > 0).length}`,
  )
  console.log(
    `families=${Object.entries(familyCounts)
      .map(([k, v]) => `${k}:${v}`)
      .join(' ')}`,
  )

  if (check) {
    if (drift.length > 0) {
      console.error(`DRIFT: ${drift.join(' | ')}`)
      process.exit(1)
    }
    console.log('documents match the generator')
    return
  }

  for (const file of files) console.log(`wrote ${file.path}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
