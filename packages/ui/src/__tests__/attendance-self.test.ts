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

  it('the device gives the origin and the share sheet, after mount — and NOT the zone', () => {
    const effect = dialog.slice(dialog.indexOf('useEffect(() => { setDevice({'))
    expect(effect.startsWith('useEffect(() => { setDevice({')).toBe(true)
    expect(dialog.split('window.location').length - 1).toBe(2)
    expect(dialog.indexOf('window.location')).toBeGreaterThan(dialog.indexOf('useEffect(() => {'))
    // The zone is the workplace's, from the server. Nothing here reads a clock.
    expect(dialog).not.toContain('resolvedOptions')
    expect(dialog).not.toContain('getTimezoneOffset')
    expect(dialog).not.toMatch(/timeZone: /)
    expect(dialog).toContain('const zone = workplace?.timeZone ?? null')
  })

  it('⚠️ no zone, no link: the button waits and the dialog says where to set one', () => {
    expect(dialog).toContain('disabled={create.isPending || !zone}')
    expect(dialog).toContain('if (!employee || !zone) return')
    expect(dialog).toContain('data-workplace-zone-missing')
    expect(dialog).toContain("href={localizePath('/settings', lang)}")
    expect([...ATTENDANCE_LINK_ERROR_CODES]).toContain('ATTENDANCE_TIME_ZONE_NOT_SET')
    // The link request carries no zone of the client's.
    const hook = code(HOOK)
    const create = hook.slice(hook.indexOf('export function useCreateAttendanceLink'))
    expect(create.slice(0, create.indexOf('apiClient.post'))).not.toContain('timeZone')
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
    // Reading, sending and registering the phone: each can meet a dead link.
    expect(page.split("setLoad({ kind: 'gone' })").length - 1).toBe(3)
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

describe('Settings → time zone', () => {
  const SECTION = 'packages/ui/src/components/ui/settings/workplace-time-zone-section.tsx'
  const section = code(SECTION)

  it('⚠️ has no default: the stored zone or nothing — the device zone is only offered', () => {
    expect(section).toContain("const value = chosen ?? current ?? ''")
    expect(section).toContain('data-time-zone-unset')
    // The device's zone becomes the choice only when a person presses the button.
    expect(section.split('setChosen(device.zone)').length - 1).toBe(1)
    expect(section).toContain('onClick={() => setChosen(device.zone)}')
    for (const place of ['Asia/', 'Europe/', 'America/', 'UTC'])
      expect(section).not.toContain(place)
    expect(section).toContain('const [chosen, setChosen] = useState<string | null>(null)')
  })

  it('reads the device after mount, and treats a failed read as a failure', () => {
    expect(section.indexOf('resolvedOptions')).toBeGreaterThan(section.indexOf('useEffect(() => {'))
    expect(section.indexOf('supportedValuesOf')).toBeGreaterThan(
      section.indexOf('useEffect(() => {'),
    )
    expect(section).toContain(') : zones.isError || !zones.data ? (')
    expect(section).toContain("{t('unreadable')}")
  })

  it('a branch can be «same as the business», which is sent as null — never as a zone', () => {
    expect(section).toContain('timeZone: next === INHERIT ? null : next')
    expect(section).toContain('value={branch.timeZone ?? INHERIT}')
  })

  it('⚠️ is in BOTH shells: the Windows and phone app has its own settings screen, which must mount it too', () => {
    // The shell renders its own «general» settings, not the web page. A
    // section added only to the web page does not exist on Windows or the
    // phone — and without a zone no attendance link can be made there.
    // Since 21 Oct 2026 the shell renders the web's own page, so the section
    // is there through it — the shell must render that page, not its own.
    const shell = code('packages/app-shell/src/features/settings/settings-page.tsx')
    expect(shell).toContain('<SharedSettingsPage')
    expect(shell).toContain("from '@hisabche/ui/screens'")
    expect(readFileSync(join(UI, 'screens.ts'), 'utf8')).toContain('SettingsPage,')
    expect(code('packages/ui/src/components/ui/settings/settings-page.tsx')).toContain(
      '<WorkplaceTimeZoneSection />',
    )
  })

  it('is mounted in settings, and a server code is translated only from the closed list', () => {
    expect(code('packages/ui/src/components/ui/settings/settings-page.tsx')).toContain(
      '<WorkplaceTimeZoneSection />',
    )
    expect(section).toContain("return code ? t(code) : t('failed')")
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
      ...[
        'title',
        'description',
        'loading',
        'unreadable',
        'notSet',
        'choose',
        'save',
        'saved',
        'failed',
        'ownerOnly',
        'deviceZone',
        'useDeviceZone',
        'branchesTitle',
        'branchesHelp',
        'branchZone',
        'sameAsBusiness',
        'TIME_ZONE_INVALID',
        'TIME_ZONE_SCHEMA_REQUIRED',
      ].map((key) => `settings.timeZone.${key}`),
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
      ['settings.timeZone.deviceZone', '{zone}'],
      ['settings.timeZone.branchZone', '{name}'],
      ['attendanceSelf.rejectedBecause', '{reason}'],
    ] as const) {
      expect(String(at(all, key)), key).toContain(placeholder)
    }
  })
})

