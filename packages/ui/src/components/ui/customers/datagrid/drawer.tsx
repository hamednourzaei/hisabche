// packages/ui/src/components/ui/customers/datagrid/drawer.tsx
'use client'

import { X } from 'lucide-react'
import { cn } from '../../../../lib/utils'

interface DrawerProps {
  t: (key: string, fallback?: string) => string
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  width?: string
}

export function Drawer({ t, open, onClose, title, children, width = 'w-[480px]' }: DrawerProps) {
  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[var(--z-overlay)] bg-black/30 backdrop-blur-sm animate-fade-in-up"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          'fixed top-0 end-0 z-[var(--z-modal)] h-full',
          'bg-[hsl(var(--surface-elevated))]',
          'border-s border-[hsl(var(--border-default))]',
          'shadow-[var(--shadow-premium)]',
          'animate-fade-in-up',
          width,
        )}
        style={{ animationDuration: '200ms' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[hsl(var(--border-default))]">
          <h3 className="text-lg font-semibold text-[hsl(var(--fg-primary))]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))] transition-colors"
            aria-label={t('common.close', 'بستن')}
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-5 h-[calc(100%-73px)]">{children}</div>
      </div>
    </>
  )
}
