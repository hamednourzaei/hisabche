'use client'

// ============================================
// «تأییدها» — what waits for a decision, and the rules that send it there, at
// one address: `/approvals`.
//
// Two tabs, and only two:
//
//   requests    what is waiting for this person (the page as it was)
//   workflows   the approval workflows (was /workflow-templates)
//
// They belong together: until a workflow is defined, NOTHING ever reaches the
// first tab — and its empty state now opens the second instead of leaving.
//
// ⚠️ A HUB OVER THE SCREENS THAT ALREADY EXIST. Each tab mounts the container
// that owns it; the hub fetches nothing. The bar and the `?tab=` handling are
// the shared `HubTabs` / `useHubTab`.
// ============================================

import { Suspense, lazy } from 'react'
import { useTranslations } from 'next-intl'
import { ClipboardCheck, ListChecks } from 'lucide-react'

import { HubTabs, useHubTab } from '../../hub-tabs'
import { ApprovalsContainer } from './approvals-container'

const WorkflowTemplatesContainer = lazy(() =>
  import('./workflow-templates-container').then((m) => ({
    default: m.WorkflowTemplatesContainer,
  })),
)

export const APPROVALS_HUB_TABS = ['requests', 'workflows'] as const
export type ApprovalsHubTab = (typeof APPROVALS_HUB_TABS)[number]

const TAB_ICON = { requests: ClipboardCheck, workflows: ListChecks } as const

export function ApprovalsHubContainer() {
  return <ApprovalsHub />
}

function ApprovalsHub() {
  const t = useTranslations()
  const [active, select] = useHubTab(APPROVALS_HUB_TABS)

  return (
    <div className="space-y-4">
      <HubTabs
        label={t('approvalsHub.label')}
        items={APPROVALS_HUB_TABS.map((tab) => ({
          id: tab,
          label: t(`approvalsHub.tabs.${tab}`),
          icon: TAB_ICON[tab],
        }))}
        active={active}
        onSelect={select}
      />

      <div role="tabpanel">
        {active === 'workflows' ? (
          <Suspense
            fallback={
              <p role="status" className="p-4 text-sm text-[hsl(var(--fg-secondary))]">
                {t('approvalsHub.loading')}
              </p>
            }
          >
            <WorkflowTemplatesContainer />
          </Suspense>
        ) : (
          // «تعریف گردش‌کار» opens the other tab — it does not leave the page.
          <ApprovalsContainer onDefineWorkflow={() => select('workflows')} />
        )}
      </div>
    </div>
  )
}
