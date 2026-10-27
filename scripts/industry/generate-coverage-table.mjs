// scripts/industry/generate-coverage-table.mjs
//
// Writes the industry coverage evidence matrix, in Markdown and CSV, from
// `coverage-data.mjs`. Both files come from the same rows, so they cannot drift.
//
// WHAT IS RESOLVED AT RUN TIME (never typed by hand)
//   · the current line of every repository anchor (needle search; the script
//     fails if a file or needle has vanished)
//   · existence of every cited test file
//   · whether an onboarding key is really in INDUSTRY_KEYS
//   · confidence, from a stated rule (below)
//
// CONFIDENCE RULE
//   HIGH    status VERIFIED_SUPPORTED · ≥ 2 sources · ≥ 1 of them official/forum
//   MEDIUM  ≥ 2 sources, or exactly one official source
//   LOW     no source, or a single vendor/forum source
//
// Run:    node scripts/industry/generate-coverage-table.mjs
// Check:  node scripts/industry/generate-coverage-table.mjs --check

import fs from 'node:fs'
import path from 'node:path'

import {
  ACCESSED,
  CAPABILITIES,
  EVIDENCE,
  INDUSTRIES,
  NEW_ONBOARDING_KEYS,
  NO_SOURCE,
  REQUIRED_ONBOARDING,
  SOURCES,
  STATUS,
  TESTS,
} from './coverage-data.mjs'

const ROOT = process.cwd()
const CHECK_ONLY = process.argv.includes('--check')
const OUT_DIR = 'docs/architecture/universal-core'
const OUT_MD = `${OUT_DIR}/INDUSTRY-COVERAGE-TABLE.md`
const OUT_CSV = `${OUT_DIR}/INDUSTRY-COVERAGE-TABLE.csv`
const OUT_SUPPORT = 'docs/architecture/industry/INDUSTRY-SUPPORT-MATRIX.md'

const problems = []
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8')
const exists = (relative) => fs.existsSync(path.join(ROOT, relative))

function lineOf(anchor) {
  if (!exists(anchor.file)) {
    problems.push(`missing file: ${anchor.file}`)
    return `${anchor.file}:?`
  }
  const lines = read(anchor.file).split(/\r?\n/)
  const index = lines.findIndex((line) => line.includes(anchor.needle))
  if (index < 0) {
    problems.push(`needle not found in ${anchor.file}: ${anchor.needle}`)
    return `${anchor.file}:?`
  }
  return `${anchor.file}:${index + 1}`
}

const industryKeys = (() => {
  const source = read('packages/validation/src/schemas/industry-profiles.ts')
  const block = source.slice(source.indexOf('export const INDUSTRY_KEYS'))
  const body = block.slice(0, block.indexOf('] as const'))
  return new Set([...body.matchAll(/'([A-Za-z]+)'/g)].map((m) => m[1]))
})()

function confidence(status, sourceIds) {
  const sources = sourceIds.map((id) => SOURCES[id])
  if (sources.length === 0) return 'LOW'
  const strong = sources.filter((s) => s.kind === 'official' || s.kind === 'forum').length
  if (status === 'VERIFIED_SUPPORTED' && sources.length >= 2 && strong >= 1) return 'HIGH'
  if (sources.length >= 2) return 'MEDIUM'
  if (sources[0].kind === 'official') return 'MEDIUM'
  return 'LOW'
}

const rows = []

for (const industry of INDUSTRIES) {
  // The onboarding row — computed from the registry, not asserted.
  const key = industry.onboarding
  if (key !== null) {
    const present = industryKeys.has(key)
    const isNew = NEW_ONBOARDING_KEYS.includes(key)
    const status = !present
      ? 'UNSUPPORTED'
      : isNew
        ? 'IMPLEMENTED_THIS_ROUND'
        : 'VERIFIED_SUPPORTED'
    rows.push({
      industry: industry.name,
      capability: 'Individually selectable onboarding option',
      need: `«${key}» is a distinct key in the industry registry (not folded into «other»)`,
      status,
      evidence: [lineOf(EVIDENCE.INDUSTRY_KEYS), TESTS.PROFILES],
      why: present
        ? 'Selecting it applies the generic profile plus any capability the registry lists for it; no specialised workflow is implied.'
        : 'The registry has no key for this model, so a user can only pick a broader or generic option.',
      sources: [],
    })
  }

  for (const [capId, need, sourceIds] of industry.rows) {
    const cap = CAPABILITIES[capId]
    if (!cap) {
      problems.push(`unknown capability ${capId} in ${industry.id}`)
      continue
    }
    if (!STATUS.includes(cap.status)) problems.push(`bad status for ${capId}`)
    for (const id of sourceIds) if (!SOURCES[id]) problems.push(`unknown source ${id}`)

    const evidence = [
      ...cap.evidence.map((name) => (EVIDENCE[name] ? lineOf(EVIDENCE[name]) : `?${name}`)),
      ...cap.tests.map((name) => {
        const file = TESTS[name]
        if (!file || !exists(file)) problems.push(`missing test file: ${name}`)
        return file ?? `?${name}`
      }),
    ]
    let why = cap.why
    if (cap.status === 'UNSUPPORTED' && cap.evidence.length === 0) {
      why += ' Absence confirmed by a repository search on ' + ACCESSED + '.'
    }
    rows.push({
      industry: industry.name,
      capability: capId,
      need,
      status: cap.status,
      evidence,
      why,
      sources: sourceIds,
    })
  }
}

