// packages/ui/src/components/ui/activity/ActivityPreview.tsx
"use client";

import { useState, useRef, useCallback, memo } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface ActivityPreviewProps {
  children: React.ReactNode;
  preview: React.ReactNode;
  delay?: number;
}

export const ActivityPreview = memo(function ActivityPreview({
  children,
  preview,
  delay = 400,
}: ActivityPreviewProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const timeoutRef = useRef<NodeJS.Timeout>();
  const triggerRef = useRef<HTMLDivElement>(null);

  const show = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPosition({
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  }, [delay]);

  const hide = useCallback(() => {
    clearTimeout(timeoutRef.current);
    setIsVisible(false);
  }, []);

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        className="cursor-pointer"
      >
        {children}
      </div>

      {isVisible &&
        createPortal(
          <div
            className={cn(
              "fixed z-[200] transform -translate-x-1/2 -translate-y-full",
              "animate-in fade-in-0 zoom-in-95 duration-150"
            )}
            style={{
              left: position.x,
              top: position.y - 8,
            }}
            onMouseEnter={() => {
              clearTimeout(timeoutRef.current);
              setIsVisible(true);
            }}
            onMouseLeave={hide}
          >
            <div className="w-80 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] shadow-2xl p-4">
              {preview}
            </div>
          </div>,
          document.body
        )}
    </>
  );
});

ActivityPreview.displayName = "ActivityPreview";