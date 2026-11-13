'use client'

// ============================================
// Security › roles › the permission matrix (V63 #52).
//
// Permissions down, the seven fixed roles across, one mark where the role
// holds the permission. Read straight from `GET /api/admin/roles` — the same
// catalogue the server's guard reads (`admin-rbac.domain.ts`) — so the
// matrix cannot disagree with what is enforced. Roles are fixed in code;
// there is nothing to edit here, and the screen does not pretend otherwise.
// ============================================

import { useState } from 'react'
import { useTranslations } from 'next-intl'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DataTable,
  EmptyState,
  Skeleton,
  TableFilterSelect,
  type TableColumn,
} from '@/components/ui'
import { ErrorState, useAdminTableT } from '@/components/admin-shell/admin-ui'
import { useAdminAccounts, useAdminRoles } from '@/hooks/use-admin-security'
import { useAdminLocale } from '@/hooks/use-admin-locale'
import { adminNumber } from '@/lib/admin-format'

const AREAS = [
  'billing',
  'offline',
  'customers',
  'product',
  'operations',
  'content',
  'security',
  'admin',
] as const

interface MatrixRow {
  permission: string
}

export function PermissionMatrix() {
  const t = useTranslations()
  const locale = useAdminLocale()
  const tableT = useAdminTableT()
  const { data, isLoading, isError, refetch } = useAdminRoles()
  const { data: accountsData } = useAdminAccounts()
  const [area, setArea] = useState<string>('all')

  const roles = data?.roles ?? []
  const all = data?.allPermissions ?? []
  const holders = new Map(roles.map((role) => [role.role, new Set(role.permissions)]))
  const accountsByRole = new Map<string, number>()
  for (const account of accountsData?.accounts ?? []) {
    if (!account.isActive) continue
    accountsByRole.set(account.role, (accountsByRole.get(account.role) ?? 0) + 1)
  }

  const rows: MatrixRow[] = all
    .filter((permission) => area === 'all' || permission.startsWith(`${area}.`))
    .map((permission) => ({ permission }))

  const columns: TableColumn<MatrixRow>[] = [
    {
      id: 'permission',
      labelKey: 'admin.insights.matrix.permission',
      labelFallback: 'Permission',
      locked: true,
      render: (row) => (
        <span dir="ltr" className="font-mono text-xs text-foreground">
          {row.permission}
        </span>
      ),
      sortValue: (row) => row.permission,
    },
    ...roles.map((role): TableColumn<MatrixRow> => ({
      id: `role-${role.role}`,
      labelKey: `admin.insights.matrix.roles.${role.role}`,
      labelFallback: role.role,
      align: 'end',
      render: (row) =>
        holders.get(role.role)?.has(row.permission) ? (
          <span
            className="font-semibold text-[hsl(var(--color-success))]"
            aria-label={t('admin.insights.matrix.granted')}
          >
            ✓
          </span>
        ) : (
          <span
            className="text-muted-foreground"
            aria-label={t('admin.insights.matrix.notGranted')}
          >
            ·
          </span>
        ),
      sortValue: (row) => (holders.get(role.role)?.has(row.permission) ? 1 : 0),
    })),
  ]

  return (
    <Card>
      <CardHeader className="text-start">
        <CardTitle>{t('admin.insights.matrix.title')}</CardTitle>
        <CardDescription>{t('admin.insights.matrix.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && <Skeleton className="h-64 w-full rounded-xl" />}

        {isError && !isLoading && (
          <ErrorState message={t('admin.insights.loadError')} onRetry={() => void refetch()} />
        )}

        {!isLoading && !isError && (
          <>
            <ul className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {roles.map((role) => (
                <li key={role.role} className="rounded-lg border border-border px-2 py-1">
                  {t('admin.insights.matrix.roleSummary', {
                    role: t(`admin.insights.matrix.roles.${role.role}`),
                    permissions: adminNumber(role.permissions.length, locale),
                    admins: adminNumber(accountsByRole.get(role.role) ?? 0, locale),
                  })}
                </li>
              ))}
            </ul>
            <DataTable
              tableId="admin-permission-matrix"
              t={tableT}
              rows={rows}
              columns={columns}
              rowKey={(row) => row.permission}
              caption={t('admin.insights.matrix.title')}
              minWidthClass="min-w-[880px]"
              actions={
                <TableFilterSelect
                  label={t('admin.insights.matrix.area')}
                  value={area}
                  onChange={setArea}
                  options={[
                    { value: 'all', label: t('admin.insights.matrix.allAreas') },
                    ...AREAS.map((value) => ({
                      value,
                      label: t(`admin.insights.matrix.areas.${value}`),
                    })),
                  ]}
                />
              }
              emptyState={<EmptyState title={t('admin.insights.matrix.empty')} />}
            />
          </>
        )}
      </CardContent>
    </Card>
  )
}
