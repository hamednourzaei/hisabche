'use client'

// ============================================
// packages/ui/src/components/ui/governance/containers/governance-container.tsx
// ============================================

import { memo, useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  asList,
  useSoD,
  useSoDOverrides,
  useSaveSoD,
  type SoDMode,
  type SoDOverride,
  type SoDRule,
  apiErrorMessage,
} from '@hisabche/api'
import { GovernanceView } from '../governance-view'

export const GovernanceContainer = memo(function GovernanceContainer() {
  const translate = useTranslations()
  const t = (key: string, fallback?: string): string => {
    const value = translate(key as Parameters<typeof translate>[0])
    return value && value !== key ? value : (fallback ?? key)
  }

  const [actionError, setActionError] = useState<string | null>(null)

  const sod = useSoD()
  const overrides = useSoDOverrides()
  const save = useSaveSoD()

  const report = useCallback((err: unknown) => {
    setActionError(apiErrorMessage(err, 'انجام نشد'))
  }, [])

  const handleModeChange = useCallback(
    (mode: SoDMode) => {
      setActionError(null)
      save.mutate({ mode }, { onError: report })
    },
    [report, save],
  )

  const handleToggleRule = useCallback(
    (ruleId: string, enabled: boolean) => {
      setActionError(null)

      const current = sod.data?.settings.disabledRules ?? []
      // The whole list is sent, not a delta: the server stores the set of
      // disabled ids, and a delta would race with a change made on another
      // device between the read and the write.
      const disabledRules = enabled ? current.filter((id) => id !== ruleId) : [...current, ruleId]

      save.mutate({ disabledRules }, { onError: report })
    },
    [report, save, sod.data],
  )

  const handleRefresh = useCallback(() => {
    setActionError(null)
    sod.refetch()
    overrides.refetch()
  }, [overrides, sod])

  return (
    <GovernanceView
      t={t}
      settings={sod.data?.settings ?? null}
      rules={asList<SoDRule>(sod.data?.rules)}
      overrides={asList<SoDOverride>(overrides.data)}
      isOverridesLoading={overrides.isLoading}
      overridesError={overrides.error ? (overrides.error as Error).message : null}
      isLoading={sod.isLoading}
      error={sod.error ? (sod.error as Error).message : null}
      actionError={actionError}
      isBusy={save.isPending}
      onModeChange={handleModeChange}
      onToggleRule={handleToggleRule}
      onRefresh={handleRefresh}
    />
  )
})

GovernanceContainer.displayName = 'GovernanceContainer'
