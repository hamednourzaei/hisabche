// packages/ui/src/components/ui/warehouse/containers/Warehouse-container.tsx
'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useWarehouse } from '../../../../hooks/warehouse/use-warehouse'
import { WarehouseView } from '../warehouse-view'
import { AddProductModal } from '../../add-product-modal'
import { fmt } from '../../../../lib/warehouse/warehouse-format'
import { useQueryClient } from '@tanstack/react-query'
import { productKeys } from '@hisabche/api'

const CURRENCIES = [
  { code: 'AFN', label: 'افغانی', rate: 1 },
  { code: 'USD', label: 'دالر', rate: 0.014 },
  { code: 'IRR', label: 'پومان', rate: 0.85 },
]

export function warehouseContainer() {
  const t = useTranslations()
  const router = useRouter()
  const queryClient = useQueryClient()

  // ورودی از command palette — همان قرارداد صفحه‌ی مشتریان: `?add=true` مودال
  // افزودن کالا را باز می‌کند و `?q=` جستجو را از قبل پر می‌کند.
  const searchParams = useSearchParams()
  const addParam = searchParams?.get('add')
  const queryParam = searchParams?.get('q')

  const [search, setSearch] = useState(queryParam ?? '')
  const [showAddModal, setShowAddModal] = useState(addParam === 'true')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (addParam === 'true') setShowAddModal(true)
  }, [addParam])

  useEffect(() => {
    if (queryParam !== null && queryParam !== undefined) setSearch(queryParam)
  }, [queryParam])

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
    refetch,
  } = useWarehouse(search)

  const onDelete = useCallback(
    async (product: { id: string; name?: string }) => {
      setDeletingId(product.id)
      await handleDelete(product)
      setDeletingId(null)
    },
    [handleDelete],
  )

  const safeT = useMemo(
    () => (key: string, fallback?: string) => {
      const v = t(key)
      return v !== key ? v : (fallback ?? key)
    },
    [t],
  )

  const handleNavigate = useCallback((id: string) => router.push(`/warehouse/${id}`), [router])

  const handleOpenAddModal = useCallback(() => setShowAddModal(true), [])

  // ✅ FIX: بعد از بستن مودال و ایجاد محصول، کش را پاک کن
  const handleCloseAddModal = useCallback(() => {
    setShowAddModal(false)
    // ✅ پاک کردن کش محصولات
    queryClient.invalidateQueries({ queryKey: productKeys.lists() })
    // ✅ رفرش کردن داده‌ها
    refetch()
  }, [queryClient, refetch])

  // ✅ FIX: وقتی محصول جدید ایجاد شد، کش را پاک کن
  const handleProductCreated = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: productKeys.lists() })
    refetch()
  }, [queryClient, refetch])

  const viewProps = {
    t: safeT,
    fmt,
    search,
    onSearchChange: setSearch,
    onOpenAddModal: handleOpenAddModal,
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
  }

  return (
    <>
      <AddProductModal
        open={showAddModal}
        onClose={handleCloseAddModal}
        onCreated={handleProductCreated}
      />
      <WarehouseView {...viewProps} />
    </>
  )
}