// Every onboarding option the owner required must have a row.
for (const [label, keys] of Object.entries(REQUIRED_ONBOARDING)) {
  const covered = INDUSTRIES.some((i) => i.onboarding !== null && keys.includes(i.onboarding))
  if (!covered) problems.push(`required onboarding option «${label}» has no industry entry`)
}

// ---------------------------------------------------------------- rendering
const csvCell = (value) => `"${String(value).replace(/"/g, '""')}"`

const sourceCell = (ids) =>
  ids.length === 0
    ? NO_SOURCE
    : ids
        .map(
          (id) =>
            `${id}: ${SOURCES[id].title} — ${SOURCES[id].publisher} — ${SOURCES[id].url} (accessed ${ACCESSED})`,
        )
        .join(' | ')

const csvLines = [
  [
    'business_model',
    'required_capability',
    'business_need',
    'hisabche_status',
    'repository_evidence',
    'why_missing_or_partial',
    'external_source',
    'confidence',
  ]
    .map(csvCell)
    .join(','),
]
const mdRows = []

for (const row of rows) {
  const conf = confidence(row.status, row.sources)
  const evidence = row.evidence.length ? row.evidence.join('; ') : '— (none to cite)'
  const why = row.status === 'VERIFIED_SUPPORTED' ? '—' : row.why
  csvLines.push(
    [
      row.industry,
      row.capability,
      row.need,
      row.status,
      evidence,
      why,
      sourceCell(row.sources),
      conf,
    ]
      .map(csvCell)
      .join(','),
  )
  const mdSources = row.sources.length === 0 ? NO_SOURCE : row.sources.join(', ')
  mdRows.push(
    `| ${row.industry} | \`${row.capability}\` — ${row.need} | ${row.status} | ${evidence.replace(/\|/g, '/')} | ${why.replace(/\|/g, '/')} | ${mdSources} | ${conf} |`,
  )
}

const counts = rows.reduce((acc, r) => ((acc[r.status] = (acc[r.status] ?? 0) + 1), acc), {})
const confCounts = rows.reduce((acc, r) => {
  const c = confidence(r.status, r.sources)
  acc[c] = (acc[c] ?? 0) + 1
  return acc
}, {})

const sourceRows = Object.entries(SOURCES).map(
  ([id, s]) =>
    `| ${id} | ${s.kind} | ${s.title} | ${s.publisher} | ${s.url} | ${ACCESSED} | ${s.says} |`,
)

// Highest-impact gaps: per industry, UNSUPPORTED/PARTIAL rows in the order the
// data lists them (listed most important first), at most three.
const gapSections = INDUSTRIES.map((industry) => {
  const own = rows.filter(
    (r) =>
      r.industry === industry.name &&
      r.status !== 'VERIFIED_SUPPORTED' &&
      r.status !== 'IMPLEMENTED_THIS_ROUND' &&
      !r.capability.startsWith('Individually'),
  )
  const top = own.slice(0, 3)
  const lines = top.length
    ? top.map((r, i) => `${i + 1}. \`${r.capability}\` (${r.status}) — ${r.need}`).join('\n')
    : '_No open gap in the capabilities evaluated._'
  return `### ${industry.name}\n\n${lines}\n`
})

