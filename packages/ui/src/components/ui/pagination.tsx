'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react'
import { cn } from '../../lib/utils'

/* ═══════════════════════════════════════════════════════════════════════════
   Pagination v1 — Hisabche Design Language
   ✅ Standard shadcn primitive API
   ✅ RTL logical properties
   ✅ Zero hardcoded colors — tokens only
   ═══════════════════════════════════════════════════════════════════════════ */

const Pagination = ({ className, ...props }: React.ComponentProps<'nav'>) => (
  <nav
    role="navigation"
    aria-label="pagination"
    className={cn('mx-auto flex w-full justify-center', className)}
    {...props}
  />
)
Pagination.displayName = 'Pagination'

const PaginationContent = React.forwardRef<HTMLUListElement, React.ComponentProps<'ul'>>(
  ({ className, ...props }, ref) => (
    <ul ref={ref} className={cn('flex flex-row items-center gap-1', className)} {...props} />
  ),
)
PaginationContent.displayName = 'PaginationContent'

const PaginationItem = React.forwardRef<HTMLLIElement, React.ComponentProps<'li'>>(
  ({ className, ...props }, ref) => <li ref={ref} className={cn('', className)} {...props} />,
)
PaginationItem.displayName = 'PaginationItem'

type PaginationLinkProps = {
  isActive?: boolean
} & React.ButtonHTMLAttributes<HTMLButtonElement>

const PaginationLink = ({ className, isActive, ...props }: PaginationLinkProps) => (
  <button
    aria-current={isActive ? 'page' : undefined}
    type="button"
    className={cn(
      'inline-flex items-center justify-center rounded-xl text-sm font-medium transition-colors min-h-[44px] min-w-[44px] px-3 py-2',
      'border border-[hsl(var(--border-default))]',
      isActive
        ? 'bg-[hsl(var(--color-primary))] text-white border-[hsl(var(--color-primary))] shadow-sm'
        : 'bg-transparent text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]',
      className,
    )}
    {...props}
  />
)
PaginationLink.displayName = 'PaginationLink'

const PaginationPrevious = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof PaginationLink>) => (
  <PaginationLink aria-label="Previous" className={cn('gap-1.5 px-3.5', className)} {...props}>
    <ChevronRight className="size-4 rtl:rotate-180" />
    <span>{children ?? 'Previous'}</span>
  </PaginationLink>
)
PaginationPrevious.displayName = 'PaginationPrevious'

const PaginationNext = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof PaginationLink>) => (
  <PaginationLink aria-label="Next" className={cn('gap-1.5 px-3.5', className)} {...props}>
    <span>{children ?? 'Next'}</span>
    <ChevronLeft className="size-4 rtl:rotate-180" />
  </PaginationLink>
)
PaginationNext.displayName = 'PaginationNext'

const PaginationEllipsis = ({ className, ...props }: React.ComponentProps<'span'>) => (
  <span
    aria-hidden
    className={cn('flex h-9 w-9 items-center justify-center', className)}
    {...props}
  >
    <MoreHorizontal className="size-4 text-[hsl(var(--fg-tertiary))]" />
    <span className="sr-only">More pages</span>
  </span>
)
PaginationEllipsis.displayName = 'PaginationEllipsis'

export interface PaginationBarProps {
  page: number
  pageSize: number
  total: number
  busy?: boolean
  onPage: (page: number) => void
  showingLabel?: string
  previousLabel?: string
  nextLabel?: string
  className?: string
}

export function PaginationBar({
  page,
  pageSize,
  total,
  busy = false,
  onPage,
  showingLabel,
  previousLabel = 'قبلی',
  nextLabel = 'بعدی',
  className,
}: PaginationBarProps) {
  if (total <= pageSize) return null

  const from = total === 0 ? 0 : page * pageSize + 1
  const to = Math.min((page + 1) * pageSize, total)

  return (
    <nav
      aria-label="Pagination"
      className={cn('flex flex-wrap items-center justify-between gap-3', className)}
    >
      <span className="text-sm text-[hsl(var(--fg-secondary))]">
        {showingLabel ??
          `${from.toLocaleString()}–${to.toLocaleString()} از ${total.toLocaleString()}`}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page === 0 || busy}
          onClick={() => onPage(Math.max(0, page - 1))}
          className={cn(
            'inline-flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl px-4 text-sm font-medium transition-colors',
            'border border-[hsl(var(--border-default))] bg-transparent text-[hsl(var(--fg-secondary))]',
            'hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]',
            'disabled:pointer-events-none disabled:opacity-40',
          )}
        >
          <ChevronRight className="size-4 rtl:rotate-180" />
          <span>{previousLabel}</span>
        </button>
        <button
          type="button"
          disabled={to >= total || busy}
          onClick={() => onPage(page + 1)}
          className={cn(
            'inline-flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl px-4 text-sm font-medium transition-colors',
            'border border-[hsl(var(--border-default))] bg-transparent text-[hsl(var(--fg-secondary))]',
            'hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]',
            'disabled:pointer-events-none disabled:opacity-40',
          )}
        >
          <span>{nextLabel}</span>
          <ChevronLeft className="size-4 rtl:rotate-180" />
        </button>
      </div>
    </nav>
  )
}

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
}
