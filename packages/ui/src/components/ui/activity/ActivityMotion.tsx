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

const motionClasses = {
  fade: "animate-fade-in",
  slide: "animate-slide-up",
  scale: "animate-scale-in",
};

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
      className={cn(
        motionClasses[type],
        "opacity-0",
        delay > 0 && `animation-delay-${Math.min(delay, 150)}`,
        className
      )}
      style={{
        animationDuration: `${animationDuration}ms`,
      }}
    >
      {children}
    </div>
  );
});

ActivityMotion.displayName = "ActivityMotion";