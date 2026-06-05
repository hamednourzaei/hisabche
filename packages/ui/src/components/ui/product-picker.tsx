"use client"

import {
  useState,
  useCallback,
  useMemo,
  forwardRef,
  useEffect,
} from "react"
import { useTranslation } from "react-i18next"
import { Package } from "lucide-react"
import { useProducts } from "@hisabche/api"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select"

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

export const ProductPicker = forwardRef<
  HTMLButtonElement,
  ProductPickerProps
>(
  (
    { value, onChange, placeholder, disabled = false, className },
    _ref
  ) => {
    const { t } = useTranslation()
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState("")
    const [debouncedSearch, setDebouncedSearch] = useState("")

    // debounce search
    useEffect(() => {
      const timer = setTimeout(() => {
        setDebouncedSearch(search)
      }, 300)

      return () => clearTimeout(timer)
    }, [search])

    const { data, isLoading } = useProducts({
      page: 1,
      limit: 25,
      sortDirection: "desc",
      search: debouncedSearch || undefined,
    })

    const products = useMemo(
      () => data?.products ?? [],
      [data]
    )

    const handleSelect = useCallback(
      (productId: string) => {
        const product = products.find((p) => p.id === productId)

        if (!product) return

        onChange({
          id: product.id ?? "",
          name: product.name,
          sellPrice: product.sellPrice ?? 0,
          unit: product.unit ?? "piece",
        })

        setOpen(false)
        setSearch("")
      },
      [products, onChange]
    )

    return (
      <Select
        open={open}
        onOpenChange={setOpen}
        value={value?.id ?? ""}
        onValueChange={handleSelect}
        disabled={disabled}
      >
        <SelectTrigger className={cn("w-full rounded-xl", className)}>
          <div className="flex items-center gap-2 truncate">
            <Package className="size-4 shrink-0 text-muted-foreground" />
            <SelectValue
              placeholder={
                placeholder ||
                t("godam.pickProduct") ||
                "انتخاب محصول..."
              }
            />
          </div>
        </SelectTrigger>

        <SelectContent className="max-h-80">
          {/* Search */}
          <div className="sticky top-0 z-10 border-b border-border bg-popover p-2">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("action.search") + "..."}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Loading */}
          {isLoading ? (
            <div className="space-y-2 p-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-10 rounded-lg skeleton-shimmer"
                />
              ))}
            </div>
          ) : products.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              {t("godam.noProducts") || "محصولی پیدا نشد"}
            </p>
          ) : (
            products.map((product) => (
              <SelectItem
                key={product.id}
                value={product.id ?? ""}
                className="cursor-pointer"
              >
                <div>
                  <p className="font-medium">{product.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(product.sellPrice ?? 0).toLocaleString()} AFN /{" "}
                    {product.unit ?? "عدد"}
                  </p>
                </div>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    )
  }
)

ProductPicker.displayName = "ProductPicker"