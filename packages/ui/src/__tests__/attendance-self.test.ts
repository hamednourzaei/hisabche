// ============================================
// An employee's personal attendance link — the screen side.
//
//   · the sheet: the name opens the employee's file, the day lives in the
//     address, a share button per row, and a pending request is its own number
//   · the link dialog: copy through `copyText`, state from the server
//   · the public page: no clock of its own, «no answer» is «we do not know»,
//     a server code is translated only from a closed list
//   · the route: noindex, its own layout, blocked in robots, in both shells
//   · every key in fa, af and en
// ============================================

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { isRealIsoDay } from '../hooks/use-address-day'
import { ATTENDANCE_LINK_ERROR_CODES } from '../components/ui/team-and-payroll/attendance-link-dialog'
import { ATTENDANCE_DECISION_ERROR_CODES } from '../components/ui/team-and-payroll/attendance-submissions-dialog'
import {
  SELF_ERROR_CODES,
  SELF_STATUSES,
} from '../components/ui/team-and-payroll/containers/attendance-self-container'

const ROOT = join(__dirname, '../../../..')
const UI = join(ROOT, 'packages/ui/src')

const code = (path: string) =>
  readFileSync(join(ROOT, path), 'utf8')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line))
    .join('\n')
    .split(/\s+/)
    .join(' ')

const SHEET = 'packages/ui/src/components/ui/team-and-payroll/attendance-sheet.tsx'
const LINK = 'packages/ui/src/components/ui/team-and-payroll/attendance-link-dialog.tsx'
const REVIEW = 'packages/ui/src/components/ui/team-and-payroll/attendance-submissions-dialog.tsx'
const SELF =
  'packages/ui/src/components/ui/team-and-payroll/containers/attendance-self-container.tsx'
const HOOK = 'packages/api/src/hooks/attendance-links.ts'

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

