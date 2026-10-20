'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cn } from '../../lib/utils'

/* ═══════════════════════════════════════════════════════════════════════════
   AlertDialog v1 — Hisabche Design Language
   ✅ Built on Dialog primitive with role="alertdialog"
   ✅ Blurred overlay (backdrop-blur-md)
   ✅ Centered content — RTL-safe with logical layout
   ✅ Zero hardcoded colors — all tokens from design system
   ✅ Explicit confirmation for destructive / money actions
   ═══════════════════════════════════════════════════════════════════════════ */

const AlertDialog = DialogPrimitive.Root
const AlertDialogTrigger = DialogPrimitive.Trigger
const AlertDialogPortal = DialogPrimitive.Portal

const AlertDialogOverlay = React.forwardRef<
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
AlertDialogOverlay.displayName = 'AlertDialogOverlay'

const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      role="alertdialog"
      className={cn(
        'fixed z-50 w-[calc(100%-32px)] max-w-lg',
        'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
        'grid gap-4 p-6',
        'max-h-[90vh] overflow-y-auto',
        'rounded-2xl',
        'border border-[hsl(var(--border-strong))]',
        'bg-[hsl(var(--surface-elevated))]',
        'text-[hsl(var(--fg-primary))]',
        'shadow-xl',
        'duration-200',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        'motion-reduce:animate-none',
        className,
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </AlertDialogPortal>
))
AlertDialogContent.displayName = 'AlertDialogContent'

const AlertDialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-2 text-start', className)} {...props} />
)
AlertDialogHeader.displayName = 'AlertDialogHeader'

const AlertDialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col-reverse sm:flex-row sm:justify-end gap-2', className)}
    {...props}
  />
)
AlertDialogFooter.displayName = 'AlertDialogFooter'

const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-bold leading-tight text-[hsl(var(--fg-primary))]', className)}
    {...props}
  />
))
AlertDialogTitle.displayName = 'AlertDialogTitle'

const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-[hsl(var(--fg-secondary))]', className)}
    {...props}
  />
))
AlertDialogDescription.displayName = 'AlertDialogDescription'

const AlertDialogAction = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'destructive' }
>(({ className, variant = 'default', ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    className={cn(
      'inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-bold',
      'h-10 px-4 py-2 rounded-full transition-all duration-200',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
      'disabled:pointer-events-none disabled:opacity-40',
      'active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100',
      variant === 'destructive'
        ? 'bg-[hsl(var(--color-destructive))] text-white hover:brightness-110 shadow-sm shadow-[hsl(var(--color-destructive)/0.15)] focus-visible:ring-[hsl(var(--color-destructive)/0.5)]'
        : 'bg-[image:var(--gradient-brand)] text-white hover:brightness-110 shadow-sm shadow-[hsl(var(--color-primary)/0.15)] focus-visible:ring-[hsl(var(--color-primary)/0.5)]',
      className,
    )}
    {...props}
  />
))
AlertDialogAction.displayName = 'AlertDialogAction'

const AlertDialogCancel = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Close>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Close
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium',
      'h-10 px-4 py-2 rounded-full transition-all duration-150',
      'border border-[hsl(var(--border-default))] bg-transparent text-[hsl(var(--fg-secondary))]',
      'hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary)/0.5)] focus-visible:ring-offset-1',
      'disabled:pointer-events-none disabled:opacity-40',
      'motion-reduce:transition-none',
      className,
    )}
    {...props}
  />
))
AlertDialogCancel.displayName = 'AlertDialogCancel'

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
}
