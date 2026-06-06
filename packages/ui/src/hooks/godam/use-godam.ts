// packages/ui/src/hooks/use-godam.ts
"use client"

import { useMemo, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { useProducts, useDeleteProduct, useRealtime } from "@hisabche/api"
import { useSyncStore, useBackupStore } from "@hisabche/store"
import { mapProducts, calculateTotals } from "../../lib/godam/godam-mappers"
import type { RawProduct } from "../../lib/godam/godam-types"

export function useGodam(search: string) {
  const { t } = useTranslation()
  const { data, isLoading, refetch } = useProducts({
    page: 1,
    limit: 50,
    sortDirection: "desc",
    search,
  })
  const deleteProduct = useDeleteProduct()
  const { setSaveStatus } = useSyncStore()
  const { moveToTrash } = useBackupStore()

  useRealtime({ table: "products", queryKey: ["products"] })

  const products = useMemo(
    () => mapProducts(data?.products as RawProduct[] | undefined, (key: string) => t(key)),
    [data, t]
  )

  const { totalValue, lowStock, outOfStock } = useMemo(
    () => calculateTotals(products),
    [products]
  )

  const total = data?.total || 0

  const stockStatus = useCallback(
    (qty: number, min: number): "success" | "warning" | "destructive" | "secondary" => {
      if (qty === 0) return "destructive"
      if (qty <= min) return "warning"
      return "success"
    },
    []
  )

  const stockLabel = useCallback(
    (qty: number, min: number) => {
      if (qty === 0) return t("godam.outOfStock", "ناموجود")
      if (qty <= min) return t("godam.lowStock", "موجودی کم")
      return t("godam.inStock", "موجود")
    },
    [t]
  )

  const handleDelete = useCallback(
    async (product: { id: string; name?: string }) => {
      if (!product.id) return
      setSaveStatus("saving")
      moveToTrash({
        entity: "product",
        entityId: product.id,
        data: JSON.stringify(product),
      })
      await deleteProduct.mutateAsync(product.id)
      setSaveStatus("saved")
      setTimeout(() => setSaveStatus("idle"), 2000)
      refetch()
    },
    [deleteProduct, moveToTrash, setSaveStatus, refetch]
  )

  return {
    products,
    total,
    totalValue,
    lowStock,
    outOfStock,
    isLoading,
    stockStatus,
    stockLabel,
    handleDelete,
    refetch,
  }
}