// ─── nights, and the lock of the phone (attendance-02) ──────────────────────

describe('the lock of the phone', () => {
  const page = code(SELF)
  const lib = code('packages/ui/src/lib/phone-unlock.ts')
  const dialog = code(LINK)

  it('⚠️ nothing of a body is read or sent: no camera, no image, no template', () => {
    for (const source of [page, lib]) {
      const lower = source.toLowerCase()
      for (const word of ['getusermedia', 'mediadevices', 'canvas', 'facedetector', 'template']) {
        expect(lower, word).not.toContain(word)
      }
    }
    // What leaves the phone when it registers is this closed list.
    const enrollment = lib.slice(lib.indexOf('export interface PhoneEnrollment {'))
    expect(enrollment.slice(0, enrollment.indexOf('}'))).toBe(
      'export interface PhoneEnrollment { credentialId: string publicKey: string algorithm: number clientDataJSON: string authenticatorData: string clientRequestId: string ',
    )
  })

  it('the phone itself must verify its owner — a tap or another device is not asked for', () => {
    expect(lib).toContain("authenticatorAttachment: 'platform'")
    expect(lib.split("userVerification: 'required'").length - 1).toBe(2)
    expect(lib).toContain("attestation: 'none'")
    // The key belongs to this page's host, which is what the server checks.
    expect(lib).toContain('rp: { id: window.location.hostname, name: input.appName }')
    expect(lib).toContain('rpId: window.location.hostname')
  })

  it('⚠️ the signature covers the very form that is sent', () => {
    // One object: signed, then spread into the body. Not two that could differ.
    expect(page).toContain(
      'proof = await signWithPhone({ token, credentialId: unlock.credentialId, fields })',
    )
    expect(page).toContain(
      'body: JSON.stringify({ ...fields, note: note.trim() || null, unlock: proof })',
    )
    // The text both sides hash is built in one shared place.
    expect(lib).toContain('unlockSubmissionMessage(input.token, input.fields)')
    expect(lib).toContain('unlockEnrollmentMessage(input.token, input.clientRequestId)')
    expect(code('backend/src/services/payroll/attendance-link.service.ts')).toContain(
      'unlockSubmissionMessage(token, {',
    )
  })

  it('reads the device only after mount and in handlers', () => {
    // The page asks «can this phone do it» inside an effect…
    expect(page).toContain('void canUsePhoneUnlock().then((answer) => {')
    // …and never touches the WebAuthn API itself.
    expect(page).not.toContain('navigator.credentials')
    expect(page).not.toContain('PublicKeyCredential')
  })

  it('⚠️ required and not registered: the form cannot be sent, and the page says what to do', () => {
    expect(page).toContain(
      'disabled={sending || !day || (unlock.required && !unlock.credentialId)}',
    )
    expect(page).toContain('data-phone-state="none"')
    expect(page).toContain('data-phone-state="unsupported"')
    expect(page).toContain('data-phone-state="registered"')
    // An older server that says nothing about a lock requires none.
    expect(page).toContain('const unlock = view.unlock ?? { required: false, credentialId: null }')
  })

  it('a closed prompt is not a failed submission: nothing left the phone', () => {
    expect(page).toContain("if (proof === 'unsupported' || proof === 'cancelled') {")
    expect(page).toContain("setOutcome({ kind: 'refused', message: t(`unlock.${proof}`) })")
  })

  it('the manager chooses it per link, sees WHEN a phone was registered, and can forget it', () => {
    expect(dialog).toContain('name="requireUnlock"')
    expect(dialog).toContain('requireUnlock, }')
    expect(dialog).toContain("t('link.phoneRegistered', { date: formatDay(phone.registeredAt) })")
    expect(dialog).toContain('forgetPhone.mutate(employee.id, {')
    // The hook's type has no key to show.
    const hook = code(HOOK)
    expect(hook).toContain('phone: { registeredAt: string; lastUsedAt: string | null } | null')
    expect(hook).not.toContain('publicKey')
    expect(hook).not.toContain('credentialId')
  })
})

describe('a night is said by a person', () => {
  const page = code(SELF)
  const sheet = code(SHEET)

  it('⚠️ the page sends the mark only for an exit that was typed, from a switch that says so', () => {
    expect(page).toContain("const night = present && checkOut !== '' && endsNextDay")
    expect(page).toContain('endsNextDay: night,')
    expect(page).toContain('name="endsNextDay"')
    expect(page).toContain("{checkOut !== '' ? (")
  })

  it('⚠️ the sheet never decides a night from the times: a button named for it does', () => {
    // The default of the function is «not a night»…
    expect(sheet).toContain('endsNextDay = false, ) => {')
    // …and `true` is passed in exactly one place, behind its own label.
    expect(sheet.split(', true)').length - 1).toBe(1)
    expect(sheet).toContain("onClick={() => submit(row, 'present', checkIn, checkOut, true)}")
    expect(sheet).toContain("{t('saveAsNight')}")
    // A shift defined across midnight is the other source — the definition says it.
    expect(sheet).toContain('endsEarlier(shift.startsAt, shift.endsAt),')
    expect(sheet).toContain('data-ends-next-day')
  })

  it('a night shift is labelled where shifts are defined', () => {
    const shifts = code('packages/ui/src/components/ui/team-and-payroll/shift-manager.tsx')
    expect(shifts).toContain('data-night-shift')
    expect(shifts).toContain('startsAt === endsAt')
  })
})

describe.each(['fa', 'af', 'en'])('attendance-02 messages in %s', (lang) => {
  const all = messages(lang)
  it('every new key exists', () => {
    const keys = [
      ...['endsNextDay', 'nextDay', 'nightNote'].map((key) => `attendanceSelf.${key}`),
      ...[
        'title',
        'enrollHelp',
        'enroll',
        'enrolling',
        'enrolled',
        'enrollUnknown',
        'registered',
        'confirmHint',
        'unsupported',
        'cancelled',
        'privacy',
        'mark',
      ].map((key) => `attendanceSelf.unlock.${key}`),
      ...[
        'requireUnlock',
        'requireUnlockHelp',
        'unlockOn',
        'unlockOff',
        'phoneLabel',
        'phoneRegistered',
        'phoneNone',
        'phoneForget',
        'phoneForgetHelp',
        'phoneForgotten',
      ].map((key) => `attendance.link.${key}`),
      'attendance.nightColumn',
      'attendance.endsNextDay',
      'attendance.saveAsNight',
      'attendance.errors.ATTENDANCE_NIGHT_NOT_CONFIGURED',
      'attendance.submissions.unlocked',
      'attendance.submissions.notUnlocked',
      'shifts.endsNextDay',
      'shifts.nightNote',
    ]
    expect(keys.filter((key) => typeof at(all, key) !== 'string')).toEqual([])
    expect(String(at(all, 'attendance.link.phoneRegistered'))).toContain('{date}')
  })

  it('⚠️ says what the lock is, and promises no recognition of a person', () => {
    const text = JSON.stringify([
      at(all, 'attendanceSelf.unlock'),
      at(all, 'attendance.link.requireUnlockHelp'),
    ]).toLowerCase()
    for (const claim of [
      'تشخیص چهره',
      'شناسایی چهره',
      'face recognition',
      'recognis',
      'recogniz',
    ]) {
      expect(text, claim).not.toContain(claim)
    }
  })
})
