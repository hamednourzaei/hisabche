// packages/ui/src/__tests__/landing-journey-scene-data.test.ts
//
// What the landing hall shows and where its camera stands are data, so they
// are tested as data: the boards against the one sale they describe, the shots
// against the room they have to fit in, the names on the walls against the
// messages file.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { JOURNEY_INDUSTRIES } from '../components/ui/landing/journey/journey-industries'
import {
  BURST_AT,
  FINALE_AT,
  JOURNEY_STATIONS,
  journeyAt,
  journeyInto,
  newJourneySnapshot,
} from '../components/ui/landing/journey/journey-machine'
import {
  STATION_FEATURE,
  buildScreens,
  fill,
  type ScreenLabels,
} from '../components/ui/landing/journey/journey-screens'
import {
  CRANE_FROM,
  MAX_DISTANCE,
  OPENING_SHOT,
  PORTRAIT_YAW_LIMIT,
  STATION_GAP,
  STATION_SHOTS,
  eyeOffset,
  fitDistance,
  hallSize,
  shotPose,
} from '../components/ui/landing/journey/journey-shots'
import {
  DEMO_SALE,
  formatDemoAmount,
  formatDemoCount,
  saleRemaining,
  saleTotal,
  stockAfter,
} from '../components/ui/landing/journey/landing-demo-data'

const MESSAGES = join(process.cwd(), '..', 'i18n', 'messages')
const LANGS = ['fa', 'af', 'en'] as const
const messages = (lang: string) =>
  JSON.parse(readFileSync(join(MESSAGES, lang, 'common.json'), 'utf8')).landing

/** The labels as the server resolves them, read from the real messages file. */
function labels(lang: string): ScreenLabels {
  const landing = messages(lang)
  const screen = landing.journey.screen
  return {
    titles: {
      pay: landing.system.step.pay.title,
      cash: landing.system.step.cash.title,
      stock: landing.system.step.stock.title,
      post: landing.system.step.post.title,
      report: landing.system.step.report.title,
    },
    note: landing.visual.example,
    waiting: screen.waiting,
    money: screen.money,
    units: landing.journey.currency,
    change: screen.change,
    invoice: screen.invoice,
    total: screen.total,
    paid: screen.paid,
    remaining: screen.remaining,
    customerBalance: screen.customerBalance,
    received: screen.received,
    drawerBefore: screen.drawerBefore,
    drawerAfter: screen.drawerAfter,
    items: screen.item,
    debit: screen.debit,
    credit: screen.credit,
    accounts: screen.account,
    balanced: screen.balanced,
    sales: screen.sales,
    receivables: screen.receivables,
    unitsSold: screen.unitsSold,
  }
}

