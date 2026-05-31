import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--hisab-ring)] focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[var(--hisab-primary)] text-[var(--hisab-primary-fg)]",
        secondary:
          "border-transparent bg-[var(--hisab-secondary)] text-[var(--hisab-secondary-fg)]",
        destructive:
          "border-transparent bg-[var(--hisab-destructive)] text-[var(--hisab-destructive-fg)]",
        outline:
          "text-[var(--hisab-foreground)] border-[var(--hisab-border)]",
        success:
          "border-transparent bg-[var(--hisab-success)] text-[var(--hisab-success-fg)]",
        warning:
          "border-transparent bg-[var(--hisab-warning)] text-[var(--hisab-warning-fg)]",
      },
      size: {
        default: "",
        sm: "px-1.5 py-0.5 text-[10px]",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <div
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }