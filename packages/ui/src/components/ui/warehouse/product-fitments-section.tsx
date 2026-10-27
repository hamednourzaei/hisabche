'use client'

// ============================================
// packages/ui/src/components/ui/warehouse/product-fitments-section.tsx
//
// Auto Fitments Section (Option 25 / Dealership & Parts)
// Mounted on the product page (warehouse-detail-container) only when the
// business profile carries the `auto_fitments` capability.
// Reuses Input, Button, Badge.
// ============================================

import { memo, useCallback, useState } from 'react'
import {
  apiErrorMessage,
  useAddProductFitment,
  useProductFitments,
  type AutoFitmentRecord,
} from '@hisabche/api'
import { Plus, Wrench } from 'lucide-react'
import { Badge } from '../badge'
import { Button } from '../button'
import { Input } from '../input'

const card =
  'rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-5'

type Translate = (key: string, fallback?: string) => string

const identity: Translate = (_key, fallback) => fallback ?? _key

export const ProductFitmentsSection = memo(function ProductFitmentsSection({
  productId,
  t = identity,
}: {
  productId: string
  t?: Translate | undefined
}) {
  const { data: fitments = [], isError: loadFailed } = useProductFitments(productId)
  const addFitment = useAddProductFitment(productId)

  const [make, setMake] = useState('')
  const [model, setModel] = useState('')
  const [yearStart, setYearStart] = useState('')
  const [yearEnd, setYearEnd] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleAdd = useCallback(async () => {
    if (!make.trim() || !model.trim() || !yearStart.trim() || !yearEnd.trim()) return

    setError(null)
    try {
      await addFitment.mutateAsync({
        make: make.trim(),
        model: model.trim(),
        yearStart: Number(yearStart),
        yearEnd: Number(yearEnd),
      })
    } catch (cause) {
      setError(apiErrorMessage(cause, t('warehouse.extSaveFailed', 'ثبت انجام نشد')))
      return
    }

    setMake('')
    setModel('')
    setYearStart('')
    setYearEnd('')
  }, [make, model, yearStart, yearEnd, addFitment, t])

  const list = fitments as AutoFitmentRecord[]

  return (
    <section className={card}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-[hsl(var(--color-primary))]" />
          <h3 className="text-base font-semibold text-[hsl(var(--fg-primary))]">
            {t('warehouse.extFitmentsTitle', 'سازگاری خودرو (قطعات و لوازم یدکی)')}
          </h3>
        </div>
        <Badge variant="outline">
          {list.length} {t('warehouse.extFitmentsCount', 'خودرو')}
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
        <Input
          name="make"
          placeholder={t('warehouse.extMake', 'سازنده (مثلا: Toyota)')}
          value={make}
          onChange={(e) => setMake(e.target.value)}
        />
        <Input
          name="model"
          placeholder={t('warehouse.extModel', 'مدل (مثلا: Corolla)')}
          value={model}
          onChange={(e) => setModel(e.target.value)}
        />
        <Input
          name="yearStart"
          placeholder={t('warehouse.extYearFrom', 'از سال (مثلا: 2018)')}
          type="number"
          value={yearStart}
          onChange={(e) => setYearStart(e.target.value)}
        />
        <Input
          name="yearEnd"
          placeholder={t('warehouse.extYearTo', 'تا سال (مثلا: 2024)')}
          type="number"
          value={yearEnd}
          onChange={(e) => setYearEnd(e.target.value)}
        />
      </div>

      <div className="flex justify-end mb-4">
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={
            !make.trim() ||
            !model.trim() ||
            !yearStart.trim() ||
            !yearEnd.trim() ||
            addFitment.isPending
          }
        >
          <Plus className="h-4 w-4 me-1" />
          {t('warehouse.extAddFitment', 'ثبت سازگاری')}
        </Button>
      </div>

      {error ? (
        <p role="alert" className="mb-3 text-xs text-[hsl(var(--color-destructive))]">
          {error}
        </p>
      ) : null}
      {loadFailed ? (
        <p role="alert" className="mb-3 text-xs text-[hsl(var(--color-destructive))]">
          {t('warehouse.extLoadFailed', 'خواندن اطلاعات انجام نشد')}
        </p>
      ) : null}

      <div className="space-y-2">
        {!loadFailed && list.length === 0 ? (
          <p className="text-sm text-[hsl(var(--fg-tertiary))]">
            {t('warehouse.extFitmentsEmpty', 'هنوز خودرویی برای این قطعه ثبت نشده است.')}
          </p>
        ) : null}
        {list.map((f) => (
          <div
            key={f.id}
            className="flex items-center justify-between p-3 rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))]"
          >
            <span className="font-medium text-sm text-[hsl(var(--fg-primary))]">
              {f.make} {f.model}
            </span>
            <Badge variant="secondary">
              {t('warehouse.extYearsFrom', 'از سال')} {f.yearStart}{' '}
              {t('warehouse.extYearsTo', 'تا')} {f.yearEnd}
            </Badge>
          </div>
        ))}
      </div>
    </section>
  )
})
