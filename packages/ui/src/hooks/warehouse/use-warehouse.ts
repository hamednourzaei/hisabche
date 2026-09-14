// packages/ui/src/hooks/warehouse/use-warehouse.ts
'use client'

import { useMemo, useCallback, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useProducts, useDeleteProduct, useRealtime, type StockSummary } from '@hisabche/api'
import { useSyncStore, useBackupStore } from '@hisabche/store'
import { mapProducts } from '../../lib/warehouse/warehouse-mappers'
import type { RawProduct } from '../../lib/warehouse/warehouse-types'
import { productDeleteRefusal } from '../../lib/warehouse/delete-refusal'
import { STOCK_LABEL_KEY, STOCK_TONE, stockStateOf } from '../../lib/warehouse/stock-state'
import { useToast } from '../../components/ui/toast-provider'

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
  const toast = useToast()

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
    (qty: number, min: number): 'success' | 'warning' | 'destructive' | 'secondary' =>
      STOCK_TONE[stockStateOf(qty, min)],
    [],
  )

  const stockLabel = useCallback(
    (qty: number, min: number) => t(STOCK_LABEL_KEY[stockStateOf(qty, min)]),
    [t],
  )

  const handleDelete = useCallback(
    async (product: { id: string; name?: string }) => {
      if (!product.id) return
      setSaveStatus('saving')
      try {
        await deleteProduct.mutateAsync(product.id)
      } catch (error) {
        // ⚠️ REFUSED IS NOT DELETED. The product used to go to the trash BEFORE
        // the request and stay there when the server refused (a product with
        // sales), the status stuck on «saving», and nothing said why.
        setSaveStatus('error')
        toast.error(productDeleteRefusal(error, t))
        return
      }
      moveToTrash({
        entity: 'product',
        entityId: product.id,
        data: JSON.stringify(product),
      })
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
      refetch()
    },
    [deleteProduct, moveToTrash, setSaveStatus, refetch, toast, t],
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
