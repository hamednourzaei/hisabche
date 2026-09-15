'use client'

import * as React from 'react'
import * as SheetPrimitive from '@radix-ui/react-dialog'
import { cn } from '../../lib/utils'
import { X } from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════════════════
   Sheet v2 — Hisabche Design Language
   Zero hardcoded colors — all tokens from design system
   Full RTL via logical CSS (start/end instead of left/right)
   Optimized for Redmi 9: no backdrop-blur, no zoom, only opacity + transform
   ═══════════════════════════════════════════════════════════════════════════ */

const Sheet = SheetPrimitive.Root
const SheetTrigger = SheetPrimitive.Trigger
const SheetPortal = SheetPrimitive.Portal
const SheetClose = SheetPrimitive.Close

// ─── Overlay ───────────────────────────────────────────────────────────────

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50',
      'bg-[hsl(var(--fg-primary)/0.3)]',
      'data-[state=open]:animate-in data-[state=closed]:animate-out',
      'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      'motion-reduce:animate-none',
      className,
    )}
    {...props}
  />
))
SheetOverlay.displayName = 'SheetOverlay'

// ─── Content ───────────────────────────────────────────────────────────────

type SheetSide = 'top' | 'bottom' | 'start' | 'end'

interface SheetContentProps extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content> {
  side?: SheetSide
  showCloseButton?: boolean
}

const sideStyles: Record<SheetSide, string> = {
  top: [
    'inset-x-0 top-0 border-b',
    'data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top',
  ].join(' '),
  bottom: [
    'inset-x-0 bottom-0 border-t',
    'data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
  ].join(' '),
  // ⚠️ tailwindcss-animate defines slide-*-left/right, NOT start/end. The old
  // `slide-in-from-end` classes did not exist, so every side sheet popped in and
  // out with no motion. Physical sides, mirrored for RTL.
  start: [
    'inset-y-0 start-0 h-full w-3/4 border-e sm:max-w-sm',
    'data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left',
    'rtl:data-[state=open]:slide-in-from-right rtl:data-[state=closed]:slide-out-to-right',
  ].join(' '),
  end: [
    'inset-y-0 end-0 h-full w-3/4 border-s sm:max-w-sm',
    'data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right',
    'rtl:data-[state=open]:slide-in-from-left rtl:data-[state=closed]:slide-out-to-left',
  ].join(' '),
}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = 'end', className, children, showCloseButton = true, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <SheetPrimitive.Content
      ref={ref}
      className={cn(
        // Base
        'fixed z-50 gap-4 p-6',
        'shadow-lg',
        // Colors — zero hardcoded
        'bg-[hsl(var(--surface-elevated))] text-[hsl(var(--fg-primary))]',
        'border-[hsl(var(--border-default))]',
        // Animation
        'ease-out',
        'data-[state=open]:duration-300 data-[state=closed]:duration-200',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        // Reduced motion
        'motion-reduce:transition-none motion-reduce:animate-none',
        // Side-specific
        sideStyles[side],
        className,
      )}
      {...props}
    >
      {children}

      {showCloseButton && (
        <SheetPrimitive.Close
          className={cn(
            'absolute end-4 top-4',
            'rounded-full p-1.5',
            'text-[hsl(var(--fg-secondary))]',
            'hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]',
            'focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary)/0.5)]',
            'transition-colors duration-150',
            'motion-reduce:transition-none',
            'min-h-[44px] min-w-[44px] flex items-center justify-center',
          )}
          aria-label="بستن"
        >
          <X className="size-4" aria-hidden="true" />
        </SheetPrimitive.Close>
      )}
    </SheetPrimitive.Content>
  </SheetPortal>
))
SheetContent.displayName = 'SheetContent'

// ─── Header ────────────────────────────────────────────────────────────────

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-2 pb-4', 'text-start', className)} {...props} />
)
SheetHeader.displayName = 'SheetHeader'

// ─── Footer ────────────────────────────────────────────────────────────────

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4', className)}
    {...props}
  />
)
SheetFooter.displayName = 'SheetFooter'

// ─── Title ─────────────────────────────────────────────────────────────────

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn('text-lg font-bold', 'text-[hsl(var(--fg-primary))]', 'leading-tight', className)}
    {...props}
  />
))
SheetTitle.displayName = 'SheetTitle'

// ─── Description ───────────────────────────────────────────────────────────

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn('text-sm', 'text-[hsl(var(--fg-secondary))]', className)}
    {...props}
  />
))
SheetDescription.displayName = 'SheetDescription'

// ═══════════════════════════════════════════════════════════════════════════

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}

export type { SheetSide, SheetContentProps }
