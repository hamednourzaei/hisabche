// packages/ui/src/components/ui/activity/CommandPalette.tsx
"use client";

import { useState, useEffect, useCallback, useRef, memo } from "react";
import { useTranslation } from "react-i18next";
import { Search, X, ArrowUp, ArrowDown, CornerDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  items: CommandItem[];
}

export const CommandPalette = memo(function CommandPalette({
  isOpen,
  onClose,
  items,
}: CommandPaletteProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filteredItems = items.filter(
    (item) =>
      item.label.toLowerCase().includes(query.toLowerCase()) ||
      item.description?.toLowerCase().includes(query.toLowerCase())
  );

  // ─── Reset on open ──────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // ─── Keyboard ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    const h = (e: KeyboardEvent) => {
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

    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [isOpen, filteredItems, selectedIndex, onClose]);

  // ─── Scroll to selected ──────────────────────────────────────────────────
  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-command-item]');
    const target = items[selectedIndex];
    if (target) {
      target.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* ─── Backdrop ───────────────────────────────────────────── */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in-0 duration-200" />

      {/* ─── Panel ───────────────────────────────────────────────── */}
      <div
        className="relative z-10 w-full max-w-[560px] rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] shadow-2xl animate-in slide-in-from-top-4 duration-200"
      >
        {/* Input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[hsl(var(--border-default))]">
          <Search className="size-4 text-[hsl(var(--fg-tertiary))]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("command.palette.placeholder", "جستجو در فعالیت‌ها...")}
            className="flex-1 bg-transparent text-sm text-[hsl(var(--fg-primary))] outline-none placeholder:text-[hsl(var(--fg-tertiary))]"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[hsl(var(--surface-muted))] transition-colors"
          >
            <X className="size-4 text-[hsl(var(--fg-tertiary))]" />
          </button>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[300px] overflow-y-auto p-2 space-y-1">
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-sm text-[hsl(var(--fg-tertiary))]">
              {t("command.palette.empty", "نتیجه‌ای یافت نشد")}
            </div>
          ) : (
            filteredItems.map((item, index) => (
              <button
                key={item.id}
                data-command-item
                onClick={() => {
                  item.action();
                  onClose();
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-start",
                  "transition-colors duration-100",
                  index === selectedIndex
                    ? "bg-[hsl(var(--color-primary)/0.1)]"
                    : "hover:bg-[hsl(var(--surface-muted))]"
                )}
              >
                {item.icon && (
                  <div className="shrink-0">{item.icon}</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[hsl(var(--fg-primary))]">
                    {item.label}
                  </p>
                  {item.description && (
                    <p className="text-xs text-[hsl(var(--fg-secondary))]">
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
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-[hsl(var(--border-default))]">
          <div className="flex items-center gap-3 text-[10px] text-[hsl(var(--fg-tertiary))]">
            <span className="flex items-center gap-1">
              <ArrowUp className="size-3" />
              <ArrowDown className="size-3" />
              {t("command.palette.navigate", "برای حرکت")}
            </span>
            <span className="flex items-center gap-1">
              <CornerDownLeft className="size-3" />
              {t("command.palette.select", "برای انتخاب")}
            </span>
            <span className="flex items-center gap-1">
              <span className="text-[8px] font-bold px-1 py-0.5 border rounded">Esc</span>
              {t("command.palette.close", "برای بستن")}
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