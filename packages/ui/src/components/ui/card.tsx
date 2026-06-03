import * as React from "react"
import { cn } from "../../lib/utils"
import { type VariantProps, cva } from "class-variance-authority"

// ═══ Card ═══
const cardVariants = cva(
  [
    "rounded-[var(--hisab-radius-lg)]",
    "border border-[var(--hisab-border)]",
    "bg-[var(--hisab-card)] text-[var(--hisab-card-fg)]",
    "shadow-[var(--hisab-shadow-sm)]",
    "transition-all duration-[var(--hisab-duration)] motion-safe:duration-[var(--hisab-duration)]",
    "motion-reduce:transition-none",
  ],
  {
    variants: {
      interactive: {
        true: ["interactive-card"],
        false: [],
      },
    },
    defaultVariants: { interactive: false },
  }
)

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof cardVariants>
>(({ className, interactive, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(cardVariants({ interactive }), className)}
    {...props}
  />
))
Card.displayName = "Card"

// ═══ Card Header ═══
const cardHeaderVariants = cva("flex flex-col gap-1.5", {
  variants: {
    compact: { true: "px-4 py-3", false: "p-6 pb-0" },
  },
  defaultVariants: { compact: false },
})

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof cardHeaderVariants>
>(({ className, compact, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(cardHeaderVariants({ compact }), className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

// ═══ Card Title ═══
type CardTitleProps = React.HTMLAttributes<HTMLHeadingElement> & {
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
}

const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, as: Tag = "h3", ...props }, ref) => (
    <Tag
      ref={ref}
      className={cn(
        "text-lg font-semibold leading-none tracking-tight",
        className
      )}
      {...props}
    />
  )
)
CardTitle.displayName = "CardTitle"

// ═══ Card Description ═══
const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-[var(--hisab-muted-fg)]", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

// ═══ Card Content ═══
const cardContentVariants = cva("", {
  variants: {
    padded: {
      sm: "p-3",
      md: "p-4 sm:p-6",
      lg: "p-6 sm:p-8",
      none: "p-0",
    },
  },
  defaultVariants: { padded: "md" },
})

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof cardContentVariants>
>(({ className, padded, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(cardContentVariants({ padded }), className)}
    {...props}
  />
))
CardContent.displayName = "CardContent"

// ═══ Card Footer ═══
const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center gap-2 p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
}
export { cardVariants, cardHeaderVariants, cardContentVariants }