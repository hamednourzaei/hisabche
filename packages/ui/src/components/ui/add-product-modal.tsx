"use client"

import { useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { X, DollarSign, Package, AlertTriangle } from "lucide-react"
import { useCreateProduct } from "@hisabche/api"
import { Button, Input, SaveIndicator } from "@hisabche/ui"
import { useSyncStore, useBackupStore } from "@hisabche/store"

interface AddProductModalProps {
  open: boolean
  onClose: () => void
  onCreated?: () => void
}

export function AddProductModal({ open, onClose, onCreated }: AddProductModalProps) {
  const { t } = useTranslation()
  const createProduct = useCreateProduct()
  const { setSaveStatus } = useSyncStore()
  const { addAuditEntry } = useBackupStore()

  const [name, setName] = useState("")
  const [quantity, setQuantity] = useState("0")
  const [buyPrice, setBuyPrice] = useState("")
  const [sellPrice, setSellPrice] = useState("")
  const [unit, setUnit] = useState("piece")
  const [minStock, setMinStock] = useState("5")
  const [showSaved, setShowSaved] = useState(false)

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

    setSaveStatus("saving")

    const product = await createProduct.mutateAsync({
      name: name.trim(),
      quantity: parseInt(quantity) || 0,
      buyPrice: parseFloat(buyPrice) || 0,
      sellPrice: parseFloat(sellPrice) || 0,
      unit: unit as "piece" | "kg" | "liter" | "meter" | "box",
      minStockLevel: parseInt(minStock) || 5,
      category: "general",
      isActive: true,
    })

    addAuditEntry({
      action: "create",
      entity: "product",
      entityId: product.id || "",
      details: `محصول جدید: ${name.trim()}`,
    })

    setSaveStatus("saved")
    setShowSaved(true)
    setTimeout(() => {
      setSaveStatus("idle")
      setShowSaved(false)
    }, 2000)

    onCreated?.()
    reset()
    onClose()
  }, [name, quantity, buyPrice, sellPrice, unit, minStock, createProduct, onClose, reset, setSaveStatus, addAuditEntry, onCreated])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <SaveIndicator show={showSaved} message={t("common.saved", "ذخیره شد ✅")} />

      <div className="glass-strong mx-4 w-full max-w-md space-y-4 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">{t("godam.addProductModal", "محصول جدید")}</h3>
          <button onClick={onClose} className="ghost-btn" aria-label={t("action.close")}>
            <X className="size-5" />
          </button>
        </div>

        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("godam.productName") + " *"} label={t("godam.productName")} leftIcon={<Package className="size-4" />} autoFocus />

        <div className="grid grid-cols-2 gap-3">
          <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder={t("godam.initialStock", "موجودی اولیه")} label={t("godam.quantity")} />
          <div>
            <label className="mb-2 block text-sm font-medium">{t("godam.unit")}</label>
            <select value={unit} onChange={(e) => setUnit(e.target.value)} className="w-full rounded-xl border border-[var(--hisab-border)] bg-[var(--hisab-card)] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--hisab-primary)]/20">
              <option value="piece">{t("godam.units.piece", "عدد")}</option>
              <option value="kg">{t("godam.units.kg", "کیلوگرم")}</option>
              <option value="liter">{t("godam.units.liter", "لیتر")}</option>
              <option value="meter">{t("godam.units.meter", "متر")}</option>
              <option value="box">{t("godam.units.box", "کارتن")}</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input type="number" value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)} placeholder={t("godam.buyPrice", "قیمت خرید (AFN)")} label={t("godam.buyPrice")} leftIcon={<DollarSign className="size-4" />} />
          <Input type="number" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} placeholder={t("godam.sellPrice", "قیمت فروش (AFN)")} label={t("godam.sellPrice")} leftIcon={<DollarSign className="size-4" />} />
        </div>

        <Input type="number" value={minStock} onChange={(e) => setMinStock(e.target.value)} placeholder={t("godam.minStock", "حداقل موجودی هشدار")} label={t("godam.minStock")} leftIcon={<AlertTriangle className="size-4" />} />

        <div className="flex gap-3 pt-2">
          <Button variant="outline" className="w-full" onClick={onClose}>{t("action.cancel")}</Button>
          <Button className="w-full" onClick={handleSubmit} loading={createProduct.isPending} disabled={!name.trim()}>{t("action.save")}</Button>
        </div>
      </div>
    </div>
  )
}