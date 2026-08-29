'use client'

import { useId, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronLeft, Users } from 'lucide-react'
import { Badge } from '@/components/ui'
import { StatusDot } from '@/components/admin-shell/admin-ui'
import { cn } from '@/lib/utils'

import { MemberList } from '@/components/members/member-list'
import type { AdminWorkspace } from '@/hooks/use-admin-workspaces'

/**
 * ONE workspace — the parent row of the hierarchy.
 *
 *   Workspace A
 *   Owner: … ▼
 *       ├ member
 *       └ member
 *
 * The parent must stay visually dominant over its children: it carries the
 * name at full weight on the card surface, while members sit indented on a
 * recessed background inside the expanded region. That contrast is what makes
 * "these people belong to this business" readable at a glance instead of
 * looking like a flat list of unrelated rows.
 *
 * The whole row is ONE semantic button rather than a clickable div, so it is
 * keyboard-reachable and announced correctly. `aria-expanded` and
 * `aria-controls` tie it to the region it opens.
 */
export function WorkspaceRow({ workspace }: { workspace: AdminWorkspace }) {
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
      <button
        type="button"
        // Once expanded, the members stay mounted and cached; toggling only
        // hides them, so re-opening costs no request.
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
        aria-controls={regionId}
        className="flex w-full items-center gap-3 p-4 text-start transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 sm:gap-4"
      >
        {/*
          The chevron rotates rather than swapping glyphs, so the control keeps
          one identity. `rtl:-scale-x-100` mirrors it for Persian and Dari —
          a right-pointing arrow means "opens away from the text", which is the
          opposite direction in RTL.
        */}
        <ChevronLeft
          aria-hidden="true"
          className={cn(
            'h-5 w-5 shrink-0 text-muted-foreground transition-transform rtl:-scale-x-100',
            expanded && '-rotate-90',
          )}
        />

        {/* Avatar cell. The initial of the real name — never a stock logo and
            never an invented brand mark. */}
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

          {/* Mobile card layout: the same secondary facts, stacked under the
              name instead of clipped off the inline-end edge. */}
          <div className="mt-2 flex flex-wrap items-center gap-2 sm:hidden">
            <StatusBadge active={workspace.is_active} />
            <Badge variant="secondary">
              {workspace.plan ?? t('admin.workspaces.noSubscription')}
            </Badge>
            <MemberCount count={workspace.memberCount} label={t('admin.workspaces.members')} />
          </div>
        </div>

        {/* Desktop: the table-like trailing cells. */}
        <div className="hidden shrink-0 items-center gap-3 sm:flex">
          <Badge variant="secondary">
            {workspace.plan ?? t('admin.workspaces.noSubscription')}
          </Badge>
          <StatusBadge active={workspace.is_active} />
          <MemberCount count={workspace.memberCount} label={t('admin.workspaces.members')} />
        </div>

        <span className="sr-only">
          {expanded
            ? t('admin.workspaces.collapse', { name: workspace.name })
            : t('admin.workspaces.expand', { name: workspace.name })}
        </span>
      </button>

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
      <StatusDot tone={active ? 'positive' : 'neutral'} />
      {active ? t('admin.workspaces.active') : t('admin.workspaces.inactive')}
    </span>
  )
}

function MemberCount({ count, label }: { count: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm tabular-nums text-muted-foreground">
      <Users className="h-4 w-4" aria-hidden="true" />
      <span>{count.toLocaleString()}</span>
      <span className="sr-only">{label}</span>
    </span>
  )
}
