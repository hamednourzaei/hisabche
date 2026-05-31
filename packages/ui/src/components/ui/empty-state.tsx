"use client"

import React from "react"
import { cn } from "../../lib/utils"
import { Package, FileText, Users, SearchX } from "lucide-react"

export interface EmptyStateProps {
  icon?:
    | "invoice"
    | "product"
    | "customer"
    | "search"
    | React.ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

const iconMap: Record<string, React.ElementType> = {
  invoice: FileText,
  product: Package,
  customer: Users,
  search: SearchX,
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon = "invoice",
  title,
  description,
  action,
  className,
}) => {
  const IconComponent =
    typeof icon === "string" ? iconMap[icon] : null

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-16 text-center",
        className
      )}
    >
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--hisab-muted)]">
        {IconComponent ? (
          <IconComponent
            className="size-10 text-[var(--hisab-muted-fg)]"
            aria-hidden
          />
        ) : (
          icon
        )}
      </div>

      <h3 className="mb-2 text-lg font-bold text-[var(--hisab-foreground)]">
        {title}
      </h3>

      {description && (
        <p className="mb-6 max-w-sm text-sm leading-relaxed text-[var(--hisab-muted-fg)]">
          {description}
        </p>
      )}

      {action && (
        <button
          onClick={action.onClick}
          className="rounded-[var(--hisab-radius)] bg-[var(--hisab-primary)] px-6 py-2.5 text-sm font-medium text-[var(--hisab-primary-fg)] transition-all hover:scale-105 active:scale-95"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

export { EmptyState }