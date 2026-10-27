// scripts/industry/generate-industry-diff.mjs
//
// Generates the machine-derived part of
// docs/architecture/industry/industry-diff.generated.md from the REAL registry.
//
// ⚠️ WHAT THIS SCRIPT MAY NOT DO
//
// It does not invent a profile, a capability or a default. Every cell comes from
// one of these files, read as source:
//
//   packages/validation/src/schemas/industry-profiles.ts
//   packages/validation/src/schemas/business-capabilities.ts
//   packages/ui-contract/src/business-types.ts
//   packages/ui/src/components/ui/landing/journey/journey-industries.ts
//
// The TypeScript modules cannot be imported by plain Node (they have no file
// extensions and use workspace imports), so the values are parsed from the
// declarations. `packages/validation/src/__tests__/industry-diff-doc.test.ts`
// imports the same modules for real and fails if this document and the runtime
// resolver disagree — the parser is never trusted on its own.
//
// Run:    node scripts/industry/generate-industry-diff.mjs
// Check:  node scripts/industry/generate-industry-diff.mjs --check  (exit 1 if stale)

import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const CHECK_ONLY = process.argv.includes('--check')

const PROFILE_FILE = 'packages/validation/src/schemas/industry-profiles.ts'
const CAPABILITY_FILE = 'packages/validation/src/schemas/business-capabilities.ts'
const LABEL_FILE = 'packages/ui-contract/src/business-types.ts'
const JOURNEY_FILE = 'packages/ui/src/components/ui/landing/journey/journey-industries.ts'
const OUT_FILE = 'docs/architecture/industry/industry-diff.generated.md'

const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8')

function between(source, start, end) {
  const from = source.indexOf(start)
  if (from === -1) return ''
  const to = source.indexOf(end, from + start.length)
  if (to === -1) return ''
  return source.slice(from + start.length, to)
}

function quotedList(source, startMarker) {
  const block = between(source, startMarker, ']')
  return [...block.matchAll(/'([^']+)'/g)].map((match) => match[1])
}

/** The object literal for one key of `OVERRIDES`, brace-matched (not regex-closed). */
function overrideBlock(source, key) {
  const marker = `\n  ${key}: {`
  const start = source.indexOf(marker)
  if (start === -1) return null
  let index = source.indexOf('{', start)
  let depth = 0
  for (let i = index; i < source.length; i++) {
    const char = source[i]
    if (char === '{') depth++
    else if (char === '}') {
      depth--
      if (depth === 0) return source.slice(index, i + 1)
    }
  }
  return null
}

const profileSource = read(PROFILE_FILE)
const capabilitySource = read(CAPABILITY_FILE)
const labelSource = read(LABEL_FILE)
const journeySource = read(JOURNEY_FILE)

const industryKeys = quotedList(profileSource, 'export const INDUSTRY_KEYS = [')
const genericDashboard = quotedList(
  profileSource,
  'const GENERIC_DASHBOARD: readonly DashboardPartId[] = [',
)
const genericUnit = (profileSource.match(/const GENERIC_PRODUCT:[^=]+=\s*\{\s*unit:\s*'([^']+)'/) ??
  [])[1]

const labels = new Map()
for (const match of labelSource.matchAll(
  /\bid:\s*'([^']+)',\s*labelKey:\s*'[^']+',\s*labelFa:\s*'([^']+)'/g,
)) {
  labels.set(match[1], match[2])
}

const journeyKeys = new Set(
  [...journeySource.matchAll(/\{\s*key:\s*'([^']+)',\s*icon:/g)].map((match) => match[1]),
)

const capabilityStatus = new Map()
for (const match of capabilitySource.matchAll(
  /key:\s*'([^']+)',\s*\n\s*status:\s*'(available|planned)'/g,
)) {
  capabilityStatus.set(match[1], match[2])
}

