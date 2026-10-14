'use client'

// ============================================
// packages/ui/src/components/ui/cycle-count/start-count-form.tsx
//
// «شروع شمارش» (live audit #35). The counts page said «هنوز شمارشی باز نشده»
// with no way to open one — `useCreateCycleCount` had no caller. A count is
// opened over ONE warehouse, with every product that warehouse holds; the
// server freezes each product's expected quantity at that moment.
// ============================================

import { useState } from 'react'

import {
  apiErrorMessage,
  asList,
  useCreateCycleCount,
  useWarehouseDetail,
  useWarehouseOverview,
  type WarehouseOverviewItem,
} from '@hisabche/api'

import { SelectField } from '../select-field'

export function StartCountForm({
  t,
  onStarted,
}: {
  t: (key: string, fallback?: string) => string
  onStarted: (countId: string) => void
}) {
  const overview = useWarehouseOverview()
  const warehouses = asList<WarehouseOverviewItem>(overview.data?.warehouses).filter(
    (warehouse) => warehouse.isActive,
  )
  const [warehouseId, setWarehouseId] = useState('')
  const detail = useWarehouseDetail(warehouseId || null)
  const create = useCreateCycleCount()
  const productIds = (detail.data?.products ?? []).map((product) => product.id)

  if (overview.isLoading) return null
  if (warehouses.length === 0) {
    return (
      <p className="text-xs text-[hsl(var(--fg-tertiary))]">
        {t('cycleCount.needWarehouse', 'برای شمارش، اول یک انبار بسازید.')}
      </p>
    )
  }

  const ready = !!warehouseId && !detail.isLoading && productIds.length > 0

  return (
    <form
      data-start-count=""
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        if (!ready || create.isPending) return
        create.mutate(
          { warehouseId, productIds },
          {
            onSuccess: (data) => {
              const id = (data as { id?: string } | null)?.id
              if (id) onStarted(id)
              setWarehouseId('')
            },
          },
        )
      }}
    >
      <SelectField
        value={warehouseId}
        onChange={setWarehouseId}
        placeholder={t('cycleCount.chooseWarehouse', 'انبار را انتخاب کنید')}
        options={warehouses.map((warehouse) => ({ value: warehouse.id, label: warehouse.name }))}
        aria-label={t('cycleCount.warehouse', 'انبار')}
      />
      <button
        type="submit"
        disabled={!ready || create.isPending}
        className="h-9 shrink-0 rounded-full bg-[hsl(var(--color-primary))] px-4 text-xs font-bold text-[hsl(var(--color-primary-fg))] disabled:opacity-40"
      >
        {create.isPending ? t('common.saving', 'در حال ثبت…') : t('cycleCount.start', 'شروع شمارش')}
      </button>
      {warehouseId && !detail.isLoading && productIds.length === 0 ? (
        <span className="text-xs text-[hsl(var(--fg-tertiary))]">
          {t('cycleCount.emptyWarehouse', 'این انبار کالایی برای شمردن ندارد.')}
        </span>
      ) : null}
      {create.error ? (
        <span role="alert" className="text-xs text-[hsl(var(--color-destructive))]">
          {apiErrorMessage(create.error, t('cycleCount.startFailed', 'شمارش باز نشد.'))}
        </span>
      ) : null}
    </form>
  )
}
