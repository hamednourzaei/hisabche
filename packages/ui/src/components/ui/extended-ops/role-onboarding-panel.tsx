'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check } from 'lucide-react'
import { useGuideProgress, useMarkGuideStepsSeen } from '@hisabche/api'
import { SelectField } from '../select-field'
import { Button } from '../button'

type OnboardingRole = 'owner' | 'cashier' | 'stockkeeper' | 'accountant' | 'manager'

const ROLE_STEP_KEYS: Readonly<
  Record<OnboardingRole, readonly ('currency' | 'warehouse' | 'till' | 'tax' | 'team')[]>
> = {
  owner: ['currency', 'warehouse', 'till', 'tax', 'team'],
  cashier: ['till'],
  stockkeeper: ['warehouse'],
  accountant: ['currency', 'tax'],
  manager: ['warehouse', 'till', 'team'],
}

export function RoleOnboardingPanel() {
  const t = useTranslations('extendedOps')
  const [role, setRole] = useState<OnboardingRole>('owner')
  const progress = useGuideProgress()
  const markSeen = useMarkGuideStepsSeen()

  const seenSet = new Set((progress.data?.steps ?? []).map((s) => s.stepId))
  const roleSteps = ROLE_STEP_KEYS[role]

  return (
    <section
      data-extended-panel="role-onboarding"
      className="mx-auto mt-4 w-full max-w-6xl space-y-3 rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4 text-start sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-base font-bold text-[hsl(var(--fg-primary))]">
          {t('ops.onboardingTitle')}
        </h3>
        <div className="w-full sm:w-56">
          <SelectField
            value={role}
            onChange={(val) => setRole(val as OnboardingRole)}
            options={[
              { value: 'owner', label: t('ops.roles.owner') },
              { value: 'cashier', label: t('ops.roles.cashier') },
              { value: 'stockkeeper', label: t('ops.roles.stockkeeper') },
              { value: 'accountant', label: t('ops.roles.accountant') },
              { value: 'manager', label: t('ops.roles.manager') },
            ]}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {roleSteps.map((stepKey) => {
          const stepId = `role_onboarding:${role}:${stepKey}`
          const done = seenSet.has(stepId)
          return (
            <Button
              key={stepId}
              type="button"
              variant={done ? 'secondary' : 'outline'}
              className="flex min-h-[44px] w-full items-center justify-between gap-2 px-3 py-2 text-start"
              disabled={markSeen.isPending}
              onClick={() => markSeen.mutate([{ stepId, routeId: '/settings' }])}
            >
              <span className="text-xs sm:text-sm">{t(`ops.steps.${stepKey}`)}</span>
              {done ? (
                <Check className="h-4 w-4 shrink-0 text-[hsl(var(--color-primary))]" />
              ) : null}
            </Button>
          )
        })}
      </div>
    </section>
  )
}
