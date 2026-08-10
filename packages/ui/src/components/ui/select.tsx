'use client'

import * as React from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { cn } from '../../lib/utils'
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react'

const Select = SelectPrimitive.Root
const SelectGroup = SelectPrimitive.Group
const SelectValue = SelectPrimitive.Value

// ─── Trigger ───────────────────────────────────────────────────────────────

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      'flex min-h-[44px] w-full items-center justify-between gap-2',
      'rounded-xl px-4 py-2.5 text-sm',
      'border border-[hsl(var(--border-default))]',
      'bg-[hsl(var(--surface-base))] text-[hsl(var(--fg-primary))]',
      'hover:border-[hsl(var(--border-strong))] hover:bg-[hsl(var(--surface-muted))]',
      'focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring-color)/0.4)] focus:ring-offset-1',
      'disabled:cursor-not-allowed disabled:opacity-40',
      'transition-colors duration-200',
      'motion-reduce:transition-none',
      'text-start',
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDownIcon className="size-4 shrink-0 text-[hsl(var(--fg-secondary))]" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = 'SelectTrigger'

// ─── Content ───────────────────────────────────────────────────────────────

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = 'popper', ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      className={cn(
        'relative z-50 min-w-[180px] overflow-hidden rounded-xl',
        'p-1.5',
        'border border-[hsl(var(--border-strong))]',
        'bg-[hsl(var(--surface-elevated))] text-[hsl(var(--fg-primary))]',
        'shadow-lg',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        'data-[side=bottom]:slide-in-from-top-2',
        'data-[side=start]:slide-in-from-end-2',
        'data-[side=end]:slide-in-from-start-2',
        'data-[side=top]:slide-in-from-bottom-2',
        'motion-reduce:animate-none',
        position === 'popper' &&
          'data-[side=bottom]:translate-y-1 data-[side=start]:-translate-x-1 data-[side=end]:translate-x-1 data-[side=top]:-translate-y-1',
        className,
      )}
      {...props}
    >
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport
        className={cn(
          'p-1',
          position === 'popper' &&
            'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]',
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = 'SelectContent'

// ─── Label ─────────────────────────────────────────────────────────────────

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn(
      'px-3 py-2 text-xs font-semibold',
      'text-[hsl(var(--fg-tertiary))]',
      'uppercase tracking-wider',
      className,
    )}
    {...props}
  />
))
SelectLabel.displayName = 'SelectLabel'

// ─── Item ──────────────────────────────────────────────────────────────────

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex w-full cursor-pointer select-none items-center',
      'min-h-[44px] ps-3 pe-10 py-2.5 rounded-lg text-sm',
      'text-[hsl(var(--fg-primary))]',
      'data-[highlighted]:bg-[hsl(var(--color-primary)/0.12)]',
      'data-[highlighted]:text-[hsl(var(--fg-primary))]',
      'data-[state=checked]:bg-[hsl(var(--color-success)/0.1)]',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-30',
      'transition-colors duration-150',
      'motion-reduce:transition-none',
      className,
    )}
    {...props}
  >
    <span className="absolute end-3 flex size-5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <CheckIcon className="size-4 text-[hsl(var(--color-success))]" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = 'SelectItem'

// ─── Separator ─────────────────────────────────────────────────────────────

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn('-mx-1 my-1.5 h-px', 'bg-[hsl(var(--border-default))]', className)}
    {...props}
  />
))
SelectSeparator.displayName = 'SelectSeparator'

// ─── Scroll Buttons ────────────────────────────────────────────────────────

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn(
      'flex cursor-default items-center justify-center py-1.5',
      'text-[hsl(var(--fg-secondary))]',
      'hover:text-[hsl(var(--fg-primary))]',
      className,
    )}
    {...props}
  >
    <ChevronUpIcon className="size-4" />
  </SelectPrimitive.ScrollUpButton>
))
SelectScrollUpButton.displayName = 'SelectScrollUpButton'

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn(
      'flex cursor-default items-center justify-center py-1.5',
      'text-[hsl(var(--fg-secondary))]',
      'hover:text-[hsl(var(--fg-primary))]',
      className,
    )}
    {...props}
  >
    <ChevronDownIcon className="size-4" />
  </SelectPrimitive.ScrollDownButton>
))
SelectScrollDownButton.displayName = 'SelectScrollDownButton'

// ═══════════════════════════════════════════════════════════════════════════

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
}
