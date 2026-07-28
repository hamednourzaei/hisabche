// packages/ui/src/components/ui/switch.tsx
"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   Switch v4 — Hisabche Design Language
   ✅ RTL-ready · Responsive · Touch-friendly

   RTL fix note: relying purely on Tailwind's logical `start-*`/`end-*`
   inset utilities (v3) turned out to be fragile in practice — the thumb
   is positioned with `position: absolute`, so its horizontal offset must
   be an exact pixel/rem value, and mixing that with `data-[state=checked]`
   variants made the intended direction hard to verify and easy to regress.
   The robust, easy-to-reason-about approach (same one shadcn/ui ships) is
   a `transform: translateX()` on the thumb: it starts at the track's
   start edge (`start-0.5`, RTL-safe) and slides by a fixed physical
   distance when checked. Because `translate-x-*` is a *physical* (not
   logical) utility, we explicitly flip its sign for RTL with the `rtl:`
   variant — same convention already used sitewide (see
   `ChevronLeft ... rtl:rotate-180` in settings-page.tsx). Net effect:
   LTR checked → thumb slides right. RTL checked → thumb slides left.
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
        "peer relative inline-flex shrink-0 items-center",
        "rounded-full",
        "transition-colors duration-200",
        "outline-none cursor-pointer",
        // Sizes (fixed physical size — a toggle shouldn't scale with
        // viewport width, it just needs to render correctly at every width)
        size === "default" && "h-6 w-11",      // 24px x 44px
        size === "sm" && "h-5 w-9",            // 20px x 36px
        // Colors
        "border-2 border-transparent",
        "bg-[hsl(var(--surface-muted))]",
        "data-[state=checked]:bg-[hsl(var(--color-success))]",
        "data-[state=checked]:border-[hsl(var(--color-success))]",
        // Focus
        "focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring-color)/0.5)] focus-visible:ring-offset-1",
        // Disabled
        "disabled:cursor-not-allowed disabled:opacity-40",
        // Invalid
        "aria-invalid:ring-2 aria-invalid:ring-[hsl(var(--color-destructive)/0.4)]",
        // Reduced motion
        "motion-reduce:transition-none",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block rounded-full",
          "bg-white",
          "shadow-sm",
          "transition-transform duration-200",
          "motion-reduce:transition-none",
          "absolute top-1/2 start-0.5 -translate-y-1/2",
          // Sizes
          size === "default" && "h-5 w-5",
          size === "sm" && "h-4 w-4",
          // LTR: slide right on check. RTL: slide left on check.
          size === "default" && "data-[state=checked]:translate-x-5 rtl:data-[state=checked]:-translate-x-5",
          size === "sm" && "data-[state=checked]:translate-x-4 rtl:data-[state=checked]:-translate-x-4",
          // -translate-y-1/2 must stay applied together with translate-x —
          // Tailwind's translate utilities share the same CSS custom
          // properties, so both axes always compose correctly regardless
          // of which one was set last.
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
export type { SwitchProps };