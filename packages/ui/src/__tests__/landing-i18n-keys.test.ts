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
    expect([...keys]).toContain('landing.modules.label')
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
    // Menu entries live in the client shell; the sections are mounted by the
    // server composition.
    const shell = strip(readFileSync(join(LANDING, 'landing-shell.tsx'), 'utf8'))
    const page = strip(readFileSync(join(LANDING, 'landing-page.tsx'), 'utf8'))
    const menu = [...shell.matchAll(/id: '([a-z-]+)' as const/g)].map((m) => m[1])
    const mounted = [...page.matchAll(/<NavigationRegistry id="([a-z-]+)">/g)].map((m) => m[1])
    expect(menu.length).toBeGreaterThan(3)
    expect(menu.filter((id) => !mounted.includes(id))).toEqual([])
  })

  it('every menu anchor is a section id the scroll observer accepts', () => {
    // The observer drops unknown ids silently: the highlight just never moves.
    const shell = strip(readFileSync(join(LANDING, 'landing-shell.tsx'), 'utf8'))
    const store = readFileSync(join(LANDING, 'use-scroll-narrative-store.ts'), 'utf8')
    const accepted: string[] =
      (store.match(/export type SectionId = ([^\n]+)/)?.[1] ?? '').match(/'([a-z-]+)'/g) ?? []
    const menu = [...shell.matchAll(/id: '([a-z-]+)' as const/g)].map((m) => `'${m[1]}'`)
    expect(menu.filter((id) => !accepted.includes(id))).toEqual([])
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
  // Chapters: counts come from the CHAPTERS table (cards / chips / examples).
  const chapterSrc = read('chapter-scene.tsx')
  for (const m of chapterSrc.matchAll(
    /^ {2}(\w+): \{\s*cards: \[([^\]]*)\][^,]*,\s*chips: (\d+),\s*examples: (\d+)/gm,
  )) {
    const base = `landing.chapter.${m[1]}`
    families.push(`${base}.label`, `${base}.title`, `${base}.desc`)
    const cards = m[2]!.split(',').filter((x) => x.trim()).length
    for (let i = 1; i <= cards; i++)
      families.push(`${base}.card${i}.title`, `${base}.card${i}.desc`)
    for (let i = 1; i <= Number(m[3]); i++) families.push(`${base}.chip${i}`)
    for (let i = 1; i <= Number(m[4]); i++) families.push(`${base}.example${i}`)
    if (Number(m[4]) > 0) families.push(`${base}.note`)
  }
  const modulesSrc = read('modules-scene.tsx')
  const groups = [...modulesSrc.matchAll(/key: '(\w+)',\r?\n\s*icon:/g)].map((m) => m[1]!)
  for (const g of groups) families.push(`landing.modules.group.${g}`)
  for (const k of ids(modulesSrc, 'key'))
    if (!groups.includes(k)) families.push(`landing.modules.item.${k}`)
  for (const k of (read('cta-scene.tsx').match(/const PROOF = \[([^\]]*)\]/)?.[1] ?? '').match(
    /\w+/g,
  ) ?? [])
    families.push(`landing.proof.${k}`)
  // Worked-example panels and step chains (`${k}.pipe${i + 1}` etc.).
  const visuals = read('chapter-visuals.tsx')
  for (const m of visuals.matchAll(/const k = '([\w.]+)'/g)) {
    const body = visuals.slice(m.index)
    const end = body.indexOf('\nexport function', 1)
    for (const s of (end > 0 ? body.slice(0, end) : body).matchAll(/t\(`\$\{k\}\.(\w+)`\)/g))
      families.push(`${m[1]}.${s[1]}`)
  }
  for (const [prefix, count] of [
    ['landing.visual.offline.pipe', 6],
    ['landing.visual.offline.action', 4],
    ['landing.chapter.inventory.flow', 6],
    ['landing.system.trace.step', 6],
  ] as const)
    for (let i = 1; i <= count; i++) families.push(`${prefix}${i}`)
  for (const row of ['opening', 'receipts', 'payments', 'transfer'])
    families.push(`landing.visual.till.${row}`, `landing.visual.till.${row}Amount`)
  families.push(
    'landing.visual.example',
    'landing.chapter.ledger.tagline',
    'landing.chapter.offline.badge',
  )
  for (const m of read('faq-scene.tsx').matchAll(/(?:question|answer)Key: '([\w.]+)'/g))
    families.push(m[1]!)
  for (const k of ids(read('system-scene.tsx'), 'key'))
    for (const f of ['title', 'desc']) families.push(`landing.system.step.${k}.${f}`)
  for (const k of ids(read('site-footer-view.tsx'), 'key')) families.push(`landing.footerLink.${k}`)
  const trust = read('trust-bar-scene.tsx')
  const industries = trust.slice(
    trust.indexOf('const INDUSTRIES'),
    trust.indexOf('const SCENARIOS'),
  )
  for (const k of ids(industries, 'key')) families.push(`landing.industry.${k}`)
  for (const k of ids(trust.slice(trust.indexOf('const SCENARIOS')), 'key'))
    families.push(`landing.industries.${k}.title`, `landing.industries.${k}.desc`)
  const rows = read('compare-scene.tsx').match(/const ROWS = \[([^\]]*)\]/)?.[1] ?? ''
  for (const k of rows.match(/\w+/g) ?? [])
    families.push(`landing.compare.row.${k}.old`, `landing.compare.row.${k}.new`)
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
    expect(families).toContain('landing.chapter.reports.card5.desc')
    expect(families).toContain('landing.chapter.money.chip4')
    expect(families).toContain('landing.chapter.ai.example4')
    expect(families).toContain('landing.modules.group.management')
    expect(families).toContain('landing.proof.languages')
    expect(families).toContain('landing.industries.services.desc')
    expect(families).toContain('landing.compare.row.changes.new')
    expect(families).toContain('landing.system.step.report.desc')
    expect(families).toContain('landing.security.sod.bullet3')
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
    const page = sources.find(([name]) => name === 'landing-shell.tsx')![1]
    expect(page).toContain('overflow-x-clip')
    expect(page).not.toContain('overflow-x-hidden')
  })

  it('the header uses the project Sheet for the phone menu, loaded on first tap', () => {
    const nav = sources.find(([name]) => name === 'top-nav.tsx')![1]
    const menu = strip(
      readFileSync(join(__dirname, '../components/ui/navigation/landing-mobile-menu.tsx'), 'utf8'),
    )
    expect(menu).toContain("from '../sheet'")
    expect(nav).not.toContain("from '../sheet'")
    expect(nav).toContain("dynamic(() => import('./landing-mobile-menu')")
    expect(nav).toMatch(/variant === 'landing' \? 'hidden md:flex'/)
  })
})

