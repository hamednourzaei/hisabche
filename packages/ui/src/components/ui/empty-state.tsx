"use client"

import React from "react"
import { cn } from "../../lib/utils"
import { Package, FileText, Users, SearchX } from "lucide-react"

export interface EmptyStateProps {
  icon?: "invoice" | "product" | "customer" | "search" | React.ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

const iconMap: Record<string, any> = {
  invoice: FileText,
  product: Package,
  customer: Users,
  search: SearchX,
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon = "invoice", title, description, action, className }) => {
  const IconComponent = typeof icon === "string" ? iconMap[icon] : null

  return (
    <div className={cn("flex flex-col items-center justify-center py-16 px-6 text-center", className)}>
      <div className="w-20 h-20 rounded-2xl bg-[var(--hisab-muted)] flex items-center justify-center mb-6">
        {IconComponent ? (
          <IconComponent className="size-10 text-[var(--hisab-muted-fg)]" />
        ) : (
          icon
        )}
      </div>

      <h3 className="text-lg font-bold text-[var(--hisab-foreground)] mb-2">
        {title}
      </h3>

      {description && (
        <p className="text-sm text-[var(--hisab-muted-fg)] max-w-sm mb-6 leading-relaxed">
          {description}
        </p>
      )}

      {action && (
        <button
          onClick={action.onClick}
          className="px-6 py-2.5 rounded-[var(--hisab-radius)] text-sm font-medium transition-all hover:scale-105 active:scale-95"
          style={{
            background: 'hsl(var(--hisab-primary))',
            color: 'white',
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

export { EmptyState }