// packages/ui/src/components/ui/activity/ActivityMotion.tsx
"use client";

import { useState, useEffect, memo, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useMotionDuration, motionClassNames } from "../../../lib/activity/motion";

interface ActivityMotionProps {
  children: ReactNode;
  type?: "fade" | "slide" | "scale" | "spring";
  delay?: number;
  className?: string;
  onAnimationComplete?: () => void;
}

export const ActivityMotion = memo(function ActivityMotion({
  children,
  type = "fade",
  delay = 0,
  className,
  onAnimationComplete,
}: ActivityMotionProps) {
  const [isVisible, setIsVisible] = useState(false);
  const duration = useMotionDuration("normal");

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
      if (onAnimationComplete) {
        setTimeout(onAnimationComplete, duration);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [delay, duration, onAnimationComplete]);

  const typeClasses = {
    fade: motionClassNames.fadeIn,
    slide: motionClassNames.slideIn,
    scale: motionClassNames.scaleIn,
    spring: motionClassNames.springIn,
  };

  return (
    <div
      className={cn(
        "transition-all",
        isVisible ? typeClasses[type] : "opacity-0",
        className
      )}
      style={{
        transitionDuration: `${duration}ms`,
        transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      }}
    >
      {children}
    </div>
  );
});

ActivityMotion.displayName = "ActivityMotion";