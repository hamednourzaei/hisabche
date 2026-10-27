'use client'

// ============================================
// packages/ui/src/components/ui/warehouse/product-fitments-section.tsx
//
// Auto Fitments Section (Option 25 / Dealership & Parts)
// Reuses Input, Button, Badge.
// ============================================

import { memo, useCallback, useState } from 'react'
import { useAddProductFitment, useProductFitments, type AutoFitmentRecord } from '@hisabche/api'
import { Plus, Wrench } from 'lucide-react'
import { Badge } from '../badge'
import { Button } from '../button'
import { Input } from '../input'

const card =
  'rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-5'

export const ProductFitmentsSection = memo(function ProductFitmentsSection({
  productId,
}: {
  productId: string
}) {
  const { data: fitments = [] } = useProductFitments(productId)
  const addFitment = useAddProductFitment(productId)

  const [make, setMake] = useState('')
  const [model, setModel] = useState('')
  const [yearStart, setYearStart] = useState('')
  const [yearEnd, setYearEnd] = useState('')

  const handleAdd = useCallback(async () => {
    if (!make.trim() || !model.trim() || !yearStart.trim() || !yearEnd.trim()) return

    await addFitment.mutateAsync({
      make: make.trim(),
      model: model.trim(),
      yearStart: Number(yearStart),
      yearEnd: Number(yearEnd),
    })

    setMake('')
    setModel('')
    setYearStart('')
    setYearEnd('')
  }, [make, model, yearStart, yearEnd, addFitment])

  return (
    <section className={card}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-[hsl(var(--color-primary))]" />
          <h3 className="text-base font-semibold text-[hsl(var(--fg-primary))]">
            سازگاری خودرو (قطعات و لوازم یدکی)
          </h3>
        </div>
        <Badge variant="outline">{(fitments as AutoFitmentRecord[]).length} خودرو</Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
        <Input
          placeholder="سازنده (مثلا: Toyota)"
          value={make}
          onChange={(e) => setMake(e.target.value)}
        />
        <Input
          placeholder="مدل (مثلا: Corolla)"
          value={model}
          onChange={(e) => setModel(e.target.value)}
        />
        <Input
          placeholder="از سال (مثلا: 2018)"
          type="number"
          value={yearStart}
          onChange={(e) => setYearStart(e.target.value)}
        />
        <Input
          placeholder="تا سال (مثلا: 2024)"
          type="number"
          value={yearEnd}
          onChange={(e) => setYearEnd(e.target.value)}
        />
      </div>

      <div className="flex justify-end mb-4">
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={!make.trim() || !model.trim() || addFitment.isPending}
        >
          <Plus className="h-4 w-4 me-1" />
          ثبت سازگاری
        </Button>
      </div>

      <div className="space-y-2">
        {(fitments as AutoFitmentRecord[]).map((f) => (
          <div
            key={f.id}
            className="flex items-center justify-between p-3 rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))]"
          >
            <span className="font-medium text-sm text-[hsl(var(--fg-primary))]">
              {f.make} {f.model}
            </span>
            <Badge variant="secondary">
              سال {f.yearStart} تا {f.yearEnd}
            </Badge>
          </div>
        ))}
      </div>
    </section>
  )
})
