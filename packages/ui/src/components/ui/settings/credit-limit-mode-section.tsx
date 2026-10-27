'use client'

// ============================================
// packages/ui/src/components/ui/settings/credit-limit-mode-section.tsx
//
// G-08: Workspace Credit Limit Policy Setting (off | warn | block).
// ============================================

import { memo, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { ShieldAlert } from 'lucide-react'
import { useWorkspaces, useUpdateWorkspace } from '@hisabche/api'
import type { CreditLimitMode } from '@hisabche/validation'
import { SegmentedControl } from '../segmented-control'
import { useToast } from '../toast-provider'

const card =
  'rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]'

export const CreditLimitModeSection = memo(function CreditLimitModeSection() {
  const t = useTranslations()
  const { data: workspaces } = useWorkspaces()
  const updateWorkspace = useUpdateWorkspace()
  const toast = useToast()

  const workspace = Array.isArray(workspaces) ? workspaces[0] : undefined
  const currentMode =
    (workspace as unknown as { credit_limit_mode?: CreditLimitMode })?.credit_limit_mode || 'warn'

  const handleModeChange = useCallback(
    (mode: CreditLimitMode) => {
      if (!workspace?.id) return
      updateWorkspace.mutate(
        { id: workspace.id, credit_limit_mode: mode } as unknown as { id: string },
        {
          onSuccess: () => {
            toast.success(
              t('settings.creditLimitMode.success', {
                fallback: 'سیاست سقف اعتبار به‌روزرسانی شد',
              }),
            )
          },
          onError: () => {
            toast.error(t('common.error', { fallback: 'خطا در ثبت تغییرات' }))
          },
        },
      )
    },
    [workspace?.id, updateWorkspace, toast, t],
  )

  const options: Array<{ value: CreditLimitMode; label: string }> = [
    { value: 'warn', label: t('settings.creditLimitMode.warn', { fallback: 'هشدار (پیش‌فرض)' }) },
    { value: 'block', label: t('settings.creditLimitMode.block', { fallback: 'مسدودسازی' }) },
    { value: 'off', label: t('settings.creditLimitMode.off', { fallback: 'غیرفعال' }) },
  ]

  return (
    <section className={`${card} p-5`} aria-labelledby="credit-limit-mode-title">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-secondary))]">
          <ShieldAlert className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h2
              id="credit-limit-mode-title"
              className="text-sm font-semibold text-[hsl(var(--fg-primary))]"
            >
              {t('settings.creditLimitMode.title', { fallback: 'سیاست سقف اعتبار مشتریان' })}
            </h2>
            <p className="mt-1 text-xs text-[hsl(var(--fg-tertiary))]">
              {t('settings.creditLimitMode.description', {
                fallback: 'تعیین رفتار سیستم هنگام صدور فاکتور فراتر از سقف اعتبار مشتری',
              })}
            </p>
          </div>
          <SegmentedControl<CreditLimitMode>
            label={t('settings.creditLimitMode.title', { fallback: 'سیاست سقف اعتبار مشتریان' })}
            options={options}
            value={currentMode as CreditLimitMode}
            onChange={handleModeChange}
          />
        </div>
      </div>
    </section>
  )
})

CreditLimitModeSection.displayName = 'CreditLimitModeSection'
