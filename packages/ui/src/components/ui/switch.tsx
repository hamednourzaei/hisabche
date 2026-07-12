"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   Switch v2 — Hisabche Design Language
   Zero hardcoded colors — all tokens from design system
   RTL-ready with logical transforms
   ═══════════════════════════════════════════════════════════════════════════ */

interface SwitchProps
  extends React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> {
  size?: "sm" | "default";
}

function Switch({ className, size = "default", ...props }: SwitchProps) {
  return (
    <SwitchPrimitive.Root
      data-size={size}
      className={cn(
        // Base
        "peer inline-flex shrink-0 items-center",
        "rounded-full",
        "transition-colors duration-200",
        "outline-none",
        // Touch target extension
        "relative",
        "after:absolute after:-inset-x-3 after:-inset-y-2",
        // Focus
        "focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring-color)/0.5)] focus-visible:ring-offset-1",
        // Disabled
        "disabled:cursor-not-allowed disabled:opacity-40",
        // Invalid
        "aria-invalid:ring-2 aria-invalid:ring-[hsl(var(--color-destructive)/0.4)]",
        // Sizes
        size === "default" && "h-[20px] w-[36px]",
        size === "sm" && "h-[14px] w-[24px]",
        // Colors — zero hardcoded
        "border-2 border-transparent",
        "bg-[hsl(var(--surface-muted))]",
        "data-[state=checked]:bg-[hsl(var(--color-success))]",
        "data-[state=checked]:border-[hsl(var(--color-success))]",
        // Reduced motion
        "motion-reduce:transition-none",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "block rounded-full",
          "bg-[hsl(var(--fg-primary))]",
          "shadow-sm",
          "transition-transform duration-200",
          "motion-reduce:transition-none",
          // Sizes
          size === "default" && "size-4",
          size === "sm" && "size-3",
          // Position — logical (RTL-compatible via Radix)
          "data-[state=checked]:translate-x-4",
          "data-[state=unchecked]:translate-x-0.5",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
export type { SwitchProps };