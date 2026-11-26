'use client'

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
  DataTable,
  EmptyState,
  Input,
  type TableColumn,
} from '@/components/ui'
import {
  useRunAdminWorkspaceReconcile,
  type AdminWorkspaceReconcileReport,
} from '@/hooks/use-admin-ops'
import { StepUpDialog } from '@/components/admin-shell/step-up-dialog'
import { useAdminTableT } from '@/components/admin-shell/admin-ui'
import { useAdminLocale } from '@/hooks/use-admin-locale'
import { adminDateTime, adminNumber, UNKNOWN_VALUE } from '@/lib/admin-format'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function AdminFinancialIntegrityPanel() {
  const t = useTranslations()
  const locale = useAdminLocale()
  const tableT = useAdminTableT()
  const [workspaceId, setWorkspaceId] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [report, setReport] = useState<AdminWorkspaceReconcileReport | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const { mutateAsync: runReconcile, isPending } = useRunAdminWorkspaceReconcile()
  const trimmedId = workspaceId.trim()
  const isValidUuid = UUID_RE.test(trimmedId)

  const handleConfirm = async ({ stepUpTimestamp }: { stepUpTimestamp: string }) => {
    setErrorMessage(null)
    try {
      const res = await runReconcile({ workspaceId: trimmedId, stepUpTimestamp })
      setReport(res.data)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : t('admin.error.generic'))
    } finally {
      setConfirmOpen(false)
    }
  }

  const columns: TableColumn<AdminWorkspaceReconcileReport['exceptions'][number]>[] = [
    {
      id: 'code',
      labelKey: 'admin.controlPlane.reconcile.code',
      labelFallback: 'کد مغایرت',
      locked: true,
      render: (e) => (
        <span dir="ltr" className="font-mono text-xs font-semibold text-foreground">
          {e.code}
        </span>
      ),
      sortValue: (e) => e.code,
    },
    {
      id: 'severity',
      labelKey: 'admin.controlPlane.reconcile.severity',
      labelFallback: 'شدت',
      render: (e) => (
        <Badge variant={e.severity === 'error' ? 'destructive' : 'outline'} className="text-xs">
          {e.severity}
        </Badge>
      ),
      sortValue: (e) => e.severity,
    },
    {
      id: 'entity',
      labelKey: 'admin.controlPlane.reconcile.entity',
      labelFallback: 'موجودیت',
      showFrom: 'md',
      render: (e) => (
        <span dir="ltr" className="font-mono text-xs text-muted-foreground">
          {e.entityType}:{e.entityId.slice(0, 10)}
        </span>
      ),
      sortValue: (e) => e.entityType,
    },
    {
      id: 'message',
      labelKey: 'admin.controlPlane.reconcile.message',
      labelFallback: 'توضیحات',
      render: (e) => <span className="text-xs text-foreground">{e.message}</span>,
      sortValue: (e) => e.message,
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.controlPlane.reconcile.title')}</CardTitle>
        <CardDescription>{t('admin.controlPlane.reconcile.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            dir="ltr"
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
            placeholder="00000000-0000-4000-8000-000000000000"
            aria-label={t('admin.controlPlane.common.workspace')}
            className="max-w-md"
          />
          <Button disabled={!isValidUuid || isPending} onClick={() => setConfirmOpen(true)}>
            {t('admin.controlPlane.reconcile.runAction')}
          </Button>
        </div>

        {errorMessage ? (
          <p role="alert" className="text-xs font-medium text-destructive">
            {errorMessage}
          </p>
        ) : null}

        {report ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={report.balanced ? 'default' : 'destructive'} className="text-xs">
                {report.status}
              </Badge>
              <span className="text-xs text-muted-foreground tabular-nums">
                {adminDateTime(report.checkedAt, locale)}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {t('admin.controlPlane.reconcile.summaryCounts', {
                  missing: adminNumber(report.missingPostings, locale),
                  duplicate: adminNumber(report.duplicatePostings, locale),
                  reversal: adminNumber(report.reversalMismatch, locale),
                  currency: adminNumber(report.currencyMismatch, locale),
                })}
              </span>
            </div>

            <DataTable
              tableId="admin-financial-integrity-exceptions"
              t={tableT}
              rows={report.exceptions}
              columns={columns}
              rowKey={(e) => `${e.code}:${e.entityId}`}
              caption={t('admin.controlPlane.reconcile.exceptionsTitle')}
              minWidthClass="min-w-[720px]"
              emptyState={
                <EmptyState
                  title={t('admin.controlPlane.reconcile.cleanTitle')}
                  description={t('admin.controlPlane.reconcile.cleanDesc')}
                />
              }
            />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {trimmedId && !isValidUuid ? t('admin.offline.invalidDeviceId') : UNKNOWN_VALUE}
          </p>
        )}
      </CardContent>

      <StepUpDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('admin.controlPlane.reconcile.title')}
        description={t('admin.controlPlane.reconcile.confirmDesc', { workspaceId: trimmedId })}
        onConfirm={handleConfirm}
      />
    </Card>
  )
}
