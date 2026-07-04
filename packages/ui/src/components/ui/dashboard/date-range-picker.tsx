// packages/ui/src/components/ui/dashboard/date-range-picker.tsx
"use client";

import { cn } from "@/lib/utils";
import { useState, useRef, useEffect, useCallback } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";

export interface DateRange {
  from: Date;
  to: Date;
}

export type PresetKey = "today" | "7days" | "30days" | "thisMonth" | "lastMonth" | "custom";

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange, preset: PresetKey) => void;
  t: (key: string, fallback?: string) => string;
  disabled?: boolean;
}

/* ─── Presets Helper ──────────────────────────────────────────────────────── */

function getPresetRange(preset: PresetKey): DateRange {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "7days": {
      const from = new Date(today);
      from.setDate(from.getDate() - 6);
      return { from, to: today };
    }
    case "30days": {
      const from = new Date(today);
      from.setDate(from.getDate() - 29);
      return { from, to: today };
    }
    case "thisMonth":
      return { from: new Date(today.getFullYear(), today.getMonth(), 1), to: today };
    case "lastMonth": {
      const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: firstDay, to: lastDay };
    }
    case "custom":
    default:
      return { from: today, to: today };
  }
}

const PRESETS: { key: PresetKey; labelKey: string }[] = [
  { key: "today", labelKey: "dateRange.today" },
  { key: "7days", labelKey: "dateRange.7days" },
  { key: "30days", labelKey: "dateRange.30days" },
  { key: "thisMonth", labelKey: "dateRange.thisMonth" },
  { key: "lastMonth", labelKey: "dateRange.lastMonth" },
];

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("fa-AF", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

/* ─── Component ───────────────────────────────────────────────────────────── */

export function DateRangePicker({
  value,
  onChange,
  t,
  disabled = false,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<PresetKey>("7days");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleSelectPreset = useCallback(
    (preset: PresetKey) => {
      const range = getPresetRange(preset);
      setActivePreset(preset);
      onChange(range, preset);
      setIsOpen(false);
    },
    [onChange],
  );

  const handleApplyCustom = useCallback(() => {
    if (!customFrom || !customTo) return;
    const from = new Date(customFrom);
    const to = new Date(customTo);
    if (isNaN(from.getTime()) || isNaN(to.getTime())) return;

    setActivePreset("custom");
    onChange({ from, to }, "custom");
    setIsOpen(false);
  }, [customFrom, customTo, onChange]);

  // بستن با کلیک بیرون
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        btnRef.current &&
        !btnRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 10);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // بستن با Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
        btnRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const currentLabel =
    activePreset === "custom"
      ? `${formatDate(value.from)} — ${formatDate(value.to)}`
      : t(`dateRange.${activePreset}`, activePreset);

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        ref={btnRef}
        type="button"
        onClick={() => !disabled && setIsOpen((p) => !p)}
        disabled={disabled}
        className={cn(
          "flex items-center gap-2 h-9 px-3 rounded-lg border text-sm",
          "transition-all duration-150 motion-reduce:transition-none",
          disabled
            ? "opacity-50 cursor-not-allowed"
            : "hover:bg-[hsl(var(--surface-muted))] active:bg-[hsl(var(--surface-elevated))]",
          "border-[hsl(var(--border-default))]",
          "text-[hsl(var(--fg-secondary))]",
          isOpen && "bg-[hsl(var(--surface-muted))] border-[hsl(var(--color-primary)/0.3)]",
        )}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <CalendarDays className="size-4 shrink-0 text-[hsl(var(--fg-tertiary))]" aria-hidden="true" />
        <span className="truncate max-w-[160px]">{currentLabel}</span>
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 text-[hsl(var(--fg-tertiary))] transition-transform duration-150",
            isOpen && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          ref={panelRef}
          role="listbox"
          className={cn(
            "absolute end-0 top-full mt-1 z-20 w-56",
            "rounded-xl overflow-hidden border",
            "bg-[hsl(var(--surface-elevated)/0.99)] backdrop-blur-xl",
            "shadow-xl shadow-black/10",
            "border-[hsl(var(--border-default))]",
            "animate-in slide-in-from-top-1 fade-in-0 duration-150 motion-reduce:animate-none",
          )}
        >
          {/* Preset Options */}
          <div className="py-1">
            {PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                role="option"
                aria-selected={activePreset === preset.key}
                onClick={() => handleSelectPreset(preset.key)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm text-start",
                  "transition-colors duration-100",
                  activePreset === preset.key
                    ? "bg-[hsl(var(--color-primary)/0.10)] text-[hsl(var(--color-primary))] font-semibold"
                    : "text-[hsl(var(--fg-primary))] hover:bg-[hsl(var(--surface-muted))]",
                )}
              >
                <span className="flex-1">{t(preset.labelKey, preset.key)}</span>
                {activePreset === preset.key && (
                  <svg
                    width={14}
                    height={14}
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="shrink-0"
                  >
                    <path d="M5 10l3.5 3.5L15 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>

          {/* Separator */}
          <div className="h-px bg-[hsl(var(--border-default))]" />

          {/* Custom Range */}
          <div className="p-3 space-y-2">
            <p className="text-[11px] font-semibold text-[hsl(var(--fg-tertiary))] tracking-wide">
              {t("dateRange.custom", "محدوده سفارشی")}
            </p>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className={cn(
                  "flex-1 h-8 px-2 rounded-md border text-xs",
                  "bg-[hsl(var(--surface-base))] text-[hsl(var(--fg-primary))]",
                  "border-[hsl(var(--border-default))]",
                  "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary)/0.18)]",
                  "placeholder:text-[hsl(var(--fg-tertiary))]",
                )}
                dir="ltr"
              />
              <span className="text-xs text-[hsl(var(--fg-tertiary))]">—</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className={cn(
                  "flex-1 h-8 px-2 rounded-md border text-xs",
                  "bg-[hsl(var(--surface-base))] text-[hsl(var(--fg-primary))]",
                  "border-[hsl(var(--border-default))]",
                  "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary)/0.18)]",
                  "placeholder:text-[hsl(var(--fg-tertiary))]",
                )}
                dir="ltr"
              />
            </div>
            <button
              type="button"
              onClick={handleApplyCustom}
              disabled={!customFrom || !customTo}
              className={cn(
                "w-full h-8 rounded-lg text-xs font-medium",
                "transition-all duration-150",
                customFrom && customTo
                  ? "bg-[hsl(var(--color-primary))] text-white hover:opacity-90 active:opacity-80"
                  : "bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-tertiary))] cursor-not-allowed",
              )}
            >
              {t("dateRange.apply", "اعمال")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}