describe('every board shows the one sale', () => {
  it.each(LANGS)(
    '%s: one board per station, no row empty, no placeholder left unfilled',
    (lang) => {
      const screens = buildScreens(labels(lang), lang)
      expect(screens.map((screen) => screen.id)).toEqual([...JOURNEY_STATIONS])
      for (const screen of screens) {
        expect(screen.title.length, screen.id).toBeGreaterThan(0)
        expect(screen.rows.length, screen.id).toBeGreaterThanOrEqual(2)
        expect(screen.rows.length, screen.id).toBeLessThanOrEqual(4)
        for (const row of screen.rows) {
          expect(row.label.length, `${screen.id} label`).toBeGreaterThan(0)
          expect((row.value + row.extra).length, `${screen.id} ${row.label}`).toBeGreaterThan(0)
          expect(row.label + row.value + row.extra).not.toContain('{')
          expect(row.label).not.toContain('landing.')
        }
        expect(screen.foot).not.toContain('{')
      }
    },
  )

  it.each(LANGS)('%s: the same amount reads the same on every board that shows it', (lang) => {
    const [pay, cash, stock, post, report] = buildScreens(labels(lang), lang)
    const total = formatDemoAmount(saleTotal(), lang)
    const paid = formatDemoAmount(DEMO_SALE.paid, lang)
    const remaining = formatDemoAmount(saleRemaining(), lang)
    // Payment and report: total, paid and what is still owed.
    expect(pay?.rows[0]?.value).toContain(total)
    expect(report?.rows[0]?.value).toBe(pay?.rows[0]?.value)
    expect(pay?.rows[1]?.value).toContain(paid)
    expect(cash?.rows[1]?.value).toContain(paid)
    expect(pay?.rows[2]?.value).toContain(remaining)
    expect(report?.rows[2]?.value).toBe(pay?.rows[2]?.value)
    // The journal: cash and receivable on one side, revenue on the other.
    expect(post?.rows.map((row) => row.value)).toEqual([paid, remaining, ''])
    expect(post?.rows.map((row) => row.extra)).toEqual(['', '', total])
    // Stock: before and after, for each item sold.
    DEMO_SALE.items.forEach((item, index) => {
      const value = stock?.rows[index]?.value ?? ''
      expect(value).toContain(formatDemoCount(item.stockBefore, lang))
      expect(value).toContain(formatDemoCount(stockAfter(item), lang))
    })
    // Every board that closes with the invoice names the same invoice.
    for (const screen of [pay, cash, stock, report]) {
      expect(screen?.foot).toContain(DEMO_SALE.invoiceId)
    }
  })

  it('Iran reads toman, Afghanistan and the English page read afghani — never both in one figure', () => {
    const fa = buildScreens(labels('fa'), 'fa')[0]?.rows[0]?.value ?? ''
    const af = buildScreens(labels('af'), 'af')[0]?.rows[0]?.value ?? ''
    const en = buildScreens(labels('en'), 'en')[0]?.rows[0]?.value ?? ''
    expect(fa).toBe(`۱۳۰٬۰۰۰ ${messages('fa').journey.currency.toman}`)
    expect(af).toContain(messages('af').journey.currency.afghani)
    expect(af).not.toMatch(/[0-9]/)
    expect(en).toBe('13,000 AFN')
  })

  it('a share bar is a share: between nothing and the whole', () => {
    for (const screen of buildScreens(labels('en'), 'en')) {
      for (const row of screen.rows) {
        expect(row.share).toBeGreaterThanOrEqual(0)
        expect(row.share).toBeLessThanOrEqual(1)
      }
    }
  })

  it('every station names the product capability it stands for', () => {
    for (const id of JOURNEY_STATIONS) expect(STATION_FEATURE[id], id).toMatch(/^\w+\.[\w-]+$/)
    expect(Object.keys(STATION_FEATURE).sort()).toEqual([...JOURNEY_STATIONS].sort())
  })

  it('fill leaves a placeholder it has no value for exactly as written', () => {
    expect(fill('{a} of {b}', { a: '1' })).toBe('1 of {b}')
  })

  it.each(LANGS)('%s: what a clerk says is one short line', (lang) => {
    const say = messages(lang).journey.say
    for (const id of JOURNEY_STATIONS) {
      expect(typeof say[id], id).toBe('string')
      expect(say[id].length, `${lang} ${id}`).toBeLessThanOrEqual(lang === 'en' ? 110 : 90)
    }
  })
})

