// Counts how many onboarding.industry keys the 35 layer-4 videos cover.
// Reads the real locale file so the number in the plan is measured, not guessed.
import { readFileSync } from 'node:fs'

const locales = {
  fa: 'packages/i18n/src/locales/fa-IR.json',
  af: 'packages/i18n/src/locales/fa-AF.json',
  en: 'packages/i18n/src/locales/en.json',
}

/** Finds a key anywhere in the tree and returns the object under it. */
function findKey(node, key, path = '') {
  if (node === null || typeof node !== 'object') return null
  if (!Array.isArray(node) && Object.prototype.hasOwnProperty.call(node, key)) {
    const value = node[key]
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      return { value, path: path ? `${path}.${key}` : key }
    }
  }
  for (const [k, v] of Object.entries(node)) {
    const hit = findKey(v, key, path ? `${path}.${k}` : k)
    if (hit) return hit
  }
  return null
}

const hits = {}
for (const [lang, file] of Object.entries(locales)) {
  const json = JSON.parse(readFileSync(file, 'utf8'))
  const hit = findKey(json, 'industry')
  if (!hit) {
    console.log(`${lang}: NO 'industry' KEY FOUND`)
    continue
  }
  hits[lang] = new Set(Object.keys(hit.value))
  console.log(`${lang}: ${hits[lang].size} keys at path "${hit.path}"`)
}

// The keys the layer-4 plan covers, exactly as written in docs/100-VIDEO-PLAN.md.
const PLAN_COVERED = [
  // merged videos
  'clinic',
  'medical',
  'fashion',
  'boutique',
  'computer',
  'electronics',
  'mobile',
  'furniture',
  'home',
  'hardware',
  'construction',
  'workshop',
  'autoParts',
  'fuel',
  'barbershop',
  'laundry',
  'beauty',
  'bookstore',
  'stationery',
  'toys',
  'gift',
  'florist',
  'pet',
  'sports',
  'cosmetics',
  'optical',
  'distribution',
  'logistics',
  'agriculture',
  'livestock',
  'feed',
  'ecommerce',
  // owned videos
  'grocery',
  'supermarket',
  'pharmacy',
  'bakery',
  'restaurant',
  'fastfood',
  'cafe',
  'jewelry',
  'printing',
  'wholesale',
  'warehouse',
  'manufacturing',
  'factory',
  'hotel',
  'travel',
  'service',
  'retail',
]

const covered = new Set(PLAN_COVERED)
for (const [lang, keys] of Object.entries(hits)) {
  const missing = [...keys].filter((k) => !covered.has(k))
  const extra = PLAN_COVERED.filter((k) => !keys.has(k))
  console.log(`\n--- ${lang} ---`)
  console.log(`locale keys: ${keys.size} | plan covers: ${covered.size}`)
  console.log(`NOT in the plan (${missing.length}): ${missing.join(', ') || 'none'}`)
  console.log(`in the plan but NOT in locale (${extra.length}): ${extra.join(', ') || 'none'}`)
}

// The marketplace is a platform feature, not an onboarding industry — report it apart.
const faKeys = hits.fa ?? new Set()
console.log(`\n'marketplace' in locale: ${faKeys.has('marketplace')}`)
