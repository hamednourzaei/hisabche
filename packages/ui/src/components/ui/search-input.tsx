"use client";

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Search, X, Clock, ArrowRight } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   SearchInput v3 — i18n-ready
   ═══════════════════════════════════════════════════════════════════════════ */

export interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  placeholder?: string;
  onSearch?: (value: string) => void;
  recentItems?: string[];
  frequentItems?: string[];
  showRecent?: boolean;
  className?: string;
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, placeholder, onSearch, recentItems = [], frequentItems = [], showRecent = true, ...props }, ref) => {
    const { t } = useTranslation();
    const [value, setValue] = React.useState("");
    const [open, setOpen] = React.useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setValue(e.target.value);
      setOpen(true);
      onSearch?.(e.target.value);
    };

    const handleSelect = (item: string) => {
      setValue(item);
      setOpen(false);
      onSearch?.(item);
    };

    const handleClear = () => {
      setValue("");
      onSearch?.("");
    };

    const filteredRecent = recentItems.filter((i) => i.toLowerCase().includes(value.toLowerCase()));
    const filteredFrequent = frequentItems.filter((i) => i.toLowerCase().includes(value.toLowerCase()));
    const hasResults = value.length > 0 && (filteredRecent.length > 0 || filteredFrequent.length > 0);

    return (
      <Popover.Root open={open && hasResults} onOpenChange={setOpen}>
        <div className={cn("relative", className)}>
          <div className="relative">
            <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-[hsl(var(--fg-tertiary))] pointer-events-none" aria-hidden="true" />
            <input
              ref={ref}
              type="text"
              value={value}
              onChange={handleChange}
              onFocus={() => value && setOpen(true)}
              placeholder={placeholder || t("action.search", "جستجو...")}
              className={cn("h-10 w-full rounded-xl", "ps-10 pe-10", "text-sm", "border border-[hsl(var(--border-default))]", "bg-[hsl(var(--surface-base))]", "text-[hsl(var(--fg-primary))]", "placeholder:text-[hsl(var(--fg-tertiary))]", "transition-all duration-200", "focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)] focus:ring-1 focus:ring-[hsl(var(--color-primary)/0.3)]", "motion-reduce:transition-none")}
              {...props}
            />
            {value && (
              <button type="button" onClick={handleClear} className={cn("absolute end-2 top-1/2 -translate-y-1/2", "p-1 rounded-full", "text-[hsl(var(--fg-tertiary))]", "hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]", "transition-colors duration-150", "motion-reduce:transition-none")} aria-label={t("action.clear", "پاک کردن جستجو")}>
                <X className="size-4" aria-hidden="true" />
              </button>
            )}
          </div>

          <Popover.Portal>
            <Popover.Content side="bottom" sideOffset={6} align="start" className={cn("z-50 w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-xl", "border border-[hsl(var(--border-strong))]", "bg-[hsl(var(--surface-elevated))]", "shadow-lg", "data-[state=open]:animate-in data-[state=closed]:animate-out", "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", "data-[state=closed]:slide-out-to-top-1 data-[state=open]:slide-in-from-top-1", "motion-reduce:animate-none")} onOpenAutoFocus={(e) => e.preventDefault()}>
              <div className="max-h-72 overflow-y-auto py-1">
                {showRecent && filteredRecent.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--fg-tertiary))]">
                      <Clock className="size-3" aria-hidden="true" />
                      {t("search.recent", "اخیر")}
                    </div>
                    {filteredRecent.slice(0, 5).map((item, i) => (
                      <button key={`recent-${i}-${item}`} type="button" onClick={() => handleSelect(item)} className={cn("flex w-full items-center gap-2 px-3 py-2.5", "text-sm text-start", "text-[hsl(var(--fg-primary))]", "hover:bg-[hsl(var(--color-primary)/0.08)]", "transition-colors duration-100", "motion-reduce:transition-none", "min-h-[44px]")}>
                        <ArrowRight className="size-3 shrink-0 text-[hsl(var(--fg-tertiary))]" />
                        <span className="truncate">{item}</span>
                      </button>
                    ))}
                  </div>
                )}

                {filteredFrequent.length > 0 && (
                  <div>
                    {showRecent && filteredRecent.length > 0 && <div className="mx-3 my-1 h-px bg-[hsl(var(--border-default))]" />}
                    <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--fg-tertiary))]">
                      {t("search.frequent", "پرتکرار")}
                    </div>
                    {filteredFrequent.slice(0, 3).map((item, i) => (
                      <button key={`freq-${i}-${item}`} type="button" onClick={() => handleSelect(item)} className={cn("flex w-full items-center gap-2 px-3 py-2.5", "text-sm text-start", "text-[hsl(var(--fg-primary))]", "hover:bg-[hsl(var(--color-primary)/0.08)]", "transition-colors duration-100", "motion-reduce:transition-none", "min-h-[44px]")}>
                        <ArrowRight className="size-3 shrink-0 text-[hsl(var(--fg-tertiary))]" />
                        <span className="truncate">{item}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Popover.Content>
          </Popover.Portal>
        </div>
      </Popover.Root>
    );
  }
);

SearchInput.displayName = "SearchInput";

export { SearchInput };