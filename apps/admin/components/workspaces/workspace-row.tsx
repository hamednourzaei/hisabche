'use client'

import { useId, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronLeft, Users } from 'lucide-react'
import { Badge, Button } from '@/components/ui'
import { cn } from '@/lib/utils'

import { MemberList } from '@/components/members/member-list'
import type { AdminWorkspace } from '@/hooks/use-admin-workspaces'
import { useAdminLocale } from '@/hooks/use-admin-locale'
import { adminNumber } from '@/lib/admin-format'

export function WorkspaceRow({
  workspace,
  onOpen360,
}: {
  workspace: AdminWorkspace
  onOpen360?: (id: string) => void
}) {
  const t = useTranslations()
  const [expanded, setExpanded] = useState(false)
  const regionId = useId()

  return (
    <li
      className={cn(
        'overflow-hidden rounded-2xl border bg-card transition-colors',
        expanded ? 'border-blue-500/50' : 'border-border hover:border-border-strong',
      )}
    >
      <div className="flex items-center justify-between p-4">
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          aria-controls={regionId}
          className="flex min-w-0 flex-1 items-center gap-3 text-start transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 sm:gap-4"
        >
          <ChevronLeft
            aria-hidden="true"
            className={cn(
              'h-5 w-5 shrink-0 text-muted-foreground transition-transform rtl:-scale-x-100',
              expanded && '-rotate-90',
            )}
          />

          <span
            aria-hidden="true"
            className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/25 to-violet-500/25 text-sm font-bold text-blue-400 sm:flex"
          >
            {workspace.name.trim().charAt(0).toUpperCase() || '—'}
          </span>

          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{workspace.name}</div>
            <div className="mt-0.5 truncate text-sm text-muted-foreground">
              {t('admin.workspaces.owner')}:{' '}
              {workspace.ownerName ?? workspace.ownerEmail ?? t('admin.workspaces.noOwner')}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2 sm:hidden">
              <StatusBadge active={workspace.is_active} />
              <Badge variant="secondary">
                {workspace.plan ?? t('admin.workspaces.noSubscription')}
              </Badge>
              <MemberCount count={workspace.memberCount} label={t('admin.workspaces.members')} />
            </div>
          </div>

          <div className="hidden shrink-0 items-center gap-3 sm:flex">
            <Badge variant="secondary">
              {workspace.plan ?? t('admin.workspaces.noSubscription')}
            </Badge>
            <StatusBadge active={workspace.is_active} />
            <MemberCount count={workspace.memberCount} label={t('admin.workspaces.members')} />
          </div>
        </button>

        {onOpen360 && (
          <Button
            variant="outline"
            size="sm"
            className="ms-3 shrink-0 text-xs"
            onClick={() => onOpen360(workspace.id)}
          >
            {t('admin.customers.view360')}
          </Button>
        )}
      </div>

      {/*
        Rendered only while open. Keeping it mounted-but-hidden would leave the
        member rows in the tab order and readable by a screen reader while
        visually collapsed.
      */}
      {expanded && (
        <div className="border-t border-border bg-background/40 px-2 pb-2">
          <MemberList
            workspaceId={workspace.id}
            workspaceName={workspace.name}
            expanded={expanded}
            regionId={regionId}
          />
        </div>
      )}
    </li>
  )
}

function StatusBadge({ active }: { active: boolean }) {
  const t = useTranslations()
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium',
        active
          ? 'border-success/40 bg-success/10 text-success'
          : 'border-border bg-accent text-muted-foreground',
      )}
    >
      <span
        className={cn('h-1.5 w-1.5 rounded-full', active ? 'bg-success' : 'bg-muted-foreground')}
        aria-hidden="true"
      />
      {active ? t('admin.workspaces.active') : t('admin.workspaces.inactive')}
    </span>
  )
}

function MemberCount({ count, label }: { count: number; label: string }) {
  const dateLocale = useAdminLocale()
  return (
    <span className="inline-flex items-center gap-1.5 text-sm tabular-nums text-muted-foreground">
      <Users className="h-4 w-4" aria-hidden="true" />
      <span>{adminNumber(count, dateLocale)}</span>
      <span className="sr-only">{label}</span>
    </span>
  )
}
