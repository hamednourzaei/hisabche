'use client'

// ============================================
// «ارجاع خودکار» of one approval workflow (capability #68): if a step waits more
// than N hours, a higher role may act on it too, and is told.
//
// Off until a person sets it. It widens who may answer — it never answers.
// ============================================

import { useEffect, useState } from 'react'
import { apiErrorMessage, useEscalationPolicy, useSetEscalationPolicy } from '@hisabche/api'

import { Button } from '../button'
import { Input } from '../input'
import { SelectField } from '../select-field'
import { useToast } from '../toast-provider'

type T = (key: string, fallback?: string) => string

/** Refusals this screen can show, each with a sentence in the catalogue. */
export const ESCALATION_ERROR_CODES = [
  'ESCALATION_MIGRATION_PENDING',
  'ESCALATION_ROLE_REQUIRED',
] as const
const KNOWN: ReadonlySet<string> = new Set(ESCALATION_ERROR_CODES)

function errorText(t: T, message: string, fallback: string): string {
  if (!message) return fallback
  return KNOWN.has(message) ? t(`workflow.escalation.errors.${message}`, message) : message
}

export function EscalationPolicyEditor({ t, workflowId }: { t: T; workflowId: string }) {
  const toast = useToast()
  const policy = useEscalationPolicy(workflowId)
  const save = useSetEscalationPolicy()

  const [hours, setHours] = useState('')
  const [role, setRole] = useState<'manager' | 'owner'>('manager')
  const [touched, setTouched] = useState(false)

  // Start from what is saved; never overwrite what the person is typing.
  useEffect(() => {
    if (!policy.data || touched) return
    setHours(policy.data.afterHours === null ? '' : String(policy.data.afterHours))
    setRole(policy.data.toRole ?? 'manager')
  }, [policy.data, touched])

  if (policy.isLoading) {
    return <div className="h-9 w-48 animate-pulse rounded-lg bg-[hsl(var(--surface-muted))]" />
  }
  if (policy.error) {
    return (
      <p role="alert" className="text-xs text-[hsl(var(--color-destructive))]">
        {errorText(
          t,
          apiErrorMessage(policy.error, ''),
          t('workflow.escalation.loadFailed', 'تنظیم ارجاع خوانده نشد.'),
        )}
      </p>
    )
  }

  const typed = hours.trim()
  const value = Number(typed)
  const invalid = typed !== '' && !(Number.isFinite(value) && value > 0 && value <= 24 * 90)
  const isOn = policy.data?.afterHours !== null && policy.data?.afterHours !== undefined

  const submit = (afterHours: number | null) =>
    save.mutate(
      { workflowId, afterHours, toRole: afterHours === null ? null : role, maxTimes: 1 },
      {
        onSuccess: () => {
          setTouched(false)
          toast.success(
            afterHours === null
              ? t('workflow.escalation.turnedOff', 'ارجاع خودکار خاموش شد.')
              : t('workflow.escalation.saved', 'ارجاع خودکار ذخیره شد.'),
          )
        },
        onError: (error) =>
          toast.error(
            errorText(
              t,
              apiErrorMessage(error, ''),
              t('workflow.escalation.saveFailed', 'ذخیره نشد.'),
            ),
          ),
      },
    )

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-[hsl(var(--fg-secondary))]">
          {t('workflow.escalation.after', 'اگر بی‌پاسخ ماند، بعد از')}
        </span>
        <div className="w-20">
          <Input
            name="afterHours"
            inputMode="decimal"
            aria-label={t('workflow.escalation.hours', 'ساعت')}
            placeholder={t('workflow.escalation.hours', 'ساعت')}
            value={hours}
            aria-invalid={invalid ? true : undefined}
            onChange={(event) => {
              setTouched(true)
              setHours(event.target.value)
            }}
          />
        </div>
        <span className="text-xs text-[hsl(var(--fg-secondary))]">
          {t('workflow.escalation.hoursTo', 'ساعت به')}
        </span>
        <div className="w-28">
          <SelectField
            name="toRole"
            aria-label={t('workflow.escalation.role', 'نقش')}
            value={role}
            onChange={(next) => {
              setTouched(true)
              setRole(next as 'manager' | 'owner')
            }}
            options={[
              { value: 'manager', label: t('workflow.escalation.roleManager', 'مدیر') },
              { value: 'owner', label: t('workflow.escalation.roleOwner', 'مالک') },
            ]}
          />
        </div>
        <span className="text-xs text-[hsl(var(--fg-secondary))]">
          {t('workflow.escalation.refer', 'ارجاع شود')}
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={typed === '' || invalid || save.isPending}
          loading={save.isPending}
          onClick={() => submit(value)}
        >
          {t('action.save', 'ذخیره')}
        </Button>
        {isOn ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={save.isPending}
            onClick={() => {
              setHours('')
              submit(null)
            }}
          >
            {t('workflow.escalation.turnOff', 'خاموش')}
          </Button>
        ) : null}
      </div>
      {invalid ? (
        <p className="text-xs text-[hsl(var(--color-destructive))]">
          {t('workflow.escalation.invalid', 'تعداد ساعت باید عددی بیشتر از صفر باشد.')}
        </p>
      ) : (
        <p className="text-xs text-[hsl(var(--fg-tertiary))]">
          {isOn
            ? t(
                'workflow.escalation.onHint',
                'روشن است. نقش بالاتر هم می‌تواند تأیید یا رد کند و به او اطلاع داده می‌شود؛ چیزی خودکار تأیید نمی‌شود.',
              )
            : t('workflow.escalation.offHint', 'خاموش است: تأیید فقط منتظر همان نقش می‌ماند.')}
        </p>
      )}
    </div>
  )
}
