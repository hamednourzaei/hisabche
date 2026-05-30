"use client"

import { useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { useProduct, useUpdateProduct, useDeleteProduct } from "@hisabche/api"
import { Button, Badge, Card, CardContent, Input } from "@hisabche/ui"
import {
  ArrowRight, Package, DollarSign, AlertTriangle,
  Loader2, Save, Trash2, Edit3, X, type LucideIcon,
} from "lucide-react"

interface Product {
  name?: string; sell_price?: number | string; sellPrice?: number | string
  buy_price?: number | string; buyPrice?: number | string
  quantity?: number | string; min_stock_level?: number | string; minStockLevel?: number | string
  category?: string; unit?: string
}

interface ProductData {
  name: string; sellPrice: number; buyPrice: number
  quantity: number; minStockLevel: number; category: string; unit: string
}

const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const fmt = (v: unknown): string => num(v).toLocaleString("fa-AF")

function InfoBox({ icon: Icon, label, value, color }: { icon: LucideIcon; label: string; value: string; color: string }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="size-4" style={{ color }} />
        <p className="text-xs text-[var(--hisab-muted-fg)]">{label}</p>
      </div>
      <p className="font-bold">{value}</p>
    </div>
  )
}

export function ProductDetailPage() {
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

  const getProduct = useCallback((p: Product): ProductData => ({
    name: p.name ?? "", sellPrice: num(p.sell_price ?? p.sellPrice), buyPrice: num(p.buy_price ?? p.buyPrice),
    quantity: num(p.quantity), minStockLevel: num(p.min_stock_level ?? p.minStockLevel ?? 5),
    category: p.category ?? "general", unit: p.unit ?? "piece",
  }), [])

  const startEditing = useCallback(() => {
    if (!product) return
    const p = getProduct(product)
    setName(p.name); setSellPrice(p.sellPrice.toString()); setBuyPrice(p.buyPrice.toString())
    setQuantity(p.quantity.toString()); setMinStockLevel(p.minStockLevel.toString())
    setCategory(p.category); setUnit(p.unit); setEditing(true)
  }, [product, getProduct])

  const cancelEditing = useCallback(() => setEditing(false), [])

  const handleSave = useCallback(async () => {
    await updateProduct.mutateAsync({
      id: id!, name: name.trim(), sellPrice: num(sellPrice), buyPrice: num(buyPrice),
      quantity: Math.floor(num(quantity)), minStockLevel: Math.floor(num(minStockLevel)) || 5,
      category: category as "general" | "food" | "electronics" | "clothing" | "construction" | "medicine",
      unit: unit as "piece" | "kg" | "liter" | "meter" | "box",
    })
    setEditing(false)
  }, [id, name, sellPrice, buyPrice, quantity, minStockLevel, category, unit, updateProduct])

  const handleDelete = useCallback(async () => {
    if (!confirm(t("godam.deleteConfirm", "آیا از حذف این محصول اطمینان دارید؟"))) return
    await deleteProduct.mutateAsync(id!)
    router.push("/godam")
  }, [id, deleteProduct, router, t])

  if (isLoading) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="size-8 animate-spin text-[var(--hisab-primary)]" />
    </div>
  )

  if (!product) return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <Package className="size-16 text-[var(--hisab-muted-fg)]" />
      <p className="text-lg text-[var(--hisab-muted-fg)]">{t("godam.notFound", "محصول پیدا نشد")}</p>
      <Button onClick={() => router.push("/godam")}>{t("action.back", "بازگشت به گدام")}</Button>
    </div>
  )

  const p = getProduct(product)
  const stockStatus: "success" | "warning" | "destructive" | "secondary" = p.quantity === 0 ? "destructive" : p.quantity <= p.minStockLevel ? "warning" : "success"
  const stockLabel = p.quantity === 0 ? t("godam.outOfStock") : p.quantity <= p.minStockLevel ? t("godam.lowStock") : t("godam.inStock")
  const profitPerUnit = p.sellPrice - p.buyPrice
  const totalProfit = p.quantity * profitPerUnit
  const totalValue = p.quantity * p.sellPrice

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" onClick={() => router.back()}><ArrowRight className="size-5" /></Button>
          <h1 className="text-2xl font-bold">{editing ? t("action.edit") : p.name}</h1>
          {!editing && <Badge variant={stockStatus} size="sm">{stockLabel} ({p.quantity})</Badge>}
        </div>
        <div className="flex gap-2">
          {editing ? (
            <>
              <Button variant="outline" size="sm" onClick={cancelEditing}><X className="size-4" /><span className="hidden sm:inline ml-1.5">{t("action.cancel")}</span></Button>
              <Button size="sm" onClick={handleSave} loading={updateProduct.isPending}><Save className="size-4" /><span className="hidden sm:inline ml-1.5">{t("action.save")}</span></Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={startEditing}><Edit3 className="size-4" /><span className="hidden sm:inline ml-1.5">{t("action.edit")}</span></Button>
              <Button variant="outline" size="sm" onClick={handleDelete}><Trash2 className="size-4 text-[var(--hisab-destructive)]" /><span className="hidden sm:inline ml-1.5 text-[var(--hisab-destructive)]">{t("action.delete")}</span></Button>
            </>
          )}
        </div>
      </div>

      <Card className="glass-card">
        <CardContent className="p-6 sm:p-8 space-y-6">
          {editing ? (
            <>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("godam.productName") + " *"} label={t("godam.productName")} />
              <div className="grid grid-cols-2 gap-4">
                <Input type="number" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} placeholder={t("godam.sellPrice")} label={`${t("godam.sellPrice")} (AFN)`} />
                <Input type="number" value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)} placeholder={t("godam.buyPrice")} label={`${t("godam.buyPrice")} (AFN)`} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder={t("godam.quantity")} label={t("godam.quantity")} />
                <Input type="number" value={minStockLevel} onChange={(e) => setMinStockLevel(e.target.value)} placeholder={t("godam.minStock")} label={t("godam.minStock")} />
                <div>
                  <label className="mb-2 block text-sm font-medium">{t("godam.unit")}</label>
                  <select value={unit} onChange={(e) => setUnit(e.target.value)} className="w-full rounded-xl border border-[var(--hisab-border)] bg-[var(--hisab-card)] px-4 py-3 text-sm">
                    <option value="piece">{t("godam.units.piece")}</option>
                    <option value="kg">{t("godam.units.kg")}</option>
                    <option value="liter">{t("godam.units.liter")}</option>
                    <option value="meter">{t("godam.units.meter")}</option>
                    <option value="box">{t("godam.units.box")}</option>
                  </select>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                <InfoBox icon={DollarSign} label={t("godam.sellPrice")} value={`${fmt(p.sellPrice)} AFN`} color="var(--hisab-primary)" />
                <InfoBox icon={DollarSign} label={t("godam.buyPrice")} value={`${fmt(p.buyPrice)} AFN`} color="var(--hisab-muted-fg)" />
                <InfoBox icon={Package} label={t("godam.quantity")} value={`${p.quantity} ${p.unit}`} color="var(--hisab-success)" />
                <InfoBox icon={AlertTriangle} label={t("godam.minStock")} value={`${p.minStockLevel}`} color="var(--hisab-warning)" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-[var(--hisab-border)]">
                <div><p className="text-xs text-[var(--hisab-muted-fg)]">{t("godam.category")}</p><p className="font-medium">{p.category}</p></div>
                <div><p className="text-xs text-[var(--hisab-muted-fg)]">{t("godam.unit")}</p><p className="font-medium">{p.unit}</p></div>
                <div><p className="text-xs text-[var(--hisab-muted-fg)]">{t("godam.totalValue", "ارزش کل موجودی")}</p><p className="font-bold text-[var(--hisab-primary)]">{fmt(totalValue)} AFN</p></div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card className="interactive-card">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{p.quantity}</p>
            <p className="text-xs text-[var(--hisab-muted-fg)]">{t("godam.currentStock", "موجودی فعلی")}</p>
          </CardContent>
        </Card>
        <Card className="interactive-card">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-[var(--hisab-success)]">{fmt(profitPerUnit)} AFN</p>
            <p className="text-xs text-[var(--hisab-muted-fg)]">{t("godam.profitPerUnit", "سود هر واحد")}</p>
          </CardContent>
        </Card>
        <Card className="interactive-card">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-[var(--hisab-primary)]">{fmt(totalProfit)} AFN</p>
            <p className="text-xs text-[var(--hisab-muted-fg)]">{t("godam.totalProfit", "سود کل موجودی")}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}