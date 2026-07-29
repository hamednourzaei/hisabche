// packages/ui/src/components/ui/accounting/components/DateRangePicker.tsx
"use client";

import { memo } from "react";
import { useTranslations } from "next-intl";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface SingleDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}

export const SingleDatePicker = memo(function SingleDatePicker({
  value,
  onChange,
  label,
  className,
}: SingleDatePickerProps) {
  const t = useTranslations();

  return (
    <div className={cn("flex flex-col gap-1 md:gap-1.5", className)}>
      {label && (
        <label className="text-[10px] md:text-xs lg:text-sm text-[hsl(var(--fg-secondary))] font-medium">
          {label}
        </label>
      )}
      <div className="relative">
        <Calendar className="absolute start-2.5 md:start-3 top-1/2 -translate-y-1/2 size-3.5 md:size-4 text-[hsl(var(--fg-tertiary))] pointer-events-none" aria-hidden="true" />
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "w-full rounded-lg border border-[hsl(var(--border-default))] bg-transparent",
            "h-8 md:h-9 lg:h-10",
            "ps-8 md:ps-9 lg:ps-10 pe-2 md:pe-3",
            "text-[11px] md:text-xs lg:text-sm text-[hsl(var(--fg-primary))]",
            "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))]"
          )}
          aria-label={label || t("accounting.dateRange.date")}
        />
      </div>
    </div>
  );
});

interface DateRangePickerProps {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  className?: string;
}

export const DateRangePicker = memo(function DateRangePicker({
  from,
  to,
  onFromChange,
  onToChange,
  className,
}: DateRangePickerProps) {
  const t = useTranslations();

  return (
    <div className={cn("flex items-end gap-2 md:gap-3", className)}>
      <SingleDatePicker
        value={from}
        onChange={onFromChange}
        label={t("accounting.dateRange.from")}
      />
      <SingleDatePicker
        value={to}
        onChange={onToChange}
        label={t("accounting.dateRange.to")}
      />
    </div>
  );
});
