// packages/ui/src/__tests__/landing-journey.test.ts
//
// The top of the landing is a scroll-played story drawn in Three.js. What can
// go wrong with it is specific:
//   • Three.js (≈150 KB) landing in the first paint, and the headline waiting
//     for WebGL — PageSpeed is a hard gate for this page;
//   • the headline becoming a client-rendered string instead of server HTML;
//   • a word written into the code, so `/en` shows Persian;
//   • a literal colour in the scene instead of a design token;
//   • the ten comparison variants, or the bar that switched them, coming back.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const LANDING = join(process.cwd(), 'src/components/ui/landing')
const MESSAGES = join(process.cwd(), '..', 'i18n', 'messages')

/** Comments explain the hazards in the hazards' own words; only code is asserted on. */
const code = (...parts: string[]) =>
  readFileSync(join(LANDING, ...parts), 'utf8')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line))
    .join('\n')
    .split(/\s+/)
    .join(' ')

const imports = (source: string) =>
  Array.from(source.matchAll(/(?:from\s+|import\s*\()\s*['"]([^'"]+)['"]/g), (m) => m[1] ?? '')

const hero = code('journey', 'journey-hero.tsx')
const stage = code('journey', 'journey-stage.tsx')
const scene = code('journey', 'scene.ts')
const canvas = code('three', 'scene-canvas.tsx')
const page = code('landing-page.tsx')

describe('the headline does not wait for the picture', () => {
  it('the hero is a server component that renders the <h1> and the invitation itself', () => {
    expect(hero).not.toContain("'use client'")
    expect(hero).not.toMatch(/\buse(State|Effect|Ref|Memo)\(/)
    expect(hero).toContain('<h1 ')
    expect(hero).toContain("{t('landing.journey.ready')}")
    expect(hero).toContain('hero={hero}')
    expect(hero).toContain('finale={finale}')
  })

  it('only the scene imports Three.js, and it is fetched when the browser is idle', () => {
    expect(imports(scene)).toContain('three')
    for (const source of [hero, stage, canvas, page]) expect(imports(source)).not.toContain('three')
    expect(stage).toContain("load={() => import('./scene')}")
    expect(canvas).toContain("import type { SceneRuntime } from './runtime'")
    expect(canvas).toContain("import('./runtime')")
    expect(canvas).toContain('whenIdle(')
  })

  it('the scene stops when it is off screen and stands still for reduced motion', () => {
    expect(canvas).toContain('new IntersectionObserver(')
    expect(canvas).toContain("document.visibilityState !== 'visible'")
    expect(canvas).toContain("matchMedia('(prefers-reduced-motion: reduce)')")
    expect(canvas).toContain('runtime.dispose()')
  })

  it('a beat changes React state; a scroll frame does not', () => {
    // The fill of the route is written straight to the element.
    expect(stage).toContain('fillRef.current.style.width = reach')
    // Two states, both of which change only at a boundary of the story: the beat,
    // and whether the core has burst.
    expect(stage.split('useState').length - 1).toBe(3)
    expect(stage).toContain('setInvited(now.invited)')
  })
})

describe('the story is the product, told with the product’s words', () => {
  it('the machines are the steps of one operation, from the catalogue', () => {
    expect(hero).toContain('JOURNEY_STATIONS.map((id, index) => ({')
    expect(code('journey', 'journey-machine.ts')).toContain(
      "export const JOURNEY_STATIONS = ['pay', 'cash', 'stock', 'post', 'report'] as const",
    )
    // The beat on screen and a click on the route both come from the machine.
    expect(stage).toContain('const now = journeyAt(progress, stops.length)')
    expect(stage).toContain('setBeat(now.beat)')
    expect(stage).toContain('goTo(progressForBeat(index, stops.length))')
    // The scene asks the same machine, into a snapshot it reuses.
    expect(scene).toContain('journeyInto(story, stations, snap)')
    // The one figure on the invoice is the sale total, not a second literal.
    expect(hero).toContain('amount: formatDemoAmount(saleTotal(), locale),')
    expect(hero).toContain('t(`landing.system.step.${id}.title`)')
  })

  it('the invoice carries the fields of a sales invoice, and says it is a sample', () => {
    for (const field of [
      'invoiceNumber',
      'date',
      'customer',
      'items',
      'quantity',
      'unitPrice',
      'subtotal',
      'discount',
      'tax',
      'total',
    ]) {
      expect(hero, field).toContain(`t('invoices.${field}')`)
    }
    expect(hero).toContain("sample: t('landing.visual.example')")
    expect(scene).toContain('write(labels.sample,')
  })

  it.each(['fa', 'af', 'en'])('%s has every line the journey speaks', (lang) => {
    const all = JSON.parse(readFileSync(join(MESSAGES, lang, 'common.json'), 'utf8'))
    const keys = [...hero.matchAll(/\b(?:t|raw)\(\s*'([\w.]+)'/g)].map((match) => match[1] ?? '')
    expect(keys.length).toBeGreaterThan(45)
    for (const key of keys) {
      const value = key
        .split('.')
        .reduce((at: unknown, part) => (at as Record<string, unknown> | undefined)?.[part], all)
      expect(typeof value === 'string' && value.length > 0, `${lang}: ${key}`).toBe(true)
    }
    for (const id of ['pay', 'cash', 'stock', 'post', 'report']) {
      expect(all.landing.system.step[id].title, id).toBeTruthy()
    }
    // The lines only the ten variants spoke went with them.
    expect(Object.keys(all.landing).filter((key) => /^v\d\d$/.test(key))).toEqual([])
  })

  it('no word, colour or physical direction is written into the code', () => {
    for (const source of [hero, stage, scene]) {
      expect(source).not.toMatch(/[؀-ۿ]/)
      expect(source).not.toMatch(
        /\b(?:bg|text|border|from|via|to|ring)-(?:white|black|slate|gray|zinc|red|green|emerald|teal|blue|amber)\b/,
      )
      expect(source).not.toMatch(
        /(?:^|[\s"'`:])-?(?:ml|mr|pl|pr|left|right|border-l|border-r)-[\w[]/m,
      )
    }
    // Scene colours come from the tokens of the page it is drawn on.
    expect(scene).toContain("runtime.color('--color-success')")
    expect(scene).not.toMatch(/new THREE\.Color\(\s*['"0]/)
  })
})

describe('one landing', () => {
  it('the journey is the hero of the landing, and the rest of the landing follows it', () => {
    expect(page).toContain('<JourneyHero t={t} raw={raw} locale={locale} />')
    for (const section of [
      '<ModulesScene',
      '<SecurityScene',
      '<CompareScene',
      '<PricingScene',
      '<FaqScene',
      '<CTAScene',
      '<SiteFooterView',
    ]) {
      expect(page.indexOf(section), section).toBeGreaterThan(page.indexOf('<JourneyHero'))
    }
  })

  it('the comparison variants and their bar are gone', () => {
    expect(existsSync(join(LANDING, 'variants'))).toBe(false)
    expect(readdirSync(join(LANDING, 'journey')).sort()).toEqual([
      'journey-hero.tsx',
      'journey-industries.ts',
      'journey-machine.ts',
      'journey-screens.ts',
      'journey-shots.ts',
      'journey-stage.tsx',
      'journey-state.ts',
      'landing-demo-data.ts',
      'scene.ts',
    ])
    const route = readFileSync(
      join(process.cwd(), '..', '..', 'apps', 'web', 'app', '[lang]', 'page.tsx'),
      'utf8',
    )
    expect(route).not.toContain('variant')
    expect(route).toContain('<LandingPage locale={locale} />')
  })
})
