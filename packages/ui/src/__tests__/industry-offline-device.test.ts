// ============================================
// V69.7 Guard: offline behaviour and the execution site, per representative.
//
// The point of the suite is that two documents cannot quietly disagree with the
// code:
//   - `OFFLINE-AND-DEVICE.md` must print, for every main action of a
//     representative, the status `OFFLINE_ENDPOINT_MATRIX` really carries;
//   - the execution site has ONE contract (`executionSiteFor`, three
//     operations), and the document may not invent a fourth or a third path;
//   - a booking overlap stays an explicit conflict on sync — `PENDING_REVIEW` /
//     `RESOURCE_SLOT_OVERLAP`, permanent, never last-write-wins.
//
// To rewrite the documents after a real change:
//   node scripts/industry/generate-industry-docs.mjs
// ============================================

import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { OFFLINE_ENDPOINT_MATRIX } from '@hisabche/validation'

import { buildIndustryDocs } from './industry-docs/build'
import { REPRESENTATIVES } from './industry-docs/content'

const ROOT = path.resolve(__dirname, '../../../..')
const DOCS = path.join(ROOT, 'docs/industries')

/** The four representatives this round names, and nothing else. */
const UNDER_TEST = ['clothing', 'beautySalon', 'education', 'repairs'] as const
type TestedId = (typeof UNDER_TEST)[number]

const STATUS_TEXT: Readonly<Record<string, string>> = {
  available: 'آفلاین: در دسترس',
  online_required: 'فقط آنلاین',
  not_supported: 'در نسخه‌ی آفلاین نیست',
}

const HEADER = '| اقدام | endpoint | آفلاین (ماتریس) | مکان اجرا (`executionSiteFor`) |'

const built = buildIndustryDocs(ROOT)

function offlineDoc(id: TestedId): string {
  const file = built.find((entry) => entry.path === `${id}/OFFLINE-AND-DEVICE.md`)
  if (!file) throw new Error(`no OFFLINE-AND-DEVICE.md built for ${id}`)
  return file.content
}

function statusOf(endpoint: string): string {
  const row = OFFLINE_ENDPOINT_MATRIX[endpoint as keyof typeof OFFLINE_ENDPOINT_MATRIX]
  if (!row) throw new Error(`no offline matrix row for ${endpoint}`)
  return row[1]
}

function rowOf(action: string, endpoint: string): string {
  return `| ${action} | \`${endpoint}\` | ${STATUS_TEXT[statusOf(endpoint)]} |`
}

function readRepoFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), 'utf8')
}

/** Source assertions read the CODE, not the comments that describe it. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1')
}

function flat(source: string): string {
  return stripComments(source).replace(/\s+/g, ' ')
}

const EXECUTION_SITE_RAW = readRepoFile('packages', 'api', 'src', 'lib', 'execution-site.ts')
const EXECUTION_SITE = flat(EXECUTION_SITE_RAW)
const SYNC_ENGINE = flat(
  readRepoFile('packages', 'app-shell', 'src', 'features', 'sync', 'sync-engine.ts'),
)

/** The union, read from the source itself — a fourth member is a fourth path. */
function deviceOperations(source: string): string[] {
  const match = /export type DeviceOperation =([\s\S]*?)(?:\n\s*export|$)/.exec(source)
  if (!match?.[1]) return []
  return match[1]
    .split('|')
    .map((part) => part.trim().replace(/^'|'$/g, ''))
    .filter(Boolean)
}

