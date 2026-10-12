'use client'

// ============================================
// «حضور و غیاب من» — what an employee sees behind the link their manager sent.
// No login, no sidebar. GET / POST /api/public/attendance/:token — the same
// pattern as PublicPortalContainer.
//
// ⚠️ FOUR ANSWERS, FOUR SENTENCES: loading, a link that does not work (404),
// a request that failed, and the page itself.
// ⚠️ «TODAY» AND «NOW» COME FROM THE SERVER, in the zone the link was made in.
// This page never reads the phone's clock to decide a day or a time.
// ⚠️ «NO ANSWER» IS «WE DO NOT KNOW». A send whose response never arrived may
// have been recorded; the page says so and reads the status again. It never
// says «not recorded». The same request id is sent on a retry, so trying
// again cannot record the day twice.
// ⚠️ A SERVER CODE IS NOT A TRANSLATION KEY unless it is in the closed list
// below; an unknown one gets the general sentence.
//
// Reads `attendanceSelf.*`; the shared select it uses reads `select.*`. The
// route's layout ships exactly those (public-page-namespaces.test.ts).
// ============================================

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

import { useDateFormat } from '../../../../hooks/use-date-format'
import { Button } from '../../button'
import { SegmentedControl } from '../../segmented-control'
import { SelectField } from '../../select-field'

const BASE_URL =
  (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_API_URL : undefined) ||
  'https://api.hisabche.com/api'

/** What an employee may say about a day. `holiday` is the business's to declare. */
export const SELF_STATUSES = ['present', 'absent', 'leave'] as const
type SelfStatus = (typeof SELF_STATUSES)[number]

/** Refusals the page can explain. Anything else gets `errors.general`. */
export const SELF_ERROR_CODES = [
  'RATE_LIMITED',
  'ATTENDANCE_DATE_IN_FUTURE',
  'ATTENDANCE_DATE_NOT_ALLOWED',
  'ATTENDANCE_DATE_INVALID',
  'ATTENDANCE_STATUS_NOT_ALLOWED',
  'ATTENDANCE_CHECK_IN_REQUIRED',
  'ATTENDANCE_TIME_INVALID',
  'ATTENDANCE_CHECK_OUT_BEFORE_CHECK_IN',
  'ATTENDANCE_NOTE_TOO_LONG',
] as const

const SENT_STATES = ['pending', 'applied', 'approved', 'rejected'] as const
const RECORD_STATUSES = ['present', 'absent', 'leave', 'holiday', 'open'] as const

interface SelfSubmission {
  id: string
  status: string
  checkIn: string | null
  checkOut: string | null
  note: string | null
  receivedAt: string
  state: string
  decisionNote: string | null
}

interface SelfView {
  businessName: string | null
  employeeName: string
  position: string | null
  timeZone: string
  today: string
  now: string
  allowedFrom: string
  allowedTo: string
  autoApply: boolean
  days: Array<{
    date: string
    record: null | { status: string; checkIn: string | null; checkOut: string | null }
    submissions: SelfSubmission[]
  }>
}

type Load =
  { kind: 'loading' } | { kind: 'gone' } | { kind: 'error' } | { kind: 'ready'; data: SelfView }

type Outcome =
  | null
  | { kind: 'sent'; state: 'applied' | 'pending' }
  | { kind: 'unknown' }
  | { kind: 'refused'; message: string }

/** A request id made on the device, once per form fill. */
function newRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // RFC 4122 version 4 from random bytes, for a WebView without randomUUID.
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

const card =
  'rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4'
const input =
  'h-11 w-full rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-3 text-base tabular-nums'
