"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/utils"
import { Loader2 } from "lucide-react"

// ============================================
// Button Variants — CVA
// ============================================
const buttonVariants = cva(
  [
    // Base styles
    "inline-flex items-center justify-center gap-2",
    "whitespace-nowrap rounded-[var(--hisab-radius)]",
    "text-sm font-medium leading-none",
    "transition-all duration-[var(--hisab-transition)]",
    "focus-visible:outline-none focus-visible:ring-2",
    "focus-visible:ring-[var(--hisab-ring)] focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
    "active:scale-[0.98]",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
    // RTL support — using logical properties
    "select-none",
  ].join(" "),
  {
    variants: {
      variant: {
        default: [
          "bg-[var(--hisab-primary)]",
          "text-[var(--hisab-primary-fg)]",
          "hover:bg-[var(--hisab-primary)]/90",
          "shadow-[var(--hisab-shadow-sm)]",
        ].join(" "),
        destructive: [
          "bg-[var(--hisab-destructive)]",
          "text-[var(--hisab-destructive-fg)]",
          "hover:bg-[var(--hisab-destructive)]/90",
        ].join(" "),
        outline: [
          "border border-[var(--hisab-input)]",
          "bg-[var(--hisab-background)]",
          "text-[var(--hisab-foreground)]",
          "hover:bg-[var(--hisab-accent)]/10",
          "hover:text-[var(--hisab-accent)]",
          "hover:border-[var(--hisab-accent)]/50",
        ].join(" "),
        secondary: [
          "bg-[var(--hisab-secondary)]",
          "text-[var(--hisab-secondary-fg)]",
          "hover:bg-[var(--hisab-secondary)]/80",
        ].join(" "),
        ghost: [
          "text-[var(--hisab-foreground)]",
          "hover:bg-[var(--hisab-accent)]/10",
          "hover:text-[var(--hisab-accent)]",
        ].join(" "),
        link: [
          "text-[var(--hisab-primary)]",
          "underline-offset-4",
          "hover:underline",
          "shadow-none",
        ].join(" "),
        success: [
          "bg-[var(--hisab-success)]",
          "text-[var(--hisab-success-fg)]",
          "hover:bg-[var(--hisab-success)]/90",
        ].join(" "),
        warning: [
          "bg-[var(--hisab-warning)]",
          "text-[var(--hisab-warning-fg)]",
          "hover:bg-[var(--hisab-warning)]/90",
        ].join(" "),
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-[var(--hisab-radius-sm)] px-3 text-xs",
        lg: "h-11 rounded-[var(--hisab-radius-lg)] px-8 text-base",
        xl: "h-12 rounded-[var(--hisab-radius-lg)] px-10 text-lg",
        icon: "h-10 w-10 rounded-full",
        "icon-sm": "h-8 w-8 rounded-full",
        "icon-lg": "h-12 w-12 rounded-full",
      },
      fullWidth: {
        true: "w-full",
        false: "w-auto",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      fullWidth: false,
    },
  }
)

// ============================================
// Button Props
// ============================================
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render as child element (e.g., Link) */
  asChild?: boolean
  /** Show loading spinner */
  loading?: boolean
  /** Icon component to show before text */
  icon?: React.ReactNode
  /** onPress handler for React Native compatibility */
  onPress?: React.MouseEventHandler<HTMLButtonElement>
}

// ============================================
// Button Component
// ============================================
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      fullWidth,
      asChild = false,
      loading = false,
      icon,
      children,
      disabled,
      onPress,
      onClick,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button"

    // Support both onPress (React Native) and onClick (Web)
    const handleClick = onPress || onClick

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, fullWidth, className }))}
        ref={ref}
        disabled={disabled || loading}
        suppressHydrationWarning
        onClick={handleClick}
        {...props}
      >
        {loading ? (
          <Loader2 className="animate-spin" aria-hidden="true" />
        ) : icon ? (
          <span className="shrink-0" aria-hidden="true">
            {icon}
          </span>
        ) : null}
        {children}
      </Comp>
    )
  },
)
Button.displayName = "Button"

// ============================================
// Exports
// ============================================
export { Button, buttonVariants }