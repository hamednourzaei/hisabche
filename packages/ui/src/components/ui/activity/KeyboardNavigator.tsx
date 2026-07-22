// packages/ui/src/components/ui/activity/KeyboardNavigator.tsx
"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { useKeyboardShortcuts } from "../../../hooks/activity/useAccessibility";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KeyboardNavigatorItem {
  id: string;
  [key: string]: unknown;
}

export interface KeyboardNavigatorProps<T extends KeyboardNavigatorItem> {
  items: T[];
  onSelect: (item: T) => void;
  onOpen: (item: T) => void;
  onMarkRead: (item: T) => void;
  onDelete?: (item: T) => void;
  children: (props: {
    selectedIndex: number;
    selectedItem: T | null;
    setSelectedIndex: (index: number) => void;
    containerRef: React.RefObject<HTMLDivElement>;
  }) => React.ReactNode;
  initialIndex?: number;
  autoFocus?: boolean;
  className?: string;
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function KeyboardNavigator<T extends KeyboardNavigatorItem>({
  items,
  onSelect,
  onOpen,
  onMarkRead,
  onDelete,
  children,
  initialIndex = -1,
  autoFocus = true,
  className,
}: KeyboardNavigatorProps<T>) {
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const containerRef = useRef<HTMLDivElement>(null);

  // ✅ اصلاح: استفاده از as cast برای رفع خطا
  const selectedItem = (selectedIndex >= 0 && selectedIndex < items.length
    ? items[selectedIndex]
    : null) as T | null;

  // ─── Scroll to selected item ──────────────────────────────────────────────
  const scrollToSelected = useCallback(() => {
    if (selectedIndex < 0 || !containerRef.current) return;

    const container = containerRef.current;
    const items = container.querySelectorAll('[data-activity-item]');
    const target = items[selectedIndex] as HTMLElement;

    if (target) {
      target.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedIndex]);

  useEffect(() => {
    scrollToSelected();
  }, [selectedIndex, scrollToSelected]);

  // ─── Auto focus ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (autoFocus && containerRef.current && items.length > 0) {
      const firstItem = containerRef.current.querySelector('[data-activity-item]') as HTMLElement;
      if (firstItem) {
        firstItem.focus();
      }
    }
  }, [autoFocus, items.length]);

  // ─── Keyboard shortcuts ────────────────────────────────────────────────────
  useKeyboardShortcuts({
    "arrowdown": () => {
      setSelectedIndex((prev) => Math.min(prev + 1, items.length - 1));
    },
    "arrowup": () => {
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    },
    "j": () => {
      setSelectedIndex((prev) => Math.min(prev + 1, items.length - 1));
    },
    "k": () => {
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    },
    "enter": () => {
      if (selectedItem) {
        onSelect(selectedItem);
        onOpen(selectedItem);
      }
    },
    "r": () => {
      if (selectedItem) {
        onMarkRead(selectedItem);
      }
    },
    "delete": () => {
      if (selectedItem && onDelete) {
        onDelete(selectedItem);
      }
    },
  });

  // ─── Reset selection when items change ────────────────────────────────────
  useEffect(() => {
    if (selectedIndex >= items.length) {
      setSelectedIndex(Math.max(0, items.length - 1));
    }
  }, [items.length, selectedIndex]);

  // ─── Return ─────────────────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      className={className}
      role="listbox"
      aria-label="فعالیت‌ها"
      tabIndex={0}
      onKeyDown={(e) => {
        if (["ArrowDown", "ArrowUp", "j", "k", "Enter", "r", "Delete"].includes(e.key)) {
          e.preventDefault();
        }
      }}
    >
      {children({
        selectedIndex,
        selectedItem,
        setSelectedIndex,
        containerRef,
      })}
    </div>
  );
}

KeyboardNavigator.displayName = "KeyboardNavigator";

// ─── Hook برای استفاده آسان ──────────────────────────────────────────────────

export function useKeyboardNavigator<T extends KeyboardNavigatorItem>({
  items,
  onSelect,
  onOpen,
  onMarkRead,
  onDelete,
  initialIndex = -1,
}: Pick<KeyboardNavigatorProps<T>, "items" | "onSelect" | "onOpen" | "onMarkRead" | "onDelete" | "initialIndex">) {
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const containerRef = useRef<HTMLDivElement>(null);

  // ✅ اصلاح: استفاده از as cast برای رفع خطا
  const selectedItem = (selectedIndex >= 0 && selectedIndex < items.length
    ? items[selectedIndex]
    : null) as T | null;

  const scrollToSelected = useCallback(() => {
    if (selectedIndex < 0 || !containerRef.current) return;

    const container = containerRef.current;
    const items = container.querySelectorAll('[data-activity-item]');
    const target = items[selectedIndex] as HTMLElement;

    if (target) {
      target.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedIndex]);

  useEffect(() => {
    scrollToSelected();
  }, [selectedIndex, scrollToSelected]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      let newIndex = selectedIndex;

      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        newIndex = Math.min(selectedIndex + 1, items.length - 1);
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        newIndex = Math.max(selectedIndex - 1, 0);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (selectedItem) {
          onSelect(selectedItem);
          onOpen(selectedItem);
        }
        return;
      } else if (e.key === "r") {
        e.preventDefault();
        if (selectedItem) {
          onMarkRead(selectedItem);
        }
        return;
      } else if (e.key === "Delete" && onDelete) {
        e.preventDefault();
        if (selectedItem) {
          onDelete(selectedItem);
        }
        return;
      } else {
        return;
      }

      setSelectedIndex(newIndex);
    },
    [selectedIndex, items.length, selectedItem, onSelect, onOpen, onMarkRead, onDelete]
  );

  return {
    selectedIndex,
    selectedItem,
    setSelectedIndex,
    containerRef,
    handleKeyDown,
    scrollToSelected,
    resetSelection: () => setSelectedIndex(-1),
  };
}