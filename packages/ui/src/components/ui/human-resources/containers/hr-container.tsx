// packages/ui/src/components/ui/human-resources/containers/hr-container.tsx
'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  useEmployees,
  useCreateEmployee,
  useDeleteEmployee,
  usePayrollSummary,
  useCreateMemberDirect,
  useWorkspaces,
} from '@hisabche/api'
import { HumanResourcesView } from '../hr-view'
import { WorkspaceContainer } from '../../workspace/containers/workspace-container'
import { useState } from 'react'
import { Users, Building2 } from 'lucide-react'
import { cn } from '../../../../lib/utils'

export function HumanResourcesContainer() {
  const t = useTranslations()
  const router = useRouter()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'employees' | 'team'>('employees')

  const { data, isLoading } = useEmployees({ page, limit: 20 })
  const { data: payrollSummary } = usePayrollSummary()
  const { data: workspaces } = useWorkspaces()
  const createEmployee = useCreateEmployee()
  const deleteEmployee = useDeleteEmployee()
  const createMemberDirect = useCreateMemberDirect()

  const workspaceId = workspaces?.[0]?.id as string | undefined

  // Wrapper برای سازگاری با exactOptionalPropertyTypes
  const safeT = (key: string, fallback?: string) => {
    const result = t(key)
    return result !== key ? result : (fallback ?? key)
  }

  const handleCreate = async (
    values: Record<string, unknown>,
    access?: { email: string; password: string; role: 'admin' | 'member' },
  ) => {
    await createEmployee.mutateAsync(values)

    if (access && workspaceId) {
      await createMemberDirect.mutateAsync({
        workspaceId,
        email: access.email,
        password: access.password,
        fullName: `${values.firstName ?? ''} ${values.lastName ?? ''}`.trim(),
        role: access.role,
      })
    }
  }

  const handleDelete = async (id: string) => {
    await deleteEmployee.mutateAsync(id)
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-full border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-1 w-fit">
        <button
          type="button"
          onClick={() => setTab('employees')}
          className={cn(
            'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors',
            tab === 'employees'
              ? 'bg-[hsl(var(--color-primary))] text-[hsl(var(--color-primary-fg))]'
              : 'text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))]',
          )}
        >
          <Users className="size-4" />
          {safeT('nav.team', 'تیم و حقوق')}
        </button>
        <button
          type="button"
          onClick={() => setTab('team')}
          className={cn(
            'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors',
            tab === 'team'
              ? 'bg-[hsl(var(--color-primary))] text-[hsl(var(--color-primary-fg))]'
              : 'text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))]',
          )}
        >
          <Building2 className="size-4" />
          {safeT('nav.coworkers', 'فضای کاری')}
        </button>
      </div>

      {tab === 'employees' ? (
        <HumanResourcesView
          t={safeT}
          employees={data?.employees ?? []}
          total={data?.total ?? 0}
          page={page}
          isLoading={isLoading}
          payrollTotal={payrollSummary?.total ?? 0}
          payrollByEmployee={payrollSummary?.byEmployee ?? {}}
          onPageChange={setPage}
          onSearch={setSearch}
          onCreate={handleCreate}
          onDelete={handleDelete}
          onView={(id) => router.push(`/human-resources/${id}`)}
        />
      ) : (
        <WorkspaceContainer />
      )}
    </div>
  )
}
