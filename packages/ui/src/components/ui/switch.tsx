// packages/ui/src/components/ui/switch.tsx
"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   Switch v3 — Hisabche Design Language
   ✅ RTL-ready · Fixed thumb movement · Touch-friendly
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
        "outline-none",
        // Sizes
        size === "default" && "h-6 w-11",      // ✅ 24px x 44px
        size === "sm" && "h-5 w-9",            // ✅ 20px x 36px
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
          "block rounded-full",
          "bg-white",
          "shadow-sm",
          "transition-all duration-200",
          "motion-reduce:transition-none",
          // ✅ Position absolute برای کنترل دقیق موقعیت
          "absolute top-1/2 -translate-y-1/2",
          // Sizes
          size === "default" && "h-5 w-5",
          size === "sm" && "h-4 w-4",
          // ✅ FIX: "inset-inline-start-*" اصلاً یک کلاس معتبر Tailwind
          // نیست (کامپایل نمی‌شود، هیچ CSS تولید نمی‌کند) — همین باعث
          // می‌شد thumb هیچ موقعیت افقی نگیرد و به یک دایره‌ی ثابت وسط
          // تبدیل شود. نام درست utility منطقی (RTL-safe) خودِ "start"/"end"
          // است که Tailwind به inset-inline-start/end ترجمه می‌کند.
          "start-0.5",
          "data-[state=checked]:start-[calc(100%-1.25rem-0.125rem)]",
          size === "sm" && "data-[state=checked]:start-[calc(100%-1rem-0.125rem)]",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
export type { SwitchProps };