const md = `# Industry coverage evidence matrix

> GENERATED by \`scripts/industry/generate-coverage-table.mjs\` from \`scripts/industry/coverage-data.mjs\`.
> The CSV beside this file (\`INDUSTRY-COVERAGE-TABLE.csv\`) is generated from the same rows.
> Do not edit by hand — run \`node scripts/industry/generate-coverage-table.mjs\`.

**Evidence rules.** A registry key, type, menu item or flag is not proof of a capability. \`VERIFIED_SUPPORTED\` needs an implementation anchor and a test file; every line number below is resolved from the current source by searching for a named symbol. Absence (\`UNSUPPORTED\`) was confirmed by a repository search, stated in the row.

**External sources.** Every cited page was opened on ${ACCESSED}; a search snippet alone was never cited. Most sources are vendor marketing or forum threads (kind is shown in the source table) — they show that a requirement is *claimed* by the trade, not that it is legally mandatory. No national tax, hallmarking or transport-licensing source was consulted in this round; any row that depends on one says so.

**Confidence rule.** HIGH = verified in the repository, ≥ 2 sources, ≥ 1 official or forum. MEDIUM = ≥ 2 sources, or one official source. LOW = no source, or a single vendor/forum source.

## Totals

${Object.entries(counts)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join('\n')}

Confidence: ${Object.entries(confCounts)
  .map(([k, v]) => `${k} ${v}`)
  .join(' · ')}  ·  Rows: ${rows.length}  ·  Business models: ${INDUSTRIES.length}

## Matrix

| Business model | Required capability | Hisabche status | Repository evidence (file:line / test) | Why missing or partial | External source | Confidence |
|---|---|---|---|---|---|---|
${mdRows.join('\n')}

## External sources

| ID | Kind | Title | Publisher | URL | Accessed | What it supports (own summary) |
|---|---|---|---|---|---|---|
${sourceRows.join('\n')}

## Highest-impact gaps by industry

Ranked by the order the data lists them: the business problem’s severity first, then how many other models share the gap (variants, serials and roll/area measurement each appear in four or more models), then data-integrity risk, then effort. This is a qualitative ranking — no customer counts or market sizes are used.

${gapSections.join('\n')}
`

// ------------------------------------------------- support matrix (summary)
const supportRows = INDUSTRIES.map((industry) => {
  const own = rows.filter(
    (r) => r.industry === industry.name && !r.capability.startsWith('Individually'),
  )
  const by = (status) => own.filter((r) => r.status === status).map((r) => r.capability)
  const verified = by('VERIFIED_SUPPORTED')
  const partial = by('PARTIALLY_SUPPORTED')
  const missing = by('UNSUPPORTED')
  const outcome =
    own.length === 0
      ? 'NOT_APPLICABLE'
      : missing.length === 0 && partial.length === 0
        ? 'VERIFIED_SUPPORTED'
        : verified.length + partial.length === 0
          ? 'UNSUPPORTED'
          : 'PARTIALLY_SUPPORTED'
  const onboarding = rows.find(
    (r) => r.industry === industry.name && r.capability.startsWith('Individually'),
  )
  return {
    name: industry.name,
    onboarding: onboarding ? onboarding.status : 'no distinct option',
    outcome,
    verified,
    partial,
    missing,
  }
})

const supportLines = supportRows.map(
  (r) =>
    `| ${r.name} | ${r.onboarding} | ${r.outcome} | ${r.verified.join(', ') || '—'} | ${r.partial.join(', ') || '—'} | ${r.missing.join(', ') || '—'} |`,
)

const supportMd = `# Industry support matrix

> GENERATED by \`scripts/industry/generate-coverage-table.mjs\` from the same rows as
> \`docs/architecture/universal-core/INDUSTRY-COVERAGE-TABLE.md\`. Do not edit by hand.

A business model is **not** \`VERIFIED_SUPPORTED\` merely because it can be selected. The roll-up outcome is computed from that model’s capability rows:

- \`VERIFIED_SUPPORTED\` — every capability it needs is verified.
- \`PARTIALLY_SUPPORTED\` — at least one needed capability works and at least one does not (or only partly).
- \`UNSUPPORTED\` — none of the needed capabilities works.

Every model can still run the universal core (invoices, payments, stock, ledger); the columns show what the *trade-specific* needs add.

| Business model | Selectable as its own option | Roll-up outcome | Works (verified) | Partly | Missing |
|---|---|---|---|---|---|
${supportLines.join('\n')}
`

if (problems.length) {
  console.error('COVERAGE TABLE: problems found\n - ' + problems.join('\n - '))
  process.exit(1)
}

const csv = csvLines.join('\n') + '\n'

if (CHECK_ONLY) {
  const stale =
    !exists(OUT_MD) ||
    read(OUT_MD) !== md ||
    !exists(OUT_CSV) ||
    read(OUT_CSV) !== csv ||
    !exists(OUT_SUPPORT) ||
    read(OUT_SUPPORT) !== supportMd
  if (stale) {
    console.error('STALE: run node scripts/industry/generate-coverage-table.mjs')
    process.exit(1)
  }
  console.log(`OK: ${rows.length} rows match the repository.`)
} else {
  fs.mkdirSync(path.join(ROOT, OUT_DIR), { recursive: true })
  fs.writeFileSync(path.join(ROOT, OUT_MD), md)
  fs.writeFileSync(path.join(ROOT, OUT_CSV), csv)
  fs.writeFileSync(path.join(ROOT, OUT_SUPPORT), supportMd)
  console.log(`Wrote ${rows.length} rows to ${OUT_MD} and ${OUT_CSV}`)
}
