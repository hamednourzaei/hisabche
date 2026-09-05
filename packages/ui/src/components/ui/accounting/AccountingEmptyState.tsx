// packages/ui/src/components/ui/accounting/AccountingEmptyState.tsx
'use client'

import { memo } from 'react'
import { FileQuestion } from 'lucide-react'
import { cn } from '../../../lib/utils'

interface AccountingEmptyStateProps {
  title: string
  subtitle?: string
  action?: React.ReactNode
  className?: string
}

export const AccountingEmptyState = memo(function AccountingEmptyState({
  title,
  subtitle,
  action,
  className,
}: AccountingEmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center py-8 md:py-12 lg:py-16 px-4',
        className,
      )}
    >
      <div className="w-10 h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 rounded-full bg-[hsl(var(--surface-muted))] flex items-center justify-center mb-3 md:mb-4">
        <FileQuestion
          className="size-5 md:size-6 lg:size-7 text-[hsl(var(--fg-tertiary))]"
          aria-hidden="true"
        />
      </div>
      <p className="text-xs md:text-sm lg:text-base font-medium text-[hsl(var(--fg-primary))]">
        {title}
      </p>
      {subtitle && (
        <p className="text-sm text-[hsl(var(--fg-tertiary))] mt-1 max-w-xs md:max-w-sm">
          {subtitle}
        </p>
      )}
      {action && <div className="mt-3 md:mt-4">{action}</div>}
    </div>
  )
})
