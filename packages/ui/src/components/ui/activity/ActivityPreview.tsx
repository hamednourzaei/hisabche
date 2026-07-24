// packages/ui/src/components/ui/activity/ActivityPreview.tsx
"use client";

import { useState, useRef, useCallback, memo, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface ActivityPreviewProps {
  children: React.ReactNode;
  preview: React.ReactNode;
  delay?: number;
  position?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  className?: string;
  previewClassName?: string;
  disabled?: boolean;
}

export const ActivityPreview = memo(function ActivityPreview({
  children,
  preview,
  delay = 300,
  position = "top",
  align = "center",
  className,
  previewClassName,
  disabled = false,
}: ActivityPreviewProps) {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [isMounted, setIsMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // ─── Mount detection ─────────────────────────────────────────
  useEffect(() => {
    setIsMounted(true);
    
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => {
      setIsMounted(false);
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  // ─── Calculate position ──────────────────────────────────────
  const calculatePosition = useCallback(() => {
    if (!triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    let x = 0;
    let y = 0;

    // Mobile: use full width with padding
    if (isMobile) {
      x = 16; // padding
      const previewWidth = window.innerWidth - 32;
      y = rect.bottom + 8;
      
      // If not enough space below, show above
      if (y + 200 > window.innerHeight) {
        y = rect.top - 8 - 200;
      }
      
      setCoords({ x, y });
      return;
    }

    // Desktop: normal positioning
    const previewWidth = 320; // w-80 = 320px
    const previewHeight = 200; // approximate

    // Horizontal alignment
    switch (align) {
      case "start":
        x = rect.left;
        break;
      case "center":
        x = rect.left + rect.width / 2 - previewWidth / 2;
        break;
      case "end":
        x = rect.right - previewWidth;
        break;
    }

    // Clamp to viewport
    x = Math.max(8, Math.min(x, window.innerWidth - previewWidth - 8));

    // Vertical position
    switch (position) {
      case "top":
        y = rect.top - previewHeight - 8;
        break;
      case "bottom":
        y = rect.bottom + 8;
        break;
      case "left":
        y = rect.top + rect.height / 2 - previewHeight / 2;
        x = rect.left - previewWidth - 8;
        break;
      case "right":
        y = rect.top + rect.height / 2 - previewHeight / 2;
        x = rect.right + 8;
        break;
    }

    // Clamp to viewport (vertical)
    y = Math.max(8, Math.min(y, window.innerHeight - previewHeight - 8));

    setCoords({ x, y });
  }, [position, align, isMobile]);

  // ─── Show/Hide handlers ──────────────────────────────────────
  const show = useCallback(() => {
    if (disabled) return;

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    calculatePosition();

    // Shorter delay on mobile
    const mobileDelay = isMobile ? Math.min(delay, 150) : delay;

    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
      timeoutRef.current = null;
    }, mobileDelay);
  }, [delay, calculatePosition, disabled, isMobile]);

  const hide = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
  }, []);

  const handlePreviewMouseEnter = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(true);
  }, []);

  // ─── Cleanup on unmount ──────────────────────────────────────
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  // ─── Position classes ────────────────────────────────────────
  const getPositionClasses = () => {
    const base = "fixed z-[200]";
    
    if (isMobile) {
      return cn(base, "animate-in fade-in-0 slide-in-from-bottom-2 duration-100");
    }
    
    switch (position) {
      case "top":
        return cn(base, "animate-in fade-in-0 slide-in-from-bottom-1 duration-150");
      case "bottom":
        return cn(base, "animate-in fade-in-0 slide-in-from-top-1 duration-150");
      case "left":
        return cn(base, "animate-in fade-in-0 slide-in-from-right-1 duration-150");
      case "right":
        return cn(base, "animate-in fade-in-0 slide-in-from-left-1 duration-150");
      default:
        return cn(base, "animate-in fade-in-0 zoom-in-95 duration-150");
    }
  };

  if (!isMounted) return <>{children}</>;

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className={cn("cursor-pointer", className)}
        aria-describedby={isVisible ? "preview-content" : undefined}
      >
        {children}
      </div>

      {isVisible &&
        createPortal(
          <div
            ref={previewRef}
            id="preview-content"
            role="tooltip"
            className={getPositionClasses()}
            style={{
              left: coords.x,
              top: coords.y,
            }}
            onMouseEnter={handlePreviewMouseEnter}
            onMouseLeave={hide}
          >
            <div
              className={cn(
                isMobile 
                  ? "w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] rounded-xl"
                  : "w-80 max-w-[calc(100vw-2rem)] rounded-2xl",
                "border border-[hsl(var(--border-default))]",
                "bg-[hsl(var(--surface-elevated))] shadow-2xl",
                isMobile ? "p-3" : "p-4",
                "overflow-hidden",
                previewClassName
              )}
            >
              {preview}
            </div>
          </div>,
          document.body
        )}
    </>
  );
});

ActivityPreview.displayName = "ActivityPreview";