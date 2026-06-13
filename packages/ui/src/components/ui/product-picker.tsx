"use client";

import {
  useState,
  useCallback,
  useMemo,
  forwardRef,
  useEffect,
} from "react";
import { useTranslation } from "react-i18next";
import { Package, Loader2, Search } from "lucide-react";
import { useProducts } from "@hisabche/api";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

/* ═══════════════════════════════════════════════════════════════════════════
   ProductPicker v2 — Hisabche Design Language
   Zero hardcoded colors — all tokens from design system
   ═══════════════════════════════════════════════════════════════════════════ */

interface ProductOption {
  id: string;
  name: string;
  sellPrice: number;
  unit: string;
}

interface ProductPickerProps {
  value: ProductOption | null;
  onChange: (product: ProductOption | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const ProductPicker = forwardRef<HTMLButtonElement, ProductPickerProps>(
  ({ value, onChange, placeholder, disabled = false, className }, _ref) => {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    // Debounce search — 300ms
    useEffect(() => {
      const timer = setTimeout(() => {
        setDebouncedSearch(search);
      }, 300);
      return () => clearTimeout(timer);
    }, [search]);

    const { data, isLoading } = useProducts({
      page: 1,
      limit: 25,
      sortDirection: "desc",
      search: debouncedSearch || undefined,
    });

    const products = useMemo(() => data?.products ?? [], [data]);

    const handleSelect = useCallback(
      (productId: string) => {
        const product = products.find((p) => p.id === productId);
        if (!product) return;

        onChange({
          id: product.id ?? "",
          name: product.name,
          sellPrice: product.sellPrice ?? 0,
          unit: product.unit ?? "piece",
        });

        setOpen(false);
        setSearch("");
      },
      [products, onChange],
    );

    return (
      <Select
        open={open}
        onOpenChange={setOpen}
        value={value?.id ?? ""}
        onValueChange={handleSelect}
        disabled={disabled}
      >
        <SelectTrigger className={cn("w-full", className)}>
          <div className="flex items-center gap-2 truncate">
            <Package
              className="size-4 shrink-0 text-[hsl(var(--fg-tertiary))]"
              aria-hidden="true"
            />
            <SelectValue
              placeholder={
                placeholder ||
                t("godam.pickProduct", "انتخاب محصول...")
              }
            />
          </div>
        </SelectTrigger>

        <SelectContent className="max-h-80">
          {/* Search input */}
          <div className="sticky top-0 z-10 p-2 border-b border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]">
            <div className="relative">
              <Search
                className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--fg-tertiary))] pointer-events-none"
                aria-hidden="true"
              />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("action.search", "جستجو") + "..."}
                className={cn(
                  "w-full rounded-lg ps-9 pe-3 py-2",
                  "text-sm",
                  "border border-[hsl(var(--border-default))]",
                  "bg-[hsl(var(--surface-base))]",
                  "text-[hsl(var(--fg-primary))]",
                  "placeholder:text-[hsl(var(--fg-tertiary))]",
                  "focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)] focus:ring-1 focus:ring-[hsl(var(--color-primary)/0.3)]",
                )}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Loading state */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2
                className="size-5 animate-spin text-[hsl(var(--fg-tertiary))]"
                aria-hidden="true"
              />
            </div>
          ) : products.length === 0 ? (
            <p className="p-4 text-center text-sm text-[hsl(var(--fg-tertiary))]">
              {t("godam.noProducts", "محصولی پیدا نشد")}
            </p>
          ) : (
            products.map((product) => (
              <SelectItem
                key={product.id}
                value={product.id ?? ""}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-[hsl(var(--fg-primary))]">
                    {product.name}
                  </span>
                  <span className="text-xs text-[hsl(var(--fg-tertiary))]">
                    {(product.sellPrice ?? 0).toLocaleString()} AFN /{" "}
                    {product.unit ?? t("godam.units.piece", "عدد")}
                  </span>
                </div>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    );
  },
);

ProductPicker.displayName = "ProductPicker";