describe('V69.7 — offline and device per representative', () => {
  it('prints, for every action of the four representatives, the matrix status it really has', () => {
    for (const id of UNDER_TEST) {
      const spec = REPRESENTATIVES[id]
      expect(spec, `a representative spec for ${id}`).toBeDefined()
      const text = offlineDoc(id)
      expect(text, `${id} has the per-action table`).toContain(HEADER)
      for (const op of spec!.operations) {
        expect(text, `${id}: ${op.action}`).toContain(rowOf(op.action, op.endpoint))
      }
    }
  })

  it('covers the six main actions this round names, with today’s real status', () => {
    const named = [
      { what: 'sale', id: 'clothing', endpoint: 'POST /invoices', status: 'available' },
      { what: 'cash payment', id: 'clothing', endpoint: 'POST /payments', status: 'available' },
      {
        what: 'appointment',
        id: 'beautySalon',
        endpoint: 'POST /service-delivery/sessions',
        status: 'available',
      },
      {
        what: 'booking',
        id: 'beautySalon',
        endpoint: 'POST /resource-bookings',
        status: 'available',
      },
      {
        what: 'service record',
        id: 'education',
        endpoint: 'POST /service-delivery/sessions',
        status: 'available',
      },
      {
        what: 'session deduction',
        id: 'education',
        endpoint: 'POST /package-credits/consume',
        status: 'available',
      },
      {
        what: 'repair intake',
        id: 'repairs',
        endpoint: 'POST /repair-tickets',
        status: 'online_required',
      },
    ] as const

    for (const item of named) {
      const spec = REPRESENTATIVES[item.id]
      const op = spec?.operations.find((entry) => entry.endpoint === item.endpoint)
      expect(op, `${item.what}: ${item.id} lists ${item.endpoint}`).toBeDefined()
      // The document's own text must carry it, and the matrix must still say this.
      expect(offlineDoc(item.id), `${item.what} row in ${item.id}`).toContain(
        rowOf(op!.action, item.endpoint),
      )
      expect(statusOf(item.endpoint), `${item.what}: matrix status`).toBe(item.status)
    }
  })

  it('keeps the execution site to one contract of three operations', () => {
    expect(deviceOperations(EXECUTION_SITE_RAW)).toEqual([
      'invoice.create',
      'payment.record',
      'invoice.return',
    ])
    // The two ways back to the server are in the contract, not in a caller.
    expect(EXECUTION_SITE).toContain('if (!readiness) return ')
    expect(EXECUTION_SITE).toContain('if (!workspaceId) return ')
    // A device is judged by the data it holds, never by the hardware.
    expect(EXECUTION_SITE).not.toMatch(/deviceClass|runtime-policy|memory|cores/)

    const clothing = offlineDoc('clothing')
    for (const operation of ['invoice.create', 'payment.record', 'invoice.return']) {
      expect(clothing, `clothing names ${operation}`).toContain(operation)
    }
    for (const id of UNDER_TEST) {
      expect(offlineDoc(id), `${id} refuses a third path`).toContain('مسیر سوم ساخته نمی‌شود')
      // An operation the contract does not name is said out loud, not implied.
      expect(offlineDoc(id), `${id} marks unnamed operations`).toContain(
        'قرارداد مکان اجرا این عمل را نام نمی‌برد',
      )
    }
  })

  it('keeps an offline booking overlap an explicit conflict, wired once', () => {
    const salon = offlineDoc('beautySalon')
    expect(salon).toContain('`POST /resource-bookings`')
    expect(salon).toContain('handleBookingSyncConflict')
    expect(salon).toContain('PENDING_REVIEW')
    expect(salon).toContain('RESOURCE_SLOT_OVERLAP')
    expect(salon).toContain('permanent')

    // The conflict shape is produced in one function…
    expect(SYNC_ENGINE).toContain("conflictState: 'PENDING_REVIEW'")
    expect(SYNC_ENGINE).toContain("reason: 'RESOURCE_SLOT_OVERLAP'")

    // …and the push path hands a 409 on a booking to it, permanently.
    const bookingAt = SYNC_ENGINE.indexOf("'/resource-bookings'")
    expect(bookingAt, 'the booking push exists').toBeGreaterThan(-1)
    const block = SYNC_ENGINE.slice(bookingAt, bookingAt + 900)
    expect(block).toContain('status === 409')
    expect(block).toContain('handleBookingSyncConflict(')
    expect(block).toContain('err.permanent = true')
    expect(block).toContain('throw err')
    // Last-write-wins would be a patch; the conflict path is a 409 and a stop.
    expect(block).not.toContain('.patch(')

    // The behaviour itself is proven by the app-shell test the document cites.
    const proof = readRepoFile(
      'packages',
      'app-shell',
      'src',
      '__tests__',
      'resource-capacity-race.test.ts',
    )
    expect(proof).toContain('handleBookingSyncConflict')
    expect(proof).toContain('RESOURCE_SLOT_OVERLAP')
  })

  it('claims a device path only for an operation a hook really asks about', () => {
    const hooksDir = path.join(ROOT, 'packages/api/src/hooks')
    const used = new Set<string>()
    for (const name of fs.readdirSync(hooksDir)) {
      if (!name.endsWith('.ts')) continue
      const source = fs.readFileSync(path.join(hooksDir, name), 'utf8')
      for (const match of source.matchAll(/executionSiteFor\('([a-zA-Z.]+)'\)/g)) {
        used.add(String(match[1]))
      }
    }
    expect(used.has('invoice.create'), 'the sale asks the contract').toBe(true)

    const clothing = offlineDoc('clothing')
    expect(clothing, 'the sale shows the device path').toContain('`invoice.create` → `device`')
    for (const declaredOnly of ['payment.record', 'invoice.return']) {
      if (used.has(declaredOnly)) {
        expect(clothing, `${declaredOnly} is asked, so the doc may promise device`).toContain(
          `\`${declaredOnly}\` → \`device\``,
        )
      } else {
        expect(clothing, `${declaredOnly} is declared but unused`).toContain(
          `\`${declaredOnly}\` در قرارداد هست، ولی هیچ hook آن را صدا نمی‌زند`,
        )
      }
    }
  })

  it('the documents on disk are the ones the builder produces', () => {
    for (const id of UNDER_TEST) {
      const onDisk = fs.readFileSync(path.join(DOCS, id, 'OFFLINE-AND-DEVICE.md'), 'utf8')
      expect(onDisk, `${id} is generated, not typed`).toBe(offlineDoc(id))
    }
  })

  it('injection test: a status that drifts from the matrix is refused', () => {
    const spec = REPRESENTATIVES.clothing!
    const op = spec.operations.find((entry) => entry.endpoint === 'POST /invoices')!
    const row = rowOf(op.action, 'POST /invoices')
    const text = offlineDoc('clothing')
    expect(text).toContain(row)
    // Flip the printed status: the exact row is gone, so the guard would fail.
    const drifted = text.replace(row, row.replace('آفلاین: در دسترس', 'فقط آنلاین'))
    expect(drifted).not.toContain(row)
    expect(drifted).toContain(row.replace('آفلاین: در دسترس', 'فقط آنلاین'))
  })

  it('injection test: a fourth execution-site operation is refused', () => {
    expect(deviceOperations(EXECUTION_SITE_RAW)).toHaveLength(3)
    const withoutReturn = EXECUTION_SITE_RAW.replace(" | 'invoice.return'", '')
    expect(deviceOperations(withoutReturn)).toEqual(['invoice.create', 'payment.record'])
  })
})
