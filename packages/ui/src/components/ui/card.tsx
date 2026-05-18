"use client"

import * as React from "react"
import { cn } from "../../lib/utils"

// ============================================
// Card Component
// ============================================
const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      
      className={cn(
        "rounded-[var(--hisab-radius-lg)]",
        "border border-[var(--hisab-border)]",
        "bg-[var(--hisab-card)] text-[var(--hisab-card-fg)]",
        "shadow-[var(--hisab-shadow-sm)]",
        "transition-shadow duration-[var(--hisab-transition)]",
        "hover:shadow-[var(--hisab-shadow-md)]",
        "hover:scale-[1.02] active:scale-[0.98] transition-transform duration-200",
        className,
      )}
      {...props}
    />
  ),
)
Card.displayName = "Card"

// ============================================
// Card Header
// ============================================
const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-col gap-1.5",
        "p-6 pb-0",
        className,
      )}
      {...props}
    />
  ),
)
CardHeader.displayName = "CardHeader"

// ============================================
// Card Title
// ============================================
const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn(
        "text-lg font-semibold leading-none tracking-tight",
        "text-[var(--hisab-foreground)]",
        className,
      )}
      {...props}
    />
  ),
)
CardTitle.displayName = "CardTitle"

// ============================================
// Card Description
// ============================================
const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn(
        "text-sm text-[var(--hisab-muted-fg)]",
        className,
      )}
      {...props}
    />
  ),
)
CardDescription.displayName = "CardDescription"

// ============================================
// Card Content
// ============================================
const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("p-6", className)}
      {...props}
    />
  ),
)
CardContent.displayName = "CardContent"

// ============================================
// Card Footer
// ============================================
const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex items-center gap-2",
        "p-6 pt-0",
        className,
      )}
      {...props}
    />
  ),
)
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }