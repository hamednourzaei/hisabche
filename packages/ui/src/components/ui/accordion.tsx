'use client'

import * as React from 'react'
import * as AccordionPrimitive from '@radix-ui/react-accordion'
import { cn } from '../../lib/utils'
import { ChevronDown } from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════════════════
   Accordion v2 — Hisabche Design Language
   Zero hardcoded colors — all tokens from design system
   Radix-based (matching rest of codebase)
   Full RTL via logical CSS
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── Root ──────────────────────────────────────────────────────────────────

function Accordion({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Root>) {
  return (
    <AccordionPrimitive.Root
      data-slot="accordion"
      className={cn('flex w-full flex-col', className)}
      {...props}
    />
  )
}

// ─── Item ──────────────────────────────────────────────────────────────────

function AccordionItem({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn('border-b border-[hsl(var(--border-default))] last:border-b-0', className)}
      {...props}
    />
  )
}

// ─── Trigger ───────────────────────────────────────────────────────────────

function AccordionTrigger({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          // Base
          'group flex flex-1 items-center justify-between gap-3',
          'py-3 text-sm font-semibold text-start',
          'transition-all duration-200',
          'motion-reduce:transition-none',
          // Colors
          'text-[hsl(var(--fg-primary))]',
          'hover:text-[hsl(var(--color-primary))]',
          // Focus
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring-color)/0.5)] focus-visible:ring-offset-1',
          // Disabled
          'disabled:pointer-events-none disabled:opacity-40',
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDown
          className={cn(
            'size-4 shrink-0',
            'text-[hsl(var(--fg-tertiary))]',
            'transition-transform duration-300',
            'group-data-[state=open]:rotate-180',
            'motion-reduce:transition-none',
          )}
          aria-hidden="true"
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}

// ─── Content ───────────────────────────────────────────────────────────────

function AccordionContent({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      data-slot="accordion-content"
      className={cn(
        'overflow-hidden',
        'data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down',
        'motion-reduce:animate-none',
      )}
      {...props}
    >
      <div
        className={cn(
          'pb-4 pt-1',
          'text-sm leading-relaxed',
          'text-[hsl(var(--fg-secondary))]',
          className,
        )}
      >
        {children}
      </div>
    </AccordionPrimitive.Content>
  )
}

// ═══════════════════════════════════════════════════════════════════════════

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
