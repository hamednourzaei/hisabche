'use client'

// ============================================
// packages/ui/src/components/ui/team-and-payroll/containers/team-and-payroll-container.tsx
//
// G2 — three tabs: [کارمندان] [شعب] [حقوق].
//
// ---------------------------------------------------------------------------
// TWO THINGS THAT WERE BROKEN HERE, NOT DESIGN CHOICES
//
// 1. HOOKS CALLED INSIDE EVENT HANDLERS.
//
//        const handleCreateEmployee = async (values) => {
//          await useCreateEmployee().mutateAsync(values)   // ← invalid
//        }
//
//    `useCreateEmployee()` is a React hook. Calling it from a click handler
//    violates the rules of hooks and throws "Invalid hook call" at runtime, so
//    adding an employee from this screen could never have worked. The same
//    shape was in the delete handler. Both now come from hooks called during
//    render, which is the only place a hook may be called.
//
// 2. A ROUTE THAT DOES NOT EXIST.
//
//    `router.push('/team-and-payroll/employee/${id}')` — there is no
//    `employee` segment. The real detail route is `/team-and-payroll/:id`
//    (G1 moved it there from /human-resources/:id). Clicking an employee card
//    navigated to a 404.
//
// ---------------------------------------------------------------------------
// THE TAB LIVES IN THE URL
//
// `?tab=branches` rather than component state, so the choice survives a reload
// and the branch tree can be linked to directly — the same convention the
// warehouse screen uses for its catalogue tab.
// ============================================

