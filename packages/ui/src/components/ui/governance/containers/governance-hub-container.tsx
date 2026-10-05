'use client'

// ============================================
// packages/ui/src/components/ui/governance/containers/governance-hub-container.tsx
//
// Governance — who has access, what they can do, who must approve, who did
// what.
//
// ---------------------------------------------------------------------------
// A HUB OVER THE CANONICAL SCREENS, NOT A SECOND GOVERNANCE SYSTEM
//
// Every tab mounts the container that already owns that concern:
//
//   members      WorkspaceContainer    workspace_members (membership ≠ employee)
//   permissions  PermissionsContainer  roles × modules, the capability matrix
//   approvals    ApprovalsContainer    workflow instances
//   sod          GovernanceContainer   separation-of-duties policy + overrides
//   audit        AuditContainer        audit_logs, workspace-scoped
//
// The overview reads only counts those same hooks already return. Nothing
// here is fetched twice under a different name, and nothing is enforced here:
// every action on every tab is authorized by the server.
//
// Only the ACTIVE tab is mounted, so opening the page does not fetch the
// member list, the matrix, the approvals and the audit log at once.
// ============================================

import { memo, useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ShieldCheck, Users, KeyRound, ClipboardCheck, Scale } from 'lucide-react'
import {
  asList,
  useAuditTrail,
  usePermissionMatrix,
  useSoD,
  useSoDOverrides,
  useWorkflowInstances,
  useWorkspaceMembers,
} from '@hisabche/api'
import { useWorkspaceStore } from '@hisabche/store'

import { useDateFormat } from '../../../../hooks/use-date-format'
import { CapabilityHeader, CapabilityPage, Panel, Stat } from '../../capability/capability-kit'
import { Skeleton } from '../../skeleton'
import { HubTabs } from '../../hub-tabs'
import { SegmentedControl } from '../../segmented-control'
import { WorkspaceContainer } from '../../workspace/containers/workspace-container'
import { PermissionsContainer } from '../../permissions/containers/permissions-container'
import { ApprovalsContainer } from '../../workflow/containers/approvals-container'
import { AuditContainer } from '../../audit/containers/audit-container'
import { GovernanceContainer } from './governance-container'

const TABS = ['overview', 'members', 'permissions', 'approvals', 'sod', 'audit'] as const
type GovernanceTab = (typeof TABS)[number]

/** The six parts in two groups — two tabs on top, one switch under them. */
export const GOVERNANCE_GROUPS = {
  people: ['overview', 'members', 'permissions'],
  control: ['approvals', 'sod', 'audit'],
} as const
export type GovernanceGroup = keyof typeof GOVERNANCE_GROUPS
const GOVERNANCE_GROUP_ORDER: readonly GovernanceGroup[] = ['people', 'control']
const GOVERNANCE_GROUP_ICON = { people: Users, control: Scale } as const

export function governanceGroupOf(tab: string): GovernanceGroup {
  return (GOVERNANCE_GROUPS.control as readonly string[]).includes(tab) ? 'control' : 'people'
}

function isTab(value: string | null): value is GovernanceTab {
  return value !== null && (TABS as readonly string[]).includes(value)
}

