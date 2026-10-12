'use client'

// ============================================
// «دستگاه‌های حضور و غیاب» — fingerprint, face and card terminals.
//
// Register a terminal, give its key to whatever sends its events, say which
// number on it is which employee, and see whether it is alive.
//
// ⚠️ NO BRAND IS «SUPPORTED» HERE. A brand and a model are labels a person
// types. What the server accepts is one documented format; a terminal reaches
// it through the small program beside it. The panel says so in words, instead
// of a list of logos that would be a promise.
// ⚠️ THE KEY IS SHOWN ONCE, in a dialog, and copied through `copyText`. It is
// not in any list afterwards — a lost key is replaced, never read back.
// ⚠️ ALIVE, SILENT, NEVER HEARD FROM — and the zone a terminal's clock is read
// in — are the server's words (`health`, `effectiveTimeZone`). Nothing here
// compares a timestamp or reads a clock.
// ⚠️ A NUMBER NOBODY HAS MAPPED IS NOT A PERSON. Its readings wait; mapping it
// settles them. Nothing is guessed from a name.
// ⚠️ Closed = not fetched: the registry is read only while the panel is open.
// ============================================

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Copy } from 'lucide-react'
import {
  apiErrorMessage,
  useAttendanceDevices,
  useDeviceIdentities,
  useMapDeviceIdentity,
  useRegisterAttendanceDevice,
  useRevokeAttendanceDevice,
  useRotateAttendanceDeviceKey,
  useUnmatchedDeviceUsers,
  useWorkplaceTimeZones,
  type AttendanceDevice,
  type AttendanceDeviceMethod,
} from '@hisabche/api'
import { formatNumber } from '@hisabche/formatting'

import { copyText } from '../../../lib/copy-text'
import { useDateFormat } from '../../../hooks/use-date-format'
import { useIntlLocale } from '../../../hooks/use-intl-locale'
import { Button } from '../button'
import { DataTable, type TableColumn } from '../data-table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../dialog'
import { SelectField } from '../select-field'
import { useToast } from '../toast-provider'

/** Server refusals this panel can explain. Anything else gets the general sentence. */
export const ATTENDANCE_DEVICE_ERROR_CODES = [
  'ATTENDANCE_DEVICES_NOT_CONFIGURED',
  'ATTENDANCE_DEVICE_NAME_INVALID',
  'ATTENDANCE_DEVICE_CAPABILITY_INVALID',
  'ATTENDANCE_DEVICE_NOT_FOUND',
  'ATTENDANCE_DEVICE_USER_INVALID',
  'ATTENDANCE_DEVICE_USER_TAKEN',
  'TIME_ZONE_INVALID',
] as const

/** What a terminal can read. Offered as toggles; none is assumed. */
export const DEVICE_CAPABILITY_CHOICES: readonly AttendanceDeviceMethod[] = [
  'FINGERPRINT',
  'FACE',
  'CARD',
  'PIN',
  'QR',
  'PALM',
]

const API_BASE =
  (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_API_URL : undefined) ||
  'https://api.hisabche.com/api'
const EVENTS_PATH = '/public/attendance-devices/events'

/** No branch chosen. Never sent as an id. */
const NO_BRANCH = 'none'

const field =
  'h-10 w-full rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-3 text-sm text-[hsl(var(--fg-primary))] outline-none focus:border-[hsl(var(--color-primary))]'
const label = 'mb-1 block text-xs text-[hsl(var(--fg-secondary))]'
const hint = 'text-xs text-[hsl(var(--fg-tertiary))]'

