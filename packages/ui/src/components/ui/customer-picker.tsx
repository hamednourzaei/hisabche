"use client"

import { useState, useCallback, useMemo, forwardRef, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { Check, ChevronsUpDown, Plus, User, Loader2 } from "lucide-react"
import { useCustomers, useCreateCustomer } from "@hisabche/api"
import { Button, cn } from "@hisabche/ui"

interface CustomerOption { id: string; name: string; phone: string }

interface CustomerPickerProps {
  value: CustomerOption | null
  onChange: (customer: CustomerOption | null) => void
  onQuickCreate?: (customer: CustomerOption) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export const CustomerPicker = forwardRef<HTMLButtonElement, CustomerPickerProps>(
  ({ value, onChange, onQuickCreate, placeholder, disabled, className }, _ref) => {
    const { t } = useTranslation()
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState("")
    const [debouncedSearch, setDebouncedSearch] = useState("")
    const [quickName, setQuickName] = useState("")
    const [createError, setCreateError] = useState<string | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search), 300); return () => clearTimeout(t) }, [search])

    const { data, isLoading } = useCustomers({ page: 1, limit: 25, sortDirection: "desc", search: debouncedSearch || undefined })
    const createCustomer = useCreateCustomer()

    useEffect(() => {
      if (!open) return
      const h = (e: MouseEvent) => { if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false) }
      document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h)
    }, [open])

    const filtered = useMemo(() => (data?.customers || []).slice(0, 25), [data])

    const handleSelect = useCallback((c: CustomerOption) => { onChange(c); setOpen(false); setSearch(""); setCreateError(null) }, [onChange])

    const handleQuickCreate = useCallback(async () => {
      const trimmed = quickName.trim(); if (!trimmed) return; setCreateError(null)
      try {
        const nc = await createCustomer.mutateAsync({ fullName: trimmed, openingBalance: 0, isActive: true })
        const opt: CustomerOption = { id: nc.id ?? "", name: nc.fullName, phone: nc.phone ?? "" }
        onQuickCreate?.(opt); onChange(opt); setQuickName(""); setOpen(false)
      } catch { setCreateError(t("customer.createError")) }
    }, [quickName, createCustomer, onChange, onQuickCreate, t])

    return (
      <div ref={containerRef} className={cn("relative", className)}>
        <button type="button" disabled={disabled} onClick={() => setOpen(!open)}
          className={cn("flex w-full items-center justify-between gap-2 rounded-xl border px-4 py-3 text-sm transition-colors",
            "border-[var(--hisab-border)] bg-[var(--hisab-card)] hover:border-[var(--hisab-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--hisab-primary)]/20",
            disabled && "opacity-50 cursor-not-allowed")}
          aria-haspopup="listbox" aria-expanded={open}>
          <span className="flex items-center gap-2 truncate"><User className="size-4 shrink-0 text-[var(--hisab-muted-fg)]" />{value ? <span className="font-medium">{value.name}</span> : <span className="text-[var(--hisab-muted-fg)]">{placeholder || t("customer.pickPlaceholder")}</span>}</span>
          <ChevronsUpDown className="size-4 shrink-0 text-[var(--hisab-muted-fg)]" />
        </button>

        {open && (
          <div role="listbox" className="glass-card absolute z-50 mt-2 w-full animate-fade-in-up">
            <div className="border-b border-[var(--hisab-border)] p-3">
              <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("action.search") + "..."}
                className="w-full rounded-lg border border-[var(--hisab-border)] bg-[var(--hisab-background)] px-3 py-2 text-sm placeholder:text-[var(--hisab-muted-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--hisab-primary)]/20" aria-label={t("action.search")} />
            </div>

            <div className="max-h-60 overflow-y-auto p-2">
              {isLoading ? (
                <div className="space-y-2 p-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton-shimmer h-10 rounded-lg" />)}</div>
              ) : filtered.length === 0 ? (
                <p className="p-4 text-center text-sm text-[var(--hisab-muted-fg)]">{t("customer.noCustomers")}</p>
              ) : (
                filtered.map((c) => (
                  <button key={c.id} role="option" aria-selected={value?.id === c.id} onClick={() => handleSelect({ id: c.id ?? "", name: c.fullName, phone: c.phone ?? "" })}
                    className={cn("flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-[var(--hisab-primary)]/10", value?.id === c.id && "bg-[var(--hisab-primary)]/10")}>
                    <div className="text-right"><p className="font-medium">{c.fullName}</p>{c.phone && <p className="text-xs text-[var(--hisab-muted-fg)]">{c.phone}</p>}</div>
                    {value?.id === c.id && <Check className="size-4 shrink-0 text-[var(--hisab-primary)]" />}
                  </button>
                ))
              )}
            </div>

            <div className="border-t border-[var(--hisab-border)] p-3">
              {createError && <p className="mb-2 text-xs text-[var(--hisab-destructive)]">{createError}</p>}
              <div className="flex gap-2">
                <input value={quickName} onChange={(e) => { setQuickName(e.target.value); setCreateError(null) }} placeholder={t("customer.quickCreate")}
                  className="flex-1 rounded-lg border border-[var(--hisab-border)] bg-[var(--hisab-background)] px-3 py-2 text-sm placeholder:text-[var(--hisab-muted-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--hisab-primary)]/20"
                  onKeyDown={(e) => { if (e.key === "Enter") handleQuickCreate() }} aria-label={t("customer.quickCreate")} />
                <Button onClick={handleQuickCreate} disabled={!quickName.trim() || createCustomer.isPending}
                  className="flex shrink-0 items-center gap-1 rounded-lg bg-[var(--hisab-primary)] px-3 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50">
                  {createCustomer.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}{t("action.add")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }
)

CustomerPicker.displayName = "CustomerPicker"