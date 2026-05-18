"use client"

import { useState, useCallback, useMemo, forwardRef, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { Check, ChevronsUpDown, Package, Loader2 } from "lucide-react"
import { useProducts } from "@hisabche/api"
import { cn } from "@hisabche/ui"

interface ProductOption {
  id: string
  name: string
  sellPrice: number
  unit: string
}

interface ProductPickerProps {
  value: ProductOption | null
  onChange: (product: ProductOption | null) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export const ProductPicker = forwardRef<HTMLButtonElement, ProductPickerProps>(
  ({ value, onChange, placeholder, disabled, className }, _ref) => {
    const { t } = useTranslation()
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState("")
    const [debouncedSearch, setDebouncedSearch] = useState("")
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
      const timer = setTimeout(() => setDebouncedSearch(search), 300)
      return () => clearTimeout(timer)
    }, [search])

    const { data, isLoading } = useProducts({
      page: 1,
      limit: 25,
      sortDirection: "desc",
      search: debouncedSearch || undefined,
    })

    useEffect(() => {
      if (!open) return
      const handler = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setOpen(false)
        }
      }
      document.addEventListener("mousedown", handler)
      return () => document.removeEventListener("mousedown", handler)
    }, [open])

    const filtered = useMemo(() => {
      if (!data?.products) return []
      return data.products.slice(0, 25)
    }, [data])

    const handleSelect = useCallback(
      (p: ProductOption) => {
        onChange(p)
        setOpen(false)
        setSearch("")
      },
      [onChange]
    )

    return (
      <div ref={containerRef} className={cn("relative", className)}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(!open)}
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-xl border px-4 py-3 text-sm transition-colors",
            "border-[var(--hisab-border)] bg-[var(--hisab-card)] text-[var(--hisab-foreground)]",
            "hover:border-[var(--hisab-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--hisab-primary)]/20",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className="flex items-center gap-2 truncate">
            <Package className="size-4 shrink-0 text-[var(--hisab-muted-fg)]" />
            {value ? (
              <span className="font-medium">{value.name}</span>
            ) : (
              <span className="text-[var(--hisab-muted-fg)]">
                {placeholder || t("godam.pickProduct") || "انتخاب محصول..."}
              </span>
            )}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-[var(--hisab-muted-fg)]" />
        </button>

        {open && (
          <div
            role="listbox"
            className="absolute z-50 mt-2 w-full rounded-2xl border border-[var(--hisab-border)] bg-[var(--hisab-card)] shadow-lg animate-in fade-in-0 zoom-in-95"
          >
            <div className="border-b border-[var(--hisab-border)] p-3">
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("action.search") + "..."}
                className="w-full rounded-lg border border-[var(--hisab-border)] bg-[var(--hisab-background)] px-3 py-2 text-sm text-[var(--hisab-foreground)] placeholder:text-[var(--hisab-muted-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--hisab-primary)]/20"
                aria-label={t("action.search")}
              />
            </div>

            <div className="max-h-60 overflow-y-auto p-2">
              {isLoading ? (
                <div className="space-y-2 p-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-10 animate-pulse rounded-lg bg-[var(--hisab-muted)]" />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <p className="p-4 text-center text-sm text-[var(--hisab-muted-fg)]">
                  {t("godam.noProducts") || "محصولی پیدا نشد"}
                </p>
              ) : (
                filtered.map((p) => (
                  <button
                    key={p.id}
                    role="option"
                    aria-selected={value?.id === p.id}
                    onClick={() =>
                      handleSelect({
                        id: p.id ?? "",
                        name: p.name,
                        sellPrice: p.sellPrice ?? 0,
                        unit: p.unit ?? "piece",
                      })
                    }
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors",
                      "hover:bg-[var(--hisab-primary)]/10",
                      value?.id === p.id && "bg-[var(--hisab-primary)]/10"
                    )}
                  >
                    <div className="text-right">
                      <p className="font-medium text-[var(--hisab-foreground)]">{p.name}</p>
                      <p className="text-xs text-[var(--hisab-muted-fg)]">
                        {(p.sellPrice ?? 0).toLocaleString()} AFN / {p.unit ?? "عدد"}
                      </p>
                    </div>
                    {value?.id === p.id && (
                      <Check className="size-4 shrink-0 text-[var(--hisab-primary)]" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    )
  }
)

ProductPicker.displayName = "ProductPicker"