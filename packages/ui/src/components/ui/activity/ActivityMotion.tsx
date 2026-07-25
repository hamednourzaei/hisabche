// packages/ui/src/components/ui/activity/ActivityMotion.tsx
"use client";

import { useEffect, useRef, memo } from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "../../../hooks/activity/useAccessibility";

export interface ActivityMotionProps {
  children: React.ReactNode;
  type?: "fade" | "slide" | "scale";
  delay?: number;
  className?: string;
  onAnimationComplete?: () => void | undefined;
}

// ⚠️ FIXED: کلاس‌های قبلی (animate-slide-up, animate-fade-in,
// animate-scale-in) هیچ‌کدام در tailwind.config.ts تعریف نشده
// بودند. Tailwind برای کلاس‌های تعریف‌نشده هیچ CSSای تولید نمی‌کند
// (بدون خطا یا هشدار) — یعنی «opacity-0» اعمال می‌شد ولی هیچ انیمیشنی
// آن را به opacity:1 برنمی‌گرداند، پس عنصر برای همیشه نامرئی
// می‌ماند (در DOM حاضر و کلیک‌پذیر، ولی بصری مخفی). این دقیقاً همان
// چیزی بود که باعث می‌شد بعضی آیتم‌های Activity feed در production
// دیده نشوند. اینجا از fade-slide-up که واقعاً در tailwind.config.ts
// تعریف شده (keyframes + animation، با opacity 0→1 و
// fill-mode: forwards به لطف «forwards» در تعریف animation) استفاده
// شده است.
const motionClasses = {
  fade: "animate-fade-slide-up",
  slide: "animate-fade-slide-up",
  scale: "animate-fade-slide-up",
};

// ⚠️ FIXED: کلاس‌های `animation-delay-${delay}` تولید داینامیک
// (template string) بودند — Tailwind کلاس‌هایی را که به‌صورت رشته‌ی
// داینامیک ساخته می‌شوند در زمان build نمی‌بیند، پس در production
// حذف (purge) می‌شدند. delay اکنون فقط از طریق inline style اعمال
// می‌شود که همیشه کار می‌کند، صرف‌نظر از purge شدن یا نشدن کلاس‌ها.

export const ActivityMotion = memo(function ActivityMotion({
  children,
  type = "fade",
  delay = 0,
  className,
  onAnimationComplete,
}: ActivityMotionProps) {
  const prefersReducedMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReducedMotion) {
      if (onAnimationComplete) {
        onAnimationComplete();
      }
      return;
    }

    const element = ref.current;
    if (!element) return;

    const timer = setTimeout(() => {
      if (onAnimationComplete) {
        onAnimationComplete();
      }
    }, 300 + delay);

    return () => clearTimeout(timer);
  }, [delay, onAnimationComplete, prefersReducedMotion]);

  if (prefersReducedMotion) {
    return <div className={cn(className)}>{children}</div>;
  }

  // Optimize animation duration for mobile
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const animationDuration = isMobile ? 150 : 200;

  return (
    <div
      ref={ref}
      className={cn(motionClasses[type], className)}
      style={{
        animationDuration: `${animationDuration}ms`,
        // ✅ FIX: delay از طریق inline style، نه کلاس داینامیک —
        // این همیشه در production کار می‌کند چون به purge شدن
        // کلاس‌های Tailwind وابسته نیست.
        animationDelay: delay > 0 ? `${Math.min(delay, 150)}ms` : undefined,
        // ✅ FIX: تضمین می‌کند که بعد از پایان انیمیشن، state نهایی
        // (opacity: 1) حفظ شود، صرف‌نظر از تنظیمات animation در
        // Tailwind config. این یک لایه‌ی ایمنی اضافی است؛ چون
        // animate-fade-slide-up در tailwind.config.ts خودش
        // "forwards" دارد، این خط عملاً redundant است ولی از تکرار
        // این کلاس باگ در آینده (مثلاً اگر کسی animation تعریف را
        // عوض کند و "forwards" را حذف کند) جلوگیری می‌کند.
        animationFillMode: "forwards",
      }}
    >
      {children}
    </div>
  );
});

ActivityMotion.displayName = "ActivityMotion";