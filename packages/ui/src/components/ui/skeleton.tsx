"use client"

import * as React from "react"
import { cn } from "../../lib/utils"

// ============================================
// Skeleton Props
// ============================================
export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Width of skeleton */
  width?: string | number
  /** Height of skeleton */
  height?: string | number
  /** Shape variant */
  variant?: "text" | "circular" | "rectangular" | "rounded"
  /** Animation style */
  animation?: "pulse" | "wave" | "none"
}

// ============================================
// Skeleton Component
// ============================================
const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, width, height, variant = "text", animation = "pulse", style, ...props }, ref) => {
    const baseStyles = cn(
      "bg-[var(--hisab-muted)]",
      animation === "pulse" && "animate-pulse",
      animation === "wave" && "relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-[var(--hisab-background)]/10 before:to-transparent",
      {
        "h-4 w-full rounded-[var(--hisab-radius-sm)]": variant === "text",
        "rounded-full": variant === "circular",
        "rounded-[var(--hisab-radius)]": variant === "rectangular",
        "rounded-[var(--hisab-radius-lg)]": variant === "rounded",
      },
      className,
    )

    return (
      <div
        ref={ref}
        
        className={baseStyles}
        style={{
          width: typeof width === "number" ? `${width}px` : width,
          height: typeof height === "number" ? `${height}px` : height,
          ...style,
        }}
        aria-hidden="true"
        {...props}
      />
    )
  },
)
Skeleton.displayName = "Skeleton"

// ============================================
// Skeleton Presets
// ============================================

/** Skeleton for a paragraph of text */
export const SkeletonText = ({ lines = 3, className, ...props }: SkeletonProps & { lines?: number }) => (
  <div className={cn("flex flex-col gap-2", className)} role="status" aria-label="Loading text">
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        variant="text"
        width={i === lines - 1 ? "60%" : "100%"}
        {...props}
      />
    ))}
    <span className="sr-only">Loading...</span>
  </div>
)

/** Skeleton for an avatar (circular) */
export const SkeletonAvatar = ({ size = 40, ...props }: SkeletonProps & { size?: number }) => (
  <Skeleton variant="circular" width={size} height={size} {...props} />
)

/** Skeleton for a card */
export const SkeletonCard = ({ className, ...props }: SkeletonProps) => (
  <div className={cn("space-y-4 rounded-[var(--hisab-radius-lg)] border border-[var(--hisab-border)] p-6", className)} role="status" aria-label="Loading card">
    <div className="flex items-center gap-3">
      <SkeletonAvatar size={40} />
      <div className="flex-1 space-y-2">
        <Skeleton variant="text" width="40%" />
        <Skeleton variant="text" width="25%" />
      </div>
    </div>
    <Skeleton variant="text" width="100%" />
    <Skeleton variant="text" width="100%" />
    <Skeleton variant="text" width="60%" />
    <span className="sr-only">Loading...</span>
  </div>
)

export { Skeleton }