describe('the camera is authored, and fits in the hall', () => {
  const shots = JOURNEY_STATIONS.map((id) => STATION_SHOTS[id])
  const pose = { yaw: 0, pitch: 0, distance: 0 }
  const offset = { x: 0, y: 0, z: 0 }

  it('no two neighbouring stations arrive the same way, starting from the opening', () => {
    const moves = [OPENING_SHOT.move, ...shots.map((shot) => shot.move)]
    for (let index = 1; index < moves.length; index++) {
      expect(moves[index], `stop ${index}`).not.toBe(moves[index - 1])
    }
  })

  it('the camera stands at eye level: never a view from above', () => {
    for (const shot of [OPENING_SHOT, ...shots]) {
      expect(shot.pitch).toBeLessThanOrEqual(8)
      for (const along of [0, 0.25, 0.5, 0.75, 1]) {
        expect(shotPose(shot, along, false, pose).pitch).toBeLessThanOrEqual(CRANE_FROM)
      }
    }
    expect(CRANE_FROM).toBeLessThanOrEqual(15)
  })

  it('a right-to-left hall is the mirror image: sideways flips, height and depth do not', () => {
    for (const shot of shots) {
      shotPose(shot, 1, false, pose)
      const one = { ...eyeOffset(pose, 10, 1, offset) }
      const other = { ...eyeOffset(pose, 10, -1, offset) }
      expect(other.x).toBeCloseTo(-one.x, 10)
      expect(other.y).toBeCloseTo(one.y, 10)
      expect(other.z).toBeCloseTo(one.z, 10)
      expect(Math.abs(one.x)).toBeGreaterThan(1)
    }
  })

  it('on a tall narrow screen the camera does not swing wide', () => {
    for (const shot of shots) {
      for (const along of [0, 0.5, 1]) {
        expect(Math.abs(shotPose(shot, along, true, pose).yaw)).toBeLessThanOrEqual(
          PORTRAIT_YAW_LIMIT,
        )
      }
    }
  })

  it.each([
    ['desktop', 2.4],
    ['phone', 1.1],
  ])(
    '%s: every shot, at its furthest, is inside the walls and clear of the station behind',
    (_, side) => {
      const hall = hallSize(JOURNEY_STATIONS.length, side)
      for (const shot of [OPENING_SHOT, ...shots]) {
        for (const along of [0, 0.5, 1]) {
          for (const roadSide of [-1, 1]) {
            shotPose(shot, along, false, pose)
            eyeOffset(pose, MAX_DISTANCE, roadSide, offset)
            // The station stands `side` off the road; the camera swings to the road side of it.
            expect(Math.abs(-roadSide * side + offset.x)).toBeLessThan(hall.halfWidth - 1.2)
            // Behind the camera is the previous station's board, a gap back.
            expect(offset.z).toBeLessThan(STATION_GAP - 2.5)
            expect(offset.z).toBeGreaterThan(0)
          }
        }
      }
      // The opening shot has the front wall behind it; the core has the back wall.
      expect(0.3 + MAX_DISTANCE).toBeLessThan(hall.front - 1.2)
      expect(hall.back).toBeLessThan(-(JOURNEY_STATIONS.length + 1) * STATION_GAP - 5 - 4)
      expect(hall.height).toBeGreaterThan(8)
    },
  )

  it('less free screen, or a narrower one, moves the camera back', () => {
    const wide = fitDistance(5.4, 5.3, 45, 16 / 9, 0.6)
    expect(fitDistance(5.4, 5.3, 45, 16 / 9, 0.4)).toBeGreaterThan(wide)
    expect(fitDistance(5.4, 5.3, 45, 9 / 19, 0.6)).toBeGreaterThan(wide)
    // Worked by hand: 5.3 tall in 60% of a 45° view with a 14% margin.
    expect(wide).toBeCloseTo(5.3 / (2 * Math.tan(Math.PI / 8) * 0.6 * 0.86), 6)
    expect(wide).toBeGreaterThan(8)
    expect(wide).toBeLessThan(MAX_DISTANCE)
  })
})

describe('the ending waits for the core', () => {
  const N = JOURNEY_STATIONS.length
  const ending = (local: number) => journeyAt((N + 1 + local) / (N + 2), N)

  it('the invitation is not shown until the burst is over', () => {
    expect(BURST_AT).toBeLessThan(FINALE_AT)
    expect(ending(0.1).invited).toBe(false)
    expect(ending(BURST_AT + 0.05).invited).toBe(false)
    expect(ending(FINALE_AT - 0.02).invited).toBe(false)
    expect(ending(FINALE_AT + 0.02).invited).toBe(true)
    expect(journeyAt(1, N).invited).toBe(true)
    // Never during a station.
    expect(journeyAt((3 + 0.99) / (N + 2), N).invited).toBe(false)
  })

  it('scrolling back out of the ending takes the invitation away again', () => {
    expect(ending(0.9).invited).toBe(true)
    expect(ending(0.3).invited).toBe(false)
  })

  it('the snapshot the scene reuses gives the same answer and makes no new lists', () => {
    const snap = newJourneySnapshot(N)
    const gates = snap.gates
    for (const progress of [0, 0.17, 0.44, 0.71, 0.93, 1]) {
      expect(journeyInto(progress, N, snap)).toEqual(journeyAt(progress, N))
      expect(snap.gates).toBe(gates)
    }
  })
})

describe('the names on the walls', () => {
  it.each(LANGS)('%s has a name for every kind of business on a board', (lang) => {
    const names = messages(lang).industry
    for (const { key, icon } of JOURNEY_INDUSTRIES) {
      expect(typeof names[key] === 'string' && names[key].length > 0, `${lang}: ${key}`).toBe(true)
      expect(icon.length).toBeGreaterThan(0)
    }
  })

  it('only kinds of business whose daily work the product covers', () => {
    const keys = JOURNEY_INDUSTRIES.map(({ key }) => key as string)
    expect(new Set(keys).size).toBe(keys.length)
    // In the messages file, and deliberately not on a wall: nothing here takes
    // bookings, keeps patients or runs pumps.
    for (const absent of ['hotel', 'clinic', 'fuel', 'travel', 'medical']) {
      expect(keys).not.toContain(absent)
    }
  })
})
