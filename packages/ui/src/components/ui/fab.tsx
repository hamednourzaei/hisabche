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
  "bottom-center":
    "bottom-6 start-1/2 -translate-x-1/2",
}

const Fab = React.forwardRef<HTMLDivElement, FabProps>(
  (
    { actions, position = "bottom-right", className },
    ref
  ) => {
    const [isOpen, setIsOpen] = React.useState(false)

    const toggleOpen = React.useCallback(
      () => setIsOpen((prev) => !prev),
      []
    )

    const handleAction = React.useCallback(
      (action: FabAction) => {
        action.onClick()
        setIsOpen(false)
      },
      []
    )

    return (
      <div
        ref={ref}
        className={cn(
          "fixed z-50",
          positionStyles[position],
          className
        )}
      >
        {/* Actions list */}
        {isOpen && (
          <div className="mb-3 flex animate-fade-in flex-col-reverse gap-2">
            {actions.map((action, index) => (
              <button
                key={action.id}
                onClick={() => handleAction(action)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-4 py-3 shadow-[var(--hisab-shadow-md)] transition-all",
                  "text-sm font-medium",
                  "hover:scale-105 active:scale-95",
                  action.variant === "primary" &&
                    "bg-[var(--hisab-primary)] text-[var(--hisab-primary-fg)]",
                  action.variant === "warning" &&
                    "bg-[var(--hisab-warning)] text-[var(--hisab-warning-fg)]",
                  action.variant !== "primary" &&
                    action.variant !== "warning" &&
                    "border border-[var(--hisab-border)] bg-[var(--hisab-card)] text-[var(--hisab-foreground)]"
                )}
                style={{
                  animationDelay: `${index * 50}ms`,
                }}
              >
                {action.icon}
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Main FAB */}
        <button
          onClick={toggleOpen}
          aria-label={
            isOpen ? "بستن منو" : "باز کردن منو"
          }
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-full shadow-[var(--hisab-shadow-lg)] transition-all",
            "hover:scale-110 active:scale-95",
            isOpen
              ? "bg-[var(--hisab-destructive)]"
              : "bg-[var(--hisab-primary)]"
          )}
        >
          {isOpen ? (
            <X
              className="size-6 text-[var(--hisab-destructive-fg)]"
              aria-hidden
            />
          ) : (
            <Plus
              className="size-6 text-[var(--hisab-primary-fg)]"
              aria-hidden
            />
          )}
        </button>
      </div>
    )
  }
)

Fab.displayName = "Fab"

export { Fab }