export const GovernanceHubContainer = memo(function GovernanceHubContainer() {
  const translate = useTranslations()
  const t = useCallback(
    (key: string, fallback?: string): string => {
      const value = translate(key as Parameters<typeof translate>[0])
      return value && value !== key ? value : (fallback ?? key)
    },
    [translate],
  )

  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const active: GovernanceTab = isTab(tabParam) ? tabParam : 'overview'

  const select = useCallback(
    (tab: GovernanceTab) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('tab', tab)
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  return (
    <CapabilityPage>
      <CapabilityHeader
        title={t('governance.hub_title', 'حاکمیت سازمان')}
        description={t(
          'governance.hub_subtitle',
          'اعضا، نقش‌ها، دسترسی‌ها، قوانین تأیید، تفکیک وظایف و گزارش فعالیت',
        )}
      />

      <div className="space-y-3">
        <HubTabs
          label={t('governance.hub_title', 'حاکمیت سازمان')}
          items={GOVERNANCE_GROUP_ORDER.map((id) => ({
            id,
            label: t(`governance.group_${id}`, id),
            icon: GOVERNANCE_GROUP_ICON[id],
          }))}
          active={governanceGroupOf(active)}
          // Opening a tab opens its first part.
          onSelect={(next) => select(GOVERNANCE_GROUPS[next][0])}
        />
        <SegmentedControl
          branch
          label={t('governance.hub_title', 'حاکمیت سازمان')}
          options={GOVERNANCE_GROUPS[governanceGroupOf(active)].map((value) => ({
            value,
            label: t(`governance.tab_${value}`, value),
          }))}
          value={active as (typeof GOVERNANCE_GROUPS)[GovernanceGroup][number]}
          onChange={select}
        />
      </div>

      <div role="tabpanel">
        {active === 'overview' ? <GovernanceOverview t={t} onOpen={select} /> : null}
        {active === 'members' ? <WorkspaceContainer /> : null}
        {active === 'permissions' ? <PermissionsContainer /> : null}
        {active === 'approvals' ? <ApprovalsContainer /> : null}
        {active === 'sod' ? <GovernanceContainer /> : null}
        {active === 'audit' ? <AuditContainer /> : null}
      </div>
    </CapabilityPage>
  )
})

GovernanceHubContainer.displayName = 'GovernanceHubContainer'

function GovernanceOverview({
  t,
  onOpen,
}: {
  t: (key: string, fallback?: string) => string
  onOpen: (tab: GovernanceTab) => void
}) {
  const { dateTime } = useDateFormat()
  const workspaceId = useWorkspaceStore((s) => s.workspaceId)
  const members = useWorkspaceMembers(workspaceId ?? '')
  const matrix = usePermissionMatrix()
  const sod = useSoD()
  const overrides = useSoDOverrides()
  const pending = useWorkflowInstances({ status: 'pending', limit: 1 })
  const audit = useAuditTrail({ limit: 5 })

  const memberCount = useMemo(() => asList(members.data).length, [members.data])
  const roleCount = matrix.data?.roles?.length ?? 0
  const activeRules = useMemo(() => {
    const rules = asList<{ id: string }>(sod.data?.rules)
    const disabled = new Set(sod.data?.settings.disabledRules ?? [])
    return rules.filter((r) => !disabled.has(r.id)).length
  }, [sod.data])

  // A count whose read failed is shown as «—», never as 0: «no overrides»
  // when the list could not be read is a reassurance nobody earned.
  const value = (query: { isLoading: boolean; error: unknown }, n: number) =>
    query.isLoading ? <Skeleton className="h-6 w-10" /> : query.error ? '—' : n

  return (
    <div className="space-y-4">
      <section
        aria-label={t('governance.overview_health', 'وضعیت دسترسی سازمان')}
        className="grid grid-cols-2 gap-3 lg:grid-cols-5"
      >
        <button type="button" onClick={() => onOpen('members')} className="text-start">
          <Stat
            icon={Users}
            label={t('governance.kpi_members', 'اعضا')}
            value={value(members, memberCount)}
          />
        </button>
        <button type="button" onClick={() => onOpen('permissions')} className="text-start">
          <Stat
            icon={KeyRound}
            label={t('governance.kpi_roles', 'نقش‌ها')}
            value={value(matrix, roleCount)}
          />
        </button>
        <button type="button" onClick={() => onOpen('approvals')} className="text-start">
          <Stat
            icon={ClipboardCheck}
            label={t('governance.kpi_pending', 'تأییدهای در انتظار')}
            value={value(pending, pending.data?.total ?? 0)}
          />
        </button>
        <button type="button" onClick={() => onOpen('sod')} className="text-start">
          <Stat
            icon={Scale}
            label={t('governance.kpi_sod', 'تفکیک وظایف')}
            value={
              sod.isLoading ? (
                <Skeleton className="h-6 w-16" />
              ) : sod.error ? (
                '—'
              ) : (
                t(
                  `governance.mode_${sod.data?.settings.mode ?? 'off'}`,
                  sod.data?.settings.mode ?? 'off',
                )
              )
            }
            hint={
              sod.data
                ? `${t('governance.kpi_rules_active', 'قانون فعال')}: ${activeRules}`
                : undefined
            }
          />
        </button>
        <button type="button" onClick={() => onOpen('sod')} className="text-start">
          <Stat
            icon={ShieldCheck}
            label={t('governance.kpi_overrides', 'استثناهای ثبت‌شده')}
            value={value(overrides, asList(overrides.data).length)}
          />
        </button>
      </section>

      <Panel
        title={t('governance.recent_activity', 'فعالیت‌های اخیر')}
        action={
          <button
            type="button"
            onClick={() => onOpen('audit')}
            className="min-h-9 rounded-lg px-2 text-sm text-[hsl(var(--color-primary))] hover:underline"
          >
            {t('governance.see_all', 'مشاهده‌ی همه')}
          </button>
        }
      >
        {audit.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : audit.error ? (
          <p className="text-sm text-[hsl(var(--color-destructive))]">
            {t('governance.activity_error', 'دریافت فعالیت‌ها ممکن نشد.')}
          </p>
        ) : asList(audit.data?.data).length === 0 ? (
          <p className="text-sm text-[hsl(var(--fg-tertiary))]">
            {t('governance.activity_empty', 'فعالیتی ثبت نشده است.')}
          </p>
        ) : (
          <ul className="divide-y divide-[hsl(var(--border-default))] text-sm">
            {asList<{ id: string; action: string; entity_type: string; created_at: string }>(
              audit.data?.data,
            ).map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <span className="font-medium">
                    {t(`audit.actions.${row.action}`, row.action)}
                  </span>
                  <span className="ms-2 text-[hsl(var(--fg-secondary))]">
                    {t(`audit.entities.${row.entity_type}`, row.entity_type)}
                  </span>
                </span>
                <span className="text-xs text-[hsl(var(--fg-tertiary))]">
                  {dateTime(row.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
