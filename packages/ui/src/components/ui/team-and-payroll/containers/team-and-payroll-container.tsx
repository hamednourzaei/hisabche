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

import { useServerFieldErrors } from '../../../../hooks/use-server-field-errors'
import type { PayrollRow } from '../payroll-list-table'
import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'

import {
  useAssignProfile,
  useBranches,
  useBranchTree,
  useCreateBranch,
  useCreateEmployee,
  useCreateMemberDirect,
  useDeleteEmployee,
  useEmployees,
  usePayrolls,
  usePayrollSummary,
  asList,
  usePermissionMatrix,
  useWorkspaces,
  apiErrorMessage,
  apiErrorFields,
} from '@hisabche/api'

import { Users, Wallet } from 'lucide-react'
import { useMyCapabilities } from '@hisabche/api'
import { isNavLocked } from '@hisabche/ui-contract'
import { TeamAndPayrollView, type TeamTab } from '../team-and-payroll-view'
import { BranchTreeView } from '../branch-tree-view'
import { AttendanceSheet } from '../attendance-sheet'
import { BranchForm, type BranchFormValues } from '../branch-form'
import { useLocalePush, useLocaleReplace } from '../../../../hooks/use-locale-push'
import { HubTabs, useHubSection, useHubTab } from '../../hub-tabs'
import { SegmentedControl } from '../../segmented-control'

const TimesheetsContainer = lazy(() =>
  import('../../timesheets/containers/timesheets-container').then((m) => ({
    default: m.TimesheetsContainer,
  })),
)

//
// Four pill tabs and a separate page became two tabs, each with one switch:
//
//   تیم            who works here   — کارمندان · شعب
//   حقوق و حضور    what they are paid and when they worked
//                                   — حقوق · حضور و غیاب · ساعات کار (was /timesheets)
//
// ⚠️ THE SAME SCREENS. The first four are this file's own screen, told which
// part to show; «ساعات کار» mounts the container that owns it. The bar, the
// switch and the address handling are the shared `HubTabs` /
// `SegmentedControl` / `useHubTab` / `useHubSection`.

export const TEAM_HUB_TABS = ['team', 'pay'] as const
export const TEAM_SECTIONS = ['employees', 'branches'] as const
export const PAY_SECTIONS = ['payroll', 'attendance', 'timesheets'] as const

/** The address «ساعات کار» used to live at — the key of its lock in `NAV_MODULE`. */
export const TIMESHEETS_SOURCE = '/timesheets'

const HUB_TAB_ICON = { team: Users, pay: Wallet } as const

/** Where an old `?tab=` value lives now; null when it is not an old value. */
export function teamAddressOf(oldTab: string | null): string | null {
  if (oldTab === 'branches') return '/team-and-payroll?view=branches'
  if (oldTab === 'payroll') return '/team-and-payroll?tab=pay'
  if (oldTab === 'attendance') return '/team-and-payroll?tab=pay&view=attendance'
  return null
}

/** The server's message, or a generic fallback. Never a swallowed error. */

/**
 * The banner's text, or null when every reason is already sitting on a field.
 * Showing both would say the same thing twice, in two places, and make the
 * form look like it has more wrong with it than it does.
 */
function employeeFieldsMessage(error: unknown, fallback: string): string | null {
  return apiErrorFields(error).length > 0 ? null : apiErrorMessage(error, fallback)
}

export function TeamAndPayrollContainer() {
  return <TeamHub />
}

function TeamHub() {
  const t = useTranslations()
  const blocked = useMyCapabilities().data?.blockedModules ?? []
  const paySections = PAY_SECTIONS.filter(
    (section) => section !== 'timesheets' || !isNavLocked(TIMESHEETS_SOURCE, blocked),
  )
  const [tab, selectTab] = useHubTab(TEAM_HUB_TABS)
  const [team, selectTeam] = useHubSection(TEAM_SECTIONS)
  const [pay, selectPay] = useHubSection(paySections)

  const params = useSearchParams()
  const localeReplace = useLocaleReplace()
  const moved = teamAddressOf(params.get('tab'))
  useEffect(() => {
    if (moved) localeReplace(moved)
  }, [moved, localeReplace])

  return (
    <div className="space-y-4">
      <HubTabs
        label={t('teamHub.label')}
        items={TEAM_HUB_TABS.map((id) => ({
          id,
          label: t(`teamHub.tabs.${id}`),
          icon: HUB_TAB_ICON[id],
        }))}
        active={tab}
        onSelect={selectTab}
      />

      <div className="mx-auto max-w-5xl">
        {tab === 'pay' ? (
          <SegmentedControl
            label={t('teamHub.sectionsLabel')}
            options={paySections.map((value) => ({
              value,
              label: t(`teamHub.sections.${value}`),
            }))}
            value={pay}
            onChange={selectPay}
          />
        ) : (
          <SegmentedControl
            label={t('teamHub.sectionsLabel')}
            options={TEAM_SECTIONS.map((value) => ({
              value,
              label: t(`teamHub.sections.${value}`),
            }))}
            value={team}
            onChange={selectTeam}
          />
        )}
      </div>

      <div role="tabpanel">
        {tab === 'pay' && pay === 'timesheets' ? (
          <Suspense
            fallback={
              <p role="status" className="p-4 text-sm text-[hsl(var(--fg-secondary))]">
                {t('teamHub.loading')}
              </p>
            }
          >
            <TimesheetsContainer />
          </Suspense>
        ) : (
          <TeamAndPayrollScreen section={tab === 'pay' ? pay : team} />
        )}
      </div>
    </div>
  )
}

