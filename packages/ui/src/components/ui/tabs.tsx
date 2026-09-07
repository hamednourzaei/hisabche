'use client'

import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '../../lib/utils'

// ─── Root ──────────────────────────────────────────────────────────────────

const Tabs = TabsPrimitive.Root

// ─── List ──────────────────────────────────────────────────────────────────

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'inline-flex items-center gap-1 overflow-x-auto scrollbar-hide',
      'rounded-xl p-1',
      'bg-[hsl(var(--surface-muted))]',
      className,
    )}
    {...props}
  />
))
TabsList.displayName = 'TabsList'

// ─── Trigger ───────────────────────────────────────────────────────────────

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'shrink-0 inline-flex items-center justify-center gap-1.5',
      'rounded-lg px-2.5 md:px-3 lg:px-4 py-1 md:py-1.5 lg:py-2',
      'text-[11px] md:text-xs lg:text-sm font-medium whitespace-nowrap',
      'min-h-[28px] md:min-h-[32px] lg:min-h-[36px]',
      'text-[hsl(var(--fg-secondary))]',
      'transition-all duration-150',
      'hover:text-[hsl(var(--fg-primary))]',
      'data-[state=active]:bg-[hsl(var(--surface-elevated))]',
      'data-[state=active]:text-[hsl(var(--fg-primary))]',
      'data-[state=active]:shadow-sm',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary)/0.4)] focus-visible:ring-offset-1',
      'disabled:pointer-events-none disabled:opacity-40',
      'motion-reduce:transition-none',
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
