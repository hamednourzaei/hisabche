// ============================================
// Attendance terminals — the screen side, and the promise it must not make.
//
//   · no brand is «supported» anywhere: not in the panel, not in the messages
//   · the key is shown once, in a dialog, and copied through `copyText`
//   · alive / silent / the zone are the server's words — no clock is read here
//   · closed = not fetched
//   · the panel is on the shared sheet, so web, Windows and the phone have it
//   · every key in fa, af and en
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  ATTENDANCE_DEVICE_ERROR_CODES,
  DEVICE_CAPABILITY_CHOICES,
} from '../components/ui/team-and-payroll/attendance-devices'

const ROOT = join(__dirname, '../../../..')
const code = (path: string) =>
  readFileSync(join(ROOT, path), 'utf8')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line))
    .join('\n')
    .split(/\s+/)
    .join(' ')

const PANEL = 'packages/ui/src/components/ui/team-and-payroll/attendance-devices.tsx'
const panel = code(PANEL)
const hook = code('packages/api/src/hooks/attendance-devices.ts')

const messages = (lang: string) =>
  JSON.parse(
    readFileSync(join(ROOT, 'packages/i18n/messages', lang, 'common.json'), 'utf8'),
  ) as Record<string, unknown>
const at = (tree: unknown, path: string): unknown =>
  path
    .split('.')
    .reduce<unknown>(
      (node, key) =>
        node && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined,
      tree,
    )

const BRANDS = ['zkteco', 'suprema', 'hikvision', 'anviz', 'virdi', 'essl']

