'use client'

// ============================================
// Operations › health › migrations (V63 #69). READ-ONLY.
//
// The migrations waiting for a human (`backend/src/services/admin/
// migration-catalog.ts`), each with what the database says about the one
// object it creates. Nothing here runs DDL: a person runs the file and then
// its VERIFY in the SQL editor. «Applied» means the object exists — the
// VERIFY file is still the proof, and the screen says so.
// ============================================

import { useTranslations } from 'next-intl'

import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DataTable,
  EmptyState,
  Skeleton,
  type TableColumn,
} from '@/components/ui'
import { ErrorState, useAdminTableT } from '@/components/admin-shell/admin-ui'
import { useAdminMigrationStatus, type MigrationStatusItem } from '@/hooks/use-admin-insights'
import { UNKNOWN_VALUE } from '@/lib/admin-format'

export function MigrationsPanel() {
  const t = useTranslations()
  const tableT = useAdminTableT()
  const { data, isLoading, isError, refetch } = useAdminMigrationStatus()

  const columns: TableColumn<MigrationStatusItem>[] = [
    {
      id: 'file',
      labelKey: 'admin.insights.migrations.file',
      labelFallback: 'Migration',
      locked: true,
      render: (row) => (
        <span dir="ltr" className="font-mono text-xs text-foreground">
          docs/{row.file}
        </span>
      ),
      sortValue: (row) => row.file,
    },
    {
      id: 'state',
      labelKey: 'admin.insights.migrations.state',
      labelFallback: 'State',
      render: (row) => (
        <Badge
          variant={
            row.state === 'applied'
              ? 'default'
              : row.state === 'not_applied'
                ? 'destructive'
                : 'outline'
          }
          className="text-xs"
        >
          {t(`admin.insights.migrations.states.${row.state}`)}
        </Badge>
      ),
      sortValue: (row) => row.state,
    },
    {
      id: 'probe',
      labelKey: 'admin.insights.migrations.probe',
      labelFallback: 'Checked object',
      showFrom: 'md',
      render: (row) => (
        <span dir="ltr" className="font-mono text-xs text-muted-foreground">
          {row.probe ?? UNKNOWN_VALUE}
        </span>
      ),
    },
    {
      id: 'verify',
      labelKey: 'admin.insights.migrations.verify',
      labelFallback: 'Verify with',
      showFrom: 'lg',
      render: (row) => (
        <span dir="ltr" className="font-mono text-xs text-muted-foreground">
          docs/{row.verify}
        </span>
      ),
    },
  ]

  return (
    <Card>
      <CardHeader className="text-start">
        <CardTitle>{t('admin.insights.migrations.title')}</CardTitle>
        <CardDescription>{t('admin.insights.migrations.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <Skeleton className="h-40 w-full rounded-xl" />}

        {isError && !isLoading && (
          <ErrorState message={t('admin.insights.loadError')} onRetry={() => void refetch()} />
        )}

        {!isLoading && !isError && (
          <DataTable
            tableId="admin-migrations"
            t={tableT}
            rows={data?.migrations ?? []}
            columns={columns}
            rowKey={(row) => row.file}
            caption={t('admin.insights.migrations.title')}
            emptyState={<EmptyState title={t('admin.insights.migrations.empty')} />}
          />
        )}
      </CardContent>
    </Card>
  )
}
