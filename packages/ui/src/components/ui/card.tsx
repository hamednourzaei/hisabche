import * as React from "react";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   Card v2 — Hisabche Design Language
   Zero hardcoded colors — all tokens from design system
   No class-variance-authority dependency
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── Card ──────────────────────────────────────────────────────────────────

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, interactive = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-2xl",
        "border border-[hsl(var(--border-default))]",
        "bg-[hsl(var(--surface-elevated))]",
        "text-[hsl(var(--fg-primary))]",
        "shadow-sm",
        "transition-all duration-200",
        "motion-reduce:transition-none",
        interactive && "hover:shadow-lg hover:border-[hsl(var(--color-primary)/0.2)] cursor-pointer",
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = "Card";

// ─── CardHeader ────────────────────────────────────────────────────────────

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  compact?: boolean;
}

const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, compact = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-col gap-1.5",
        compact ? "px-4 py-3" : "p-6 pb-0",
        className,
      )}
      {...props}
    />
  ),
);
CardHeader.displayName = "CardHeader";

// ─── CardTitle ─────────────────────────────────────────────────────────────

type CardTitleProps = React.HTMLAttributes<HTMLHeadingElement> & {
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
};

const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, as: Tag = "h3", ...props }, ref) => (
    <Tag
      ref={ref}
      className={cn(
        "text-lg font-bold leading-tight",
        "text-[hsl(var(--fg-primary))]",
        className,
      )}
      {...props}
    />
  ),
);
CardTitle.displayName = "CardTitle";

// ─── CardDescription ───────────────────────────────────────────────────────

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn(
      "text-sm",
      "text-[hsl(var(--fg-secondary))]",
      className,
    )}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

// ─── CardContent ───────────────────────────────────────────────────────────

type CardPadded = "sm" | "md" | "lg" | "none";

interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  padded?: CardPadded;
}

const paddedStyles: Record<CardPadded, string> = {
  sm: "p-3",
  md: "p-4 sm:p-6",
  lg: "p-6 sm:p-8",
  none: "p-0",
};

const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, padded = "md", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(paddedStyles[padded], className)}
      {...props}
    />
  ),
);
CardContent.displayName = "CardContent";

// ─── CardFooter ────────────────────────────────────────────────────────────

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex items-center gap-2 p-6 pt-0",
      className,
    )}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

// ═══════════════════════════════════════════════════════════════════════════

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
};

export type { CardProps, CardHeaderProps, CardTitleProps, CardContentProps };