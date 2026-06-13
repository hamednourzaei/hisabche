"use client";

import * as React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";
import { Plus, X } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   Fab v2 — Hisabche Design Language
   Zero hardcoded colors — all tokens from design system
   Full RTL via logical CSS (start/end)
   Optimized for Redmi 9: no zoom, only fade + slide
   ═══════════════════════════════════════════════════════════════════════════ */

export interface FabAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "primary" | "destructive";
}

export interface FabProps {
  actions: FabAction[];
  position?: "bottom-end" | "bottom-start" | "bottom-center";
  className?: string;
}

const positionStyles: Record<string, string> = {
  "bottom-end": "bottom-6 end-6",
  "bottom-start": "bottom-6 start-6",
  "bottom-center": "bottom-6 start-1/2 -translate-x-1/2",
};

const Fab = React.forwardRef<HTMLDivElement, FabProps>(
  ({ actions, position = "bottom-end", className }, ref) => {
    const [open, setOpen] = React.useState(false);

    const handleAction = React.useCallback(
      (action: FabAction) => {
        action.onClick();
        setOpen(false);
      },
      [],
    );

    return (
      <div
        ref={ref}
        className={cn("fixed z-50", positionStyles[position], className)}
      >
        <DropdownMenu.Root open={open} onOpenChange={setOpen}>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              aria-label={open ? "بستن منو" : "باز کردن منو"}
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-full",
                "shadow-lg",
                "transition-all duration-200",
                "hover:scale-110 active:scale-95",
                "motion-reduce:transition-none motion-reduce:hover:scale-100",
                open
                  ? "bg-[hsl(var(--color-destructive))] rotate-45"
                  : "bg-[var(--gradient-brand)] rotate-0",
              )}
            >
              <Plus className="size-6 text-white transition-transform duration-200" aria-hidden="true" />
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              side="top"
              sideOffset={12}
              align="end"
              className={cn(
                "z-50 min-w-[160px] overflow-hidden rounded-2xl",
                "border border-[hsl(var(--border-strong))]",
                "bg-[hsl(var(--surface-elevated))]",
                "p-1.5 shadow-lg",
                "data-[state=open]:animate-in data-[state=closed]:animate-out",
                "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
                "data-[state=closed]:slide-out-to-bottom-2 data-[state=open]:slide-in-from-bottom-2",
                "motion-reduce:animate-none",
              )}
            >
              {actions.map((action) => (
                <DropdownMenu.Item
                  key={action.id}
                  onClick={() => handleAction(action)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium outline-none",
                    "transition-colors duration-150",
                    "motion-reduce:transition-none",
                    "min-h-[44px]",
                    // Default
                    action.variant === undefined || action.variant === "default"
                      ? "text-[hsl(var(--fg-primary))] data-[highlighted]:bg-[hsl(var(--color-primary)/0.08)]"
                      : "",
                    // Primary
                    action.variant === "primary"
                      ? "bg-[var(--gradient-brand)] text-white data-[highlighted]:brightness-110"
                      : "",
                    // Destructive
                    action.variant === "destructive"
                      ? "text-[hsl(var(--color-destructive))] data-[highlighted]:bg-[hsl(var(--color-destructive)/0.1)]"
                      : "",
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
    );
  },
);

Fab.displayName = "Fab";

export { Fab };