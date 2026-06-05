"use client"

import {
  useState,
  useCallback,
  useMemo,
  forwardRef,
  useEffect,
} from "react"
import { useTranslation } from "react-i18next"
import * as Select from "@radix-ui/react-select"
import * as Popover from "@radix-ui/react-popover"
import {
  Check,
  ChevronsUpDown,
  Plus,
  User,
  Loader2,
} from "lucide-react"
import { useCustomers, useCreateCustomer } from "@hisabche/api"
import { Button, cn } from "@hisabche/ui"

interface CustomerOption {
  id: string
  name: string
  phone: string
}

interface CustomerPickerProps {
  value: CustomerOption | null
  onChange: (customer: CustomerOption | null) => void
  onQuickCreate?: (customer: CustomerOption) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export const CustomerPicker = forwardRef<
  HTMLButtonElement,
  CustomerPickerProps
>(
  (
    {
      value,
      onChange,
      onQuickCreate,
      placeholder,
      disabled,
      className,
    },
    _ref
  ) => {
    const { t } = useTranslation()
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState("")
    const [debouncedSearch, setDebouncedSearch] = useState("")
    const [quickName, setQuickName] = useState("")
    const [createError, setCreateError] = useState<string | null>(null)

    // Debounce search
    useEffect(() => {
      const timer = setTimeout(() => setDebouncedSearch(search), 300)
      return () => clearTimeout(timer)
    }, [search])

    const { data, isLoading } = useCustomers({
      page: 1,
      limit: 25,
      sortDirection: "desc",
      search: debouncedSearch || undefined,
    })
    const createCustomer = useCreateCustomer()

    const filtered = useMemo(
      () => (data?.customers || []).slice(0, 25),
      [data]
    )

    const handleSelect = useCallback(
      (customerId: string) => {
        const customer = filtered.find(c => c.id === customerId)
        if (customer) {
          onChange({
            id: customer.id ?? "",
            name: customer.fullName,
            phone: customer.phone ?? "",
          })
          setOpen(false)
          setSearch("")
          setCreateError(null)
        }
      },
      [filtered, onChange]
    )

    const handleQuickCreate = useCallback(async () => {
      const trimmed = quickName.trim()
      if (!trimmed) return
      setCreateError(null)
      try {
        const nc = await createCustomer.mutateAsync({
          fullName: trimmed,
          openingBalance: 0,
          isActive: true,
        })
        const opt: CustomerOption = {
          id: nc.id ?? "",
          name: nc.fullName,
          phone: nc.phone ?? "",
        }
        onQuickCreate?.(opt)
        onChange(opt)
        setQuickName("")
        setOpen(false)
      } catch {
        setCreateError(t("customer.createError"))
      }
    }, [quickName, createCustomer, onChange, onQuickCreate, t])

    return (
      <div className={cn("relative", className)}>
        <Select.Root
      open={open}
      onOpenChange={setOpen}
      {...(value?.id ? { value: value.id } : {})}
      onValueChange={handleSelect}
      disabled={disabled ?? false}
    >
      <Select.Trigger
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-xl border px-4 py-3 text-sm transition-colors",
          "border-[var(--hisab-border)] bg-[var(--hisab-card)] hover:border-[var(--hisab-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--hisab-primary)]/20",
          disabled && "cursor-not-allowed opacity-50"
        )}
        aria-label="Customer picker"
      >
        <span className="flex items-center gap-2 truncate text-start">
          <User className="size-4 shrink-0 text-[var(--hisab-muted-fg)]" aria-hidden />
          {value ? (
            <span className="font-medium">{value.name}</span>
          ) : (
            <span className="text-[var(--hisab-muted-fg)]">
              {placeholder || t("customer.pickPlaceholder")}
            </span>
          )}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-[var(--hisab-muted-fg)]" aria-hidden />
      </Select.Trigger>

          <Select.Portal>
            <Select.Content
              position="popper"
              sideOffset={8}
              className={cn(
                "z-50 w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl",
                "border border-[var(--hisab-border)] bg-[var(--hisab-background)] shadow-lg",
                "animate-in fade-in-0 zoom-in-95"
              )}
            >
              <Select.Viewport className="p-2">
                {/* Search */}
                <div className="border-b border-[var(--hisab-border)] pb-2 mb-2">
                  <input
                    autoFocus
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t("action.search") + "..."}
                    className="w-full rounded-lg border border-[var(--hisab-border)] bg-[var(--hisab-background)] px-3 py-2 text-sm placeholder:text-[var(--hisab-muted-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--hisab-primary)]/20"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>

                {/* List */}
                {isLoading ? (
                  <div className="space-y-2 p-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="skeleton-shimmer h-10 rounded-lg" />
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <p className="p-4 text-center text-sm text-[var(--hisab-muted-fg)]">
                    {t("customer.noCustomers")}
                  </p>
                ) : (
                  filtered.map((customer) => (
                    <Select.Item
                      key={customer.id}
                      value={customer.id ?? ""}
                      className={cn(
                        "relative flex cursor-pointer select-none items-center justify-between rounded-lg px-3 py-2.5 text-sm outline-none",
                        "focus:bg-[var(--hisab-primary)]/10",
                        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                      )}
                    >
                      <Select.ItemText>
                        <div>
                          <p className="font-medium">{customer.fullName}</p>
                          {customer.phone && (
                            <p className="text-xs text-[var(--hisab-muted-fg)]">
                              {customer.phone}
                            </p>
                          )}
                        </div>
                      </Select.ItemText>
                      <Select.ItemIndicator>
                        <Check className="size-4 shrink-0 text-[var(--hisab-primary)]" />
                      </Select.ItemIndicator>
                    </Select.Item>
                  ))
                )}

                {/* Quick create section */}
                <div className="border-t border-[var(--hisab-border)] pt-3 mt-2">
                  {createError && (
                    <p className="mb-2 text-xs text-[var(--hisab-destructive)]">
                      {createError}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <input
                      value={quickName}
                      onChange={(e) => {
                        setQuickName(e.target.value)
                        setCreateError(null)
                      }}
                      placeholder={t("customer.quickCreate")}
                      className="flex-1 rounded-lg border border-[var(--hisab-border)] bg-[var(--hisab-background)] px-3 py-2 text-sm placeholder:text-[var(--hisab-muted-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--hisab-primary)]/20"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleQuickCreate()
                      }}
                    />
                    <Button
                      onClick={handleQuickCreate}
                      disabled={!quickName.trim() || createCustomer.isPending}
                      className="flex shrink-0 items-center gap-1 rounded-lg bg-[var(--hisab-primary)] px-3 py-2 text-sm font-medium text-[var(--hisab-primary-fg)] transition-colors hover:opacity-90 disabled:opacity-50"
                    >
                      {createCustomer.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Plus className="size-4" />
                      )}
                      {t("action.add")}
                    </Button>
                  </div>
                </div>
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
      </div>
    )
  }
)

CustomerPicker.displayName = "CustomerPicker"