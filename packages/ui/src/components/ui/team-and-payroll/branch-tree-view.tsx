'use client'

// ============================================
// packages/ui/src/components/ui/team-and-payroll/branch-tree-view.tsx
//
// G2 — the «شعب» tab: branches nested by parent, each holding its people.
//
// ---------------------------------------------------------------------------
// WHY A NEW COMPONENT
//
// There is no tree or nested-list primitive in this package — the closest is
// the accordion, which is flat by construction. Rather than bend that into a
// recursive shape, this is one small recursive component with no dependencies
// beyond the icons, so a second caller (the department tree, an account tree)
// can take it as-is.
//
// ---------------------------------------------------------------------------
// WHAT IT SHOWS, AND WHY THAT AND NOT MORE
//
// Per branch: the name, its code, who manages it, and how many people call it
// home. Per employee: their name and their position, clickable to their
// profile. That is the org chart. Head count and manager come from the server
// already computed — the client does not sum anything, because a head count
// computed twice is a head count that can disagree with itself.
//
// ---------------------------------------------------------------------------
// RTL
//
// Indentation uses `paddingInlineStart`, not `paddingLeft`. In an RTL layout
// the tree must indent from the RIGHT, and a left-padded tree reads as a
// column of misaligned rows rather than a hierarchy.
// ============================================

import { memo, useCallback, useState } from 'react'
import { Building2, ChevronDown, ChevronLeft, User, Users } from 'lucide-react'

import { cn } from '../../../lib/utils'

export interface BranchTreeEmployee {
  id: string
  employeeCode: string | null
  firstName: string
  lastName: string
  position: string | null
  isPrimary: boolean
}

export interface BranchTreeNodeData {
  id: string
  code: string
  name: string
  parentBranchId: string | null
  isActive: boolean
  managerEmployeeId: string | null
  managerName: string | null
  headCount: number
  employees: BranchTreeEmployee[]
  children: BranchTreeNodeData[]
}

interface BranchTreeViewProps {
  t: (key: string, fallback?: string) => string
  nodes: BranchTreeNodeData[]
  isLoading?: boolean
  onSelectEmployee?: (employeeId: string) => void
  onAddBranch?: () => void
  /** Owner-only in the service; hidden rather than disabled when absent. */
  canAddBranch?: boolean
}

// ─── One branch, and everything under it ────────────────────────────────────

interface NodeProps {
  t: (key: string, fallback?: string) => string
  node: BranchTreeNodeData
  depth: number
  onSelectEmployee?: ((employeeId: string) => void) | undefined
}

