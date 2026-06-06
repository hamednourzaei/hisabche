// packages/ui/src/containers/godam-container.tsx
"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { useGodam } from "../../../../hooks/godam/use-godam"
import { GodamView } from "../godam-view"
import { AddProductModal } from "../../../../components/ui/add-product-modal"
import { fmt } from "../../../../lib/godam/godam-format"

const CURRENCIES = [
  { code: "AFN", label: "افغانی", rate: 1 },
  { code: "USD", label: "دالر", rate: 0.014 },
  { code: "IRR", label: "پومان", rate: 0.85 },
]

export function GodamContainer() {
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
  } = useGodam(search)

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
    (id: string) => router.push(`/godam/${id}`),
    [router]
  )

  return (
    <>
      <AddProductModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
      />
      <GodamView
        t={safeT}
        fmt={fmt}
        search={search}
        onSearchChange={setSearch}
        onOpenAddModal={() => setShowAddModal(true)}
        deletingId={deletingId}
        products={products}
        total={total}
        isLoading={isLoading}
        totalValue={totalValue}
        lowStock={lowStock}
        outOfStock={outOfStock}
        currencies={CURRENCIES}
        onNavigate={handleNavigate}
        onDelete={onDelete}
        stockStatus={stockStatus}
        stockLabel={stockLabel}
      />
    </>
  )
}