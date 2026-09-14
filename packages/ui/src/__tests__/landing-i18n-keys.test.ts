// Landing redesign guard — every literal translation key the landing page asks
// for exists in fa, af AND en, and no hardcoded English sits in its JSX text.
//
// A fallback string hides a missing key: `t(key, 'رایگان')` renders Persian on
// /en and the page still looks fine in fa. So "it renders" proves nothing here.
import { readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { describe, expect, it } from 'vitest'

const LANDING = join(__dirname, '../components/ui/landing')
const MESSAGES = join(__dirname, '../../../i18n/messages')
const FILES = [
  ...readdirSync(LANDING)
    .filter((f) => f.endsWith('.tsx') && f !== 'transform-scene.tsx') // not mounted
    .map((f) => join(LANDING, f)),
  join(__dirname, '../components/ui/navigation/top-nav.tsx'),
]

const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const messages = Object.fromEntries(
  ['fa', 'af', 'en'].map((l) => [
    l,
    JSON.parse(readFileSync(join(MESSAGES, l, 'common.json'), 'utf8')) as Record<string, unknown>,
  ]),
)

const has = (tree: Record<string, unknown>, key: string) =>
  key.split('.').reduce<unknown>((node, part) => {
    return node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined
  }, tree) !== undefined

describe('landing i18n', () => {
  const keys = new Set<string>()
  for (const file of FILES) {
    const src = strip(readFileSync(file, 'utf8'))
    // t('a.b') / st('a.b') / t(`a.b`) without interpolation, and data-table keys.
    for (const m of src.matchAll(/\b(?:t|st)\(\s*['`]([a-zA-Z][\w.]*)['`]/g)) keys.add(m[1]!)
    for (const m of src.matchAll(
      /(?:Key|labelKey|valueKey|titleKey):\s*'([a-zA-Z][\w.]*\.[\w.]+)'/g,
    ))
      keys.add(m[1]!)
  }

  it('found the keys (the scan itself works)', () => {
    expect(keys.size).toBeGreaterThan(40)
    expect([...keys]).toContain('landing.featureStatus.active')
  })

  it.each(['fa', 'af', 'en'])('every literal key exists in %s', (locale) => {
    const missing = [...keys].filter((k) => !has(messages[locale]!, k))
    expect(missing).toEqual([])
  })

  it('no hardcoded English text between JSX tags', () => {
    const offenders: string[] = []
    for (const file of FILES) {
      const src = strip(readFileSync(file, 'utf8'))
      for (const m of src.matchAll(/>\s*([A-Za-z][A-Za-z ,.'!?-]{2,})\s*</g)) {
        offenders.push(`${file.split(/[\\/]/).pop()}: ${m[1]}`)
      }
    }
    expect(offenders).toEqual([])
  })
})

describe('landing section menu', () => {
  it('every menu anchor is a section the page actually mounts', () => {
    const src = strip(readFileSync(join(LANDING, 'landing-page.tsx'), 'utf8'))
    const menu = [...src.matchAll(/id: '([a-z-]+)' as const/g)].map((m) => m[1])
    const mounted = [...src.matchAll(/<NavigationRegistry id="([a-z-]+)">/g)].map((m) => m[1])
    expect(menu.length).toBeGreaterThan(3)
    expect(menu.filter((id) => !mounted.includes(id))).toEqual([])
  })
})

describe('landing data carries no pre-formatted Persian', () => {
  it('numbers are numbers, and table values are not Persian literals', () => {
    const offenders: string[] = []
    for (const file of FILES) {
      const src = strip(readFileSync(file, 'utf8'))
      const name = basename(file)
      for (const m of src.matchAll(/:\s*'[۰-۹]+'/g)) offenders.push(`${name}: ${m[0]}`)
      for (const m of src.matchAll(/values:\s*\[[^\]]*[؀-ۿ][^\]]*\]/g))
        offenders.push(`${name}: ${m[0]}`)
    }
    expect(offenders).toEqual([])
  })
})

// Keys built from data (`landing.capability.${item.key}.claim`) are invisible
// to the literal scan above — the capability cards rendered Persian on /en for
// exactly that reason. Expand each family from the data it iterates.
describe('landing i18n — data-driven key families', () => {
  // Raw source: class strings like `/0.6)]` next to `*` confuse the comment stripper.
  const read = (f: string) => readFileSync(join(LANDING, f), 'utf8')
  const ids = (src: string, field: string) =>
    [...src.matchAll(new RegExp(String.raw`\b${field}:\s*'(\w+)'`, 'g'))].map((m) => m[1]!)

  const families: string[] = []
  for (const k of ids(read('social-scene.tsx'), 'key'))
    families.push(`landing.capability.${k}.claim`, `landing.capability.${k}.where`)
  for (const k of ids(read('features-scene.tsx'), 'key'))
    families.push(`landing.feature.${k}Title`, `landing.feature.${k}Desc`)
  for (const k of ids(read('site-footer.tsx'), 'key')) families.push(`landing.footerLink.${k}`)
  for (const k of ids(read('trust-bar-scene.tsx'), 'key')) families.push(`landing.industry.${k}`)
  const pricing = read('pricing-scene.tsx')
  for (const k of ids(pricing, 'key'))
    for (const f of ['name', 'bestIf', 'cta', 'who']) families.push(`landing.pricing.${k}.${f}`)
  for (const k of ids(pricing, 'groupKey')) families.push(`landing.pricing.group.${k}`)
  for (const k of ids(pricing, 'labelKey')) families.push(`landing.pricing.row.${k}`)
  for (const m of read('security-scene.tsx').matchAll(
    /key:\s*'(\w+)',[\s\S]*?bullets:\s*\[([^\]]*)\]/g,
  )) {
    families.push(`landing.security.${m[1]}.title`)
    const count = (m[2]!.match(/'[^']*'/g) ?? []).length
    for (let j = 1; j <= count; j++) families.push(`landing.security.${m[1]}.bullet${j}`)
  }

  it('expanded every family', () => {
    expect(families.length).toBeGreaterThan(150)
    expect(families).toContain('landing.capability.c8.where')
  })

  it.each(['fa', 'af', 'en'])('every data-driven key exists in %s', (locale) => {
    expect(families.filter((k) => !has(messages[locale]!, k))).toEqual([])
  })
})

// Mobile redesign guard. Measured at 360px before the fix: 10px footer links,
// a horizontally scrolling section strip in the header, and a sticky header
// that scrolled away because an ancestor used `overflow-x: hidden`.
describe('landing is mobile-first', () => {
  const sources = FILES.map((file) => [basename(file), strip(readFileSync(file, 'utf8'))] as const)

  it('no text below 12px (text-[8..11px])', () => {
    const hits = sources.flatMap(([name, src]) =>
      [...src.matchAll(/text-\[(?:[89]|1[01])px\]/g)].map((m) => `${name}: ${m[0]}`),
    )
    expect(hits).toEqual([])
  })

  it('nothing scrolls sideways except the wide-screen comparison table', () => {
    const hits = sources.flatMap(([name, src]) =>
      [...src.matchAll(/overflow-x-(?:auto|scroll)|snap-x/g)].map((m) => `${name}: ${m[0]}`),
    )
    expect(hits).toEqual(['pricing-scene.tsx: overflow-x-auto'])
    const pricing = sources.find(([name]) => name === 'pricing-scene.tsx')![1]
    expect(pricing).toContain("'mt-10 hidden lg:block")
  })

  it('the page wrapper clips instead of hiding, so the sticky header stays stuck', () => {
    const page = sources.find(([name]) => name === 'landing-page.tsx')![1]
    expect(page).toContain('overflow-x-clip')
    expect(page).not.toContain('overflow-x-hidden')
  })

  it('the header uses the project Sheet for the phone menu', () => {
    const nav = sources.find(([name]) => name === 'top-nav.tsx')![1]
    expect(nav).toContain("from '../sheet'")
    expect(nav).toMatch(/variant === 'landing' \? 'hidden md:flex'/)
  })
})
