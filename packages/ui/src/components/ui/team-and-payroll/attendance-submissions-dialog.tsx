'use client'

// ============================================
// What one employee sent through their link for this day, beside what is on
// the sheet now — and the two things a manager can do about it.
//
// ⚠️ BOTH ARE SHOWN, SIDE BY SIDE. Not a computed «difference»: the manager
// reads what the person claims and what is recorded, and decides.
// ⚠️ APPROVE REPLACES THE DAY'S RECORD with what was sent; reject leaves the
// sheet alone and needs a reason, which the employee is shown.
// ⚠️ TWO MANAGERS, ONE DECISION. The loser gets ATTENDANCE_SUBMISSION_DECIDED
// and the list is read again either way.
// ============================================

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  apiErrorMessage,
  useDecideAttendanceSubmission,
  type AttendanceRecord,
  type AttendanceSubmission,
} from '@hisabche/api'

import { useDateFormat } from '../../../hooks/use-date-format'
import { Button } from '../button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../dialog'

/** Server refusals this dialog can explain. Anything else gets the general sentence. */
export const ATTENDANCE_DECISION_ERROR_CODES = [
  'ATTENDANCE_SUBMISSION_DECIDED',
  'ATTENDANCE_REJECTION_REASON_REQUIRED',
  'ATTENDANCE_NOT_FOUND',
] as const

const cell = 'rounded-xl border border-[hsl(var(--border-default))] p-3 text-sm'
const caption = 'mb-1 block text-xs text-[hsl(var(--fg-tertiary))]'

export function AttendanceSubmissionsDialog({
  employee,
  date,
  record,
  submissions,
  onClose,
}: {
  /** Null = closed. */
  employee: { id: string; name: string } | null
  date: string
  record: AttendanceRecord | null
  submissions: AttendanceSubmission[]
  onClose: () => void
}) {
  const t = useTranslations('attendance')
  const { dateTime } = useDateFormat()
  const decide = useDecideAttendanceSubmission()
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [failure, setFailure] = useState<{ id: string; message: string } | null>(null)

  const explain = (error: unknown): string => {
    const raw = apiErrorMessage(error, '')
    const code = ATTENDANCE_DECISION_ERROR_CODES.find((known) => raw.includes(known))
    return code ? t(`errors.${code}`) : t('errors.general')
  }

  const send = (submission: AttendanceSubmission, decision: 'approve' | 'reject') => {
    const note = (reasons[submission.id] ?? '').trim()
    if (decision === 'reject' && !note) {
      setFailure({
        id: submission.id,
        message: t('errors.ATTENDANCE_REJECTION_REASON_REQUIRED'),
      })
      return
    }
    setFailure(null)
    decide.mutate(
      { id: submission.id, date, decision, note: decision === 'reject' ? note : null },
      { onError: (error) => setFailure({ id: submission.id, message: explain(error) }) },
    )
  }

  const times = (checkIn: string | null, checkOut: string | null, nextDay = false) =>
    checkIn
      ? `${checkIn} – ${checkOut ?? t('stillIn')}${checkOut && nextDay ? ` (${t('endsNextDay')})` : ''}`
      : null

  return (
    <Dialog open={employee !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent data-attendance-submissions>
        <DialogHeader>
          <DialogTitle>{t('submissions.title', { name: employee?.name ?? '' })}</DialogTitle>
          <DialogDescription>{t('submissions.help')}</DialogDescription>
        </DialogHeader>

        <div className={cell}>
          <span className={caption}>{t('submissions.onSheet')}</span>
          {record ? (
            <p>
              <span className="font-medium">{t(`statuses.${record.status}`)}</span>
              {times(record.checkIn, record.checkOut) ? (
                <span className="ms-2 tabular-nums">
                  {times(record.checkIn, record.checkOut, record.endsNextDay)}
                </span>
              ) : null}
            </p>
          ) : (
            <p className="text-[hsl(var(--fg-secondary))]">{t('submissions.nothingOnSheet')}</p>
          )}
        </div>

        {submissions.length === 0 ? (
          <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('submissions.empty')}</p>
        ) : (
          <ul className="space-y-3">
            {submissions.map((submission) => {
              const busy = decide.isPending && decide.variables?.id === submission.id
              return (
                <li key={submission.id} className={`${cell} space-y-3`} data-submission>
                  <div>
                    <span className={caption}>{t('submissions.sent')}</span>
                    <p>
                      <span className="font-medium">{t(`statuses.${submission.status}`)}</span>
                      {times(submission.checkIn, submission.checkOut) ? (
                        <span className="ms-2 tabular-nums">
                          {times(submission.checkIn, submission.checkOut, submission.endsNextDay)}
                        </span>
                      ) : null}
                    </p>
                    <p
                      data-submission-proof={submission.unlocked ? 'unlocked' : 'none'}
                      className="mt-1 text-xs text-[hsl(var(--fg-secondary))]"
                    >
                      {submission.unlocked
                        ? t('submissions.unlocked')
                        : t('submissions.notUnlocked')}
                    </p>
                    <p className="mt-1 text-xs text-[hsl(var(--fg-tertiary))]">
                      {t('submissions.receivedAt')} {dateTime(submission.receivedAt)}
                    </p>
                    {submission.note ? (
                      <p className="mt-1 text-xs text-[hsl(var(--fg-secondary))]">
                        {t('submissions.employeeNote')}: {submission.note}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor={`reason-${submission.id}`}
                      className="block text-xs text-[hsl(var(--fg-secondary))]"
                    >
                      {t('submissions.reason')}
                    </label>
                    <input
                      id={`reason-${submission.id}`}
                      name="note"
                      maxLength={500}
                      value={reasons[submission.id] ?? ''}
                      placeholder={t('submissions.reasonPlaceholder')}
                      onChange={(event) =>
                        setReasons((current) => ({
                          ...current,
                          [submission.id]: event.target.value,
                        }))
                      }
                      className="h-9 w-full rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-2 text-sm"
                    />
                  </div>

                  {failure?.id === submission.id ? (
                    <p role="alert" className="text-xs text-[hsl(var(--color-destructive))]">
                      {failure.message}
                    </p>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" disabled={busy} onClick={() => send(submission, 'approve')}>
                      {t('submissions.approve')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => send(submission, 'reject')}
                    >
                      {t('submissions.reject')}
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
