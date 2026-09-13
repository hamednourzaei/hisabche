// packages/ui/src/hooks/warehouse/use-warehouse.ts
'use client'

import { useMemo, useCallback, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useProducts, useDeleteProduct, useRealtime, type StockSummary } from '@hisabche/api'
import { useSyncStore, useBackupStore } from '@hisabche/store'
import { mapProducts } from '../../lib/warehouse/warehouse-mappers'
import type { RawProduct } from '../../lib/warehouse/warehouse-types'

export function useWarehouse(search: string) {
  const t = useTranslations()
  const { data, isLoading, refetch } = useProducts({
    page: 1,
    limit: 100,
    sortDirection: 'desc',
    search,
    // Stock value and stock-state counts come from the server, over EVERY
    // product. They used to be reduced here over this 100-row page, so a shop
    // with more products read the value of its newest hundred as «ارزش کل».
    includeSummary: true,
  })

  const deleteProduct = useDeleteProduct()
  const { setSaveStatus } = useSyncStore()
  const { moveToTrash } = useBackupStore()

  // ✅ Real-time subscription for products
  useRealtime({ table: 'products', queryKey: ['products'] })

  // ✅ دیباگ: لاگ کردن داده‌ها
  useEffect(() => {
    console.log('📊 useWarehouse - products count:', data?.products?.length)
    console.log('📊 useWarehouse - total:', data?.total)
  }, [data])

  const products = useMemo(
    () => mapProducts(data?.products as RawProduct[] | undefined, (key: string) => t(key)),
    [data, t],
  )

  /** `null` when the server sent no summary — shown as unavailable, never as 0. */
  const summary: StockSummary | null = data?.summary ?? null

  const stockStatus = useCallback(
    (qty: number, min: number): 'success' | 'warning' | 'destructive' | 'secondary' => {
      if (qty <= 0) return 'destructive'
      if (qty <= min) return 'warning'
      return 'success'
    },
    [],
  )

  const stockLabel = useCallback(
    (qty: number, min: number) => {
      if (qty <= 0) return t('warehouse.outOfStock')
      if (qty <= min) return t('warehouse.lowStock')
      return t('warehouse.inStock')
    },
    [t],
  )

  const handleDelete = useCallback(
    async (product: { id: string; name?: string }) => {
      if (!product.id) return
      setSaveStatus('saving')
      moveToTrash({
        entity: 'product',
        entityId: product.id,
        data: JSON.stringify(product),
      })
      await deleteProduct.mutateAsync(product.id)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
      refetch()
    },
    [deleteProduct, moveToTrash, setSaveStatus, refetch],
  )

  return {
    products,
    summary,
    isLoading,
    stockStatus,
    stockLabel,
    handleDelete,
    refetch,
  }
}
