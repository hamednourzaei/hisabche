'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useInfrastructureSettings, useUpdateInfrastructureSettings } from '@hisabche/api'
import type { UpdateInfrastructureSettingsInput } from '@hisabche/validation'
import { InfrastructureTogglesPanel, Skeleton } from '@/components/ui'
import { ErrorState } from '@/components/admin-shell/admin-ui'
import { StepUpDialog } from '@/components/admin-shell/step-up-dialog'

interface PendingSave {
  payload: UpdateInfrastructureSettingsInput
  resolve: () => void
  reject: (reason?: unknown) => void
}

export function InfrastructurePanel() {
  const t = useTranslations()
  const { data, isLoading, isError, refetch } = useInfrastructureSettings()
  const { mutateAsync: updateSettings, isPending } = useUpdateInfrastructureSettings()
  const [pendingSave, setPendingSave] = useState<PendingSave | null>(null)

  const handleSaveRequest = (payload: UpdateInfrastructureSettingsInput) =>
    new Promise<void>((resolve, reject) => {
      setPendingSave({ payload, resolve, reject })
    })

  const handleDialogOpenChange = (open: boolean) => {
    if (!open && pendingSave) {
      pendingSave.reject(new Error('STEP_UP_CANCELLED'))
      setPendingSave(null)
    }
  }

  const handleConfirm = async ({ stepUpTimestamp }: { stepUpTimestamp: string }) => {
    if (!pendingSave) return
    const { payload, resolve, reject } = pendingSave
    try {
      await updateSettings({ ...payload, stepUpTimestamp })
      resolve()
      setPendingSave(null)
    } catch (err: unknown) {
      reject(err)
      setPendingSave(null)
      throw err
    }
  }

  if (isLoading) {
    return <Skeleton className="h-96 w-full rounded-xl" />
  }

  if (isError) {
    return (
      <ErrorState message={t('admin.infrastructure.saveError')} onRetry={() => void refetch()} />
    )
  }

  return (
    <>
      <InfrastructureTogglesPanel
        {...(data ? { initialSettings: data } : {})}
        onSave={handleSaveRequest}
        isSavingExternal={isPending}
      />

      <StepUpDialog
        open={pendingSave !== null}
        onOpenChange={handleDialogOpenChange}
        title={t('admin.infrastructure.stepUpTitle')}
        description={t('admin.infrastructure.stepUpDesc')}
        confirmLabel={t('admin.infrastructure.stepUpConfirm')}
        destructive={pendingSave?.payload.maintenanceMode === true}
        onConfirm={handleConfirm}
      />
    </>
  )
}
