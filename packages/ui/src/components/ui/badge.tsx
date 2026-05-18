"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/utils"
import { X } from "lucide-react"

// ============================================
// Badge Variants
// ============================================
const badgeVariants = cva(
  [
    "inline-flex items-center gap-1.5",
    "rounded-full px-2.5 py-0.5",
    "text-xs font-semibold",
    "transition-all duration-[var(--hisab-transition)]",
    "focus:outline-none focus:ring-2 focus:ring-[var(--hisab-ring)] focus:ring-offset-2",
    "select-none",
  ].join(" "),
  {
    variants: {
      variant: {
        default: [
          "bg-[var(--hisab-primary)]/10",
          "text-[var(--hisab-primary)]",
          "border border-[var(--hisab-primary)]/20",
          "hover:bg-[var(--hisab-primary)]/20",
        ].join(" "),
        secondary: [
          "bg-[var(--hisab-secondary)]",
          "text-[var(--hisab-secondary-fg)]",
          "hover:bg-[var(--hisab-secondary)]/80",
        ].join(" "),
        destructive: [
          "bg-[var(--hisab-destructive)]/10",
          "text-[var(--hisab-destructive)]",
          "border border-[var(--hisab-destructive)]/20",
          "hover:bg-[var(--hisab-destructive)]/20",
        ].join(" "),
        success: [
          "bg-[var(--hisab-success)]/10",
          "text-[var(--hisab-success)]",
          "border border-[var(--hisab-success)]/20",
          "hover:bg-[var(--hisab-success)]/20",
        ].join(" "),
        warning: [
          "bg-[var(--hisab-warning)]/10",
          "text-[var(--hisab-warning)]",
          "border border-[var(--hisab-warning)]/20",
          "hover:bg-[var(--hisab-warning)]/20",
        ].join(" "),
        info: [
          "bg-[var(--hisab-info)]/10",
          "text-[var(--hisab-info)]",
          "border border-[var(--hisab-info)]/20",
          "hover:bg-[var(--hisab-info)]/20",
        ].join(" "),
        outline: [
          "border border-[var(--hisab-input)]",
          "text-[var(--hisab-foreground)]",
          "hover:bg-[var(--hisab-muted)]",
        ].join(" "),
      },
      size: {
        sm: "px-2 py-0 text-[10px]",
        default: "px-2.5 py-0.5 text-xs",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

// ============================================
// Badge Props
// ============================================
export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  /** Show a remove/dismiss button */
  removable?: boolean
  /** Callback when remove button is clicked */
  onRemove?: () => void
  /** Icon before text */
  icon?: React.ReactNode
}

// ============================================
// Badge Component
// ============================================
const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, size, removable = false, onRemove, icon, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        suppressHydrationWarning
        className={cn(badgeVariants({ variant, size, className }))}
        {...props}
      >
        {icon && (
          <span className="shrink-0 [&_svg]:size-3" aria-hidden="true">
            {icon}
          </span>
        )}
        <span>{children}</span>
        {removable && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onRemove?.()
            }}
            className={cn(
              "rounded-full p-0.5",
              "hover:bg-[var(--hisab-background)]/20",
              "transition-colors duration-[var(--hisab-transition)]",
              "[&_svg]:size-3",
            )}
            aria-label="Remove"
          >
            <X aria-hidden="true" />
          </button>
        )}
      </div>
    )
  },
)
Badge.displayName = "Badge"

export { Badge, badgeVariants }