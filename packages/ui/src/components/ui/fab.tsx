"use client"

import * as React from "react"
import { cn } from "../../lib/utils"
import { Plus, X } from "lucide-react"

export interface FabAction {
  id: string
  label: string
  icon: React.ReactNode
  onClick: () => void
  variant?: "default" | "primary" | "warning"
}

export interface FabProps {
  actions: FabAction[]
  position?: "bottom-right" | "bottom-left" | "bottom-center"
  className?: string
}

const positionStyles = {
  "bottom-right": "bottom-6 end-6",
  "bottom-left": "bottom-6 start-6",
  "bottom-center": "bottom-6 start-1/2 -translate-x-1/2",
}

const Fab = React.forwardRef<HTMLDivElement, FabProps>(
  ({ actions, position = "bottom-right", className }, ref) => {
    const [isOpen, setIsOpen] = React.useState(false)

    return (
      <div ref={ref} className={cn("fixed z-50", positionStyles[position], className)}>
        {isOpen && (
          <div className="flex flex-col-reverse gap-2 mb-3 animate-fade-in">
            {actions.map((action, index) => (
              <button
                key={action.id}
                onClick={() => {
                  action.onClick()
                  setIsOpen(false)
                }}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl shadow-[var(--hisab-shadow-md)] transition-all",
                  "hover:scale-105 active:scale-95",
                  "text-sm font-medium",
                )}
                style={{
                  background: action.variant === "primary"
                    ? "hsl(var(--hisab-primary))"
                    : action.variant === "warning"
                      ? "hsl(var(--hisab-warning))"
                      : "hsl(var(--hisab-card))",
                  color: action.variant === "primary" || action.variant === "warning"
                    ? "white"
                    : "hsl(var(--hisab-foreground))",
                  border: action.variant !== "primary" && action.variant !== "warning"
                    ? "1px solid hsl(var(--hisab-border))"
                    : "none",
                  animationDelay: `${index * 50}ms`,
                }}
              >
                {action.icon}
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "w-14 h-14 rounded-full shadow-[var(--hisab-shadow-lg)] flex items-center justify-center transition-all",
            "hover:scale-110 active:scale-95",
          )}
          style={{
            background: isOpen ? "hsl(var(--hisab-destructive))" : "hsl(var(--hisab-primary))",
          }}
        >
          {isOpen ? (
            <X className="size-6 text-white" />
          ) : (
            <Plus className="size-6 text-white" />
          )}
        </button>
      </div>
    )
  },
)
Fab.displayName = "Fab"

export { Fab }