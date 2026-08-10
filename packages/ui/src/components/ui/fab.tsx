// packages/ui/src/components/ui/fab.tsx
'use client'

import * as React from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useTranslations } from 'next-intl'
import { cn } from '../../lib/utils'
import { Plus } from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════════════════
   Fab v4 — GPU-safe · CLS-free · i18n-ready
   ═══════════════════════════════════════════════════════════════════════════ */

export interface FabAction {
  id: string
  label: string
  icon: React.ReactNode
  onClick: () => void
  variant?: 'default' | 'primary' | 'destructive'
}

export interface FabProps {
  actions: FabAction[]
  position?: 'bottom-end' | 'bottom-start' | 'bottom-center'
  className?: string
}

const positionStyles: Record<string, string> = {
  'bottom-end': 'bottom-6 end-6',
  'bottom-start': 'bottom-6 start-6',
  'bottom-center': 'bottom-6 start-1/2 -translate-x-1/2',
}

const Fab = React.forwardRef<HTMLDivElement, FabProps>(
  ({ actions, position = 'bottom-end', className }, ref) => {
    const t = useTranslations()
    const [open, setOpen] = React.useState(false)

    const handleAction = React.useCallback((action: FabAction) => {
      action.onClick()
      setOpen(false)
    }, [])

    if (!actions.length) return null

    return (
      <div ref={ref} className={cn('fixed z-50', positionStyles[position], className)}>
        <DropdownMenu.Root open={open} onOpenChange={setOpen}>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              aria-label={open ? t('action.close') : t('action.open')}
              className={cn(
                'flex h-14 w-14 items-center justify-center rounded-full shadow-lg',
                'transition-transform duration-200 motion-reduce:transition-none',
                'active:scale-95',
                open
                  ? 'bg-[hsl(var(--color-destructive))] rotate-45'
                  : 'bg-[var(--gradient-brand)] rotate-0 hover:scale-110 motion-reduce:hover:scale-100',
              )}
            >
              <Plus className="size-6 text-white" aria-hidden="true" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              side="top"
              sideOffset={12}
              align="end"
              className={cn(
                'z-50 min-w-[160px] overflow-hidden rounded-2xl',
                'border border-[hsl(var(--border-strong))]',
                'bg-[hsl(var(--surface-elevated))]',
                'p-1.5 shadow-lg',
                'data-[state=open]:animate-in data-[state=closed]:animate-out',
                'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
                'data-[state=closed]:slide-out-to-bottom-2 data-[state=open]:slide-in-from-bottom-2',
                'motion-reduce:animate-none',
              )}
            >
              {actions.map((action) => (
                <DropdownMenu.Item
                  key={action.id}
                  onClick={() => handleAction(action)}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium outline-none min-h-[44px]',
                    'transition-colors duration-150 motion-reduce:transition-none',
                    action.variant === 'primary' &&
                      'bg-[var(--gradient-brand)] text-white data-[highlighted]:brightness-110',
                    action.variant === 'destructive' &&
                      'text-[hsl(var(--color-destructive))] data-[highlighted]:bg-[hsl(var(--color-destructive)/0.1)]',
                    (!action.variant || action.variant === 'default') &&
                      'text-[hsl(var(--fg-primary))] data-[highlighted]:bg-[hsl(var(--color-primary)/0.08)]',
                  )}
                >
                  <span className="shrink-0">{action.icon}</span>
                  <span>{action.label}</span>
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    )
  },
)

Fab.displayName = 'Fab'

export { Fab }
