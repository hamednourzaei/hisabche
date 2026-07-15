"use client";

import {
  useState,
  useCallback,
  useMemo,
  forwardRef,
  useEffect,
  memo,
} from "react";
import { useTranslation } from "react-i18next";
import * as Select from "@radix-ui/react-select";
import {
  Check,
  ChevronsUpDown,
  Plus,
  User,
  Loader2,
} from "lucide-react";
import { useCustomers, useCreateCustomer } from "@hisabche/api";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   CustomerPicker v3 — Memoized · Performance Optimized
   ✅ memo · useCallback · useMemo · safeT wrapper
   ═══════════════════════════════════════════════════════════════════════════ */

interface CustomerOption {
  id: string;
  name: string;
  phone: string;
}

interface CustomerPickerProps {
  value: CustomerOption | null;
  onChange: (customer: CustomerOption | null) => void;
  onQuickCreate?: (customer: CustomerOption) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const CustomerPicker = memo(
  forwardRef<HTMLButtonElement, CustomerPickerProps>(
    (
      {
        value,
        onChange,
        onQuickCreate,
        placeholder,
        disabled,
        className,
      },
      _ref,
    ) => {
      const { t: tOriginal } = useTranslation();

      // ✅ safeT wrapper
      const t = useCallback(
        (key: string, fallback?: string): string => {
          const result = tOriginal(key);
          return result && result !== key ? result : (fallback ?? key);
        },
        [tOriginal]
      );

      const [open, setOpen] = useState(false);
      const [search, setSearch] = useState("");
      const [debouncedSearch, setDebouncedSearch] = useState("");
      const [quickName, setQuickName] = useState("");
      const [createError, setCreateError] = useState<string | null>(null);

      // Debounce search
      useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 300);
        return () => clearTimeout(timer);
      }, [search]);

      const { data, isLoading } = useCustomers({
        page: 1,
        limit: 25,
        sortDirection: "desc",
        search: debouncedSearch || undefined,
      });
      const createCustomer = useCreateCustomer();

      const filtered = useMemo(
        () => (data?.customers || []).slice(0, 25),
        [data],
      );

      const handleSelect = useCallback(
        (customerId: string) => {
          const customer = filtered.find((c) => c.id === customerId);
          if (customer) {
            onChange({
              id: customer.id ?? "",
              name: customer.fullName,
              phone: customer.phone ?? "",
            });
            setOpen(false);
            setSearch("");
            setCreateError(null);
          }
        },
        [filtered, onChange],
      );

      const handleQuickCreate = useCallback(async () => {
        const trimmed = quickName.trim();
        if (!trimmed) return;
        setCreateError(null);
        try {
          const nc = await createCustomer.mutateAsync({
            type: "cash",
            fullName: trimmed,
            openingBalance: 0,
            isActive: true,
          });
          const opt: CustomerOption = {
            id: nc.id ?? "",
            name: nc.fullName,
            phone: nc.phone ?? "",
          };
          onQuickCreate?.(opt);
          onChange(opt);
          setQuickName("");
          setOpen(false);
        } catch {
          setCreateError(t("customer.createError", "خطا در ایجاد مشتری"));
        }
      }, [quickName, createCustomer, onChange, onQuickCreate, t]);

