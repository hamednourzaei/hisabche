"use client"

import { useState, useEffect } from "react"
import { Button } from "../button"
import { Badge } from "../badge"
import { Card, CardContent } from "../card"
import { Input } from "../input"
import { Label } from "../label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../select"
import {
  ArrowRight,
  Package,
  DollarSign,
  AlertTriangle,
  Loader2,
  Save,
  Trash2,
  Edit3,
  X,
  type LucideIcon,
} from "lucide-react"

type UnitType = "piece" | "kg" | "liter" | "meter" | "box"

// ProductData با unit از نوع string (برای سازگاری با API)
interface ProductData {
  name: string
  sellPrice: number
  buyPrice: number
  quantity: number
  minStockLevel: number
  category: string
  unit: string  // از API می‌آید، می‌تواند هر string باشد
}

interface ProductEditValues {
  name: string
  sellPrice: number
  buyPrice: number
  quantity: number
  minStockLevel: number
  category: string
  unit: UnitType
}

const UNIT_OPTIONS = [
  { value: "piece" as const, labelKey: "godam.units.piece", fallback: "عدد" },
  { value: "kg" as const, labelKey: "godam.units.kg", fallback: "کیلوگرم" },
  { value: "liter" as const, labelKey: "godam.units.liter", fallback: "لیتر" },
  { value: "meter" as const, labelKey: "godam.units.meter", fallback: "متر" },
  { value: "box" as const, labelKey: "godam.units.box", fallback: "کارتن" },
] as const

// Helper to validate if string is valid UnitType
const toUnitType = (unit: string): UnitType => {
  if (UNIT_OPTIONS.some(opt => opt.value === unit)) {
    return unit as UnitType
  }
  return "piece"
}

function InfoBox({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: LucideIcon
  label: string
  value: string
  color: string
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <Icon className="size-4" style={{ color }} aria-hidden />
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <p className="font-bold tabular-nums text-foreground">{value}</p>
    </div>
  )
}

export interface ProductDetailPageProps {
  t: (key: string, fallback?: string) => string
  fmt: (v: number) => string
  isLoading: boolean
  product: ProductData | null
  editing: boolean
  updatePending: boolean
  stockStatus: "success" | "warning" | "destructive" | "secondary"
  stockLabel: string
  profitPerUnit: number
  totalProfit: number
  totalValue: number
  onBack: () => void
  onStartEditing: () => void
  onCancelEditing: () => void
  onSave: (data: ProductEditValues) => void
  onDelete: () => void
}