describe('no brand is promised', () => {
  it('⚠️ the panel names no brand — a brand is a label a person types', () => {
    const lower = panel.toLowerCase()
    for (const brand of BRANDS) expect(lower, brand).not.toContain(brand)
    // The formats shown are the server's list, not a list written here.
    expect(panel).toContain("t('formats', { formats: devices.data.formats.join(', ') })")
    expect(panel).not.toMatch(/formats: \[/)
  })

  it.each(['fa', 'af', 'en'])(
    '⚠️ the %s messages name no brand and say «supported» only to deny it',
    (lang) => {
      const devices = JSON.stringify(at(messages(lang), 'attendance.devices')).toLowerCase()
      for (const brand of BRANDS) expect(devices, brand).not.toContain(brand)
    },
  )

  it('the registry of the server has one format and no brand', () => {
    const registry = code('backend/src/services/attendance-devices/device-adapters.ts')
    expect(registry).toContain('export const DEVICE_ADAPTERS: readonly DeviceAdapter[] = [generic]')
    const lower = registry.toLowerCase()
    for (const brand of BRANDS) expect(lower, brand).not.toContain(`format: '${brand}`)
  })
})

describe('the key', () => {
  it('is copied only through copyText, and shown only in its dialog', () => {
    expect(panel).toContain('if (await copyText(value)) toast.success(')
    expect(panel).not.toContain('navigator.clipboard')
    const dialog = panel.slice(
      panel.indexOf('data-device-key'),
      panel.indexOf('data-device-revoke'),
    )
    expect(dialog).toContain("['keyLabel', fresh.key]")
    // Outside that dialog the key is not rendered: a row shows only its prefix.
    expect(panel.split('fresh.key').length - 1).toBe(1)
    expect(panel).toContain('{row.keyPrefix}…')
  })

  it('is never kept on the device: only mutations carry it', () => {
    // The list type has no key at all.
    const list = hook.slice(hook.indexOf('export interface AttendanceDevice {'))
    expect(list.slice(0, list.indexOf('}'))).not.toMatch(/\bkey: string/)
    expect(hook).toContain(
      "apiClient.post<{ device: AttendanceDevice; key: string }>( '/attendance-devices'",
    )
    // Neither mutation writes its result into the query cache.
    expect(hook).not.toContain('setQueryData')
  })

  it('the sample a person is shown is the route the server serves', () => {
    expect(panel).toContain("const EVENTS_PATH = '/public/attendance-devices/events'")
    expect(code('backend/src/routes/attendance-device.routes.ts')).toContain(
      "'/api/public/attendance-devices/events'",
    )
    expect(panel).toContain('X-Device-Key: hsd_…')
  })
})

describe('what the panel does not decide', () => {
  it('⚠️ reads no clock: health and the zone are the words of the server', () => {
    expect(panel).not.toContain('new Date(')
    expect(panel).not.toContain('Date.now(')
    expect(panel).not.toContain('resolvedOptions')
    expect(panel).toContain('data-device-health={row.health}')
    expect(panel).toContain('t(`health.${row.health}`)')
    expect(panel).toContain('row.effectiveTimeZone ? (')
    expect(panel).toContain('data-device-zone-missing')
  })

  it('closed = not fetched', () => {
    expect(panel).toContain('const devices = useAttendanceDevices(open)')
    expect(panel).toContain('const places = useWorkplaceTimeZones(open)')
    expect(hook).toContain('enabled: ready && enabled')
    expect(hook).toContain('enabled: ready && !!deviceId')
  })

  it('a failed read is not «no devices», and «not configured» is its own sentence', () => {
    const failed = panel.indexOf(') : devices.error || !devices.data ? (')
    const unset = panel.indexOf(') : !devices.data.configured ? (')
    expect(failed).toBeGreaterThan(-1)
    expect(unset).toBeGreaterThan(failed)
    expect(panel).toContain("{t('empty')}")
  })

  it('a server code is translated only from the closed list', () => {
    expect(panel).toContain("return code ? t(`errors.${code}`) : t('errors.general')")
  })

  it('a number is mapped to a person a manager chose — never matched by name', () => {
    expect(panel).toContain('everyDevice: false')
    expect(panel).toContain("nameOf(identity.employeeId) ?? t('employeeNotListed')")
    expect(panel).not.toMatch(/\.find\(\(person\) => person\.name/)
  })

  it('uses the shared table and select — it draws neither', () => {
    expect(panel).toContain('<DataTable tableId="attendance-devices"')
    expect(panel).toContain('<SelectField')
    expect(panel).not.toContain('<table')
    expect(panel).not.toContain('<select')
  })
})

describe('on every platform', () => {
  it('the panel is part of the shared attendance sheet', () => {
    const sheet = code('packages/ui/src/components/ui/team-and-payroll/attendance-sheet.tsx')
    expect(sheet).toContain('<AttendanceDevices employees={')
    // …and the sheet says who wrote a record when it was not a person.
    expect(sheet).toContain('data-from-device')
    expect(sheet).toContain("{t('fromDevice')}")
    // The shell (Windows, phone) mounts the same hub the web does.
    expect(code('packages/app-shell/src/features/team-and-payroll/tap-page.tsx')).toContain(
      "export { TeamAndPayrollContainer as default } from '@hisabche/ui/screens'",
    )
  })

  it('the settings screen of the shell has the books currency and the time zone too', () => {
    const shell = code('packages/app-shell/src/features/settings/settings-page.tsx')
    expect(shell).toContain('<BookCurrencySection />')
    expect(shell).toContain('<WorkplaceTimeZoneSection />')
  })
})

describe.each(['fa', 'af', 'en'])('messages in %s', (lang) => {
  const all = messages(lang)

  it('every key the panel names exists', () => {
    const keys = [
      ...[...panel.matchAll(/\bt\(\s*'([A-Za-z0-9_.]+)'/g)].map(
        (match) => `attendance.devices.${match[1]}`,
      ),
      ...['online', 'silent', 'never'].map((health) => `attendance.devices.health.${health}`),
      ...DEVICE_CAPABILITY_CHOICES.map((method) => `attendance.devices.methods.${method}`),
      ...ATTENDANCE_DEVICE_ERROR_CODES.map((known) => `attendance.devices.errors.${known}`),
      ...[
        'keyLabel',
        'endpointLabel',
        'colName',
        'colHealth',
        'colZone',
        'colWaiting',
        'colActions',
      ].map((key) => `attendance.devices.${key}`),
      'attendance.devices.errors.general',
      'attendance.fromDevice',
      'common.retry',
      'common.cancel',
    ]
    expect(keys.length).toBeGreaterThan(55)
    expect([...new Set(keys)].filter((key) => typeof at(all, key) !== 'string')).toEqual([])
  })

  it('a message with a placeholder names the value the panel passes', () => {
    for (const [key, placeholders] of [
      ['formats', ['{formats}']],
      ['unmatchedCount', ['{count}']],
      ['heldCount', ['{count}']],
      ['keyTitle', ['{name}']],
      ['revokeTitle', ['{name}']],
      ['peopleTitle', ['{name}']],
      ['unmatchedSeen', ['{count}', '{from}', '{to}']],
      ['mapped', ['{applied}', '{held}']],
    ] as const) {
      for (const placeholder of placeholders) {
        expect(String(at(all, `attendance.devices.${key}`)), key).toContain(placeholder)
      }
    }
  })
})

// ─── readings kept back (attendance-02) ─────────────────────────────────────

describe('readings kept back', () => {
  const HELD = 'packages/ui/src/components/ui/team-and-payroll/attendance-held-dialog.tsx'
  const held = code(HELD)

  it('the count on the panel opens the list — it is no longer only a number', () => {
    expect(panel).toContain('data-device-held onClick={() => setReviewingHeld(true)}')
    expect(panel).toContain('<AttendanceHeldDialog open={reviewingHeld}')
  })

  it('open = fetched, never from a cache; a failed read is not «nothing kept back»', () => {
    expect(held).toContain('const held = useHeldDeviceDays(open)')
    const hooks = hook.slice(hook.indexOf('export function useHeldDeviceDays'))
    const body = hooks.slice(0, hooks.indexOf('export function useAcceptHeldDeviceDay'))
    expect(body).toContain('enabled: ready && enabled')
    expect(body).toContain('staleTime: 0')
    expect(body).toContain('gcTime: 0')
    expect(body).toContain('meta: { persist: false }')
    const failed = held.indexOf(') : held.error || !held.data ? (')
    expect(failed).toBeGreaterThan(-1)
    expect(held.indexOf("{t('heldEmpty')}")).toBeGreaterThan(failed)
  })

  it('⚠️ shows both sides and decides nothing: no clock, no day arithmetic', () => {
    expect(held).toContain('data-held-readings')
    expect(held).toContain('data-held-record')
    expect(held).not.toContain('new Date(')
    expect(held).not.toContain('Date.now(')
    // «Next day» is the word of the server, per reading and per record.
    expect(held).toContain('{reading.nextDay ? (')
    expect(held).toContain('{row.record.endsNextDay ? (')
  })

  it('⚠️ accepting is one day, one button, and is refreshed whether it worked or not', () => {
    expect(held).toContain('{ employeeId: row.employeeId, day: row.day },')
    expect(held.split('accept.mutate(').length - 1).toBe(1)
    const accept = hook.slice(hook.indexOf('export function useAcceptHeldDeviceDay'))
    expect(accept).toContain('onSettled: () => {')
    expect(accept).toContain('queryClient.invalidateQueries({ queryKey: attendanceKeys.all })')
    expect(held).toContain('<DataTable tableId="attendance-held"')
    expect(held).not.toContain('<table')
  })

  it.each(['fa', 'af', 'en'])(
    'every key of the dialog exists in %s, and names no brand',
    (lang) => {
      const all = messages(lang)
      const keys = [
        ...[...held.matchAll(/\bt\(\s*'([A-Za-z0-9_.]+)'/g)].map(
          (match) => `attendance.devices.${match[1]}`,
        ),
        ...['in', 'out'].map((direction) => `attendance.devices.heldDirection.${direction}`),
        'attendance.devices.errors.ATTENDANCE_DEVICE_NOTHING_HELD',
        'attendance.devices.heldColEmployee',
        'attendance.devices.heldColDevice',
        'attendance.devices.heldColRecord',
      ]
      expect(keys.length).toBeGreaterThan(14)
      expect([...new Set(keys)].filter((key) => typeof at(all, key) !== 'string')).toEqual([])
      const lower = held.toLowerCase()
      for (const brand of BRANDS) expect(lower, brand).not.toContain(brand)
    },
  )
})