const labelClass = 'mb-1 block text-sm text-[hsl(var(--fg-secondary))]'
export function AttendanceSelfContainer({ token }: { token: string }) {
  const t = useTranslations('attendanceSelf')
  const { dateLong, dateTime } = useDateFormat()
  const [load, setLoad] = useState<Load>({ kind: 'loading' })

  const [day, setDay] = useState('')
  const [status, setStatus] = useState<SelfStatus>('present')
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [note, setNote] = useState('')
  const [requestId, setRequestId] = useState('')
  const [sending, setSending] = useState(false)
  const [outcome, setOutcome] = useState<Outcome>(null)

  const read = useCallback(
    async (quiet: boolean) => {
      if (!quiet) setLoad({ kind: 'loading' })
      try {
        const res = await fetch(`${BASE_URL}/public/attendance/${token}`, { cache: 'no-store' })
        if (res.status === 404) return setLoad({ kind: 'gone' })
        if (!res.ok) {
          // A quiet re-read that fails leaves what is on screen alone.
          if (!quiet) setLoad({ kind: 'error' })
          return
        }
        const data = (await res.json()) as SelfView
        setLoad({ kind: 'ready', data })
        setDay((current) =>
          data.days.some((item) => item.date === current) ? current : data.today,
        )
      } catch {
        if (!quiet) setLoad({ kind: 'error' })
      }
    },
    [token],
  )

  useEffect(() => {
    void read(false)
    setRequestId(newRequestId())
  }, [read])

  if (load.kind === 'loading') {
    return <p className="p-8 text-center text-[hsl(var(--fg-secondary))]">{t('loading')}</p>
  }
  if (load.kind === 'gone') {
    return (
      <p role="alert" className="p-8 text-center text-[hsl(var(--fg-secondary))]">
        {t('gone')}
      </p>
    )
  }
  if (load.kind === 'error') {
    return (
      <div className="space-y-3 p-8 text-center">
        <p role="alert" className="text-[hsl(var(--color-destructive))]">
          {t('failed')}
        </p>
        <Button variant="outline" onClick={() => void read(false)}>
          {t('retry')}
        </Button>
      </div>
    )
  }

  const view = load.data
  const selected = view.days.find((item) => item.date === day) ?? null
  const present = status === 'present'

  const explain = (code: string | undefined, httpStatus: number): string => {
    const known = SELF_ERROR_CODES.find(
      (candidate) => candidate === (httpStatus === 429 ? 'RATE_LIMITED' : code),
    )
    return known ? t(`errors.${known}`) : t('errors.general')
  }

  const submit = async () => {
    if (sending || !day) return
    setSending(true)
    setOutcome(null)
    try {
      const res = await fetch(`${BASE_URL}/public/attendance/${token}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          date: day,
          status,
          checkIn: present ? checkIn || null : null,
          checkOut: present ? checkOut || null : null,
          note: note.trim() || null,
          clientRequestId: requestId,
        }),
      })
      if (res.status === 404) return setLoad({ kind: 'gone' })
      const body = (await res.json().catch(() => null)) as {
        state?: string
        code?: string
      } | null
      if (!res.ok) {
        setOutcome({ kind: 'refused', message: explain(body?.code, res.status) })
        return
      }
      setOutcome({ kind: 'sent', state: body?.state === 'applied' ? 'applied' : 'pending' })
      // A definite answer: the next fill is a new request.
      setRequestId(newRequestId())
      setCheckIn('')
      setCheckOut('')
      setNote('')
      await read(true)
    } catch {
      // The request left and no answer came back. It may have been recorded.
      // The id is kept, so sending again cannot record it twice.
      setOutcome({ kind: 'unknown' })
      await read(true)
    } finally {
      setSending(false)
    }
  }

  const span = (from: string | null, to: string | null) =>
    from ? `${from} – ${to ?? t('stillIn')}` : null
  const statusWord = (value: string) =>
    (RECORD_STATUSES as readonly string[]).includes(value)
      ? t(`statuses.${value as (typeof RECORD_STATUSES)[number]}`)
      : value
  const stateWord = (value: string) =>
    (SENT_STATES as readonly string[]).includes(value)
      ? t(`states.${value as (typeof SENT_STATES)[number]}`)
      : value

  return (
    <div className="mx-auto max-w-xl space-y-4" data-attendance-self>
      <header className="space-y-1">
        {view.businessName ? (
          <p className="text-sm text-[hsl(var(--fg-secondary))]">{view.businessName}</p>
        ) : null}
        <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))]">{t('title')}</h1>
        <p className="text-base text-[hsl(var(--fg-primary))]">
          {view.employeeName}
          {view.position ? (
            <span className="ms-2 text-sm text-[hsl(var(--fg-tertiary))]">{view.position}</span>
          ) : null}
        </p>
      </header>

      <form
        className={`${card} space-y-4`}
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <div>
          <span className={labelClass}>{t('day')}</span>
          {view.days.length > 1 ? (
            <SelectField
              name="date"
              aria-label={t('day')}
              value={day}
              onChange={(next) => {
                setDay(next)
                setOutcome(null)
              }}
              options={view.days.map((item) => ({
                value: item.date,
                label:
                  item.date === view.today
                    ? `${t('today')} · ${dateLong(item.date)}`
                    : dateLong(item.date),
              }))}
              className={input}
            />
          ) : (
            // Today only: nothing to choose, so it is said, not asked.
            <p className="text-base font-medium text-[hsl(var(--fg-primary))]">
              {t('today')} · {dateLong(view.today)}
            </p>
          )}
        </div>

        <div>
          <span className={labelClass}>{t('status')}</span>
          <SegmentedControl
            label={t('status')}
            options={SELF_STATUSES.map((value) => ({ value, label: t(`statuses.${value}`) }))}
            value={status}
            onChange={setStatus}
          />
        </div>

        {present ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="self-check-in" className={labelClass}>
                {t('checkIn')}
              </label>
              <div className="flex gap-2">
                <input
                  id="self-check-in"
                  type="time"
                  name="checkIn"
                  required
                  value={checkIn}
                  onChange={(event) => setCheckIn(event.target.value)}
                  className={input}
                />
                <Button
                  type="button"
                  variant="outline"
                  // The server's clock in the shop's zone, not the phone's.
                  onClick={() => setCheckIn(view.now)}
                >
                  {t('now')}
                </Button>
              </div>
            </div>
            <div>
              <label htmlFor="self-check-out" className={labelClass}>
                {t('checkOut')}
              </label>
              <div className="flex gap-2">
                <input
                  id="self-check-out"
                  type="time"
                  name="checkOut"
                  value={checkOut}
                  onChange={(event) => setCheckOut(event.target.value)}
                  className={input}
                />
                <Button type="button" variant="outline" onClick={() => setCheckOut(view.now)}>
                  {t('now')}
                </Button>
              </div>
              <p className="mt-1 text-xs text-[hsl(var(--fg-tertiary))]">{t('checkOutHelp')}</p>
            </div>
          </div>
        ) : null}

        <div>
          <label htmlFor="self-note" className={labelClass}>
            {t('note')}
          </label>
          <textarea
            id="self-note"
            name="note"
            rows={2}
            maxLength={500}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="w-full rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-3 py-2 text-sm"
          />
        </div>

        {outcome?.kind === 'sent' ? (
          <p
            role="status"
            data-outcome={outcome.state}
            className="text-sm text-[hsl(var(--color-success))]"
          >
            {t(`result.${outcome.state}`)}
          </p>
        ) : outcome?.kind === 'unknown' ? (
          <p
            role="alert"
            data-outcome="unknown"
            className="text-sm text-[hsl(var(--color-warning))]"
          >
            {t('result.unknown')}
          </p>
        ) : outcome?.kind === 'refused' ? (
          <p
            role="alert"
            data-outcome="refused"
            className="text-sm text-[hsl(var(--color-destructive))]"
          >
            {outcome.message}
          </p>
        ) : null}

        <Button type="submit" disabled={sending || !day} className="w-full">
          {sending ? t('sending') : t('submit')}
        </Button>

        <div className="space-y-1 text-xs text-[hsl(var(--fg-tertiary))]">
          <p>{view.autoApply ? t('autoApplyOn') : t('autoApplyOff')}</p>
          <p>{t('zoneNote', { zone: view.timeZone })}</p>
          <p>{t('nightNote')}</p>
        </div>
      </form>

      {selected ? (
        <section className={`${card} space-y-3`}>
          <div>
            <h2 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">{t('onSheet')}</h2>
            {selected.record ? (
              <p className="mt-1 text-sm">
                <span className="font-medium">{statusWord(selected.record.status)}</span>
                {span(selected.record.checkIn, selected.record.checkOut) ? (
                  <span className="ms-2 tabular-nums" dir="ltr">
                    {span(selected.record.checkIn, selected.record.checkOut)}
                  </span>
                ) : null}
              </p>
            ) : (
              <p className="mt-1 text-sm text-[hsl(var(--fg-secondary))]">{t('nothingRecorded')}</p>
            )}
          </div>

          {selected.submissions.length > 0 ? (
            <div>
              <h2 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">{t('sent')}</h2>
              <ul className="mt-1 space-y-2">
                {selected.submissions.map((submission) => (
                  <li
                    key={submission.id}
                    data-sent-state={submission.state}
                    className="rounded-xl border border-[hsl(var(--border-default))] p-3 text-sm"
                  >
                    <p>
                      <span className="font-medium">{statusWord(submission.status)}</span>
                      {span(submission.checkIn, submission.checkOut) ? (
                        <span className="ms-2 tabular-nums" dir="ltr">
                          {span(submission.checkIn, submission.checkOut)}
                        </span>
                      ) : null}
                      <span className="ms-2 text-xs text-[hsl(var(--fg-secondary))]">
                        {stateWord(submission.state)}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-[hsl(var(--fg-tertiary))]">
                      {dateTime(submission.receivedAt)}
                    </p>
                    {submission.state === 'rejected' && submission.decisionNote ? (
                      <p className="mt-1 text-xs text-[hsl(var(--color-destructive))]">
                        {t('rejectedBecause', { reason: submission.decisionNote })}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
