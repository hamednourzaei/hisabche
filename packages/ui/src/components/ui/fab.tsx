"use client"

import * as React from "react"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
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
    const [open, setOpen] = React.useState(false)

    const handleAction = React.useCallback((action: FabAction) => {
      action.onClick()
      setOpen(false)
    }, [])

    return (
      <div
        ref={ref}
        className={cn(
          "fixed z-50",
          positionStyles[position],
          className
        )}
      >
        <DropdownMenu.Root open={open} onOpenChange={setOpen}>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              aria-label={open ? "بستن منو" : "باز کردن منو"}
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-full shadow-[var(--hisab-shadow-lg)] transition-all",
                "hover:scale-110 active:scale-95",
                open
                  ? "bg-[var(--hisab-destructive)]"
                  : "bg-[var(--hisab-primary)]"
              )}
            >
              {open ? (
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
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              side="top"
              sideOffset={12}
              align="end"
              className={cn(
                "z-50 min-w-[160px] overflow-hidden rounded-xl",
                "border border-[var(--hisab-border)] bg-[var(--hisab-background)] p-2 shadow-lg",
                "animate-in fade-in-0 zoom-in-95",
                "data-[side=bottom]:slide-in-from-top-2",
                "data-[side=left]:slide-in-from-right-2",
                "data-[side=right]:slide-in-from-left-2",
                "data-[side=top]:slide-in-from-bottom-2"
              )}
            >
              {actions.map((action, index) => (
                <DropdownMenu.Item
                  key={action.id}
                  onClick={() => handleAction(action)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium outline-none",
                    "transition-colors",
                    "focus:bg-[var(--hisab-muted)]",
                    action.variant === "primary" &&
                      "bg-[var(--hisab-primary)] text-[var(--hisab-primary-fg)] focus:bg-[var(--hisab-primary)]/90",
                    action.variant === "warning" &&
                      "bg-[var(--hisab-warning)] text-[var(--hisab-warning-fg)] focus:bg-[var(--hisab-warning)]/90",
                    action.variant !== "primary" &&
                      action.variant !== "warning" &&
                      "text-[var(--hisab-foreground)]"
                  )}
                >
                  <span className="shrink-0">{action.icon}</span>
                  <span>{action.label}</span>
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    )
  }
)

Fab.displayName = "Fab"

export { Fab }