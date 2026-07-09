// packages/ui/src/containers/warehouse-container.tsx
"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
// ✅ اصلاح: useWarehouse (با حرف بزرگ)
import { useWarehouse } from "../../../../hooks/warehouse/use-warehouse"
import { warehouseView } from "../warehouse-view"
import { AddProductModal } from "../../add-product-modal"
import { fmt } from "../../../../lib/warehouse/warehouse-format"

const CURRENCIES = [
  { code: "AFN", label: "افغانی", rate: 1 },
  { code: "USD", label: "دالر", rate: 0.014 },
  { code: "IRR", label: "پومان", rate: 0.85 },
]

export function warehouseContainer() {
  const { t } = useTranslation()
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [showAddModal, setShowAddModal] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const {
    products,
    total,
    totalValue,
    lowStock,
    outOfStock,
    isLoading,
    stockStatus,
    stockLabel,
    handleDelete,
  // ✅ اصلاح: useWarehouse (با حرف بزرگ)
  } = useWarehouse(search)

  const onDelete = useCallback(
    async (product: { id: string; name?: string }) => {
      setDeletingId(product.id)
      await handleDelete(product)
      setDeletingId(null)
    },
    [handleDelete]
  )

  const safeT = useCallback(
    (key: string, fallback?: string) => {
      const v = t(key)
      return v !== key ? v : (fallback ?? key)
    },
    [t]
  )

  const handleNavigate = useCallback(
    (id: string) => router.push(`/warehouse/${id}`),
    [router]
  )

  // ✅ اصلاح: صدا زدن warehouseView به عنوان تابع
  return warehouseView({
    t: safeT,
    fmt,
    search,
    onSearchChange: setSearch,
    onOpenAddModal: () => setShowAddModal(true),
    deletingId,
    products,
    total,
    isLoading,
    totalValue,
    lowStock,
    outOfStock,
    currencies: CURRENCIES,
    onNavigate: handleNavigate,
    onDelete,
    stockStatus,
    stockLabel,
  })
}