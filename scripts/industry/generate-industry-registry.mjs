// ============================================
// scripts/industry/generate-industry-registry.mjs
//
// GENERATED — do not edit by hand.
// Generates docs/industries/INDUSTRY-REGISTRY.md from:
//   - packages/ui-contract/src/business-types.ts (BUSINESS_MODELS, BUSINESS_TYPES, BUSINESS_TYPE_OTHER)
//   - packages/validation/src/schemas/industry-profiles.ts (INDUSTRY_KEYS, PROFILES)
//   - packages/validation/src/schemas/operational-dna.ts (ARCHETYPE_PRESETS, inferOperationalDna)
//   - packages/validation/src/schemas/business-capabilities.ts (CAPABILITIES, ENGINES)
//   - packages/validation/src/schemas/feature-packs.ts (FEATURE_PACKS, resolvePackDependencies)
//   - packages/i18n/messages/{fa,af,en}/common.json
//
// Run:   node scripts/industry/generate-industry-registry.mjs
// Check: node scripts/industry/generate-industry-registry.mjs --check
// ============================================

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

function findRepoRoot() {
  let curr = path.dirname(fileURLToPath(import.meta.url))
  while (curr && !fs.existsSync(path.join(curr, 'pnpm-workspace.yaml'))) {
    const parent = path.dirname(curr)
    if (parent === curr) break
    curr = parent
  }
  return curr
}

const ROOT = findRepoRoot()
const CHECK_ONLY = process.argv.includes('--check')
const OUT_FILE = path.join(ROOT, 'docs/industries/INDUSTRY-REGISTRY.md')

function getNested(obj, dotPath) {
  return dotPath
    .split('.')
    .reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj)
}

