// packages/ui/src/components/ui/activity/AccessibleCard.tsx
"use client";

import { forwardRef, memo, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useFocusTrap, useEscapeKey } from "../../../hooks/activity/useAccessibility";

interface AccessibleCardProps {
  children: React.ReactNode;
  onClose?: () => void;
  isOpen?: boolean;
  className?: string;
  ariaLabel: string;
  ariaDescribedby?: string;
  role?: "dialog" | "article" | "region";
}

export const AccessibleCard = memo(
  forwardRef<HTMLDivElement, AccessibleCardProps>(
    (
      {
        children,
        onClose,
        isOpen = true,
        className,
        ariaLabel,
        ariaDescribedby,
        role = "article",
      },
      ref
    ) => {
      const containerRef = useRef<HTMLDivElement | null>(null);
      const combinedRef = (node: HTMLDivElement) => {
        containerRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      };

      // Focus trap when open
      useFocusTrap(containerRef, isOpen);

      // Escape to close
      useEscapeKey(() => {
        if (onClose && isOpen) onClose();
      });

      if (!isOpen) return null;

      return (
        <div
          ref={combinedRef}
          role={role}
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedby}
          className={cn(
            "rounded-xl border border-[hsl(var(--border-default))]",
            "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))]",
            className
          )}
          tabIndex={0}
        >
          {children}
        </div>
      );
    }
  )
);

AccessibleCard.displayName = "AccessibleCard";