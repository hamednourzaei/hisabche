'use client'

// ============================================
// «سیاست مرخصی» — what each leave type grants and how it accrues (V58,
// leave-policy-01), and the button that runs the accrual for one month.
//
// The entitlement is policy; the consumption is the approved leave; the
// accrual rows are the engine's. One policy per workspace + leave type — the
// unique index refuses the second, and the screen reads that refusal as
// «این نوع سیاست دارد».
//
// The engine not being switched on yet (the migration absent) is a named
// state the card says out loud, never an empty table (§۷٫۳).
// ============================================

import { useState } from 'react'
import { CalendarClock, Plus, X } from 'lucide-react'
import {
  apiErrorMessage,
  useCreateLeavePolicy,
  useLeavePolicies,
  useRunLeaveAccrual,
  useUpdateLeavePolicy,
  type LeavePolicy,
} from '@hisabche/api'

import { SelectField } from '../select-field'
import { Switch } from '../switch'
import { cn } from '../../../lib/utils'

const FIELD =
  'rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-4 py-2.5 text-sm text-[hsl(var(--fg-primary))] placeholder:text-[hsl(var(--fg-tertiary))] focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)]'

const LEAVE_TYPES = [
  { value: 'annual', labelKey: 'hr.leaveAnnual', fallback: 'مرخصی استحقاقی' },
  { value: 'sick', labelKey: 'hr.leaveSick', fallback: 'استعلاجی' },
  { value: 'unpaid', labelKey: 'hr.leaveUnpaid', fallback: 'بدون حقوق' },
  { value: 'maternity', labelKey: 'hr.leaveMaternity', fallback: 'زایمان' },
  { value: 'paternity', labelKey: 'hr.leavePaternity', fallback: 'پدری' },
  { value: 'bereavement', labelKey: 'hr.leaveBereavement', fallback: 'فوت بستگان' },
  { value: 'other', labelKey: 'hr.leaveOther', fallback: 'سایر' },
] as const

const ACCRUAL_METHODS = [
  { value: 'monthly', labelKey: 'hr.accrualMonthly', fallback: 'ماهانه (از ۱۲ بخش سال)' },
  { value: 'yearly', labelKey: 'hr.accrualYearly', fallback: 'سالانه (دی‌ماه)' },
  { value: 'upfront', labelKey: 'hr.accrualUpfront', fallback: 'سالانه (ماه استخدام)' },
] as const

function methodLabel(
  t: (key: string, fallback?: string) => string,
  method: LeavePolicy['accrualMethod'],
): string {
  const found = ACCRUAL_METHODS.find((m) => m.value === method)
  return found ? t(found.labelKey, found.fallback) : method
}

