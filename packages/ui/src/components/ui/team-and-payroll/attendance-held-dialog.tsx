'use client'

// ============================================
// Readings a terminal sent for a day a person had already recorded.
//
// They were kept back, not applied: a device does not overwrite what a
// manager or the employee wrote. This dialog puts the two side by side — what
// the terminal saw, what the sheet says — and lets a manager choose the
// terminal's version for that one day.
//
// ⚠️ ACCEPTING REPLACES A PERSON'S RECORD. It is one day at a time, behind a
// button that says what it does, and the server refuses it when somebody else
// already decided.
// ⚠️ NOTHING IS WORKED OUT HERE. Which day a reading counts toward (a night
// shift's exit is on the next calendar day) is the server's answer.
// ⚠️ Open = fetched; closed = not. The list is never read from a cache.
// ============================================

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  apiErrorMessage,
  useAcceptHeldDeviceDay,
  useHeldDeviceDays,
  type HeldDeviceDay,
} from '@hisabche/api'

import { useDateFormat } from '../../../hooks/use-date-format'
import { Button } from '../button'
import { DataTable, type TableColumn } from '../data-table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../dialog'
import { useToast } from '../toast-provider'

/** Server refusals this dialog can explain. Anything else gets the general sentence. */
export const ATTENDANCE_HELD_ERROR_CODES = [
  'ATTENDANCE_DEVICES_NOT_CONFIGURED',
  'ATTENDANCE_DEVICE_NOTHING_HELD',
] as const

const RECORD_STATUSES = ['present', 'absent', 'leave', 'holiday', 'open'] as const

export function AttendanceHeldDialog({
  open,
  employees,
  deviceNames,
  onClose,
}: {
  open: boolean
  /** The people on the sheet, to put a name to an id. */
  employees: ReadonlyArray<{ id: string; name: string }>
  deviceNames: ReadonlyMap<string, string>
  onClose: () => void
}) {
  const t = useTranslations('attendance.devices')
  const tSheet = useTranslations('attendance')
  const tCommon = useTranslations('common')
  const translate = useTranslations()
  const tableT = (key: string, fallback?: string): string => {
    const value = translate(key as never)
    return value && value !== key ? value : (fallback ?? key)
  }
  const toast = useToast()
  const { dateLong } = useDateFormat()

  const held = useHeldDeviceDays(open)
  const accept = useAcceptHeldDeviceDay()
  const [failure, setFailure] = useState<string | null>(null)

  const explain = (error: unknown): string => {
    const raw = apiErrorMessage(error, '')
    const code = ATTENDANCE_HELD_ERROR_CODES.find((known) => raw.includes(known))
    return code ? t(`errors.${code}`) : t('errors.general')
  }

  const nameOf = (id: string) => employees.find((person) => person.id === id)?.name
  const keyOf = (row: HeldDeviceDay) => `${row.employeeId}|${row.day}`
  const busyFor = (row: HeldDeviceDay) =>
    accept.isPending &&
    accept.variables?.employeeId === row.employeeId &&
    accept.variables?.day === row.day

  const columns: TableColumn<HeldDeviceDay>[] = [
    {
      id: 'employee',
      labelKey: 'attendance.devices.heldColEmployee',
      labelFallback: t('heldColEmployee'),
      locked: true,
      sortValue: (row) => nameOf(row.employeeId) ?? '',
      render: (row) => (
        <div>
          <p className="font-medium text-[hsl(var(--fg-primary))]">
            {nameOf(row.employeeId) ?? t('employeeNotListed')}
          </p>
          <p className="text-xs text-[hsl(var(--fg-tertiary))]">{dateLong(row.day)}</p>
        </div>
      ),
    },
    {
      id: 'device',
      labelKey: 'attendance.devices.heldColDevice',
      labelFallback: t('heldColDevice'),
      render: (row) => (
        <ul className="space-y-0.5" data-held-readings>
          {row.readings.map((reading, index) => (
            <li key={`${reading.at}-${index}`} className="text-sm">
              <span className="tabular-nums" dir="ltr">
                {reading.at}
              </span>
              {reading.nextDay ? (
                <span className="ms-1 text-xs text-[hsl(var(--fg-secondary))]">
                  {t('heldNextDay')}
                </span>
              ) : null}
              {reading.direction !== 'unknown' ? (
                <span className="ms-1 text-xs text-[hsl(var(--fg-secondary))]">
                  {t(`heldDirection.${reading.direction}`)}
                </span>
              ) : null}
              <span className="ms-1 text-xs text-[hsl(var(--fg-tertiary))]">
                {deviceNames.get(reading.deviceId) ?? t('heldDeviceGone')}
              </span>
            </li>
          ))}
        </ul>
      ),
    },
    {
      id: 'record',
      labelKey: 'attendance.devices.heldColRecord',
      labelFallback: t('heldColRecord'),
      render: (row) =>
        row.record ? (
          <div className="text-sm" data-held-record>
            <span className="font-medium">
              {(RECORD_STATUSES as readonly string[]).includes(row.record.status)
                ? tSheet(`statuses.${row.record.status as (typeof RECORD_STATUSES)[number]}`)
                : row.record.status}
            </span>
            {row.record.checkIn ? (
              <span className="ms-2 tabular-nums" dir="ltr">
                {row.record.checkIn} – {row.record.checkOut ?? '…'}
              </span>
            ) : null}
            {row.record.endsNextDay ? (
              <span className="ms-1 text-xs text-[hsl(var(--fg-secondary))]">
                {t('heldNextDay')}
              </span>
            ) : null}
          </div>
        ) : (
          <span className="text-sm text-[hsl(var(--fg-secondary))]">{t('heldRecordGone')}</span>
        ),
    },
    {
      id: 'actions',
      labelKey: 'attendance.devices.colActions',
      labelFallback: t('colActions'),
      locked: true,
      render: (row) => (
        <Button
          size="sm"
          variant="outline"
          disabled={busyFor(row)}
          data-held-accept
          onClick={() => {
            setFailure(null)
            accept.mutate(
              { employeeId: row.employeeId, day: row.day },
              {
                onSuccess: () => toast.success(t('heldAccepted')),
                onError: (error) => setFailure(explain(error)),
              },
            )
          }}
        >
          {t('heldAccept')}
        </Button>
      ),
    },
  ]

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent data-attendance-held className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('heldTitle')}</DialogTitle>
          <DialogDescription>{t('heldHelp')}</DialogDescription>
        </DialogHeader>

        {held.isLoading ? (
          <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('loading')}</p>
        ) : held.error || !held.data ? (
          // A failed read is not «nothing was kept back».
          <div className="space-y-2">
            <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
              {t('heldLoadFailed')}
            </p>
            <Button size="sm" variant="outline" onClick={() => void held.refetch()}>
              {tCommon('retry')}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {failure ? (
              <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
                {failure}
              </p>
            ) : null}
            <DataTable
              tableId="attendance-held"
              t={tableT}
              rows={held.data}
              columns={columns}
              rowKey={keyOf}
              minWidthClass="min-w-[560px]"
              emptyState={
                <p className="p-6 text-center text-sm text-[hsl(var(--fg-secondary))]">
                  {t('heldEmpty')}
                </p>
              }
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