      const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleQuickCreate();
          }
        },
        [handleQuickCreate]
      );

      return (
        <div className={cn("relative", className)}>
          <Select.Root
            open={open}
            onOpenChange={setOpen}
            {...(value?.id ? { value: value.id } : {})}
            onValueChange={handleSelect}
            disabled={disabled ?? false}
          >
            {/* Trigger */}
            <Select.Trigger
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-xl px-4 py-3 text-sm",
                "border border-[hsl(var(--border-default))]",
                "bg-[hsl(var(--surface-base))]",
                "text-[hsl(var(--fg-primary))]",
                "hover:border-[hsl(var(--color-primary)/0.4)]",
                "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary)/0.3)]",
                "transition-colors duration-200",
                "motion-reduce:transition-none",
                disabled && "cursor-not-allowed opacity-40",
              )}
              aria-label={t("customer.pickPlaceholder", "انتخاب مشتری")}
            >
              <span className="flex items-center gap-2 truncate text-start">
                <User
                  className="size-4 shrink-0 text-[hsl(var(--fg-tertiary))]"
                  aria-hidden="true"
                />
                {value ? (
                  <span className="font-medium">{value.name}</span>
                ) : (
                  <span className="text-[hsl(var(--fg-tertiary))]">
                    {placeholder ||
                      t("customer.pickPlaceholder", "انتخاب مشتری...")}
                  </span>
                )}
              </span>
              <ChevronsUpDown
                className="size-4 shrink-0 text-[hsl(var(--fg-tertiary))]"
                aria-hidden="true"
              />
            </Select.Trigger>

            <Select.Portal>
              <Select.Content
                position="popper"
                sideOffset={8}
                className={cn(
                  "z-50 w-[var(--radix-select-trigger-width)] overflow-hidden rounded-2xl",
                  "border border-[hsl(var(--border-strong))]",
                  "bg-[hsl(var(--surface-elevated))]",
                  "shadow-lg",
                  "data-[state=open]:animate-in data-[state=closed]:animate-out",
                  "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
                  "data-[state=closed]:slide-out-to-top-1 data-[state=open]:slide-in-from-top-1",
                  "motion-reduce:animate-none",
                )}
              >
                <Select.Viewport className="p-2">
                  {/* Search */}
                  <div className="border-b border-[hsl(var(--border-default))] pb-2 mb-2">
                    <input
                      autoFocus
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={t("action.search", "جستجو") + "..."}
                      className={cn(
                        "w-full rounded-lg px-3 py-2 text-sm",
                        "border border-[hsl(var(--border-default))]",
                        "bg-[hsl(var(--surface-base))]",
                        "text-[hsl(var(--fg-primary))]",
                        "placeholder:text-[hsl(var(--fg-tertiary))]",
                        "focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)] focus:ring-1 focus:ring-[hsl(var(--color-primary)/0.3)]",
                      )}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>

                  {/* Loading */}
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2
                        className="size-5 animate-spin text-[hsl(var(--fg-tertiary))]"
                        aria-hidden="true"
                      />
                    </div>
                  ) : filtered.length === 0 ? (
                    <p className="p-4 text-center text-sm text-[hsl(var(--fg-tertiary))]">
                      {t("customer.noCustomers", "مشتری‌ای پیدا نشد")}
                    </p>
                  ) : (
                    filtered.map((customer) => (
                      <Select.Item
                        key={customer.id}
                        value={customer.id ?? ""}
                        className={cn(
                          "relative flex cursor-pointer select-none items-center justify-between rounded-lg px-3 py-2.5 text-sm outline-none",
                          "min-h-[44px]",
                          "text-[hsl(var(--fg-primary))]",
                          "data-[highlighted]:bg-[hsl(var(--color-primary)/0.08)]",
                          "transition-colors duration-100",
                          "motion-reduce:transition-none",
                        )}
                      >
                        <Select.ItemText>
                          <div>
                            <p className="font-medium">{customer.fullName}</p>
                            {customer.phone && (
                              <p className="text-xs text-[hsl(var(--fg-tertiary))]">
                                {customer.phone}
                              </p>
                            )}
                          </div>
                        </Select.ItemText>
                        <Select.ItemIndicator>
                          <Check className="size-4 shrink-0 text-[hsl(var(--color-success))]" />
                        </Select.ItemIndicator>
                      </Select.Item>
                    ))
                  )}

                  {/* Quick create */}
                  <div className="border-t border-[hsl(var(--border-default))] pt-3 mt-2">
                    {createError && (
                      <p
                        className="mb-2 text-xs text-[hsl(var(--color-destructive))]"
                        role="alert"
                      >
                        {createError}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <input
                        value={quickName}
                        onChange={(e) => {
                          setQuickName(e.target.value);
                          setCreateError(null);
                        }}
                        placeholder={t(
                          "customer.quickCreate",
                          "ایجاد سریع مشتری"
                        )}
                        className={cn(
                          "flex-1 rounded-lg px-3 py-2 text-sm",
                          "border border-[hsl(var(--border-default))]",
                          "bg-[hsl(var(--surface-base))]",
                          "text-[hsl(var(--fg-primary))]",
                          "placeholder:text-[hsl(var(--fg-tertiary))]",
                          "focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)] focus:ring-1 focus:ring-[hsl(var(--color-primary)/0.3)]",
                        )}
                        onKeyDown={handleKeyDown}
                      />
                      <button
                        type="button"
                        onClick={handleQuickCreate}
                        disabled={!quickName.trim() || createCustomer.isPending}
                        className={cn(
                          "flex shrink-0 items-center gap-1 rounded-lg px-3 py-2",
                          "text-sm font-medium text-white",
                          "bg-[var(--gradient-brand)]",
                          "transition-all duration-200",
                          "hover:brightness-110",
                          "disabled:opacity-40 disabled:cursor-not-allowed",
                          "motion-reduce:transition-none",
                        )}
                      >
                        {createCustomer.isPending ? (
                          <Loader2
                            className="size-4 animate-spin"
                            aria-hidden="true"
                          />
                        ) : (
                          <Plus className="size-4" aria-hidden="true" />
                        )}
                        {t("action.add", "افزودن")}
                      </button>
                    </div>
                  </div>
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
        </div>
      );
    }
  )
);

CustomerPicker.displayName = "CustomerPicker";