export function LeavePolicyCard({
  t,
}: {
  t: (key: string, fallback?: string) => string
}) {
  const policies = useLeavePolicies()
  const create = useCreateLeavePolicy()
  const update = useUpdateLeavePolicy()
  const accrue = useRunLeaveAccrual()

  const [open, setOpen] = useState(false)
  const [leaveType, setLeaveType] = useState<(typeof LEAVE_TYPES)[number]['value']>('annual')
  const [annualDays, setAnnualDays] = useState('20')
  const [method, setMethod] = useState<LeavePolicy['accrualMethod']>('monthly')
  const [formError, setFormError] = useState<string | null>(null)

  // The accrual run: one month, typed as its first day. The server refuses
  // anything that is not a month start (LEAVE_ACCRUAL_NOT_MONTH_START).
  const [period, setPeriod] = useState('')
  const [accrualNote, setAccrualNote] = useState<string | null>(null)

  const policiesError = policies.error
  const engineOff =
    policies.isError &&
    apiErrorMessage(policiesError, '').startsWith('LEAVE_POLICY_SCHEMA_REQUIRED')

  const submitPolicy = () => {
    const days = Number(annualDays)
    if (!Number.isFinite(days) || days <= 0 || days * 2 !== Math.trunc(days * 2)) {
      setFormError(t('hr.leavePolicyDaysInvalid', 'روزهای سال باید عددی مثبت و مضرب نیم باشد.'))
      return
    }
    setFormError(null)
    create.mutate(
      { leaveType, annualDays: days, accrualMethod: method, isActive: true },
      {
        onSuccess: () => {
          setOpen(false)
          setAnnualDays('20')
        },
        onError: (err) => {
          const message = apiErrorMessage(err, t('hr.leavePolicySaveError', 'ثبت نشد.'))
          setFormError(
            message.startsWith('LEAVE_POLICY_EXISTS')
              ? t('hr.leavePolicyExists', 'برای این نوع مرخصی قبلاً سیاست ثبت شده است.')
              : message.startsWith('LEAVE_POLICY_SCHEMA_REQUIRED')
                ? t(
                    'hr.leaveEngineOff',
                    'موتور مرخصی هنوز فعال نشده — میفگریشن leave-policy-01 اجرا نشده است.',
                  )
                : message,
          )
        },
      },
    )
  }

  const runAccrual = () => {
    const firstOfMonth = period ? `${period}-01` : ''
    setAccrualNote(null)
    if (!/^\d{4}-\d{2}$/.test(period)) {
      setAccrualNote(t('hr.accrualPeriodInvalid', 'ماه را به شکل ۱۴۰۴-۰۱ یا 2026-01 بنویسید.'))
      return
    }
    accrue.mutate(
      { period: firstOfMonth },
      {
        onSuccess: (result) =>
          setAccrualNote(
            t('hr.accrualDone', 'انجام شد: {count} ردیف اندوخته نوشته شد.').replace(
              '{count}',
              String(result.accruedCount),
            ),
          ),
        onError: (err) => {
          const message = apiErrorMessage(err, t('hr.accrualFailed', 'اجرا نشد.'))
          setAccrualNote(
            message.startsWith('LEAVE_POLICY_SCHEMA_REQUIRED')
              ? t(
                  'hr.leaveEngineOff',
                  'موتور مرخصی هنوز فعال نشده — میفگریشن leave-policy-01 اجرا نشده است.',
                )
              : message,
          )
        },
      },
    )
  }

  return (
    <div
      className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-6 space-y-4"
      data-leave-policy-card
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarClock className="size-5 text-[hsl(var(--color-primary))]" />
          <h2 className="text-base font-semibold text-[hsl(var(--fg-primary))]">
            {t('hr.leavePolicies', 'سیاست مرخصی')}
          </h2>
        </div>
        {engineOff ? null : (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--color-primary))] px-3 py-1.5 text-xs font-bold text-[hsl(var(--color-primary-fg))]"
          >
            {open ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
            {t('hr.addLeavePolicy', 'سیاست تازه')}
          </button>
        )}
      </div>

      {engineOff ? (
        <p role="status" className="text-sm text-[hsl(var(--fg-secondary))]">
          {t(
            'hr.leaveEngineOffLong',
            'موتور مرخصی روی این دیتابیس فعال نشده است. میفگریشن docs/leave-policy-01-migration.sql را اجرا کنید تا سیاست مرخصی و اندوخته‌ی خودکار روزها کار کند.',
          )}
        </p>
      ) : (
        <>
          {open && (
            <div className="space-y-3 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs text-[hsl(var(--fg-secondary))]">
                    {t('hr.leaveType', 'نوع مرخصی')}
                  </span>
                  <SelectField
                    value={leaveType}
                    onChange={(value) => setLeaveType(value as typeof leaveType)}
                    options={LEAVE_TYPES.map((item) => ({
                      value: item.value,
                      label: t(item.labelKey, item.fallback),
                    }))}
                    className={FIELD}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs text-[hsl(var(--fg-secondary))]">
                    {t('hr.leaveAnnualDays', 'روز در سال')}
                  </span>
                  <input
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={annualDays}
                    onChange={(e) => setAnnualDays(e.target.value)}
                    className={cn(FIELD, 'tabular-nums')}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs text-[hsl(var(--fg-secondary))]">
                    {t('hr.accrualMethod', 'روش اندوختن')}
                  </span>
                  <SelectField
                    value={method}
                    onChange={(value) => setMethod(value as LeavePolicy['accrualMethod'])}
                    options={ACCRUAL_METHODS.map((item) => ({
                      value: item.value,
                      label: t(item.labelKey, item.fallback),
                    }))}
                    className={FIELD}
                  />
                </label>
              </div>
              {formError ? (
                <p className="text-sm text-[hsl(var(--color-destructive))]" role="alert">
                  {formError}
                </p>
              ) : null}
              <button
                type="button"
                onClick={submitPolicy}
                disabled={create.isPending}
                className="rounded-full bg-[hsl(var(--color-primary))] px-5 py-2 text-sm font-bold text-[hsl(var(--color-primary-fg))] disabled:opacity-50"
              >
                {create.isPending ? '...' : t('action.save', 'ذخیره')}
              </button>
            </div>
          )}

          {policies.isLoading ? (
            <div className="h-16 animate-pulse rounded-xl bg-[hsl(var(--surface-muted))]" />
          ) : (policies.data ?? []).length === 0 ? (
            <p className="py-4 text-center text-sm text-[hsl(var(--fg-secondary))]">
              {t('hr.noLeavePolicies', 'هنوز سیاستی ثبت نشده — برای هر نوع مرخصی یکی بنویسید.')}
            </p>
          ) : (
            <div className="space-y-2">
              {(policies.data ?? []).map((policy) => (
                <div
                  key={policy.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[hsl(var(--border-default))] p-3"
                  data-leave-policy={policy.leaveType}
                >
                  <span className="min-w-0">
                    <span className="text-sm font-medium text-[hsl(var(--fg-primary))]">
                      {t(
                        `hr.leave${policy.leaveType.charAt(0).toUpperCase()}${policy.leaveType.slice(1)}`,
                        policy.leaveType,
                      )}
                      <span className="ms-2 text-xs tabular-nums text-[hsl(var(--fg-secondary))]">
                        {policy.annualDays} {t('hr.days', 'روز')} ·{' '}
                        {methodLabel(t, policy.accrualMethod)}
                      </span>
                    </span>
                    <span className="block text-xs text-[hsl(var(--fg-tertiary))]">
                      {policy.isPaid
                        ? t('hr.leavePolicyPaid', 'با حقوق')
                        : t('hr.leavePolicyUnpaid', 'بدون حقوق')}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-[hsl(var(--fg-secondary))]">
                      {policy.isActive
                        ? t('hr.leavePolicyActive', 'فعال')
                        : t('hr.leavePolicyInactive', 'خاموش')}
                    </span>
                    <Switch
                      id={`leave-policy-active-${policy.id}`}
                      checked={policy.isActive}
                      onCheckedChange={(next) => update.mutate({ id: policy.id, isActive: next })}
                    />
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* The accrual run. Idempotent on the server: a retried run or a
              backfill writes no second entitlement. */}
          <div className="space-y-2 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] p-4">
            <p className="text-sm font-medium text-[hsl(var(--fg-primary))]">
              {t('hr.accrualRun', 'اجرای اندوخته‌ی ماهانه')}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder={t('hr.accrualPeriodPlaceholder', 'مثلاً 2026-01')}
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                dir="ltr"
                className={cn(FIELD, 'w-40')}
                aria-label={t('hr.accrualPeriod', 'ماه اجرا')}
              />
              <button
                type="button"
                onClick={runAccrual}
                disabled={accrue.isPending}
                className="rounded-full border border-[hsl(var(--border-default))] px-4 py-2 text-sm font-medium text-[hsl(var(--fg-primary))] hover:bg-[hsl(var(--surface-muted))] disabled:opacity-50"
              >
                {accrue.isPending ? '...' : t('hr.accrualRunButton', 'اجرای اندوخته')}
              </button>
            </div>
            {accrualNote ? (
              <p role="status" className="text-xs text-[hsl(var(--fg-secondary))]">
                {accrualNote}
              </p>
            ) : null}
          </div>
        </>
      )}
    </div>
  )
}