const profiles = industryKeys.map((key) => {
  const block = overrideBlock(profileSource, key)
  const rawCapabilities = block ? quotedList(block, 'capabilities: [') : []
  const capabilities = rawCapabilities.filter((c) => capabilityStatus.get(c) === 'available')
  const extraColumns = block ? quotedList(block, 'extraVisibleColumns: [') : []
  const emphasized = block ? quotedList(block, 'emphasizedFields: [') : []
  const dashboardOverride = block ? quotedList(block, 'dashboard: [') : []
  const unit = (block?.match(/unit:\s*'([^']+)'/) ?? [])[1] ?? genericUnit
  const multiplier = (block?.match(/priceMultiplierSource:\s*'([^']+)'/) ?? [])[1] ?? '—'
  const vocabularyBlock = block ? between(block, 'vocabulary: {', '}') : ''
  const vocabulary = [...vocabularyBlock.matchAll(/(productKey|customerKey):\s*'([^']+)'/g)].map(
    (match) => `${match[1]}=${match[2]}`,
  )
  const kind = capabilities.length > 0 || vocabulary.length > 0 ? 'تخصصی' : 'پایه (عمومی)'

  return {
    key,
    label: labels.get(key) ?? '—',
    selectable: labels.has(key) ? 'بله' : 'خیر',
    journey: journeyKeys.has(key) ? 'بله' : '—',
    kind,
    capabilities,
    unit,
    extraColumns,
    multiplier,
    emphasized,
    dashboard: dashboardOverride.length > 0 ? dashboardOverride : genericDashboard,
    vocabulary,
  }
})

const count = (predicate) => profiles.filter(predicate).length
const availableCapabilities = [...capabilityStatus.entries()]
  .filter(([, status]) => status === 'available')
  .map(([key]) => key)

function list(values) {
  return values.length > 0 ? values.join('، ') : '—'
}

const registryRows = profiles
  .map(
    (profile) =>
      `| ${profile.label} | \`${profile.key}\` | ${profile.selectable} | ${
        profile.journey
      } | ${profile.kind} | ${list(profile.capabilities)} | \`${profile.unit}\` | ${list(
        profile.extraColumns,
      )} | ${profile.multiplier === '—' ? '—' : `\`${profile.multiplier}\``} | ${list(
        profile.emphasized,
      )} | ${list(profile.dashboard)} | ${list(profile.vocabulary)} |`,
  )
  .join('\n')

const capabilityRows = [...capabilityStatus.entries()]
  .map(
    ([key, status]) =>
      `| \`${key}\` | ${status === 'available' ? 'available' : 'planned'} | ${
        availableCapabilities.includes(key) ? 'فعال' : 'فعال نیست'
      } |`,
  )
  .join('\n')

const content = `# Industry diff — generated tables

<!-- GENERATED by scripts/industry/generate-industry-diff.mjs — do not edit by hand. -->

Sources read by the generator: \`${PROFILE_FILE}\`, \`${CAPABILITY_FILE}\`, \`${LABEL_FILE}\`,
\`${JOURNEY_FILE}\`.

## Summary

| Measure | Value |
| --- | --- |
| Industry keys in the registry | ${profiles.length} |
| Selectable in onboarding | ${count((p) => p.selectable === 'بله')} |
| Specialised profile | ${count((p) => p.kind === 'تخصصی')} |
| General-purpose baseline | ${count((p) => p.kind === 'پایه (عمومی)')} |
| Exact match with \`JOURNEY_INDUSTRIES\` | ${count((p) => p.journey === 'بله')} |
| Available capabilities | ${availableCapabilities.length} |

## Industry registry

<!-- industry-registry-table -->
| Industry label | Internal key | Selectable in onboarding | Exact \`JOURNEY_INDUSTRIES\` match | Profile status | Registered capabilities | Default product unit | Extra visible invoice columns | Price multiplier source | Emphasized product fields | Dashboard order | Vocabulary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${registryRows}
<!-- /industry-registry-table -->

## Capability registry

<!-- industry-capability-table -->
| Capability | Status | Active in a resolved profile |
| --- | --- | --- |
${capabilityRows}
<!-- /industry-capability-table -->

A capability is active only when its status is \`available\`. \`planned\` capabilities are attached
to no profile and the resolver rejects them.
`

if (CHECK_ONLY) {
  const current = fs.existsSync(path.join(ROOT, OUT_FILE))
    ? fs.readFileSync(path.join(ROOT, OUT_FILE), 'utf8')
    : ''
  if (current !== content) {
    console.error(`STALE: ${OUT_FILE} does not match the registry.`)
    process.exit(1)
  }
  console.log(`OK: ${OUT_FILE} matches the registry.`)
  process.exit(0)
}

fs.mkdirSync(path.dirname(path.join(ROOT, OUT_FILE)), { recursive: true })
fs.writeFileSync(path.join(ROOT, OUT_FILE), content, 'utf8')
console.log(`wrote ${OUT_FILE}`)
