'use client'

import * as React from 'react'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { cn } from '../../lib/utils'
import { CheckIcon, ChevronRightIcon } from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════════════════
   DropdownMenu v2 — Hisabche Design Language
   "Ledger Ink Reveal" signature interaction for financial operations
   Zero hardcoded colors — all tokens from design system
   Full RTL via logical CSS + Tailwind start/end/ms/me/ps/pe
   Optimized for Redmi 9: only opacity + transform
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── Types ──────────────────────────────────────────────────────────────────

type Tone = 'finance' | 'filter' | 'settings' | 'danger'

type ItemStatus = 'synced' | 'pending' | 'conflict'

interface MenuItemProps extends React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> {
  inset?: boolean
  variant?: 'default' | 'destructive'
  status?: ItemStatus
  description?: string
  shortcut?: string
}

interface LedgerContentProps extends React.ComponentPropsWithoutRef<
  typeof DropdownMenuPrimitive.Content
> {
  tone?: Tone
}

// ─── Hooks ─────────────────────────────────────────────────────────────────

function useIsRTL(): boolean {
  const [isRTL, setIsRTL] = React.useState(false)

  React.useEffect(() => {
    const dir = document.documentElement.getAttribute('dir')
    setIsRTL(dir === 'rtl')
  }, [])

  return isRTL
}

// ─── Primitives (internal, not exported) ───────────────────────────────────

const Root = DropdownMenuPrimitive.Root
const Portal = DropdownMenuPrimitive.Portal
const TriggerPrimitive = DropdownMenuPrimitive.Trigger
const GroupPrimitive = DropdownMenuPrimitive.Group
const SubPrimitive = DropdownMenuPrimitive.Sub
const RadioGroupPrimitive = DropdownMenuPrimitive.RadioGroup

// ─── LedgerDrop ────────────────────────────────────────────────────────────

const LedgerDrop = Root
LedgerDrop.displayName = 'LedgerDrop'

// ─── LedgerTrigger ─────────────────────────────────────────────────────────

const LedgerTrigger = React.forwardRef<
  React.ElementRef<typeof TriggerPrimitive>,
  React.ComponentPropsWithoutRef<typeof TriggerPrimitive> & {
    tone?: Tone
  }
>(({ className, tone = 'filter', children, ...props }, ref) => {
  return (
    <TriggerPrimitive
      ref={ref}
      className={cn(
        // Base
        'inline-flex items-center justify-between gap-2',
        'min-h-[44px] px-4 py-2',
        'text-sm font-medium',
        'rounded-md',
        'bg-[var(--ledger-surface)] text-[var(--ledger-ink)]',
        'border border-[var(--ledger-line)]',
        // States
        'hover:bg-[var(--ledger-surface-raised)]',
        'focus-visible:outline-none focus-visible:ring-2',
        'focus-visible:ring-[var(--ledger-action)] focus-visible:ring-offset-1',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        // Reduced motion
        'transition-colors duration-150',
        'motion-reduce:transition-none',
        // RTL
        'text-start',
        className,
      )}
      {...props}
    >
      <span className="flex-1">{children}</span>
      {/* Caret */}
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        aria-hidden="true"
        className={cn(
          'shrink-0 transition-transform duration-200',
          'text-[var(--ledger-ink-muted)]',
          'motion-reduce:transition-none',
        )}
      >
        <path
          d="M3 4.5L6 7.5L9 4.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </TriggerPrimitive>
  )
})
LedgerTrigger.displayName = 'LedgerTrigger'

// ─── LedgerContent ─────────────────────────────────────────────────────────

const LedgerContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  LedgerContentProps
>(({ className, sideOffset = 8, tone = 'filter', children, ...props }, ref) => {
  return (
    <Portal>
      {/* ── Ink Line (only for finance tone) ── */}
      {tone === 'finance' && (
        <div
          aria-hidden="true"
          className={cn(
            'absolute z-[51] w-px',
            'bg-[var(--ledger-action)]',
            'origin-top',
            'animate-[ledgerInkReveal_300ms_cubic-bezier(0.22,1,0.36,1)_forwards]',
            'motion-reduce:animate-none motion-reduce:hidden',
          )}
          style={
            {
              left: 'var(--radix-dropdown-menu-content-transform-origin)',
              top: 'var(--radix-dropdown-menu-trigger-height)',
              height: 'var(--radix-dropdown-menu-content-available-height)',
              '--tw-translate-y': 'calc(-100% + 0px)',
              transform: 'translateY(var(--tw-translate-y))',
            } as React.CSSProperties
          }
        />
      )}

      {/* ── Content ── */}
      <DropdownMenuPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          // Layout
          'z-50 min-w-[180px] max-w-[320px]',
          'overflow-hidden rounded-lg',
          'p-1',
          // Background & text
          'bg-[var(--ledger-surface-raised)]',
          'text-[var(--ledger-ink)]',
          // Border
          'border border-[var(--ledger-line)]',
          // Shadow
          'shadow-[var(--ledger-shadow,0_4px_24px_rgba(0,0,0,0.08))]',
          // Animation: fade + slide
          'data-[state=open]:animate-in',
          'data-[state=closed]:animate-out',
          'data-[state=closed]:fade-out-0',
          'data-[state=open]:fade-in-0',
          'data-[state=closed]:slide-out-to-top-1',
          'data-[state=open]:slide-in-from-top-1',
          // Reduced motion
          'motion-reduce:animate-none',
          // Ink reveal: delay slightly so ink line draws first
          tone === 'finance' && 'data-[state=open]:animate-[ledgerContentReveal_350ms_ease-out]',
          className,
        )}
        {...props}
      >
        {children}
      </DropdownMenuPrimitive.Content>
    </Portal>
  )
})
LedgerContent.displayName = 'LedgerContent'

// ─── LedgerLabel ───────────────────────────────────────────────────────────

const LedgerLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
    inset?: boolean
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn(
      'px-3 py-2',
      'text-xs font-semibold',
      'text-[var(--ledger-ink-muted)]',
      'uppercase tracking-wider',
      inset && 'ps-10',
      className,
    )}
    {...props}
  />
))
LedgerLabel.displayName = 'LedgerLabel'

// ─── StatusIndicator ───────────────────────────────────────────────────────

function StatusIndicator({ status }: { status: ItemStatus }) {
  const config: Record<ItemStatus, { label: string; color: string; icon: string }> = {
    synced: {
      label: 'همگام‌سازی شده',
      color: 'var(--ledger-action)',
      icon: '✓',
    },
    pending: {
      label: 'در انتظار همگام‌سازی',
      color: 'var(--ledger-ink-muted)',
      icon: '◌',
    },
    conflict: {
      label: 'نیاز به بررسی',
      color: 'var(--ledger-danger)',
      icon: '!',
    },
  }

  const { label, color, icon } = config[status]

  return (
    <span
      role="status"
      aria-label={label}
      className={cn('ms-auto text-xs font-medium', 'flex items-center gap-1')}
      style={{ color }}
    >
      <span aria-hidden="true">{icon}</span>
      <span className="sr-only">{label}</span>
    </span>
  )
}

// ─── LedgerItem ────────────────────────────────────────────────────────────

const LedgerItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  MenuItemProps
>(
  (
    { className, inset, variant = 'default', status, description, shortcut, children, ...props },
    ref,
  ) => {
    return (
      <DropdownMenuPrimitive.Item
        ref={ref}
        className={cn(
          // Base layout
          'relative flex items-center gap-3',
          'min-h-[44px] px-3 py-2',
          'rounded-sm',
          'text-sm leading-tight',
          'cursor-default select-none',
          'outline-none',
          // Colors
          'text-[var(--ledger-ink)]',
          'data-[highlighted]:bg-[var(--ledger-action)]/10 data-[highlighted]:text-[var(--ledger-ink)]',
          // Variants
          variant === 'destructive' &&
            cn(
              'text-[var(--ledger-danger)]',
              'data-[highlighted]:bg-[var(--ledger-danger)]/10',
              'data-[highlighted]:text-[var(--ledger-danger)]',
            ),
          // States
          'data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
          'active:scale-[0.98]',
          // Transitions
          'transition-colors duration-150',
          'motion-reduce:transition-none motion-reduce:active:scale-100',
          // Inset (for submenus)
          inset && 'ps-10',
          className,
        )}
        {...props}
      >
        {children}

        {/* Description — below title when present */}
        {description && (
          <span
            className={cn(
              'text-xs text-[var(--ledger-ink-muted)]',
              'block w-full truncate',
              'mt-0.5',
            )}
          >
            {description}
          </span>
        )}

        {/* Shortcut — right-aligned */}
        {shortcut && (
          <span
            className={cn(
              'ms-auto text-xs tracking-wider',
              'text-[var(--ledger-ink-muted)]',
              'font-mono',
            )}
          >
            {shortcut}
          </span>
        )}

        {/* Sync Status */}
        {status && <StatusIndicator status={status} />}
      </DropdownMenuPrimitive.Item>
    )
  },
)
LedgerItem.displayName = 'LedgerItem'

// ─── LedgerItemWithIcon ────────────────────────────────────────────────────

interface LedgerItemWithIconProps extends MenuItemProps {
  icon: React.ElementType
}

const LedgerItemWithIcon = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  LedgerItemWithIconProps
>(({ icon: Icon, description, shortcut, status, children, ...props }, ref) => (
  <LedgerItem ref={ref} {...props}>
    <div className="flex items-start gap-3 w-full">
      {/* Icon slot */}
      <span className="shrink-0 mt-0.5 text-[var(--ledger-ink-muted)]">
        <Icon className="size-5" />
      </span>

      {/* Text + description */}
      <div className="flex-1 min-w-0">
        <span className="block text-sm font-medium truncate">{children}</span>
        {description && (
          <span className="block text-xs text-[var(--ledger-ink-muted)] mt-0.5 truncate">
            {description}
          </span>
        )}
      </div>

      {/* Shortcut + Status */}
      <div className="flex items-center gap-2 shrink-0">
        {shortcut && (
          <span className="text-xs tracking-wider text-[var(--ledger-ink-muted)] font-mono">
            {shortcut}
          </span>
        )}
        {status && <StatusIndicator status={status} />}
      </div>
    </div>
  </LedgerItem>
))
LedgerItemWithIcon.displayName = 'LedgerItemWithIcon'

// ─── LedgerSubTrigger ──────────────────────────────────────────────────────

const LedgerSubTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
    inset?: boolean
  }
>(({ className, inset, children, ...props }, ref) => {
  return (
    <DropdownMenuPrimitive.SubTrigger
      ref={ref}
      className={cn(
        'flex cursor-default select-none items-center gap-3',
        'min-h-[44px] px-3 py-2',
        'rounded-sm text-sm',
        'text-[var(--ledger-ink)]',
        'data-[highlighted]:bg-[var(--ledger-action)]/10',
        'data-[state=open]:bg-[var(--ledger-action)]/10',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
        'transition-colors duration-150',
        'motion-reduce:transition-none',
        inset && 'ps-10',
        className,
      )}
      {...props}
    >
      <span className="flex-1">{children}</span>
      <ChevronRightIcon
        className={cn('size-4 shrink-0', 'text-[var(--ledger-ink-muted)]', 'rtl:rotate-180')}
        aria-hidden="true"
      />
    </DropdownMenuPrimitive.SubTrigger>
  )
})
LedgerSubTrigger.displayName = 'LedgerSubTrigger'

// ─── LedgerSubContent ──────────────────────────────────────────────────────

const LedgerSubContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.SubContent
    ref={ref}
    className={cn(
      'z-50 min-w-[180px] overflow-hidden rounded-lg',
      'bg-[var(--ledger-surface-raised)]',
      'text-[var(--ledger-ink)]',
      'border border-[var(--ledger-line)]',
      'shadow-[var(--ledger-shadow,0_4px_24px_rgba(0,0,0,0.08))]',
      'p-1',
      // Animation
      'data-[state=open]:animate-in',
      'data-[state=closed]:animate-out',
      'data-[state=closed]:fade-out-0',
      'data-[state=open]:fade-in-0',
      'data-[state=closed]:slide-out-to-start-1',
      'data-[state=open]:slide-in-from-start-1',
      // Reduced motion
      'motion-reduce:animate-none',
      className,
    )}
    {...props}
  />
))
LedgerSubContent.displayName = 'LedgerSubContent'

// ─── LedgerCheckboxItem ────────────────────────────────────────────────────

const LedgerCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, checked = false, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center',
      'min-h-[44px] ps-10 pe-3 py-2',
      'rounded-sm text-sm',
      'text-[var(--ledger-ink)]',
      'data-[highlighted]:bg-[var(--ledger-action)]/10',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
      'transition-colors duration-150',
      'motion-reduce:transition-none',
      className,
    )}
    checked={checked}
    {...props}
  >
    <span className="absolute start-3 flex size-5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <CheckIcon className="size-4 text-[var(--ledger-action)]" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
))
LedgerCheckboxItem.displayName = 'LedgerCheckboxItem'

// ─── LedgerRadioItem ───────────────────────────────────────────────────────

const LedgerRadioItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.RadioItem
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center',
      'min-h-[44px] ps-10 pe-3 py-2',
      'rounded-sm text-sm',
      'text-[var(--ledger-ink)]',
      'data-[highlighted]:bg-[var(--ledger-action)]/10',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
      'transition-colors duration-150',
      'motion-reduce:transition-none',
      className,
    )}
    {...props}
  >
    <span className="absolute start-3 flex size-5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <CheckIcon className="size-4 fill-[var(--ledger-action)] text-[var(--ledger-action)]" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.RadioItem>
))
LedgerRadioItem.displayName = 'LedgerRadioItem'

// ─── LedgerSeparator ───────────────────────────────────────────────────────

const LedgerSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn('-mx-1 my-1 h-px', 'bg-[var(--ledger-line)]', className)}
    {...props}
  />
))
LedgerSeparator.displayName = 'LedgerSeparator'

// ─── LedgerShortcut ────────────────────────────────────────────────────────

const LedgerShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn(
        'ms-auto text-xs tracking-wider font-mono',
        'text-[var(--ledger-ink-muted)]',
        className,
      )}
      {...props}
    />
  )
}
LedgerShortcut.displayName = 'LedgerShortcut'

// ─── Backward-compatible aliases (shadcn/ui API) ──────────────────────────

const DropdownMenu = LedgerDrop
const DropdownMenuPortal = Portal
const DropdownMenuTrigger = LedgerTrigger
const DropdownMenuContent = LedgerContent
const DropdownMenuGroup = GroupPrimitive
const DropdownMenuLabel = LedgerLabel
const DropdownMenuItem = LedgerItem
const DropdownMenuCheckboxItem = LedgerCheckboxItem
const DropdownMenuRadioGroup = RadioGroupPrimitive
const DropdownMenuRadioItem = LedgerRadioItem
const DropdownMenuSeparator = LedgerSeparator
const DropdownMenuShortcut = LedgerShortcut
const DropdownMenuSub = SubPrimitive
const DropdownMenuSubTrigger = LedgerSubTrigger
const DropdownMenuSubContent = LedgerSubContent

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export {
  // New API (recommended)
  LedgerDrop,
  LedgerTrigger,
  LedgerContent,
  LedgerLabel,
  LedgerItem,
  LedgerItemWithIcon,
  LedgerSubTrigger,
  LedgerSubContent,
  LedgerCheckboxItem,
  LedgerRadioItem,
  LedgerSeparator,
  LedgerShortcut,
  // Backward-compatible aliases (shadcn/ui API)
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
}

export type { Tone, ItemStatus, MenuItemProps, LedgerContentProps, LedgerItemWithIconProps }
