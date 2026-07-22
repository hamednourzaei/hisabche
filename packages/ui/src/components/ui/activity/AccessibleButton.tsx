// packages/ui/src/components/ui/accessibility/AccessibleButton.tsx
"use client";

import { forwardRef, memo } from "react";
import { cn } from "../../../lib/activity/entity-registry";

interface AccessibleButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "destructive" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
}

export const AccessibleButton = memo(
  forwardRef<HTMLButtonElement, AccessibleButtonProps>(
    (
      {
        children,
        variant = "primary",
        size = "md",
        loading = false,
        icon,
        iconPosition = "left",
        className,
        disabled,
        "aria-label": ariaLabel,
        ...props
      },
      ref
    ) => {
      const variantStyles = {
        primary: "bg-[hsl(var(--color-primary))] text-white hover:opacity-90",
        secondary:
          "bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-primary))] hover:bg-[hsl(var(--surface-muted)/0.8)]",
        destructive:
          "bg-[hsl(var(--color-destructive))] text-white hover:opacity-90",
        ghost:
          "text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))]",
      };

      const sizeStyles = {
        sm: "px-2.5 py-1.5 text-xs rounded-lg",
        md: "px-4 py-2 text-sm rounded-xl",
        lg: "px-6 py-3 text-base rounded-2xl",
      };

      return (
        <button
          ref={ref}
          disabled={disabled || loading}
          aria-label={ariaLabel || (typeof children === "string" ? children : undefined)}
          aria-busy={loading}
          aria-disabled={disabled || loading}
          className={cn(
            "inline-flex items-center justify-center gap-2 font-medium",
            "transition-all duration-150",
            "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))] focus:ring-offset-2",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            variantStyles[variant],
            sizeStyles[size],
            className
          )}
          {...props}
        >
          {loading && (
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
              aria-hidden="true"
            />
          )}
          {icon && !loading && iconPosition === "left" && (
            <span aria-hidden="true">{icon}</span>
          )}
          {children}
          {icon && !loading && iconPosition === "right" && (
            <span aria-hidden="true">{icon}</span>
          )}
        </button>
      );
    }
  )
);

AccessibleButton.displayName = "AccessibleButton";