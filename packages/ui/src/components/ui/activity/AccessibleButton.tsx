// packages/ui/src/components/ui/accessibility/AccessibleButton.tsx
"use client";

import { forwardRef, memo } from "react";
import { cn } from "@/lib/utils";

interface AccessibleButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "destructive" | "ghost" | "success" | "warning";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  fullWidth?: boolean;
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
        fullWidth = false,
        className,
        disabled,
        "aria-label": ariaLabel,
        ...props
      },
      ref
    ) => {
      // ─── Variant Styles ──────────────────────────────────────
      const variantStyles = {
        primary:
          "bg-[hsl(var(--color-primary))] text-[hsl(var(--color-primary-fg))] hover:bg-[hsl(var(--color-primary-hover))] shadow-sm shadow-[hsl(var(--color-primary)/0.2)]",
        secondary:
          "bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-primary))] hover:bg-[hsl(var(--surface-muted)/0.8)] border border-[hsl(var(--border-default))]",
        destructive:
          "bg-[hsl(var(--color-destructive))] text-[hsl(var(--color-destructive-fg))] hover:opacity-90 shadow-sm shadow-[hsl(var(--color-destructive)/0.2)]",
        ghost:
          "text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]",
        success:
          "bg-[hsl(var(--color-success))] text-[hsl(var(--color-success-fg))] hover:opacity-90 shadow-sm shadow-[hsl(var(--color-success)/0.2)]",
        warning:
          "bg-[hsl(var(--color-warning))] text-[hsl(var(--color-warning-fg))] hover:opacity-90 shadow-sm shadow-[hsl(var(--color-warning)/0.2)]",
      };

      // ─── Size Styles ─────────────────────────────────────────
      const sizeStyles = {
        sm: "px-2 md:px-2.5 py-1 md:py-1.5 text-[10px] md:text-xs rounded-lg min-h-[28px] md:min-h-[32px]",
        md: "px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm rounded-xl min-h-[36px] md:min-h-[40px]",
        lg: "px-4 md:px-6 py-2 md:py-3 text-sm md:text-base rounded-xl md:rounded-2xl min-h-[44px] md:min-h-[48px]",
      };

      // ─── Loading Spinner ─────────────────────────────────────
      const Spinner = () => (
        <span
          className="h-3.5 w-3.5 md:h-4 md:w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
          role="img"
          aria-label="در حال بارگذاری"
        />
      );

      // ─── Render ──────────────────────────────────────────────
      return (
        <button
          ref={ref}
          disabled={disabled || loading}
          aria-label={
            ariaLabel ||
            (typeof children === "string" ? children : undefined)
          }
          aria-busy={loading}
          aria-disabled={disabled || loading}
          className={cn(
            "inline-flex items-center justify-center gap-1.5 md:gap-2 font-medium",
            "transition-all duration-150",
            "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))] focus:ring-offset-2",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "select-none",
            fullWidth && "w-full",
            variantStyles[variant],
            sizeStyles[size],
            className
          )}
          {...props}
        >
          {loading ? (
            <Spinner />
          ) : (
            <>
              {icon && iconPosition === "left" && (
                <span className="shrink-0" aria-hidden="true">{icon}</span>
              )}
              {children}
              {icon && iconPosition === "right" && (
                <span className="shrink-0" aria-hidden="true">{icon}</span>
              )}
            </>
          )}
        </button>
      );
    }
  )
);

AccessibleButton.displayName = "AccessibleButton";