const BranchNode = memo(function BranchNode({ t, node, depth, onSelectEmployee }: NodeProps) {
  // Open at the top two levels: a chain's regions and its shops are what
  // someone opening this tab came to see. Deeper levels start closed so a large
  // organisation does not render as a wall.
  const [open, setOpen] = useState(depth < 2)

  const toggle = useCallback(() => setOpen((prev) => !prev), [])

  const hasChildren = node.children.length > 0 || node.employees.length > 0
  const Chevron = open ? ChevronDown : ChevronLeft

  return (
    <li>
      <div
        // Indent from the inline start so the hierarchy reads correctly in RTL.
        style={{ paddingInlineStart: `${depth * 1.25}rem` }}
        className="flex items-center gap-2 rounded-xl px-2 py-2 transition-colors hover:bg-[hsl(var(--surface-muted))]"
      >
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-label={open ? t('action.collapse', 'بستن') : t('action.expand', 'باز کردن')}
          disabled={!hasChildren}
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-[hsl(var(--fg-tertiary))] transition-colors hover:bg-[hsl(var(--surface-base))] disabled:opacity-0"
        >
          <Chevron className="size-4" aria-hidden />
        </button>

        <Building2
          className={cn(
            'size-4 shrink-0',
            node.isActive ? 'text-[hsl(var(--color-primary))]' : 'text-[hsl(var(--fg-tertiary))]',
          )}
          aria-hidden
        />

        <span className="font-semibold text-[hsl(var(--fg-primary))]">{node.name}</span>

        <span className="rounded-md bg-[hsl(var(--surface-muted))] px-1.5 py-0.5 font-mono text-xs text-[hsl(var(--fg-tertiary))]">
          {node.code}
        </span>

        {!node.isActive && (
          <span className="rounded-md bg-[hsl(var(--fg-tertiary)/0.12)] px-1.5 py-0.5 text-xs text-[hsl(var(--fg-tertiary))]">
            {t('branch.inactive', 'غیرفعال')}
          </span>
        )}

        {node.managerName && (
          <span className="flex items-center gap-1 text-xs text-[hsl(var(--fg-secondary))]">
            <User className="size-3" aria-hidden />
            {node.managerName}
          </span>
        )}

        <span className="ms-auto flex items-center gap-1 text-xs text-[hsl(var(--fg-tertiary))]">
          <Users className="size-3" aria-hidden />
          {/*
            Head count comes from the server. Counting `node.employees.length`
            here would disagree with it for anyone on a temporary posting —
            they appear in the list but are counted at their home branch.
          */}
          {node.headCount}
        </span>
      </div>

      {open && (
        <>
          {node.employees.length > 0 && (
            <ul className="space-y-0.5">
              {node.employees.map((employee) => (
                <li key={employee.id}>
                  <button
                    type="button"
                    onClick={() => onSelectEmployee?.(employee.id)}
                    style={{ paddingInlineStart: `${(depth + 1) * 1.25 + 1.5}rem` }}
                    className="flex w-full items-center gap-2 rounded-xl py-1.5 pe-2 text-start text-sm transition-colors hover:bg-[hsl(var(--surface-muted))]"
                  >
                    <User
                      className="size-3.5 shrink-0 text-[hsl(var(--fg-tertiary))]"
                      aria-hidden
                    />
                    <span className="text-[hsl(var(--fg-primary))]">
                      {employee.firstName} {employee.lastName}
                    </span>
                    {employee.position && (
                      <span className="text-xs text-[hsl(var(--fg-tertiary))]">
                        {employee.position}
                      </span>
                    )}
                    {!employee.isPrimary && (
                      <span className="rounded-md bg-[hsl(var(--color-warning)/0.12)] px-1.5 py-0.5 text-xs text-[hsl(var(--color-warning))]">
                        {t('branch.temporaryPosting', 'موقت')}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {node.children.length > 0 && (
            <ul className="space-y-0.5">
              {node.children.map((child) => (
                <BranchNode
                  key={child.id}
                  t={t}
                  node={child}
                  depth={depth + 1}
                  onSelectEmployee={onSelectEmployee}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </li>
  )
})

// ─── The tab ────────────────────────────────────────────────────────────────

export const BranchTreeView = memo(function BranchTreeView({
  t,
  nodes,
  isLoading = false,
  onSelectEmployee,
  onAddBranch,
  canAddBranch = false,
}: BranchTreeViewProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[hsl(var(--fg-primary))]">
          {t('branch.tree', 'ساختار شعب')}
        </h2>

        {canAddBranch && onAddBranch && (
          <button
            type="button"
            onClick={onAddBranch}
            className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--color-primary))] px-4 py-2 text-sm font-bold text-[hsl(var(--color-primary-fg))] transition hover:brightness-110"
          >
            <Building2 className="size-4" aria-hidden />
            {t('branch.add', 'افزودن شعبه')}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-xl bg-[hsl(var(--surface-muted))]" />
          ))}
        </div>
      ) : nodes.length === 0 ? (
        <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-12 text-center">
          <Building2 className="mx-auto mb-3 size-12 text-[hsl(var(--fg-tertiary))]" aria-hidden />
          <p className="mb-1 text-[hsl(var(--fg-secondary))]">
            {t('branch.empty', 'هنوز شعبه‌ای ثبت نشده')}
          </p>
          <p className="text-sm text-[hsl(var(--fg-tertiary))]">
            {t(
              'branch.emptyHint',
              'یک کسب‌وکار تک‌شعبه‌ای هم می‌تواند یک شعبه داشته باشد تا فاکتورها و کارکنانش به آن نسبت داده شوند.',
            )}
          </p>
        </div>
      ) : (
        <ul className="space-y-0.5 rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-3">
          {nodes.map((node) => (
            <BranchNode
              key={node.id}
              t={t}
              node={node}
              depth={0}
              onSelectEmployee={onSelectEmployee}
            />
          ))}
        </ul>
      )}
    </div>
  )
})
