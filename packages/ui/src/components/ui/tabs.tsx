'use client'

import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '../../lib/utils'

// ─── Root ──────────────────────────────────────────────────────────────────

const Tabs = TabsPrimitive.Root

// ─── List ──────────────────────────────────────────────────────────────────

type TabsListProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & {
  /**
   * `pill` is the hub bar (default). `underline` is the section bar: a rule
   * under the row and the active item marked by a rule under itself. Both
   * live here so a screen cannot draw a third tab bar of its own.
   */
  variant?: 'pill' | 'underline'
}

const TabsList = React.forwardRef<React.ElementRef<typeof TabsPrimitive.List>, TabsListProps>(
  ({ className, variant = 'pill', ...props }, ref) => (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        'inline-flex items-center gap-1 overflow-x-auto scrollbar-hide',
        variant === 'pill'
          ? 'rounded-xl p-1 bg-[hsl(var(--surface-muted))]'
          : 'w-full justify-start gap-0.5 rounded-none border-b border-[hsl(var(--border-default))] bg-transparent p-0',
        className,
      )}
      {...props}
    />
  ),
)
TabsList.displayName = 'TabsList'

// ─── Trigger ───────────────────────────────────────────────────────────────

type TabsTriggerProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & {
  variant?: 'pill' | 'underline'
}

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  TabsTriggerProps
>(({ className, variant = 'pill', ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'shrink-0 inline-flex items-center justify-center gap-1.5',
      'whitespace-nowrap',
      'text-[hsl(var(--fg-secondary))]',
      'transition-all duration-150',
      'hover:text-[hsl(var(--fg-primary))]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary)/0.4)] focus-visible:ring-offset-1',
      'disabled:pointer-events-none disabled:opacity-40',
      'motion-reduce:transition-none',
      variant === 'pill'
        ? [
            'rounded-lg px-2.5 md:px-3 lg:px-4 py-1 md:py-1.5 lg:py-2',
            'text-[11px] md:text-xs lg:text-sm font-medium',
            'min-h-[28px] md:min-h-[32px] lg:min-h-[36px]',
            'data-[state=active]:bg-[hsl(var(--surface-elevated))]',
            'data-[state=active]:text-[hsl(var(--fg-primary))]',
            'data-[state=active]:shadow-sm',
          ].join(' ')
        : [
            '-mb-px rounded-none border-b-2 border-transparent px-3 py-2.5',
            'text-xs font-bold sm:text-sm',
            'hover:border-[hsl(var(--border-strong))]',
            'data-[state=active]:border-[hsl(var(--color-primary))]',
            'data-[state=active]:bg-transparent',
            'data-[state=active]:text-[hsl(var(--color-primary))]',
            'data-[state=active]:shadow-none',
          ].join(' '),
      className,
    )}
    {...props}
  />
))
TabsTrigger.displayName = 'TabsTrigger'

// ─── Content ───────────────────────────────────────────────────────────────

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn('focus-visible:outline-none', className)}
    {...props}
  />
))
TabsContent.displayName = 'TabsContent'

// ═══════════════════════════════════════════════════════════════════════════

export { Tabs, TabsList, TabsTrigger, TabsContent }
