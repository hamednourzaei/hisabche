import * as React from "react";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   Badge v2 — Hisabche Design Language
   Zero hardcoded colors — all tokens from design system
   No class-variance-authority dependency
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── Types ─────────────────────────────────────────────────────────────────

type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning";

type BadgeSize = "default" | "sm";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
}

// ─── Style Maps ────────────────────────────────────────────────────────────

const variantStyles: Record<BadgeVariant, string> = {
  default:
    "border-transparent bg-[var(--gradient-brand)] text-white",
  secondary:
    "border-transparent bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-secondary))]",
  destructive:
    "border-transparent bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))] border-[hsl(var(--color-destructive)/0.2)]",
  outline:
    "bg-transparent text-[hsl(var(--fg-secondary))] border-[hsl(var(--border-default))]",
  success:
    "border-transparent bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))] border-[hsl(var(--color-success)/0.2)]",
  warning:
    "border-transparent bg-[hsl(var(--color-warning)/0.12)] text-[hsl(var(--color-warning))] border-[hsl(var(--color-warning)/0.2)]",
};

const sizeStyles: Record<BadgeSize, string> = {
  default: "px-2.5 py-0.5 text-xs",
  sm: "px-1.5 py-0.5 text-[10px]",
};

// ─── Component ─────────────────────────────────────────────────────────────

function Badge({
  className,
  variant = "default",
  size = "default",
  ...props
}: BadgeProps) {
  return (
    <div
      className={cn(
        // Base
        "inline-flex items-center rounded-full border",
        "font-semibold transition-colors duration-150",
        "motion-reduce:transition-none",
        // Variant
        variantStyles[variant],
        // Size
        sizeStyles[size],
        // Custom
        className,
      )}
      {...props}
    />
  );
}

export { Badge };
export type { BadgeVariant, BadgeSize };