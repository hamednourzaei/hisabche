'use client'

// ============================================
// packages/ui/src/components/ui/governance/containers/governance-hub-container.tsx
//
// Organisation and control — who must approve, and what each role may do.
//
// Two tabs, each the container that already owns that concern:
//
//   approvals    ApprovalsContainer    workflow instances and templates
//   permissions  PermissionsContainer  roles × modules, the capability matrix
//
// Owner, 18 Oct 2026: «نمای کلی»، «اعضا»، «تفکیک وظایف» and «گزارش فعالیت»
// were removed from here. Members are managed on the team page
// (HrContainer → WorkspaceContainer) and the change history is the
// «سابقه تغییرات» tab of /activities — one place each, not two. An old
// `?tab=` for a removed part opens the first tab.
//
// Only the ACTIVE tab is mounted. Nothing is enforced here: every action is
// authorized by the server.
// ============================================

import { memo, useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ClipboardCheck, KeyRound } from 'lucide-react'

import { CapabilityHeader, CapabilityPage } from '../../capability/capability-kit'
import { HubTabs } from '../../hub-tabs'
import { PermissionsContainer } from '../../permissions/containers/permissions-container'
import { ApprovalsContainer } from '../../workflow/containers/approvals-container'

export const GOVERNANCE_TABS = ['approvals', 'permissions'] as const
export type GovernanceTab = (typeof GOVERNANCE_TABS)[number]
const GOVERNANCE_TAB_ICON = { approvals: ClipboardCheck, permissions: KeyRound } as const

/** A removed part (overview, members, sod, audit) or no tab at all opens the first. */
export function governanceTabOf(value: string | null): GovernanceTab {
  return value !== null && (GOVERNANCE_TABS as readonly string[]).includes(value)
    ? (value as GovernanceTab)
    : 'approvals'
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
  const active = governanceTabOf(searchParams.get('tab'))

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
        description={t('governance.hub_subtitle_short', 'قوانین تأیید و دسترسی‌ها')}
      />

      <HubTabs
        label={t('governance.hub_title', 'حاکمیت سازمان')}
        items={GOVERNANCE_TABS.map((id) => ({
          id,
          label: t(`governance.tab_${id}`, id),
          icon: GOVERNANCE_TAB_ICON[id],
        }))}
        active={active}
        onSelect={select}
      />

      <div role="tabpanel">
        {active === 'approvals' ? <ApprovalsContainer /> : null}
        {active === 'permissions' ? <PermissionsContainer /> : null}
      </div>
    </CapabilityPage>
  )
})

GovernanceHubContainer.displayName = 'GovernanceHubContainer'