/** The screen itself: the hub says which part shows. */
function TeamAndPayrollScreen({ section }: { section: TeamTab | 'timesheets' }) {
  const tOriginal = useTranslations()
  const t = useCallback(
    (key: string, fallback?: string): string => {
      const v = tOriginal(key as Parameters<typeof tOriginal>[0])
      return v && v !== key ? v : (fallback ?? key)
    },
    [tOriginal],
  )

  const push = useLocalePush()
  // «ساعات کار» is mounted by the hub itself; here it never arrives.
  const tab: TeamTab = section === 'timesheets' ? 'employees' : section

  // ─── Data ─────────────────────────────────────────────────────────────────

  const {
    data: employeesData,
    isLoading: isLoadingEmployees,
    refetch: refetchEmployees,
  } = useEmployees({ page: 1, limit: 20 })

  const { data: payrollData, isLoading: isLoadingPayroll } = usePayrolls()
  // The total is its own server-side sum over every payroll row — not
  // something added up from whatever page of rows happened to arrive.
  const { data: payrollSummary } = usePayrollSummary()

  // The flat list feeds the employee form's branch picker; the tree feeds the
  // «شعب» tab. Two reads because they answer two questions — the picker needs
  // every branch including ones with nobody in them, the tree needs the nesting
  // and the head counts.
  const { data: branches = [] } = useBranches()
  const { data: branchTree = [], isLoading: isLoadingTree } = useBranchTree()

  // ⚠️ Hooks, called during render. This is the fix for the invalid hook calls
  // described at the top of this file.
  const createEmployee = useCreateEmployee()
  const createMemberDirect = useCreateMemberDirect()
  // The account is created under the owner's workspace. `useWorkspaces` is
  // already how `hr-container.tsx` resolves it; same source, same answer.
  const { data: workspaces } = useWorkspaces()
  const workspaceId = workspaces?.[0]?.id as string | undefined
  const deleteEmployee = useDeleteEmployee()
  const createBranch = useCreateBranch()
  const assignProfile = useAssignProfile()

  // G3 — the profiles offered in the employee form.
  //
  // owner/manager/seller are filtered out: they are what the enforced static
  // table decides, and "assigning" one as a profile would add a grant that
  // duplicates the member's own workspace role without changing anything.
  // Profiles are the ones that widen — Accountant, Sales Manager, and so on.
  const { data: matrix } = usePermissionMatrix()
  const permissionProfiles = useMemo(
    () => (Array.isArray(matrix?.roles) ? matrix.roles : []).filter((role) => !role.isEnforcedBase),
    [matrix],
  )

  const [employeeFormError, setEmployeeFormError] = useState<string | null>(null)
  // A refusal that names a field belongs ON that field, with the user taken
  // to it — «هیچ اروری نبود، حتی منم نفهمیدم ارور چی بود».
  const employeeFields = useServerFieldErrors()
  const [branchFormError, setBranchFormError] = useState<string | null>(null)
  const [showBranchForm, setShowBranchForm] = useState(false)

  const employees = employeesData?.employees ?? []
  const totalEmployees = employeesData?.total ?? 0
  // ⚠️ `GET /api/payrolls` returns the ARRAY of rows — there is no `.payrolls`
  // and no `.total` on it. Both reads were `undefined`, so the tab was empty
  // and the total was 0 even once the query above started running.
  const payrollRecords = asList<PayrollRow>(payrollData)
  const totalPayroll = payrollSummary?.total ?? 0

  // ─── Actions ──────────────────────────────────────────────────────────────

  const handleCreateEmployee = useCallback(
    async (
      values: Record<string, unknown>,
      /**
       * Sign-in credentials, present only when the owner switched access on.
       *
       * ⚠️ A SECOND WRITE TO A SECOND ENDPOINT. An employee row and an auth
       * account live in different tables and are created by different
       * services; there is no single call that does both. The employee is
       * created first because it is the thing that must exist either way — if
       * the account fails, a person on the payroll is still on the payroll.
       */
      access?: { email: string; password: string; role: 'admin' | 'member' | 'viewer' },
    ) => {
      setEmployeeFormError(null)
      employeeFields.reset()
      const { permissionProfileId, ...employeeValues } = values as Record<string, unknown> & {
        permissionProfileId?: string
      }

      try {
        const created = (await createEmployee.mutateAsync(employeeValues)) as
          { id?: string; user_id?: string | null } | undefined

        // ─── The account, if one was asked for ───
        //
        // ⚠️ ITS FAILURE MUST NOT READ AS THE EMPLOYEE FAILING. The employee
        // row is already saved by this point. A duplicate email — by far the
        // most likely rejection — would otherwise surface as «ذخیره ناموفق
        // بود» beside a person who was in fact created, and the owner would
        // add them a second time.
        let accessUserId: string | null = null
        if (access && workspaceId) {
          try {
            const member = (await createMemberDirect.mutateAsync({
              workspaceId,
              hasAccess: true,
              email: access.email,
              password: access.password,
              role: access.role,
              fullName: `${values.firstName ?? ''} ${values.lastName ?? ''}`.trim(),
              jobTitle: typeof values.position === 'string' ? values.position : undefined,
            })) as { user_id?: string | null } | undefined
            accessUserId = member?.user_id ?? null
          } catch (error) {
            setEmployeeFormError(
              `${t('team.accountFailed', 'کارمند ثبت شد، ولی ساخت حساب کاربری ناموفق بود')}: ${apiErrorMessage(error, '')}`,
            )
          }
        } else if (access && !workspaceId) {
          setEmployeeFormError(
            t(
              'team.accountNeedsWorkspace',
              'کارمند ثبت شد، ولی حساب کاربری ساخته نشد: فضای کاری پیدا نشد.',
            ),
          )
        }

        // G3 — apply the profile, but ONLY if this employee has a login.
        //
        // A grant is a `user_roles` row keyed to a user. An employee with no
        // account has no user id, so there is nothing to grant to. Rather than
        // failing the whole creation — the employee record is valid and wanted
        // — the person is created and the caller is told the profile did not
        // apply. Silently dropping it would tell them access was granted.
        if (permissionProfileId) {
          // The account just created counts: before this existed, switching
          // access on and choosing a profile in the same submission still
          // reported «this employee has no account yet», because the employee
          // row was read before the account was made.
          const userId = created?.user_id ?? accessUserId
          if (userId) {
            await assignProfile.mutateAsync({
              userId,
              roleId: permissionProfileId,
              replaceExisting: true,
            })
          } else {
            setEmployeeFormError(
              t(
                'team.profileNeedsAccount',
                'کارمند ثبت شد، ولی پروفایل دسترسی اعمال نشد: این کارمند هنوز حساب کاربری ندارد.',
              ),
            )
          }
        }

        await refetchEmployees()
      } catch (error) {
        // Surfaced, not swallowed. A save that fails silently tells the user
        // their employee was created when it was not — and the branch
        // assignment fails loudly on the server when phase-d-01 has not run,
        // which is precisely the message they need to see.
        // Names the field where it can, and falls back to one sentence for
        // the whole form where the failure belongs to no single input.
        employeeFields.report(error, t('common.saveError', 'ذخیره ناموفق بود'))
        setEmployeeFormError(
          employeeFieldsMessage(error, t('common.saveError', 'ذخیره ناموفق بود')),
        )
        throw error
      }
    },
    [
      createEmployee,
      assignProfile,
      createMemberDirect,
      workspaceId,
      refetchEmployees,
      employeeFields,
      t,
    ],
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
        setBranchFormError(apiErrorMessage(error, t('common.saveError', 'ذخیره ناموفق بود')))
      }
    },
    [createBranch, t],
  )

  // G1 moved the employee detail route to /team-and-payroll/:id. This used to
  // push `/team-and-payroll/employee/:id`, which is not a route.
  const handleViewEmployee = useCallback((id: string) => push(`/team-and-payroll/${id}`), [push])

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
      onViewEmployee={handleViewEmployee}
      onCreateEmployee={handleCreateEmployee}
      onDeleteEmployee={handleDeleteEmployee}
      branches={branches}
      permissionProfiles={permissionProfiles}
      branchesTab={branchesTab}
      attendanceTab={tab === 'attendance' ? <AttendanceSheet /> : null}
      employeeFormError={employeeFormError}
      employeeFieldErrors={employeeFields.fields}
    />
  )
}
