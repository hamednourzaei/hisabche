// packages/ui/src/components/ui/activity/KeyboardNavigator.tsx
"use client";

import { useEffect, useCallback, useRef, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

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
  disabled?: boolean;
  onEscape?: () => void;
}

// ─── Helper: Check if key matches shortcut ──────────────────────────────────

function matchesKey(key: string, shortcuts: readonly string[]): boolean {
  return shortcuts.includes(key);
}

// ─── Constants ───────────────────────────────────────────────────────────────

const KEYBOARD_SHORTCUTS = {
  ARROW_DOWN: ["ArrowDown", "j"] as const,
  ARROW_UP: ["ArrowUp", "k"] as const,
  SELECT: ["Enter"] as const,
  MARK_READ: ["r"] as const,
  DELETE: ["Delete", "Backspace"] as const,
  ESCAPE: ["Escape"] as const,
  HOME: ["Home"] as const,
  END: ["End"] as const,
} as const;

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
  disabled = false,
  onEscape,
}: KeyboardNavigatorProps<T>) {
  const { t } = useTranslation();
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // ─── Memoized selected item ──────────────────────────────────────────────
  const selectedItem = useMemo((): T | null => {
    if (selectedIndex >= 0 && selectedIndex < items.length) {
      return items[selectedIndex] ?? null;
    }
    return null;
  }, [selectedIndex, items]);

  // ─── Scroll to selected item ──────────────────────────────────────────────
  const scrollToSelected = useCallback(() => {
    if (selectedIndex < 0 || !containerRef.current || disabled) return;

    const container = containerRef.current;
    const itemsList = container.querySelectorAll('[data-activity-item]');
    const target = itemsList[selectedIndex] as HTMLElement;

    if (target) {
      target.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedIndex, disabled]);

  useEffect(() => {
    scrollToSelected();
  }, [selectedIndex, scrollToSelected]);

  // ─── Auto focus ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (autoFocus && containerRef.current && items.length > 0 && !disabled) {
      const firstItem = containerRef.current.querySelector('[data-activity-item]') as HTMLElement;
      if (firstItem) {
        setTimeout(() => firstItem.focus(), 100);
      }
    }
  }, [autoFocus, items.length, disabled]);

  // ─── Keyboard handlers ─────────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled || items.length === 0) return;

      const key = e.key;

      // ── Navigation ──────────────────────────────────────────
      if (matchesKey(key, KEYBOARD_SHORTCUTS.ARROW_DOWN)) {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, items.length - 1));
        return;
      }

      if (matchesKey(key, KEYBOARD_SHORTCUTS.ARROW_UP)) {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        return;
      }

      if (matchesKey(key, KEYBOARD_SHORTCUTS.HOME)) {
        e.preventDefault();
        setSelectedIndex(0);
        return;
      }

      if (matchesKey(key, KEYBOARD_SHORTCUTS.END)) {
        e.preventDefault();
        setSelectedIndex(items.length - 1);
        return;
      }

      // ── Actions ─────────────────────────────────────────────
      if (matchesKey(key, KEYBOARD_SHORTCUTS.SELECT)) {
        e.preventDefault();
        if (selectedItem) {
          onSelect(selectedItem);
          onOpen(selectedItem);
        }
        return;
      }

      if (matchesKey(key, KEYBOARD_SHORTCUTS.MARK_READ)) {
        e.preventDefault();
        if (selectedItem) {
          onMarkRead(selectedItem);
        }
        return;
      }

      if (matchesKey(key, KEYBOARD_SHORTCUTS.DELETE) && onDelete) {
        e.preventDefault();
        if (selectedItem) {
          onDelete(selectedItem);
        }
        return;
      }

      if (matchesKey(key, KEYBOARD_SHORTCUTS.ESCAPE)) {
        e.preventDefault();
        if (onEscape) {
          onEscape();
        }
        return;
      }
    },
    [disabled, items.length, selectedItem, onSelect, onOpen, onMarkRead, onDelete, onEscape]
  );

  // ─── Reset selection when items change ────────────────────────────────────
  useEffect(() => {
    if (selectedIndex >= items.length) {
      setSelectedIndex(Math.max(0, items.length - 1));
    }
  }, [items.length, selectedIndex]);

  // ─── Announce selection to screen readers ─────────────────────────────────
  useEffect(() => {
    if (selectedItem && isFocused) {
      const announcer = document.getElementById("keyboard-announcer");
      if (announcer) {
        const label = (selectedItem as any).label || selectedItem.id;
        announcer.textContent = t("keyboard.selected", "انتخاب شد: {{label}}", {
          label,
        });
      }
    }
  }, [selectedItem, isFocused, t]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ─── Screen Reader Announcer ────────────────────────── */}
      <div id="keyboard-announcer" className="sr-only" aria-live="polite" />

      <div
        ref={containerRef}
        className={cn(
          "relative",
          disabled && "opacity-50 pointer-events-none",
          className
        )}
        role="listbox"
        aria-label={t("keyboard.activities", "فعالیت‌ها")}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      >
        {children({
          selectedIndex,
          selectedItem,
          setSelectedIndex,
          containerRef,
        })}

        {/* ─── Keyboard shortcuts hint ───────────────────────── */}
        {!disabled && items.length > 0 && (
          <div className="sr-only">
            {t("keyboard.hint", "از کلیدهای جهت‌دار برای حرکت، Enter برای انتخاب، r برای علامت‌گذاری خوانده‌شده استفاده کنید")}
          </div>
        )}
      </div>
    </>
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
  disabled = false,
}: {
  items: T[];
  onSelect: (item: T) => void;
  onOpen: (item: T) => void;
  onMarkRead: (item: T) => void;
  onDelete?: (item: T) => void;
  initialIndex?: number;
  disabled?: boolean;
}) {
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedItem = useMemo((): T | null => {
    if (selectedIndex >= 0 && selectedIndex < items.length) {
      return items[selectedIndex] ?? null;
    }
    return null;
  }, [selectedIndex, items]);

  const scrollToSelected = useCallback(() => {
    if (selectedIndex < 0 || !containerRef.current || disabled) return;

    const container = containerRef.current;
    const itemsList = container.querySelectorAll('[data-activity-item]');
    const target = itemsList[selectedIndex] as HTMLElement;

    if (target) {
      target.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedIndex, disabled]);

  useEffect(() => {
    scrollToSelected();
  }, [selectedIndex, scrollToSelected]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled || items.length === 0) return;

      const key = e.key;
      let newIndex = selectedIndex;

      if (matchesKey(key, KEYBOARD_SHORTCUTS.ARROW_DOWN)) {
        e.preventDefault();
        newIndex = Math.min(selectedIndex + 1, items.length - 1);
      } else if (matchesKey(key, KEYBOARD_SHORTCUTS.ARROW_UP)) {
        e.preventDefault();
        newIndex = Math.max(selectedIndex - 1, 0);
      } else if (matchesKey(key, KEYBOARD_SHORTCUTS.HOME)) {
        e.preventDefault();
        newIndex = 0;
      } else if (matchesKey(key, KEYBOARD_SHORTCUTS.END)) {
        e.preventDefault();
        newIndex = items.length - 1;
      } else if (matchesKey(key, KEYBOARD_SHORTCUTS.SELECT)) {
        e.preventDefault();
        if (selectedItem) {
          onSelect(selectedItem);
          onOpen(selectedItem);
        }
        return;
      } else if (matchesKey(key, KEYBOARD_SHORTCUTS.MARK_READ)) {
        e.preventDefault();
        if (selectedItem) {
          onMarkRead(selectedItem);
        }
        return;
      } else if (matchesKey(key, KEYBOARD_SHORTCUTS.DELETE) && onDelete) {
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
    [selectedIndex, items.length, selectedItem, onSelect, onOpen, onMarkRead, onDelete, disabled]
  );

  return {
    selectedIndex,
    selectedItem,
    setSelectedIndex,
    containerRef,
    handleKeyDown,
    scrollToSelected,
    resetSelection: () => setSelectedIndex(-1),
    isSelected: (item: T) => selectedItem?.id === item.id,
  };
}

KeyboardNavigator.displayName = "KeyboardNavigator";