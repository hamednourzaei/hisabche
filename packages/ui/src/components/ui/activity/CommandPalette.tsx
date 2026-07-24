// packages/ui/src/components/ui/activity/CommandPalette.tsx
"use client";

import { useState, useEffect, useCallback, useRef, memo } from "react";
import { useTranslation } from "react-i18next";
import { Search, X, ArrowUp, ArrowDown, CornerDownLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  shortcut?: string;
  action: () => void;
  category?: string;
  keywords?: string[];
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  items: CommandItem[];
  loading?: boolean;
  placeholder?: string;
  emptyMessage?: string;
  className?: string;
}

export const CommandPalette = memo(function CommandPalette({
  isOpen,
  onClose,
  items,
  loading = false,
  placeholder,
  emptyMessage,
  className,
}: CommandPaletteProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = useState(false);

  // ─── Mount detection ─────────────────────────────────────────
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // ─── Filter items ─────────────────────────────────────────────
  const filteredItems = items.filter((item) => {
    const searchQuery = query.toLowerCase().trim();
    if (!searchQuery) return true;

    const matchLabel = item.label.toLowerCase().includes(searchQuery);
    const matchDescription = item.description?.toLowerCase().includes(searchQuery) ?? false;
    const matchKeywords = item.keywords?.some((kw) =>
      kw.toLowerCase().includes(searchQuery)
    ) ?? false;

    return matchLabel || matchDescription || matchKeywords;
  });

  // ─── Group by category ────────────────────────────────────────
  const groupedItems = filteredItems.reduce((acc, item) => {
    const category = item.category || t("command.palette.uncategorized", "سایر");
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {} as Record<string, CommandItem[]>);

  const categories = Object.keys(groupedItems);

  // ─── Reset on open ────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // ─── Keyboard ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if typing in input
      if (e.target === inputRef.current) {
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filteredItems.length - 1));
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        const item = filteredItems[selectedIndex];
        if (item) {
          item.action();
          onClose();
        }
        return;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex, onClose]);

  // ─── Scroll to selected ──────────────────────────────────────
  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-command-item]');
    const target = items[selectedIndex];
    if (target) {
      target.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedIndex]);

  // ─── Global shortcut ──────────────────────────────────────────
  useEffect(() => {
    const handleGlobal = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      }
    };

    document.addEventListener("keydown", handleGlobal);
    return () => document.removeEventListener("keydown", handleGlobal);
  }, [isOpen, onClose]);

  if (!isOpen || !isMounted) return null;

  const displayPlaceholder = placeholder || t("command.palette.placeholder", "جستجو در فعالیت‌ها...");
  const displayEmpty = emptyMessage || t("command.palette.empty", "نتیجه‌ای یافت نشد");

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] sm:pt-[20vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* ─── Backdrop ───────────────────────────────────────────── */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in-0 duration-200"
        aria-hidden="true"
      />

      {/* ─── Panel ───────────────────────────────────────────────── */}
      <div
        className={cn(
          "relative z-10 w-full max-w-[560px] mx-4 sm:mx-0",
          "rounded-2xl border border-[hsl(var(--border-default))]",
          "bg-[hsl(var(--surface-elevated))] shadow-2xl",
          "animate-in slide-in-from-top-4 duration-200",
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-label={t("command.palette.title", "پالت فرمان")}
      >
        {/* ─── Input ────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[hsl(var(--border-default))]">
          <Search className="size-4 text-[hsl(var(--fg-tertiary))] shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder={displayPlaceholder}
            className="flex-1 bg-transparent text-sm text-[hsl(var(--fg-primary))] outline-none placeholder:text-[hsl(var(--fg-tertiary))]"
            aria-label={displayPlaceholder}
            autoFocus
          />
          <kbd className="shrink-0 text-[10px] text-[hsl(var(--fg-tertiary))] border border-[hsl(var(--border-default))] px-1.5 py-0.5 rounded">
            ⌘K
          </kbd>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[hsl(var(--surface-muted))] transition-colors focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))]"
            aria-label={t("action.close", "بستن")}
          >
            <X className="size-4 text-[hsl(var(--fg-tertiary))]" aria-hidden="true" />
          </button>
        </div>

        {/* ─── Results ───────────────────────────────────────────── */}
        <div
          ref={listRef}
          className="max-h-[320px] overflow-y-auto p-2 space-y-2 scrollbar-thin scrollbar-thumb-[hsl(var(--surface-muted))]"
          role="listbox"
        >
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-[hsl(var(--color-primary))]" aria-hidden="true" />
              <span className="sr-only">{t("common.loading", "در حال بارگذاری...")}</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-12 text-center text-sm text-[hsl(var(--fg-tertiary))]">
              {query ? displayEmpty : t("command.palette.startTyping", "برای جستجو تایپ کنید...")}
            </div>
          ) : (
            categories.map((category) => {
              const categoryItems = groupedItems[category] || [];
              if (categoryItems.length === 0) return null;

              return (
                <div key={category}>
                  <div className="px-3 py-1 text-[10px] font-medium text-[hsl(var(--fg-tertiary))] uppercase tracking-wider">
                    {category}
                  </div>
                  <div className="space-y-1">
                    {categoryItems.map((item) => {
                      const index = filteredItems.indexOf(item);
                      const isSelected = index === selectedIndex;
                      return (
                        <button
                          key={item.id}
                          data-command-item
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            item.action();
                            onClose();
                          }}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-start",
                            "transition-colors duration-100",
                            isSelected
                              ? "bg-[hsl(var(--color-primary)/0.12)] border border-[hsl(var(--color-primary)/0.2)]"
                              : "hover:bg-[hsl(var(--surface-muted))] border border-transparent"
                          )}
                        >
                          {item.icon && (
                            <div className="shrink-0 text-[hsl(var(--fg-secondary))]">
                              {item.icon}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[hsl(var(--fg-primary))]">
                              {item.label}
                            </p>
                            {item.description && (
                              <p className="text-xs text-[hsl(var(--fg-secondary))] line-clamp-1">
                                {item.description}
                              </p>
                            )}
                          </div>
                          {item.shortcut && (
                            <kbd className="shrink-0 text-[10px] text-[hsl(var(--fg-tertiary))] border border-[hsl(var(--border-default))] px-1.5 py-0.5 rounded">
                              {item.shortcut}
                            </kbd>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ─── Footer ───────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-[hsl(var(--border-default))]">
          <div className="flex items-center gap-3 text-[10px] text-[hsl(var(--fg-tertiary))]">
            <span className="flex items-center gap-1">
              <ArrowUp className="size-3" aria-hidden="true" />
              <ArrowDown className="size-3" aria-hidden="true" />
              <span className="hidden xs:inline">{t("command.palette.navigate", "برای حرکت")}</span>
            </span>
            <span className="flex items-center gap-1">
              <CornerDownLeft className="size-3" aria-hidden="true" />
              <span className="hidden xs:inline">{t("command.palette.select", "برای انتخاب")}</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="text-[8px] font-bold px-1 py-0.5 border rounded">Esc</kbd>
              <span className="hidden xs:inline">{t("command.palette.close", "برای بستن")}</span>
            </span>
          </div>
          <span className="text-[10px] text-[hsl(var(--fg-tertiary))]">
            {filteredItems.length} {t("command.palette.results", "نتیجه")}
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
});

CommandPalette.displayName = "CommandPalette";