// PageSpeed mobile TBT reached 6.9 s with every landing section hydrating. The
// static sections are server components; a stray 'use client' (or a hook) would
// silently put them back into the client bundle.
describe('static landing sections stay server components', () => {
  it.each([
    'cinematic-hero.tsx',
    'system-scene.tsx',
    'chapter-scene.tsx',
    'modules-scene.tsx',
    'security-scene.tsx',
    'cta-scene.tsx',
    'trust-bar-scene.tsx',
    'faq-scene.tsx',
    'site-footer-view.tsx',
    'landing-page.tsx',
  ])('%s has no use client and no hooks', (file) => {
    const src = strip(readFileSync(join(LANDING, file), 'utf8'))
    expect(src).not.toMatch(/['"]use client['"]/)
    expect(src).not.toMatch(
      /\buse(State|Effect|Ref|Memo|Callback|SceneObserver|IntlLocale|Router)\(/,
    )
  })
})

// PageSpeed desktop found a 400 KiB chunk that was 100% unused: Next.js
// prefetches the JavaScript of every route linked from the viewport, and the
// landing links to /login, /signup and /docs — routes that pull the dashboard UI.
// On slow 4G that download also competed with the LCP image (mobile LCP 4.1 s).
describe('landing links do not prefetch other routes', () => {
  it.each([
    'landing/cinematic-hero.tsx',
    'landing/cta-scene.tsx',
    'landing/modules-scene.tsx',
    'landing/pricing-scene.tsx',
    'landing/site-footer-view.tsx',
    'navigation/landing-mobile-menu.tsx',
    'navigation/top-nav.tsx',
  ])('%s: every <Link> has prefetch={false}', (file) => {
    const src = strip(readFileSync(join(__dirname, '../components/ui', file), 'utf8'))
    const links = src.match(/<(?:Next)?Link\b[^]*?>/g) ?? []
    expect(links.length).toBeGreaterThan(0)
    expect(links.filter((tag) => !tag.includes('prefetch={false}'))).toEqual([])
  })
})

// Live /fa HTML: spinner at byte 1,080, the whole landing (h1 + LCP image) in
// `<div hidden id="S:0">` at byte 160,003, revealed by `$RC` at the end of the
// document. PageSpeed mobile: LCP element render delay 2,050 ms; desktop CLS 0.02.
describe('the landing is not behind a Suspense boundary', () => {
  it('apps/web page.tsx renders LandingPage without <Suspense>', () => {
    const page = strip(
      readFileSync(join(__dirname, '../../../../apps/web/app/[lang]/page.tsx'), 'utf8'),
    )
    expect(page).toContain('<LandingPage')
    expect(page).not.toMatch(/<Suspense\b/)
  })
})