describe('the attendance sheet', () => {
  const sheet = code(SHEET)

  it('the name is a real link to the employee file, built with the locale helper', () => {
    expect(sheet).toContain('href={localizePath(`/team-and-payroll/${row.employeeId}`, lang)}')
    expect(sheet).toContain("import Link from 'next/link'")
    expect(sheet).toContain('const lang = useRouteLang()')
    // No route with a language written into it, and no bare push.
    expect(sheet).not.toMatch(/['"`]\/(fa|af|en)\//)
    expect(sheet).not.toMatch(/router\.push\(['"`]\//)
  })

  it('⚠️ the day lives in the address, not in component state', () => {
    expect(sheet).toContain('const [date, setDate] = useAddressDay()')
    expect(sheet).not.toContain('useState(() => toIsoDay(new Date()))')
    const hook = code('packages/ui/src/hooks/use-address-day.ts')
    expect(hook).toContain('searchParams.get(param)')
    expect(hook).toContain('isRealIsoDay(asked) ? asked : today')
    expect(hook).toContain('router.replace(')
  })

  it('a day that is not a real day is ignored, never guessed at', () => {
    expect(isRealIsoDay('2026-10-12')).toBe(true)
    expect(isRealIsoDay('2024-02-29')).toBe(true)
    for (const bad of ['2026-02-30', '2025-02-29', '2026-13-01', '2026-1-1', 'today', '', null]) {
      expect(isRealIsoDay(bad), String(bad)).toBe(false)
    }
  })

  it('every row has a share button with a name a screen reader can say', () => {
    expect(sheet).toContain('data-share-attendance-link')
    expect(sheet).toContain("aria-label={t('link.open', { name: row.name })}")
    expect(sheet).toContain('className={GHOST_ICON_BUTTON}')
    expect(sheet).toContain('<AttendanceLinkDialog employee={linkFor}')
  })

  it('⚠️ a pending request is its own number and never part of «present»', () => {
    expect(sheet).toContain('data-pending-summary')
    expect(sheet).toContain("{t('submissions.summary')}")
    // The five counters still come from the server's summary of RECORDS.
    expect(sheet).toContain("['present', sheet.data.summary.present]")
    expect(sheet).not.toMatch(/summary\.present\s*\+/)
    expect(sheet).toContain('data-from-link')
  })

  it('what employees sent is read BESIDE the sheet — its failure is not the failure of the sheet', () => {
    expect(sheet).toContain('const sent = useAttendanceSubmissions(date)')
    // The sheet's own error branch looks only at the sheet.
    expect(sheet).toContain(') : sheet.error || !sheet.data ? (')
    expect(sheet).not.toContain('sent.error ||')
    expect(sheet).not.toContain('sent.isLoading ?')
  })
})

describe('the link dialog', () => {
  const dialog = code(LINK)

  it('copies only through copyText, and says whether it worked', () => {
    expect(dialog).toContain('if (await copyText(url)) toast.success(')
    expect(dialog).toContain("else toast.error(t('link.copyFailed'))")
    for (const file of [LINK, REVIEW, SELF, SHEET]) {
      expect(code(file), file).not.toContain('navigator.clipboard')
    }
  })

  it('the state of a link is the word of the server; no date is compared here', () => {
    expect(dialog).toContain("const live = current?.state === 'active'")
    expect(dialog).not.toMatch(/new Date\([^)]*expiresAt[^)]*\)\s*(<|>)/)
    expect(dialog).not.toContain('Date.now()')
  })

  it('the device is read after mount: origin, zone and the share sheet', () => {
    const effect = dialog.slice(dialog.indexOf('useEffect(() => { setDevice({'))
    expect(effect.startsWith('useEffect(() => { setDevice({')).toBe(true)
    expect(dialog.split('window.location').length - 1).toBe(2)
    expect(dialog.split('resolvedOptions().timeZone').length - 1).toBe(1)
    expect(dialog.indexOf('window.location')).toBeGreaterThan(dialog.indexOf('useEffect(() => {'))
    // No zone, no link: the button waits rather than sending a guess.
    expect(dialog).toContain('disabled={create.isPending || !device.timeZone}')
    expect(dialog).not.toMatch(/timeZone: ['"]Asia\//)
  })

  it('the link points at the public page, with the language of the reader', () => {
    expect(dialog).toContain('localizePath(`/my-attendance/${current.token}`, locale)')
  })

  it('the link is fetched only while the dialog is open, and is not kept on the device', () => {
    const hook = code(HOOK)
    expect(hook).toContain('enabled: ready && !!employeeId')
    expect(hook).toContain('meta: { persist: false }')
    expect(hook).toContain('gcTime: 0')
    expect(dialog).toContain('useAttendanceLink(employee?.id ?? null)')
  })
})

describe('the public page', () => {
  const page = code(SELF)

  it('⚠️ has no clock of its own: «now» and «today» come from the server', () => {
    expect(page).not.toContain('new Date(')
    expect(page).not.toContain('Date.now(')
    expect(page).not.toContain('getTimezoneOffset')
    expect(page).not.toContain('resolvedOptions')
    expect(page).toContain('onClick={() => setCheckIn(view.now)}')
    expect(page).toContain('item.date === view.today')
  })

  it('offers present, absent and leave — holiday is not for the employee to declare', () => {
    expect([...SELF_STATUSES]).toEqual(['present', 'absent', 'leave'])
  })

  it('⚠️ «no answer» is «we do not know»: it re-reads, keeps the request id, and never says «failed»', () => {
    const caught = page.slice(page.indexOf("} catch { setOutcome({ kind: 'unknown' })"))
    expect(caught.startsWith("} catch { setOutcome({ kind: 'unknown' }) await read(true)")).toBe(
      true,
    )
    // The id changes only after a definite answer.
    expect(page.split('setRequestId(newRequestId())').length - 1).toBe(2)
    const sent = page.indexOf("setOutcome({ kind: 'sent'")
    const unknown = page.indexOf("setOutcome({ kind: 'unknown' })")
    const renewed = page.lastIndexOf('setRequestId(newRequestId())')
    expect(renewed).toBeGreaterThan(sent)
    expect(renewed).toBeLessThan(unknown)
    expect(page).toContain('clientRequestId: requestId')
  })

  it('a server code reaches t() only from the closed list', () => {
    expect(page).toContain("return known ? t(`errors.${known}`) : t('errors.general')")
    expect(page).not.toMatch(/t\(body\??\.code/)
    expect(page).not.toMatch(/t\(`errors\.\$\{(code|body)/)
  })

  it('a dead link has one sentence, whatever killed it', () => {
    expect(page.split("setLoad({ kind: 'gone' })").length - 1).toBe(2)
    expect(page).toContain("{t('gone')}")
  })

  it('uses the shared switch and the shared select — it draws neither', () => {
    expect(page).toContain('<SegmentedControl')
    expect(page).toContain('<SelectField')
    expect(page).not.toContain('role="radiogroup"')
    expect(page).not.toContain('<select')
  })
})

describe('the route', () => {
  const page = code('apps/web/app/[lang]/my-attendance/[token]/page.tsx')

  it('is metadata and one container: noindex, no client code of its own', () => {
    expect(page).not.toContain("'use client'")
    expect(page).toContain('index: false')
    expect(page).toContain('follow: false')
    expect(page).toContain('<AttendanceSelfContainer token={token} />')
    expect(page.split('<main').length - 1).toBe(1)
  })

  it('has a layout that ships the namespaces the container reads', () => {
    const layout = code('apps/web/app/[lang]/my-attendance/layout.tsx')
    expect(layout).toContain("namespaces={[...CORE_NAMESPACES, 'attendanceSelf', 'select']}")
  })

  it('is closed to crawlers and absent from the sitemap', () => {
    const robots = code('apps/web/app/robots.ts')
    expect(robots).toContain("'/my-attendance/',")
    expect(robots).toContain("'/*/my-attendance/',")
    expect(readFileSync(join(ROOT, 'apps/web/app/sitemap.ts'), 'utf8')).not.toContain(
      'my-attendance',
    )
  })

  it('exists in the other shell too, and both barrels export the container', () => {
    const shell = code('packages/app-shell/src/app/app.tsx')
    expect(shell).toContain("{ path: 'my-attendance/:token', element: <AttendanceSelfPage /> }")
    expect(
      existsSync(join(ROOT, 'packages/app-shell/src/features/public/attendance-self-page.tsx')),
    ).toBe(true)
    for (const barrel of ['index.ts', 'screens.ts']) {
      expect(readFileSync(join(UI, barrel), 'utf8'), barrel).toContain(
        "export { AttendanceSelfContainer } from './components/ui/team-and-payroll/containers/attendance-self-container'",
      )
    }
  })
})

describe.each(['fa', 'af', 'en'])('messages in %s', (lang) => {
  const all = messages(lang)

  it('every refusal a screen can explain has its sentence', () => {
    for (const known of [...ATTENDANCE_LINK_ERROR_CODES, ...ATTENDANCE_DECISION_ERROR_CODES]) {
      expect(typeof at(all, `attendance.errors.${known}`), known).toBe('string')
    }
    for (const known of SELF_ERROR_CODES) {
      expect(typeof at(all, `attendanceSelf.errors.${known}`), known).toBe('string')
    }
    expect(typeof at(all, 'attendanceSelf.errors.general')).toBe('string')
    expect(typeof at(all, 'attendance.errors.general')).toBe('string')
  })

  it('every key the three screens name exists', () => {
    const literal = (source: string, namespace: string) =>
      [...source.matchAll(/\bt\(\s*'([A-Za-z0-9_.]+)'/g)].map((match) => `${namespace}.${match[1]}`)
    const keys = [
      ...literal(code(LINK), 'attendance'),
      ...literal(code(REVIEW), 'attendance'),
      ...literal(code(SELF), 'attendanceSelf'),
      'attendance.openFile',
      'attendance.fromLink',
      'attendance.link.open',
      'attendance.submissions.pendingCount',
      'attendance.submissions.summary',
      'common.retry',
      ...['active', 'expired', 'revoked'].map((state) => `attendance.link.state.${state}`),
      ...['pending', 'applied', 'approved', 'rejected'].map(
        (state) => `attendanceSelf.states.${state}`,
      ),
      ...['present', 'absent', 'leave', 'holiday', 'open'].map(
        (status) => `attendanceSelf.statuses.${status}`,
      ),
      ...['applied', 'pending', 'unknown'].map((result) => `attendanceSelf.result.${result}`),
    ]
    expect(keys.length).toBeGreaterThan(60)
    const missing = [...new Set(keys)].filter((key) => typeof at(all, key) !== 'string')
    expect(missing).toEqual([])
  })

  it('a message with a placeholder names the value the screen passes', () => {
    for (const [key, placeholder] of [
      ['attendance.openFile', '{name}'],
      ['attendance.link.open', '{name}'],
      ['attendance.link.title', '{name}'],
      ['attendance.link.daysBackOption', '{count}'],
      ['attendance.link.timeZone', '{zone}'],
      ['attendance.submissions.title', '{name}'],
      ['attendance.submissions.pendingCount', '{count}'],
      ['attendanceSelf.zoneNote', '{zone}'],
      ['attendanceSelf.rejectedBecause', '{reason}'],
    ] as const) {
      expect(String(at(all, key)), key).toContain(placeholder)
    }
  })
})
