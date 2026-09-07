'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cn } from '../../lib/utils'
import { X } from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════════════════
   Dialog v3 — Hisabche Design Language
   ✅ Blurred overlay (backdrop-blur-md)
   ✅ Centered content (left-1/2 -translate-x-1/2) — RTL-safe
   ✅ Zoom animation restored for smooth entry
   ✅ Zero hardcoded colors — all tokens from design system
   ═══════════════════════════════════════════════════════════════════════════ */

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal
const DialogClose = DialogPrimitive.Close

// ─── Overlay ───────────────────────────────────────────────────────────────

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50',
      'bg-[hsl(var(--surface-base)/0.6)] backdrop-blur-md',
      'data-[state=open]:animate-in data-[state=closed]:animate-out',
      'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      'motion-reduce:animate-none',
      className,
    )}
    {...props}
  />
))
DialogOverlay.displayName = 'DialogOverlay'

// ─── Content ───────────────────────────────────────────────────────────────

interface DialogContentProps extends React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Content
> {
  showCloseButton?: boolean
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, showCloseButton = true, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // Layout — centered (RTL-safe with left/translate)
        'fixed z-50 w-[calc(100%-32px)] max-w-lg',
        'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
        'grid gap-4 p-6',
        'max-h-[90vh] overflow-y-auto',
        // Colors
        'rounded-2xl',
        'border border-[hsl(var(--border-strong))]',
        'bg-[hsl(var(--surface-elevated))]',
        'text-[hsl(var(--fg-primary))]',
        'shadow-xl',
        // Animation
        'duration-200',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        // Reduced motion
        'motion-reduce:animate-none',
        className,
      )}
      {...props}
    >
      {children}

      {showCloseButton && (
        <DialogPrimitive.Close
          className={cn(
            'absolute end-4 top-4',
            'rounded-full p-1.5',
            'text-[hsl(var(--fg-tertiary))]',
            'hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]',
            'focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary)/0.5)]',
            'transition-colors duration-150',
            'motion-reduce:transition-none',
            'min-h-[44px] min-w-[44px] flex items-center justify-center',
          )}
          aria-label="بستن"
        >
          <X className="size-4" aria-hidden="true" />
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = 'DialogContent'

// ─── Header ────────────────────────────────────────────────────────────────

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-1.5', 'text-start', className)} {...props} />
)
DialogHeader.displayName = 'DialogHeader'

// ─── Footer ────────────────────────────────────────────────────────────────

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col-reverse sm:flex-row sm:justify-end gap-2', className)}
    {...props}
  />
)
DialogFooter.displayName = 'DialogFooter'

// ─── Title ─────────────────────────────────────────────────────────────────

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-bold leading-tight', 'text-[hsl(var(--fg-primary))]', className)}
    {...props}
  />
))
DialogTitle.displayName = 'DialogTitle'

// ─── Description ───────────────────────────────────────────────────────────

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm', 'text-[hsl(var(--fg-secondary))]', className)}
    {...props}
  />
))
DialogDescription.displayName = 'DialogDescription'

// ═══════════════════════════════════════════════════════════════════════════

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}

export type { DialogContentProps }