export function AttendanceDevices({
  employees,
}: {
  /** The people on the sheet — who a number on a device can be. */
  employees: ReadonlyArray<{ id: string; name: string }>
}) {
  const t = useTranslations('attendance.devices')
  const locale = useIntlLocale()
  const toast = useToast()
  const { dateTime } = useDateFormat()
  const translate = useTranslations()
  const tableT = (key: string, fallback?: string): string => {
    const value = translate(key as never)
    return value && value !== key ? value : (fallback ?? key)
  }

  const [open, setOpen] = useState(false)
  const devices = useAttendanceDevices(open)
  // The branches a terminal can be put in; read only while the panel is open.
  const places = useWorkplaceTimeZones(open)
  const register = useRegisterAttendanceDevice()
  const rotate = useRotateAttendanceDeviceKey()
  const revoke = useRevokeAttendanceDevice()

  const [name, setName] = useState('')
  const [vendor, setVendor] = useState('')
  const [model, setModel] = useState('')
  const [branchId, setBranchId] = useState(NO_BRANCH)
  const [capabilities, setCapabilities] = useState<AttendanceDeviceMethod[]>([])
  const [failure, setFailure] = useState<string | null>(null)
  // The key of the device just registered or re-keyed. Held only while its
  // dialog is open; closing the dialog is the last time it exists here.
  const [fresh, setFresh] = useState<{ device: string; key: string } | null>(null)
  const [mapping, setMapping] = useState<AttendanceDevice | null>(null)
  const [revoking, setRevoking] = useState<AttendanceDevice | null>(null)

  const explain = (error: unknown): string => {
    const raw = apiErrorMessage(error, '')
    const code = ATTENDANCE_DEVICE_ERROR_CODES.find((known) => raw.includes(known))
    return code ? t(`errors.${code}`) : t('errors.general')
  }

  const toggle = (method: AttendanceDeviceMethod) =>
    setCapabilities((current) =>
      current.includes(method) ? current.filter((item) => item !== method) : [...current, method],
    )

  const add = () => {
    setFailure(null)
    register.mutate(
      {
        name: name.trim(),
        vendor: vendor.trim() || null,
        model: model.trim() || null,
        branchId: branchId === NO_BRANCH ? null : branchId,
        // The terminal's clock is read where it stands: its branch, else the
        // business. A zone of its own is not asked for here.
        timeZone: null,
        capabilities,
      },
      {
        onSuccess: (created) => {
          setFresh({ device: created.device.name, key: created.key })
          setName('')
          setVendor('')
          setModel('')
          setBranchId(NO_BRANCH)
          setCapabilities([])
        },
        onError: (error) => setFailure(explain(error)),
      },
    )
  }

  const copy = async (value: string) => {
    if (await copyText(value)) toast.success(t('copied'))
    else toast.error(t('copyFailed'))
  }

  const status = (devices.error as { response?: { status?: number } } | null)?.response?.status

  const columns: TableColumn<AttendanceDevice>[] = [
    {
      id: 'name',
      labelKey: 'attendance.devices.colName',
      labelFallback: t('colName'),
      locked: true,
      sortValue: (row) => row.name,
      render: (row) => (
        <>
          <span className="font-medium">{row.name}</span>
          {row.vendor || row.model ? (
            <span className="block text-xs text-[hsl(var(--fg-tertiary))]" dir="auto">
              {[row.vendor, row.model].filter(Boolean).join(' · ')}
            </span>
          ) : null}
          <span className="block text-xs text-[hsl(var(--fg-tertiary))]" dir="ltr">
            {row.keyPrefix}…
          </span>
        </>
      ),
    },
    {
      id: 'health',
      labelKey: 'attendance.devices.colHealth',
      labelFallback: t('colHealth'),
      sortValue: (row) => row.health,
      render: (row) => (
        <span
          data-device-health={row.health}
          className={
            row.health === 'online'
              ? 'text-xs font-medium text-[hsl(var(--color-success))]'
              : row.health === 'silent'
                ? 'text-xs font-medium text-[hsl(var(--color-warning))]'
                : 'text-xs text-[hsl(var(--fg-tertiary))]'
          }
        >
          {t(`health.${row.health}`)}
          {row.lastSeenAt ? (
            <span className="block font-normal text-[hsl(var(--fg-tertiary))]">
              {dateTime(row.lastSeenAt)}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      id: 'zone',
      labelKey: 'attendance.devices.colZone',
      labelFallback: t('colZone'),
      showFrom: 'md',
      sortValue: (row) => row.effectiveTimeZone ?? '',
      render: (row) =>
        row.effectiveTimeZone ? (
          <span className="text-xs" dir="ltr">
            {row.effectiveTimeZone}
          </span>
        ) : (
          // No zone anywhere: the server refuses this device's events.
          <span
            data-device-zone-missing
            className="text-xs font-medium text-[hsl(var(--color-warning))]"
          >
            {t('zoneMissing')}
          </span>
        ),
    },
    {
      id: 'waiting',
      labelKey: 'attendance.devices.colWaiting',
      labelFallback: t('colWaiting'),
      sortValue: (row) => row.unmatched,
      render: (row) => (
        <div className="space-y-1">
          <Button size="sm" variant="outline" onClick={() => setMapping(row)}>
            {row.unmatched > 0
              ? t('unmatchedCount', { count: formatNumber(row.unmatched, locale, 0) })
              : t('people')}
          </Button>
          {row.held > 0 ? (
            <span className="block text-xs text-[hsl(var(--fg-tertiary))]" data-device-held>
              {t('heldCount', { count: formatNumber(row.held, locale, 0) })}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: 'actions',
      labelKey: 'attendance.devices.colActions',
      labelFallback: t('colActions'),
      locked: true,
      render: (row) => (
        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            disabled={rotate.isPending}
            onClick={() =>
              rotate.mutate(row.id, {
                onSuccess: (next) => setFresh({ device: row.name, key: next.key }),
                onError: (error) => toast.error(explain(error)),
              })
            }
          >
            {t('newKey')}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setRevoking(row)}>
            {t('revoke')}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <section
      className="space-y-3 rounded-2xl border border-[hsl(var(--border-default))] p-4"
      data-attendance-devices
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-[hsl(var(--fg-primary))]">{t('title')}</h3>
          <p className="mt-0.5 text-xs text-[hsl(var(--fg-tertiary))]">{t('hint')}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setOpen((value) => !value)}>
          {open ? t('hide') : t('show')}
        </Button>
      </div>

      {!open ? null : devices.isLoading ? (
        <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('loading')}</p>
      ) : devices.error || !devices.data ? (
        // A failed read is not «no devices».
        <div className="space-y-2">
          <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
            {status === 403 ? t('forbidden') : t('loadFailed')}
          </p>
          <Button size="sm" variant="outline" onClick={() => void devices.refetch()}>
            {translate('common.retry')}
          </Button>
        </div>
      ) : !devices.data.configured ? (
        <p className="text-sm text-[hsl(var(--fg-secondary))]">
          {t('errors.ATTENDANCE_DEVICES_NOT_CONFIGURED')}
        </p>
      ) : (
        <>
          <p className={hint} data-device-formats>
            {t('formats', { formats: devices.data.formats.join(', ') })}
          </p>

          <DataTable
            tableId="attendance-devices"
            t={tableT}
            rows={devices.data.devices}
            columns={columns}
            rowKey={(row) => row.id}
            minWidthClass="min-w-[560px]"
            emptyState={
              <p className="p-6 text-center text-sm text-[hsl(var(--fg-secondary))]">
                {t('empty')}
              </p>
            }
          />

          <form
            className="space-y-3 rounded-xl border border-[hsl(var(--border-default))] p-3"
            onSubmit={(event) => {
              event.preventDefault()
              add()
            }}
          >
            <p className="text-sm font-medium text-[hsl(var(--fg-primary))]">{t('addTitle')}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="device-name" className={label}>
                  {t('name')}
                </label>
                <input
                  id="device-name"
                  name="name"
                  required
                  maxLength={80}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className={field}
                />
              </div>
              <div>
                <label htmlFor="device-vendor" className={label}>
                  {t('vendor')}
                </label>
                <input
                  id="device-vendor"
                  name="vendor"
                  maxLength={60}
                  value={vendor}
                  onChange={(event) => setVendor(event.target.value)}
                  className={field}
                />
              </div>
              <div>
                <label htmlFor="device-model" className={label}>
                  {t('model')}
                </label>
                <input
                  id="device-model"
                  name="model"
                  maxLength={60}
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  className={field}
                />
              </div>
            </div>
            <p className={hint}>{t('vendorHelp')}</p>

            {(places.data?.branches.length ?? 0) > 0 ? (
              <div className="sm:max-w-xs">
                <span className={label}>{t('branch')}</span>
                <SelectField
                  name="branchId"
                  aria-label={t('branch')}
                  value={branchId}
                  onChange={setBranchId}
                  options={[
                    { value: NO_BRANCH, label: t('noBranch') },
                    ...(places.data?.branches ?? []).map((branch) => ({
                      value: branch.id,
                      label: branch.name,
                    })),
                  ]}
                  className={field}
                />
                <p className={`mt-1 ${hint}`}>{t('branchHelp')}</p>
              </div>
            ) : null}

            <div>
              <span className={label}>{t('capabilities')}</span>
              <div className="flex flex-wrap gap-1.5">
                {DEVICE_CAPABILITY_CHOICES.map((method) => (
                  <Button
                    key={method}
                    type="button"
                    size="sm"
                    variant={capabilities.includes(method) ? 'default' : 'outline'}
                    aria-pressed={capabilities.includes(method)}
                    onClick={() => toggle(method)}
                  >
                    {t(`methods.${method}`)}
                  </Button>
                ))}
              </div>
            </div>

            {failure ? (
              <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
                {failure}
              </p>
            ) : null}
            <Button type="submit" disabled={register.isPending || name.trim() === ''}>
              {t('add')}
            </Button>
          </form>
        </>
      )}

      {/* The key, once. */}
      <Dialog open={fresh !== null} onOpenChange={(next) => (next ? undefined : setFresh(null))}>
        <DialogContent data-device-key>
          <DialogHeader>
            <DialogTitle>{t('keyTitle', { name: fresh?.device ?? '' })}</DialogTitle>
            <DialogDescription>{t('keyOnce')}</DialogDescription>
          </DialogHeader>
          {fresh ? (
            <div className="space-y-3">
              {(
                [
                  ['keyLabel', fresh.key],
                  ['endpointLabel', `${API_BASE}${EVENTS_PATH}`],
                ] as const
              ).map(([caption, value]) => (
                <div key={caption}>
                  <span className={label}>{t(caption)}</span>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      dir="ltr"
                      aria-label={t(caption)}
                      value={value}
                      onFocus={(event) => event.currentTarget.select()}
                      className={`${field} bg-[hsl(var(--surface-muted))] text-xs`}
                    />
                    <Button size="sm" variant="outline" onClick={() => void copy(value)}>
                      <Copy className="size-4" aria-hidden="true" />
                      {t('copy')}
                    </Button>
                  </div>
                </div>
              ))}
              <p className={hint}>{t('keyHowTo')}</p>
              <pre
                dir="ltr"
                className="overflow-x-auto rounded-xl bg-[hsl(var(--surface-muted))] p-3 text-xs text-[hsl(var(--fg-secondary))]"
              >
                {SAMPLE_REQUEST}
              </pre>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Stop listening to a device. */}
      <Dialog
        open={revoking !== null}
        onOpenChange={(next) => (next ? undefined : setRevoking(null))}
      >
        <DialogContent data-device-revoke>
          <DialogHeader>
            <DialogTitle>{t('revokeTitle', { name: revoking?.name ?? '' })}</DialogTitle>
            <DialogDescription>{t('revokeHelp')}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="destructive"
              disabled={revoke.isPending}
              onClick={() => {
                if (!revoking) return
                revoke.mutate(revoking.id, {
                  // Closed once it is done; a refusal keeps the question open.
                  onSuccess: () => setRevoking(null),
                  onError: (error) => toast.error(explain(error)),
                })
              }}
            >
              {t('revoke')}
            </Button>
            <Button variant="outline" onClick={() => setRevoking(null)}>
              {translate('common.cancel')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <DeviceIdentityDialog
        device={mapping}
        employees={employees}
        explain={explain}
        onClose={() => setMapping(null)}
      />
    </section>
  )
}

/** What a sender posts. The same shape the server documents and tests. */
const SAMPLE_REQUEST = `POST ${EVENTS_PATH}
X-Device-Key: hsd_…
Content-Type: application/json

{ "events": [
    { "id": "184467", "userId": "182",
      "at": "2026-10-12T08:03:10",
      "direction": "in", "method": "FINGERPRINT" } ] }`

function DeviceIdentityDialog({
  device,
  employees,
  explain,
  onClose,
}: {
  device: AttendanceDevice | null
  employees: ReadonlyArray<{ id: string; name: string }>
  explain: (error: unknown) => string
  onClose: () => void
}) {
  const t = useTranslations('attendance.devices')
  const locale = useIntlLocale()
  const toast = useToast()
  const { date } = useDateFormat()
  const unmatched = useUnmatchedDeviceUsers(device?.id ?? null)
  const identities = useDeviceIdentities(device?.id ?? null)
  const map = useMapDeviceIdentity()
  const [number, setNumber] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [failure, setFailure] = useState<string | null>(null)

  const deviceId = device?.id ?? null
  useEffect(() => {
    setNumber('')
    setEmployeeId('')
    setFailure(null)
  }, [deviceId])

  const nameOf = (id: string) => employees.find((person) => person.id === id)?.name ?? null
  const options = employees.map((person) => ({ value: person.id, label: person.name || '—' }))

  const save = (externalUserId: string, employee: string | null) => {
    if (!device) return
    setFailure(null)
    map.mutate(
      { deviceId: device.id, externalUserId, employeeId: employee, everyDevice: false },
      {
        onSuccess: (settled) => {
          if (employee === null) toast.success(t('unmapped'))
          else {
            toast.success(
              t('mapped', {
                applied: formatNumber(settled.applied, locale, 0),
                held: formatNumber(settled.held, locale, 0),
              }),
            )
            setNumber('')
            setEmployeeId('')
          }
        },
        onError: (error) => setFailure(explain(error)),
      },
    )
  }

  return (
    <Dialog open={device !== null} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent data-device-identities>
        <DialogHeader>
          <DialogTitle>{t('peopleTitle', { name: device?.name ?? '' })}</DialogTitle>
          <DialogDescription>{t('peopleHelp')}</DialogDescription>
        </DialogHeader>

        <section className="space-y-2">
          <h4 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
            {t('unmatchedTitle')}
          </h4>
          {unmatched.isLoading ? (
            <p className={hint}>{t('loading')}</p>
          ) : unmatched.error ? (
            <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
              {t('loadFailed')}
            </p>
          ) : (unmatched.data ?? []).length === 0 ? (
            <p className={hint}>{t('unmatchedNone')}</p>
          ) : (
            <ul className="space-y-1">
              {(unmatched.data ?? []).map((user) => (
                <li
                  key={user.externalUserId}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm"
                >
                  <span>
                    <span className="font-medium tabular-nums" dir="ltr">
                      {user.externalUserId}
                    </span>
                    <span className="ms-2 text-xs text-[hsl(var(--fg-tertiary))]">
                      {t('unmatchedSeen', {
                        count: formatNumber(user.events, locale, 0),
                        from: date(user.firstDay),
                        to: date(user.lastDay),
                      })}
                    </span>
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setNumber(user.externalUserId)}
                  >
                    {t('choosePerson')}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <form
          className="space-y-2 rounded-xl border border-[hsl(var(--border-default))] p-3"
          onSubmit={(event) => {
            event.preventDefault()
            if (number.trim() && employeeId) save(number.trim(), employeeId)
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="device-user-number" className={label}>
                {t('number')}
              </label>
              <input
                id="device-user-number"
                name="externalUserId"
                dir="ltr"
                maxLength={64}
                value={number}
                onChange={(event) => setNumber(event.target.value)}
                className={field}
              />
            </div>
            <div>
              <span className={label}>{t('employee')}</span>
              <SelectField
                name="employeeId"
                aria-label={t('employee')}
                value={employeeId}
                onChange={setEmployeeId}
                placeholder={t('choosePerson')}
                options={options}
                className={field}
              />
            </div>
          </div>
          {failure ? (
            <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
              {failure}
            </p>
          ) : null}
          <Button type="submit" disabled={map.isPending || !number.trim() || !employeeId}>
            {t('map')}
          </Button>
        </form>

        <section className="space-y-2">
          <h4 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
            {t('mappedTitle')}
          </h4>
          {identities.isLoading ? (
            <p className={hint}>{t('loading')}</p>
          ) : identities.error ? (
            <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
              {t('loadFailed')}
            </p>
          ) : (identities.data ?? []).length === 0 ? (
            <p className={hint}>{t('mappedNone')}</p>
          ) : (
            <ul className="space-y-1">
              {(identities.data ?? []).map((identity) => (
                <li
                  key={identity.externalUserId}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm"
                >
                  <span>
                    <span className="font-medium tabular-nums" dir="ltr">
                      {identity.externalUserId}
                    </span>
                    <span className="ms-2">
                      {/* An employee who is not on today's sheet is still mapped;
                          say that the name is not known here rather than a blank. */}
                      {nameOf(identity.employeeId) ?? t('employeeNotListed')}
                    </span>
                  </span>
                  {identity.everyDevice ? (
                    <span className={hint}>{t('everyDevice')}</span>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={map.isPending}
                      onClick={() => save(identity.externalUserId, null)}
                    >
                      {t('unmap')}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </DialogContent>
    </Dialog>
  )
}