import { useCallback, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'

import {
  useBranches,
  useBranchTree,
  useCreateBranch,
  useCreateEmployee,
  useDeleteEmployee,
  useEmployees,
  usePayrolls,
} from '@hisabche/api'

import { TeamAndPayrollView, type TeamTab } from '../team-and-payroll-view'
import { BranchTreeView } from '../branch-tree-view'
import { BranchForm, type BranchFormValues } from '../branch-form'

/** Anything that is not a known tab is «کارمندان» — what the menu entry means. */
function tabFrom(value: string | null | undefined): TeamTab {
  return value === 'branches' || value === 'payroll' ? value : 'employees'
}

/** The server's message, or a generic fallback. Never a swallowed error. */
function messageOf(error: unknown, fallback: string): string {
  const response = (error as { response?: { data?: { error?: string } } })?.response
  return response?.data?.error ?? (error as Error)?.message ?? fallback
}

export function TeamAndPayrollContainer() {
  const tOriginal = useTranslations()
  const t = useCallback(
    (key: string, fallback?: string): string => {
      const v = tOriginal(key as Parameters<typeof tOriginal>[0])
      return v && v !== key ? v : (fallback ?? key)
    },
    [tOriginal],
  )

  const router = useRouter()
  const params = useSearchParams()
  const tab = tabFrom(params.get('tab'))

  const setTab = useCallback(
    (next: TeamTab) => {
      // replace, not push: switching tabs is not a step the back button should
      // have to walk through one at a time.
      router.replace(next === 'employees' ? '/team-and-payroll' : `/team-and-payroll?tab=${next}`)
    },
    [router],
  )

  // ─── Data ─────────────────────────────────────────────────────────────────

  const {
    data: employeesData,
    isLoading: isLoadingEmployees,
    refetch: refetchEmployees,
  } = useEmployees({ page: 1, limit: 20 })

  const { data: payrollData, isLoading: isLoadingPayroll } = usePayrolls()

  // The flat list feeds the employee form's branch picker; the tree feeds the
  // «شعب» tab. Two reads because they answer two questions — the picker needs
  // every branch including ones with nobody in them, the tree needs the nesting
  // and the head counts.
  const { data: branches = [] } = useBranches()
  const { data: branchTree = [], isLoading: isLoadingTree } = useBranchTree()

  // ⚠️ Hooks, called during render. This is the fix for the invalid hook calls
  // described at the top of this file.
  const createEmployee = useCreateEmployee()
  const deleteEmployee = useDeleteEmployee()
  const createBranch = useCreateBranch()

  const [employeeFormError, setEmployeeFormError] = useState<string | null>(null)
  const [branchFormError, setBranchFormError] = useState<string | null>(null)
  const [showBranchForm, setShowBranchForm] = useState(false)

  const employees = employeesData?.employees ?? []
  const totalEmployees = employeesData?.total ?? 0
  const payrollRecords = payrollData?.payrolls ?? []
  const totalPayroll = payrollData?.total ?? 0

  // ─── Actions ──────────────────────────────────────────────────────────────

  const handleCreateEmployee = useCallback(
    async (values: Record<string, unknown>) => {
      setEmployeeFormError(null)
      try {
        await createEmployee.mutateAsync(values)
        await refetchEmployees()
      } catch (error) {
        // Surfaced, not swallowed. A save that fails silently tells the user
        // their employee was created when it was not — and the branch
        // assignment fails loudly on the server when phase-d-01 has not run,
        // which is precisely the message they need to see.
        setEmployeeFormError(messageOf(error, t('common.saveError', 'ذخیره ناموفق بود')))
        throw error
      }
    },
    [createEmployee, refetchEmployees, t],
  )

  const handleDeleteEmployee = useCallback(
    async (id: string) => {
      await deleteEmployee.mutateAsync(id)
      await refetchEmployees()
    },
    [deleteEmployee, refetchEmployees],
  )

  const handleCreateBranch = useCallback(
    async (values: BranchFormValues) => {
      setBranchFormError(null)
      try {
        await createBranch.mutateAsync(values)
        setShowBranchForm(false)
      } catch (error) {
        // The service refuses a non-owner with BRANCH_MANAGE_FORBIDDEN. Showing
        // that beats a form that closes as though it had worked.
        setBranchFormError(messageOf(error, t('common.saveError', 'ذخیره ناموفق بود')))
      }
    },
    [createBranch, t],
  )

  // G1 moved the employee detail route to /team-and-payroll/:id. This used to
  // push `/team-and-payroll/employee/:id`, which is not a route.
  const handleViewEmployee = useCallback(
    (id: string) => router.push(`/team-and-payroll/${id}`),
    [router],
  )

  const handleViewPayroll = useCallback(
    (id: string) => router.push(`/team-and-payroll/payroll/${id}`),
    [router],
  )

  // ─── The «شعب» tab ────────────────────────────────────────────────────────

  const branchesTab = useMemo(
    () => (
      <div className="space-y-4">
        {showBranchForm && (
          <BranchForm
            t={t}
            branches={branches}
            employees={employees}
            isSubmitting={createBranch.isPending}
            error={branchFormError}
            onSubmit={handleCreateBranch}
            onCancel={() => {
              setShowBranchForm(false)
              setBranchFormError(null)
            }}
          />
        )}

        <BranchTreeView
          t={t}
          nodes={branchTree}
          isLoading={isLoadingTree}
          onSelectEmployee={handleViewEmployee}
          onAddBranch={() => setShowBranchForm(true)}
          // Creating a branch is owner-only in the service. The button is shown
          // to everyone and the server refuses — rather than hiding it and
          // leaving a manager wondering where the feature went. The refusal
          // carries a code the form displays.
          canAddBranch
        />
      </div>
    ),
    [
      t,
      branches,
      employees,
      branchTree,
      isLoadingTree,
      showBranchForm,
      branchFormError,
      createBranch.isPending,
      handleCreateBranch,
      handleViewEmployee,
    ],
  )

  return (
    <TeamAndPayrollView
      t={t}
      employees={employees}
      payrollRecords={payrollRecords}
      totalEmployees={totalEmployees}
      totalPayroll={totalPayroll}
      isLoadingEmployees={isLoadingEmployees}
      isLoadingPayroll={isLoadingPayroll}
      statusFilter={tab}
      onStatusChange={setTab}
      onViewEmployee={handleViewEmployee}
      onViewPayroll={handleViewPayroll}
      onCreateEmployee={handleCreateEmployee}
      onDeleteEmployee={handleDeleteEmployee}
      branches={branches}
      branchesTab={branchesTab}
      employeeFormError={employeeFormError}
    />
  )
}
