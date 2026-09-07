'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'

/* ═══════════════════════════════════════════════════════════════════════════
   Modal v2 — Hisabche Design Language
   Zero hardcoded colors — all tokens from design system
   Full RTL via logical CSS
   Optimized for Redmi 9: no backdrop-blur, no zoom, only opacity + transform
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── Root ──────────────────────────────────────────────────────────────────

const Modal = DialogPrimitive.Root
const ModalTrigger = DialogPrimitive.Trigger
const ModalPortal = DialogPrimitive.Portal
const ModalClose = DialogPrimitive.Close

// ─── Overlay ───────────────────────────────────────────────────────────────

const ModalOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      // Layout
      'fixed inset-0 z-50',
      // Color — zero hardcoded
      'bg-[hsl(var(--fg-primary))]/40',
      // Animation: fade only
      'data-[state=open]:animate-in',
      'data-[state=closed]:animate-out',
      'data-[state=closed]:fade-out-0',
      'data-[state=open]:fade-in-0',
      // Reduced motion
      'motion-reduce:animate-none',
      className,
    )}
    {...props}
  />
))
ModalOverlay.displayName = 'ModalOverlay'

// ─── Content ───────────────────────────────────────────────────────────────

interface ModalContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  size?: 'sm' | 'md' | 'lg'
}

const ModalContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  ModalContentProps
>(({ className, size = 'md', children, ...props }, ref) => {
  const sizeClasses: Record<string, string> = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
  }

  return (
    <ModalPortal>
      <ModalOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          // Layout
          'fixed z-50 grid w-full gap-4',
          // Center — logical (no left/translate-x hardcoding)
          'start-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
          // Scroll
          'max-h-[90vh] overflow-y-auto',
          // Spacing
          'p-6',
          // Colors — zero hardcoded
          'rounded-xl',
          'border border-[hsl(var(--border-default))]',
          'bg-[hsl(var(--surface-elevated))] text-[hsl(var(--fg-primary))]',
          // Shadow
          'shadow-[var(--ledger-shadow,0_4px_24px_rgba(0,0,0,0.12))]',
          // Animation: fade + slide (no zoom)
          'duration-200',
          'data-[state=open]:animate-in',
          'data-[state=closed]:animate-out',
          'data-[state=closed]:fade-out-0',
          'data-[state=open]:fade-in-0',
          'data-[state=closed]:slide-out-to-top-1',
          'data-[state=open]:slide-in-from-top-1',
          // Reduced motion
          'motion-reduce:animate-none',
          // Size
          sizeClasses[size],
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </ModalPortal>
  )
})
ModalContent.displayName = 'ModalContent'

// ─── Header ────────────────────────────────────────────────────────────────

const ModalHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex items-center justify-between gap-4', className)} {...props} />
)
ModalHeader.displayName = 'ModalHeader'

// ─── Title ─────────────────────────────────────────────────────────────────

const ModalTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-bold', 'text-[hsl(var(--fg-primary))]', 'leading-tight', className)}
    {...props}
  />
))
ModalTitle.displayName = 'ModalTitle'

// ─── Description ───────────────────────────────────────────────────────────

const ModalDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm', 'text-[hsl(var(--fg-tertiary))]', className)}
    {...props}
  />
))
ModalDescription.displayName = 'ModalDescription'

// ─── Close Button ──────────────────────────────────────────────────────────

const ModalCloseButton = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Close>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Close
    ref={ref}
    className={cn(
      // Base
      'rounded-full p-1.5',
      // Colors
      'text-[hsl(var(--fg-tertiary))]',
      'hover:bg-[hsl(var(--fg-primary))]/5 hover:text-[hsl(var(--fg-primary))]',
      // Focus
      'focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))]',
      // Transition
      'transition-colors duration-150',
      'motion-reduce:transition-none',
      // Touch target
      'min-h-[44px] min-w-[44px] flex items-center justify-center',
      className,
    )}
    aria-label="بستن"
    {...props}
  >
    <X className="size-4" aria-hidden="true" />
  </DialogPrimitive.Close>
))
ModalCloseButton.displayName = 'ModalCloseButton'

// ─── Body ──────────────────────────────────────────────────────────────────

const ModalBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('space-y-4', className)} {...props} />
)
ModalBody.displayName = 'ModalBody'

// ─── Footer ────────────────────────────────────────────────────────────────

const ModalFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex items-center justify-end gap-3 pt-2', className)} {...props} />
)
ModalFooter.displayName = 'ModalFooter'

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export {
  Modal,
  ModalTrigger,
  ModalPortal,
  ModalClose,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
}

export type { ModalContentProps }
