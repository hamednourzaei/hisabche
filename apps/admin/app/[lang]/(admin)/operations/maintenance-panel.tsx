'use client'

// ============================================
// Operations › announcements › maintenance (V63 #68).
//
// The switch over the existing read-only mode: while it is on, every
// customer write answers `503 SERVICE_READ_ONLY` (reason `maintenance`);
// reads, sign-in and this console keep working so the switch can be turned
// back off. Turning it either way needs a fresh second factor and a reason,
// and is written to the security events.
// ============================================

import { useState } from 'react'
import { useTranslations } from 'next-intl'

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@/components/ui'
import { ErrorState } from '@/components/admin-shell/admin-ui'
import { StepUpDialog } from '@/components/admin-shell/step-up-dialog'
import { useAdminMaintenance, useSetMaintenance } from '@/hooks/use-admin-insights'
import { useAdminLocale } from '@/hooks/use-admin-locale'
import { adminDateTime, UNKNOWN_VALUE } from '@/lib/admin-format'

export function MaintenancePanel() {
  const t = useTranslations()
  const locale = useAdminLocale()
  const { data, isLoading, isError, refetch } = useAdminMaintenance()
  const { mutateAsync: setMaintenance } = useSetMaintenance()
  const [confirming, setConfirming] = useState<boolean | null>(null)

  const handleConfirm = async ({
    stepUpTimestamp,
    reason,
  }: {
    stepUpTimestamp: string
    reason?: string
  }) => {
    if (confirming === null || !reason) return
    await setMaintenance({ enabled: confirming, reason, stepUpTimestamp })
    setConfirming(null)
  }

  return (
    <Card>
      <CardHeader className="text-start">
        <CardTitle>{t('admin.insights.maintenance.title')}</CardTitle>
        <CardDescription>{t('admin.insights.maintenance.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && <Skeleton className="h-24 w-full rounded-xl" />}

        {isError && !isLoading && (
          <ErrorState message={t('admin.insights.loadError')} onRetry={() => void refetch()} />
        )}

        {!isLoading && !isError && data && (
          <>
            {!data.readable && (
              <p role="alert" className="text-sm text-warning">
                {t('admin.insights.maintenance.unreadable')}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={data.enabled ? 'destructive' : 'default'}>
                {data.enabled
                  ? t('admin.insights.maintenance.on')
                  : t('admin.insights.maintenance.off')}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {t('admin.insights.maintenance.changedAt', {
                  time: data.changedAt ? adminDateTime(data.changedAt, locale) : UNKNOWN_VALUE,
                })}
              </span>
            </div>
            {data.reason && (
              <p className="text-sm text-foreground">
                {t('admin.insights.maintenance.reasonShown', { reason: data.reason })}
              </p>
            )}
            <p className="text-xs text-muted-foreground">{t('admin.insights.maintenance.scope')}</p>
            <Button
              variant={data.enabled ? 'outline' : 'destructive'}
              onClick={() => setConfirming(!data.enabled)}
            >
              {data.enabled
                ? t('admin.insights.maintenance.turnOff')
                : t('admin.insights.maintenance.turnOn')}
            </Button>
          </>
        )}
      </CardContent>

      <StepUpDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={
          confirming
            ? t('admin.insights.maintenance.confirmOnTitle')
            : t('admin.insights.maintenance.confirmOffTitle')
        }
        description={
          confirming
            ? t('admin.insights.maintenance.confirmOnDesc')
            : t('admin.insights.maintenance.confirmOffDesc')
        }
        requireReason
        reasonLabel={t('admin.insights.maintenance.reason')}
        destructive={confirming === true}
        confirmLabel={
          confirming
            ? t('admin.insights.maintenance.turnOn')
            : t('admin.insights.maintenance.turnOff')
        }
        onConfirm={handleConfirm}
      />
    </Card>
  )
}
