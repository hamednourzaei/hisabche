"use client"

import { Button, Badge, Card, CardContent, Input } from "@hisabche/ui"
import {
  ArrowRight, Package, DollarSign, AlertTriangle,
  Loader2, Save, Trash2, Edit3, X, type LucideIcon,
} from "lucide-react"

interface ProductData {
  name: string
  sellPrice: number
  buyPrice: number
  quantity: number
  minStockLevel: number
  category: string
  unit: string
}

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

export interface ProductDetailPageProps {
  t: (key: string, fallback?: string) => string
  fmt: (v: number) => string
  isLoading: boolean
  product: ProductData | null
  editing: boolean
  editValues: {
    name: string; sellPrice: string; buyPrice: string
    quantity: string; minStockLevel: string; category: string; unit: string
  }
  updatePending: boolean
  stockStatus: "success" | "warning" | "destructive" | "secondary"
  stockLabel: string
  profitPerUnit: number
  totalProfit: number
  totalValue: number
  onBack: () => void
  onStartEditing: () => void
  onCancelEditing: () => void
  onSave: () => void
  onDelete: () => void
  onEditValueChange: (field: string, value: string) => void
}

export function ProductDetailPage({
  t, fmt, isLoading, product, editing, editValues, updatePending,
  stockStatus, stockLabel, profitPerUnit, totalProfit, totalValue,
  onBack, onStartEditing, onCancelEditing, onSave, onDelete, onEditValueChange,
}: ProductDetailPageProps) {
  if (isLoading) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="size-8 animate-spin text-[var(--hisab-primary)]" />
    </div>
  )

  if (!product) return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <Package className="size-16 text-[var(--hisab-muted-fg)]" />
      <p className="text-lg text-[var(--hisab-muted-fg)]">{t("godam.notFound", "محصول پیدا نشد")}</p>
      <Button onClick={onBack}>{t("action.back", "بازگشت به گدام")}</Button>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" onClick={onBack}><ArrowRight className="size-5" /></Button>
          <h1 className="text-2xl font-bold">{editing ? t("action.edit") : product.name}</h1>
          {!editing && <Badge variant={stockStatus} size="sm">{stockLabel} ({product.quantity})</Badge>}
        </div>
        <div className="flex gap-2">
          {editing ? (
            <>
              <Button variant="outline" size="sm" onClick={onCancelEditing}><X className="size-4" /><span className="hidden sm:inline ml-1.5">{t("action.cancel")}</span></Button>
              <Button size="sm" onClick={onSave} loading={updatePending}><Save className="size-4" /><span className="hidden sm:inline ml-1.5">{t("action.save")}</span></Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={onStartEditing}><Edit3 className="size-4" /><span className="hidden sm:inline ml-1.5">{t("action.edit")}</span></Button>
              <Button variant="outline" size="sm" onClick={onDelete}><Trash2 className="size-4 text-[var(--hisab-destructive)]" /><span className="hidden sm:inline ml-1.5 text-[var(--hisab-destructive)]">{t("action.delete")}</span></Button>
            </>
          )}
        </div>
      </div>

      <Card className="glass-card">
        <CardContent className="p-6 sm:p-8 space-y-6">
          {editing ? (
            <>
              <Input value={editValues.name} onChange={(e) => onEditValueChange("name", e.target.value)} placeholder={t("godam.productName") + " *"} label={t("godam.productName")} />
              <div className="grid grid-cols-2 gap-4">
                <Input type="number" value={editValues.sellPrice} onChange={(e) => onEditValueChange("sellPrice", e.target.value)} placeholder={t("godam.sellPrice")} label={`${t("godam.sellPrice")} (AFN)`} />
                <Input type="number" value={editValues.buyPrice} onChange={(e) => onEditValueChange("buyPrice", e.target.value)} placeholder={t("godam.buyPrice")} label={`${t("godam.buyPrice")} (AFN)`} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Input type="number" value={editValues.quantity} onChange={(e) => onEditValueChange("quantity", e.target.value)} placeholder={t("godam.quantity")} label={t("godam.quantity")} />
                <Input type="number" value={editValues.minStockLevel} onChange={(e) => onEditValueChange("minStockLevel", e.target.value)} placeholder={t("godam.minStock")} label={t("godam.minStock")} />
                <div>
                  <label className="mb-2 block text-sm font-medium">{t("godam.unit")}</label>
                  <select value={editValues.unit} onChange={(e) => onEditValueChange("unit", e.target.value)} className="w-full rounded-xl border border-[var(--hisab-border)] bg-[var(--hisab-card)] px-4 py-3 text-sm">
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
                <InfoBox icon={DollarSign} label={t("godam.sellPrice")} value={`${fmt(product.sellPrice)} AFN`} color="var(--hisab-primary)" />
                <InfoBox icon={DollarSign} label={t("godam.buyPrice")} value={`${fmt(product.buyPrice)} AFN`} color="var(--hisab-muted-fg)" />
                <InfoBox icon={Package} label={t("godam.quantity")} value={`${product.quantity} ${product.unit}`} color="var(--hisab-success)" />
                <InfoBox icon={AlertTriangle} label={t("godam.minStock")} value={`${product.minStockLevel}`} color="var(--hisab-warning)" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-[var(--hisab-border)]">
                <div><p className="text-xs text-[var(--hisab-muted-fg)]">{t("godam.category")}</p><p className="font-medium">{product.category}</p></div>
                <div><p className="text-xs text-[var(--hisab-muted-fg)]">{t("godam.unit")}</p><p className="font-medium">{product.unit}</p></div>
                <div><p className="text-xs text-[var(--hisab-muted-fg)]">{t("godam.totalValue", "ارزش کل موجودی")}</p><p className="font-bold text-[var(--hisab-primary)]">{fmt(totalValue)} AFN</p></div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card className="interactive-card">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{product.quantity}</p>
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