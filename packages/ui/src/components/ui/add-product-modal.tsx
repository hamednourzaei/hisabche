"use client"

import { useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { X, DollarSign } from "lucide-react"
import { useCreateProduct } from "@hisabche/api"
import { Button } from "./button"
import { Input } from "./input"

interface AddProductModalProps {
  open: boolean
  onClose: () => void
}

export function AddProductModal({ open, onClose }: AddProductModalProps) {
  const { t } = useTranslation()
  const createProduct = useCreateProduct()

  const [name, setName] = useState("")
  const [quantity, setQuantity] = useState("0")
  const [buyPrice, setBuyPrice] = useState("")
  const [sellPrice, setSellPrice] = useState("")
  const [unit, setUnit] = useState("piece")
  const [minStock, setMinStock] = useState("5")

  const reset = useCallback(() => {
    setName("")
    setQuantity("0")
    setBuyPrice("")
    setSellPrice("")
    setUnit("piece")
    setMinStock("5")
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) return
    await createProduct.mutateAsync({
  name: name.trim(),
  quantity: parseInt(quantity) || 0,
  buyPrice: parseFloat(buyPrice) || 0,
  sellPrice: parseFloat(sellPrice) || 0,
  unit: unit as any,
  minStockLevel: parseInt(minStock) || 5,
  category: "general",
  isActive: true,
})
    reset()
    onClose()
  }, [name, quantity, buyPrice, sellPrice, unit, minStock, createProduct, onClose, reset])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[var(--hisab-card)] rounded-2xl shadow-[var(--hisab-shadow-xl)] border border-[var(--hisab-border)] w-full max-w-md p-6 space-y-4 mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-[var(--hisab-foreground)]">
            {t("godam.addProductModal", { defaultValue: "محصول جدید" })}
          </h3>
          <button
            onClick={onClose}
            className="text-[var(--hisab-muted-fg)] hover:text-[var(--hisab-foreground)] transition-colors"
            aria-label={t("action.close")}
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Name */}
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("godam.productName") + " *"}
          autoFocus
        />

        {/* Quantity + Unit */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder={t("godam.initialStock", { defaultValue: "موجودی اولیه" })}
          />
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="rounded-xl border border-[var(--hisab-border)] bg-[var(--hisab-card)] px-4 py-3 text-sm text-[var(--hisab-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--hisab-primary)]/20"
          >
            <option value="piece">{t("godam.units.piece", { defaultValue: "عدد" })}</option>
            <option value="kg">{t("godam.units.kg", { defaultValue: "کیلوگرم" })}</option>
            <option value="liter">{t("godam.units.liter", { defaultValue: "لیتر" })}</option>
            <option value="meter">{t("godam.units.meter", { defaultValue: "متر" })}</option>
            <option value="box">{t("godam.units.box", { defaultValue: "کارتن" })}</option>
          </select>
        </div>

        {/* Buy + Sell Price */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            type="number"
            value={buyPrice}
            onChange={(e) => setBuyPrice(e.target.value)}
            placeholder={t("godam.buyPrice", { defaultValue: "قیمت خرید (AFN)" })}
            leftIcon={<DollarSign className="size-4" />}
          />
          <Input
            type="number"
            value={sellPrice}
            onChange={(e) => setSellPrice(e.target.value)}
            placeholder={t("godam.sellPrice", { defaultValue: "قیمت فروش (AFN)" })}
            leftIcon={<DollarSign className="size-4" />}
          />
        </div>

        {/* Min Stock */}
        <Input
          type="number"
          value={minStock}
          onChange={(e) => setMinStock(e.target.value)}
          placeholder={t("godam.minStock", { defaultValue: "حداقل موجودی هشدار" })}
        />

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button variant="outline" fullWidth onClick={onClose}>
            {t("action.cancel")}
          </Button>
          <Button
            fullWidth
            onClick={handleSubmit}
            loading={createProduct.isPending}
            disabled={!name.trim()}
          >
            {t("action.save")}
          </Button>
        </div>
      </div>
    </div>
  )
}