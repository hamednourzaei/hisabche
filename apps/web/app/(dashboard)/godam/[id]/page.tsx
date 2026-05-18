// ============================================
// apps/web/app/godam/[id]/page.tsx
// ============================================

"use client"

import { useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { useProduct, useUpdateProduct, useDeleteProduct } from "@hisabche/api"
import { Button, Badge, Card, CardContent, Input } from "@hisabche/ui"
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
} from "lucide-react"

// ─── Helpers ──────────────────────────────────────────
const num = (v: any) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const fmt = (v: any) => num(v).toLocaleString("fa-AF")

// ─── Mini Info Box ────────────────────────────────────
function InfoBox({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any
  label: string
  value: string
  color: string
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="size-4" style={{ color }} />
        <p className="text-xs text-[var(--hisab-muted-fg)]">{label}</p>
      </div>
      <p className="font-bold text-[var(--hisab-foreground)]">{value}</p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────
export default function ProductDetailPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const { id } = useParams<{ id: string }>()

  const { data: product, isLoading } = useProduct(id)
  const updateProduct = useUpdateProduct()
  const deleteProduct = useDeleteProduct()

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState("")
  const [sellPrice, setSellPrice] = useState("")
  const [buyPrice, setBuyPrice] = useState("")
  const [quantity, setQuantity] = useState("")
  const [minStockLevel, setMinStockLevel] = useState("")
  const [category, setCategory] = useState("general")
  const [unit, setUnit] = useState("piece")

  // Resolve snake_case or camelCase from backend
  const getProduct = useCallback((p: any) => ({
    name: p.name ?? "",
    sellPrice: num(p.sell_price ?? p.sellPrice),
    buyPrice: num(p.buy_price ?? p.buyPrice),
    quantity: num(p.quantity),
    minStockLevel: num(p.min_stock_level ?? p.minStockLevel ?? 5),
    category: p.category ?? "general",
    unit: p.unit ?? "piece",
  }), [])

  const startEditing = useCallback(() => {
    if (!product) return
    const p = getProduct(product)
    setName(p.name)
    setSellPrice(p.sellPrice.toString())
    setBuyPrice(p.buyPrice.toString())
    setQuantity(p.quantity.toString())
    setMinStockLevel(p.minStockLevel.toString())
    setCategory(p.category)
    setUnit(p.unit)
    setEditing(true)
  }, [product, getProduct])

  const cancelEditing = useCallback(() => setEditing(false), [])

  const handleSave = useCallback(async () => {
    await updateProduct.mutateAsync({
      id: id!,
      name: name.trim(),
      sellPrice: num(sellPrice),
      buyPrice: num(buyPrice),
      quantity: Math.floor(num(quantity)),
      minStockLevel: Math.floor(num(minStockLevel)) || 5,
      category: category as any,
      unit: unit as any,
    })
    setEditing(false)
  }, [id, name, sellPrice, buyPrice, quantity, minStockLevel, category, unit, updateProduct])

  const handleDelete = useCallback(async () => {
    if (!confirm("آیا از حذف این محصول اطمینان دارید؟")) return
    await deleteProduct.mutateAsync(id!)
    router.push("/godam")
  }, [id, deleteProduct, router])

  // ─── Loading ───────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-[var(--hisab-primary)]" />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <Package className="size-16 text-[var(--hisab-muted-fg)]" />
        <p className="text-lg text-[var(--hisab-muted-fg)]">محصول پیدا نشد</p>
        <Button onClick={() => router.push("/godam")}>بازگشت به گدام</Button>
      </div>
    )
  }

  const p = getProduct(product)
  const stockStatus: "success" | "warning" | "destructive" | "secondary" =
    p.quantity === 0 ? "destructive" : p.quantity <= p.minStockLevel ? "warning" : "success"
  const stockLabel = p.quantity === 0 ? "ناموجود" : p.quantity <= p.minStockLevel ? "کمبود موجودی" : "موجود"
  const profitPerUnit = p.sellPrice - p.buyPrice
  const totalProfit = p.quantity * profitPerUnit
  const totalValue = p.quantity * p.sellPrice

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" onClick={() => router.back()}>
            <ArrowRight className="size-5" />
          </Button>
          <h1 className="text-2xl font-bold text-[var(--hisab-foreground)]">
            {editing ? "ویرایش محصول" : p.name}
          </h1>
          {!editing && (
            <Badge variant={stockStatus} size="sm">
              {stockLabel} ({p.quantity})
            </Badge>
          )}
        </div>

        <div className="flex gap-2">
          {editing ? (
            <>
              <Button variant="outline" size="sm" onClick={cancelEditing}>
                <X className="size-4" />
                <span className="hidden sm:inline ml-1.5">انصراف</span>
              </Button>
              <Button size="sm" onClick={handleSave} loading={updateProduct.isPending}>
                <Save className="size-4" />
                <span className="hidden sm:inline ml-1.5">ذخیره</span>
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={startEditing}>
                <Edit3 className="size-4" />
                <span className="hidden sm:inline ml-1.5">ویرایش</span>
              </Button>
              <Button variant="outline" size="sm" onClick={handleDelete}>
                <Trash2 className="size-4 text-[var(--hisab-destructive)]" />
                <span className="hidden sm:inline ml-1.5 text-[var(--hisab-destructive)]">حذف</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Product Info Card */}
      <Card>
        <CardContent className="p-6 sm:p-8 space-y-6">
          {editing ? (
            <>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="نام محصول *" label="نام محصول" />
              <div className="grid grid-cols-2 gap-4">
                <Input type="number" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} placeholder="قیمت فروش" label="قیمت فروش (AFN)" />
                <Input type="number" value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)} placeholder="قیمت خرید" label="قیمت خرید (AFN)" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="موجودی" label="موجودی" />
                <Input type="number" value={minStockLevel} onChange={(e) => setMinStockLevel(e.target.value)} placeholder="حداقل" label="حداقل هشدار" />
                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--hisab-foreground)]">واحد</label>
                  <select value={unit} onChange={(e) => setUnit(e.target.value)} className="w-full rounded-xl border border-[var(--hisab-border)] bg-[var(--hisab-card)] px-4 py-3 text-sm text-[var(--hisab-foreground)]">
                    <option value="piece">عدد</option>
                    <option value="kg">کیلوگرم</option>
                    <option value="liter">لیتر</option>
                    <option value="meter">متر</option>
                    <option value="box">کارتن</option>
                  </select>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                <InfoBox icon={DollarSign} label="قیمت فروش" value={`${fmt(p.sellPrice)} AFN`} color="var(--hisab-primary)" />
                <InfoBox icon={DollarSign} label="قیمت خرید" value={`${fmt(p.buyPrice)} AFN`} color="var(--hisab-muted-fg)" />
                <InfoBox icon={Package} label="موجودی" value={`${p.quantity} ${p.unit}`} color="var(--hisab-success)" />
                <InfoBox icon={AlertTriangle} label="حداقل موجودی" value={`${p.minStockLevel}`} color="var(--hisab-warning)" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-[var(--hisab-border)]">
                <div>
                  <p className="text-xs text-[var(--hisab-muted-fg)]">دسته‌بندی</p>
                  <p className="font-medium text-[var(--hisab-foreground)]">{p.category}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--hisab-muted-fg)]">واحد</p>
                  <p className="font-medium text-[var(--hisab-foreground)]">{p.unit}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--hisab-muted-fg)]">ارزش کل موجودی</p>
                  <p className="font-bold text-[var(--hisab-primary)]">{fmt(totalValue)} AFN</p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-[var(--hisab-foreground)]">{p.quantity}</p>
            <p className="text-xs text-[var(--hisab-muted-fg)]">موجودی فعلی</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-[var(--hisab-success)]">{fmt(profitPerUnit)} AFN</p>
            <p className="text-xs text-[var(--hisab-muted-fg)]">سود هر واحد</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-[var(--hisab-primary)]">{fmt(totalProfit)} AFN</p>
            <p className="text-xs text-[var(--hisab-muted-fg)]">سود کل موجودی</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}