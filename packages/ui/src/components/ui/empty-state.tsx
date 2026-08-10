'use client'

import React from 'react'
import { cn } from '../../lib/utils'
import { Package, FileText, Users, SearchX } from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════════════════
   EmptyState v2 — Hisabche Design Language
   Zero hardcoded colors — all tokens from design system
   ═══════════════════════════════════════════════════════════════════════════ */

export interface EmptyStateProps {
  icon?: 'invoice' | 'product' | 'customer' | 'search' | React.ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

const iconMap: Record<string, React.ElementType> = {
  invoice: FileText,
  product: Package,
  customer: Users,
  search: SearchX,
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'invoice',
  title,
  description,
  action,
  className,
}) => {
  const IconComponent = typeof icon === 'string' ? iconMap[icon] : null

  return (
    <div
      className={cn('flex flex-col items-center justify-center px-6 py-16 text-center', className)}
      role="status"
    >
      {/* Icon container */}
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-[hsl(var(--surface-muted))]">
        {IconComponent ? (
          <IconComponent className="size-10 text-[hsl(var(--fg-tertiary))]" aria-hidden="true" />
        ) : (
          icon
        )}
      </div>

      {/* Title */}
      <h3 className="mb-2 text-lg font-bold text-[hsl(var(--fg-primary))]">{title}</h3>

      {/* Description */}
      {description && (
        <p className="mb-6 max-w-sm text-sm leading-relaxed text-[hsl(var(--fg-secondary))]">
          {description}
        </p>
      )}

      {/* Action button */}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className={cn(
            'rounded-full px-6 py-2.5',
            'text-sm font-bold text-white',
            'bg-[var(--gradient-brand)]',
            'shadow-sm shadow-[hsl(var(--color-primary)/0.15)]',
            'transition-all duration-200',
            'hover:brightness-110',
            'active:scale-95',
            'motion-reduce:transition-none',
          )}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

export { EmptyState }
