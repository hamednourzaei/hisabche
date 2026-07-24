// packages/ui/src/components/ui/activity/AccessibleCard.tsx
"use client";

import { forwardRef, memo, useRef, useCallback, useEffect } from "react";
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
  elevation?: "none" | "sm" | "md" | "lg";
  interactive?: boolean;
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
        elevation = "sm",
        interactive = false,
      },
      ref
    ) => {
      const containerRef = useRef<HTMLDivElement | null>(null);
      const combinedRef = (node: HTMLDivElement) => {
        containerRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      };

      // Focus trap when open (only for dialog)
      useFocusTrap(containerRef, isOpen && role === "dialog");

      // Escape to close
      useEscapeKey(() => {
        if (onClose && isOpen) onClose();
      });

      // Announcer for screen readers when card opens
      useEffect(() => {
        if (isOpen && role === "dialog") {
          const announcer = document.getElementById("card-announcer");
          if (announcer) {
            announcer.textContent = `${ariaLabel} باز شد`;
          }
        }
      }, [isOpen, ariaLabel, role]);

      // ─── Elevation Styles ────────────────────────────────────
      const elevationStyles = {
        none: "shadow-none border border-[hsl(var(--border-default))]",
        sm: "shadow-sm border border-[hsl(var(--border-default))]",
        md: "shadow-md border border-[hsl(var(--border-default))]",
        lg: "shadow-lg border border-[hsl(var(--border-default))]",
      };

      if (!isOpen) return null;

      return (
        <>
          {/* ─── Screen Reader Announcer ────────────────────── */}
          <div id="card-announcer" className="sr-only" aria-live="polite" />

          <div
            ref={combinedRef}
            role={role}
            aria-label={ariaLabel}
            aria-describedby={ariaDescribedby}
            aria-modal={role === "dialog" ? true : undefined}
            className={cn(
              "rounded-xl md:rounded-2xl bg-[hsl(var(--surface-elevated))] overflow-hidden",
              "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))] focus:ring-offset-1",
              elevationStyles[elevation],
              interactive && "hover:border-[hsl(var(--color-primary)/0.3)] transition-colors duration-200 cursor-pointer",
              className
            )}
            tabIndex={role === "dialog" ? -1 : 0}
          >
            {children}
          </div>
        </>
      );
    }
  )
);

AccessibleCard.displayName = "AccessibleCard";