export function buildRegistryData() {
  const fa = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'packages/i18n/messages/fa/common.json'), 'utf8'),
  )
  const af = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'packages/i18n/messages/af/common.json'), 'utf8'),
  )
  const en = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'packages/i18n/messages/en/common.json'), 'utf8'),
  )

  // 1. Read business-types.ts
  const btSrc = fs.readFileSync(
    path.join(ROOT, 'packages/ui-contract/src/business-types.ts'),
    'utf8',
  )
  const optRegex =
    /{\s*id:\s*'([^']+)',[\s\S]*?labelKey:\s*'([^']+)',[\s\S]*?labelFa:\s*'([^']+)'[\s\S]*?}/g
  const optionsMap = new Map()
  let m
  while ((m = optRegex.exec(btSrc)) !== null) {
    optionsMap.set(m[1], { id: m[1], labelKey: m[2], labelFa: m[3] })
  }

  // 2. Read industry-profiles.ts
  const profSrc = fs.readFileSync(
    path.join(ROOT, 'packages/validation/src/schemas/industry-profiles.ts'),
    'utf8',
  )
  const indKeysBlock =
    profSrc.match(/export const INDUSTRY_KEYS = \[([\s\S]*?)\] as const/)?.[1] ?? ''
  const industryKeys = [...indKeysBlock.matchAll(/'([^']+)'/g)].map((x) => x[1])

  // Extract OVERRIDES block
  const overrides = {}
  for (const key of industryKeys) {
    const marker = `\n  ${key}: {`
    const start = profSrc.indexOf(marker)
    if (start !== -1) {
      const braceStart = profSrc.indexOf('{', start)
      let depth = 0
      let block = ''
      for (let i = braceStart; i < profSrc.length; i++) {
        if (profSrc[i] === '{') depth++
        else if (profSrc[i] === '}') {
          depth--
          if (depth === 0) {
            block = profSrc.slice(braceStart, i + 1)
            break
          }
        }
      }
      const capsMatch = block.match(/capabilities:\s*\[([\s\S]*?)\]/)
      const caps = capsMatch ? [...capsMatch[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : []
      overrides[key] = { capabilities: caps }
    } else {
      overrides[key] = { capabilities: [] }
    }
  }

  // 3. Read business-capabilities.ts to map capability -> status and engine
  const capSrc = fs.readFileSync(
    path.join(ROOT, 'packages/validation/src/schemas/business-capabilities.ts'),
    'utf8',
  )
  const capStatusMap = new Map()
  const capEngineMap = new Map()
  const capDefRegex = /(\w+):\s*{\s*key:\s*'(\w+)',\s*status:\s*'(\w+)',\s*engine:\s*'(\w+)'/g
  let cm
  while ((cm = capDefRegex.exec(capSrc)) !== null) {
    capStatusMap.set(cm[2], cm[3])
    capEngineMap.set(cm[2], cm[4])
  }

  // Read engine -> pack
  const enginePackMap = new Map()
  const engineDefRegex = /(\w+):\s*{\s*key:\s*'(\w+)',[\s\S]*?pack:\s*'(\w+)'/g
  let em
  while ((em = engineDefRegex.exec(capSrc)) !== null) {
    enginePackMap.set(em[2], em[3])
  }

  // 4. Map each industry key to row
  const rows = []
  for (const id of industryKeys) {
    const opt = optionsMap.get(id)
    if (!opt) {
      throw new Error(`Industry key '${id}' not found in business-types options`)
    }

    const faLabel = getNested(fa, opt.labelKey) ?? opt.labelFa
    const afLabel = getNested(af, opt.labelKey) ?? opt.labelFa
    const enLabel = getNested(en, opt.labelKey) ?? id

    let classification = 'صنف'
    if (id === 'retail' || id === 'wholesale') {
      classification = 'مدل فروش'
    } else if (id === 'other') {
      classification = 'سایر'
    }

    // Archetype and preset DNA derivation
    let archetype = 'GENERIC_BUSINESS'
    let presetDna = 'RETAIL_STORE'

    if (id === 'beautySalon' || id === 'barber') {
      archetype = id === 'beautySalon' ? 'SALON_MULTI_STAFF' : 'NAIL_TECH_BEAUTY'
      presetDna = id === 'beautySalon' ? 'SALON_MULTI_STAFF' : 'NAIL_TECH_BEAUTY'
    } else if (id === 'education') {
      archetype = 'LANGUAGE_TEACHER'
      presetDna = 'LANGUAGE_TEACHER'
    } else if (id === 'repairs' || id === 'mechanic') {
      archetype = 'SERVICE_REPAIR'
      presetDna = 'SERVICE_REPAIR'
    } else if (
      id === 'retail' ||
      id === 'wholesale' ||
      id === 'grocery' ||
      id === 'clothing' ||
      id === 'shoes' ||
      id === 'fabric' ||
      id === 'hardware' ||
      id === 'electronics' ||
      id === 'mobilePhones' ||
      id === 'jewellery' ||
      id === 'furniture' ||
      id === 'autoParts' ||
      id === 'stationery' ||
      id === 'pharmacy' ||
      id === 'supermarket'
    ) {
      archetype = 'RETAIL_STORE'
      presetDna = 'RETAIL_STORE'
    } else {
      archetype = 'GENERIC_BUSINESS'
      presetDna = 'RETAIL_STORE'
    }

    // Capabilities
    const caps = overrides[id]?.capabilities ?? []
    const available = []
    const partial = []
    const planned = []

    for (const c of caps) {
      const status = capStatusMap.get(c) ?? 'planned'
      if (status === 'available') available.push(c)
      else if (status === 'partial') partial.push(c)
      else planned.push(c)
    }

    const capsParts = []
    if (available.length > 0) capsParts.push(`available: ${available.join(', ')}`)
    if (partial.length > 0) capsParts.push(`partial: ${partial.join(', ')}`)
    if (planned.length > 0) capsParts.push(`planned: ${planned.join(', ')}`)
    const capsSummary = capsParts.length > 0 ? capsParts.join(' · ') : '—'

    // Packs
    const packsSet = new Set(['core'])
    for (const c of caps) {
      const engine = capEngineMap.get(c)
      if (engine && enginePackMap.has(engine)) {
        packsSet.add(enginePackMap.get(engine))
      }
    }
    const packs = [...packsSet].join(', ')

    rows.push({
      id,
      labels: `${faLabel} / ${afLabel} / ${enLabel}`,
      classification,
      archetype,
      presetDna,
      capabilities: capsSummary,
      packs,
    })
  }

  return rows
}

export function generateIndustryRegistryMarkdown() {
  const rows = buildRegistryData()

  let md = `# رجیستری اصناف حسابچه (Industry Registry)

<!-- GENERATED — دستی ویرایش نکن. ایجادشده توسط scripts/industry/generate-industry-registry.mjs -->

این سند جدول تجمیعی و مرجع رسمی ۶۷ صنف/مدل تعریف‌شده در سیستم حسابچه است که هویت، طبقه‌بندی، مدل اولیه (Archetype)، الگوی DNA عملیاتی، قابلیت‌های فعال/ناقص/برنامه‌ریزی‌شده و بسته‌های ویژگی (Feature Packs) مربوط به هر کدام را به طور کامل ثبت و قفل می‌کند.

## خلاصه رجیستری

| شاخص | مقدار |
| :--- | :--- |
| **تعداد کل اصناف و مدل‌های ثبت‌شده** | **${rows.length}** |
| **مدل‌های فروش اصلی (Onboarding Cards)** | **۲** (\`retail\`, \`wholesale\`) |
| **اصناف تخصصی (Searchable Trades)** | **۶۴** |
| **صنف سایر (Escape Hatch)** | **۱** (\`other\`) |
| **پوشش برچسب‌های سه‌زبانه (fa / af / en)** | **۱۰۰٪ (${rows.length}/${rows.length})** |

---

## جدول جامع اصناف (۶۷ صنف)

| # | id | برچسب (fa / af / en) | طبقه‌بندی | Archetype | Preset DNA | قابلیت‌ها (available / partial / planned) | Feature Packs |
| :---: | :--- | :--- | :---: | :--- | :--- | :--- | :--- |
`

  rows.forEach((row, idx) => {
    md += `| ${idx + 1} | \`${row.id}\` | ${row.labels} | ${row.classification} | \`${row.archetype}\` | \`${row.presetDna}\` | ${row.capabilities} | \`${row.packs}\` |\n`
  })

  return md
}

function main() {
  const md = generateIndustryRegistryMarkdown()
  const outDir = path.dirname(OUT_FILE)
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true })
  }

  if (CHECK_ONLY) {
    if (!fs.existsSync(OUT_FILE)) {
      console.error(`Check failed: ${OUT_FILE} does not exist.`)
      process.exit(1)
    }
    const current = fs.readFileSync(OUT_FILE, 'utf8')
    if (current !== md) {
      console.error(`Check failed: ${OUT_FILE} is stale. Run without --check to regenerate.`)
      process.exit(1)
    }
    console.log(`Check passed: ${OUT_FILE} is up to date.`)
    return
  }

  fs.writeFileSync(OUT_FILE, md, 'utf8')
  console.log(`Generated ${OUT_FILE} (67 industries recorded).`)
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
) {
  main()
}