export function ProductDetailPage({
  t,
  fmt,
  isLoading,
  product,
  editing,
  updatePending,
  stockStatus,
  stockLabel,
  profitPerUnit,
  totalProfit,
  totalValue,
  onBack,
  onStartEditing,
  onCancelEditing,
  onSave,
  onDelete,
}: ProductDetailPageProps) {
  const [editValues, setEditValues] = useState<ProductEditValues>({
    name: "",
    sellPrice: 0,
    buyPrice: 0,
    quantity: 0,
    minStockLevel: 0,
    category: "general",
    unit: "piece",
  })

  const [errors, setErrors] = useState<Partial<Record<keyof ProductEditValues, string>>>({})

  useEffect(() => {
    if (product) {
      setEditValues({
        name: product.name,
        sellPrice: product.sellPrice,
        buyPrice: product.buyPrice,
        quantity: product.quantity,
        minStockLevel: product.minStockLevel,
        category: product.category,
        unit: toUnitType(product.unit), // تبدیل string به UnitType
      })
    }
  }, [product])

  const handleEditChange = (field: keyof ProductEditValues, value: string | number | UnitType) => {
    setEditValues((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof ProductEditValues, string>> = {}
    if (!editValues.name.trim()) {
      newErrors.name = t("product.nameRequired", "نام محصول الزامی است")
    }
    if (editValues.sellPrice < 0) {
      newErrors.sellPrice = t("validation.min", "مقدار نمی‌تواند منفی باشد")
    }
    if (editValues.buyPrice < 0) {
      newErrors.buyPrice = t("validation.min", "مقدار نمی‌تواند منفی باشد")
    }
    if (editValues.quantity < 0) {
      newErrors.quantity = t("validation.min", "مقدار نمی‌تواند منفی باشد")
    }
    if (editValues.minStockLevel < 0) {
      newErrors.minStockLevel = t("validation.min", "مقدار نمی‌تواند منفی باشد")
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (validateForm()) {
      onSave(editValues)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <Package className="size-16 text-muted-foreground" aria-hidden />
        <p className="text-lg text-muted-foreground">
          {t("godam.notFound", "محصول پیدا نشد")}
        </p>
        <Button onClick={onBack}>
          {t("action.back", "بازگشت به گدام")}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            aria-label={t("common.back", "بازگشت")}
          >
            <ArrowRight className="size-5" aria-hidden />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">
            {editing ? t("action.edit", "ویرایش") : product.name}
          </h1>
          {!editing && (
            <Badge variant={stockStatus}>
              {stockLabel} ({product.quantity})
            </Badge>
          )}
        </div>

        <div className="flex gap-2">
          {editing ? (
            <>
              <Button variant="outline" size="sm" onClick={onCancelEditing}>
                <X className="size-4" aria-hidden />
                <span className="hidden sm:inline ms-1.5">
                  {t("action.cancel", "انصراف")}
                </span>
              </Button>
              <Button size="sm" onClick={handleSubmit} disabled={updatePending}>
                {updatePending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Save className="size-4" aria-hidden />
                )}
                <span className="hidden sm:inline ms-1.5">
                  {t("action.save", "ذخیره")}
                </span>
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={onStartEditing}>
                <Edit3 className="size-4" aria-hidden />
                <span className="hidden sm:inline ms-1.5">
                  {t("action.edit", "ویرایش")}
                </span>
              </Button>
              <Button variant="outline" size="sm" onClick={onDelete}>
                <Trash2 className="size-4 text-destructive" aria-hidden />
                <span className="hidden sm:inline ms-1.5 text-destructive">
                  {t("action.delete", "حذف")}
                </span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── Product details card ── */}
      <Card className="glass-card border-border">
        <CardContent className="space-y-6 p-6 sm:p-8">
          {editing ? (
            <div className="space-y-4">
              <div>
                <Input
                  value={editValues.name}
                  onChange={(e) => handleEditChange("name", e.target.value)}
                  placeholder={`${t("godam.productName", "نام محصول")} *`}
                  label={t("godam.productName", "نام محصول")}
                />
                {errors.name && <p className="mt-1 text-sm text-destructive">{errors.name}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Input
                    type="number"
                    step="0.01"
                    value={editValues.sellPrice}
                    onChange={(e) => handleEditChange("sellPrice", parseFloat(e.target.value) || 0)}
                    placeholder={t("godam.sellPrice", "قیمت فروش")}
                    label={`${t("godam.sellPrice", "قیمت فروش")} (AFN)`}
                  />
                  {errors.sellPrice && <p className="mt-1 text-sm text-destructive">{errors.sellPrice}</p>}
                </div>
                <div>
                  <Input
                    type="number"
                    step="0.01"
                    value={editValues.buyPrice}
                    onChange={(e) => handleEditChange("buyPrice", parseFloat(e.target.value) || 0)}
                    placeholder={t("godam.buyPrice", "قیمت خرید")}
                    label={`${t("godam.buyPrice", "قیمت خرید")} (AFN)`}
                  />
                  {errors.buyPrice && <p className="mt-1 text-sm text-destructive">{errors.buyPrice}</p>}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Input
                    type="number"
                    value={editValues.quantity}
                    onChange={(e) => handleEditChange("quantity", parseInt(e.target.value) || 0)}
                    placeholder={t("godam.quantity", "تعداد")}
                    label={t("godam.quantity", "تعداد")}
                  />
                  {errors.quantity && <p className="mt-1 text-sm text-destructive">{errors.quantity}</p>}
                </div>
                <div>
                  <Input
                    type="number"
                    value={editValues.minStockLevel}
                    onChange={(e) => handleEditChange("minStockLevel", parseInt(e.target.value) || 0)}
                    placeholder={t("godam.minStock", "حداقل موجودی")}
                    label={t("godam.minStock", "حداقل موجودی")}
                  />
                  {errors.minStockLevel && <p className="mt-1 text-sm text-destructive">{errors.minStockLevel}</p>}
                </div>
                <div>
                  <Label className="mb-2 block">{t("godam.unit", "واحد")}</Label>
                  <Select
                    value={editValues.unit}
                    onValueChange={(val) => handleEditChange("unit", val as UnitType)}
                  >
                    <SelectTrigger className="w-full rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIT_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {t(opt.labelKey, opt.fallback)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
                <InfoBox
                  icon={DollarSign}
                  label={t("godam.sellPrice", "قیمت فروش")}
                  value={`${fmt(product.sellPrice)} AFN`}
                  color="hsl(var(--primary))"
                />
                <InfoBox
                  icon={DollarSign}
                  label={t("godam.buyPrice", "قیمت خرید")}
                  value={`${fmt(product.buyPrice)} AFN`}
                  color="hsl(var(--muted-foreground))"
                />
                <InfoBox
                  icon={Package}
                  label={t("godam.quantity", "تعداد")}
                  value={`${product.quantity} ${t(`godam.units.${toUnitType(product.unit)}`, product.unit)}`}
                  color="hsl(var(--success))"
                />
                <InfoBox
                  icon={AlertTriangle}
                  label={t("godam.minStock", "حداقل موجودی")}
                  value={`${product.minStockLevel}`}
                  color="hsl(var(--warning))"
                />
              </div>
              <div className="grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t("godam.category", "دسته‌بندی")}
                  </p>
                  <p className="font-medium text-foreground">{product.category}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t("godam.unit", "واحد")}
                  </p>
                  <p className="font-medium text-foreground">
                    {t(`godam.units.${toUnitType(product.unit)}`, product.unit)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t("godam.totalValue", "ارزش کل موجودی")}
                  </p>
                  <p className="font-bold text-primary">{fmt(totalValue)} AFN</p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Profit cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card className="interactive-card border-border">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold tabular-nums text-foreground">{product.quantity}</p>
            <p className="text-xs text-muted-foreground">{t("godam.currentStock", "موجودی فعلی")}</p>
          </CardContent>
        </Card>
        <Card className="interactive-card border-border">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold tabular-nums text-success">{fmt(profitPerUnit)} AFN</p>
            <p className="text-xs text-muted-foreground">{t("godam.profitPerUnit", "سود هر واحد")}</p>
          </CardContent>
        </Card>
        <Card className="interactive-card border-border">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold tabular-nums text-primary">{fmt(totalProfit)} AFN</p>
            <p className="text-xs text-muted-foreground">{t("godam.totalProfit", "سود کل موجودی")}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}