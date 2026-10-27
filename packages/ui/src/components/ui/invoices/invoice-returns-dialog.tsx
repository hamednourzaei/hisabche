'use client'

// ============================================
// packages/ui/src/components/ui/invoices/invoice-returns-dialog.tsx
//
// Invoice Returns Dialog (Option 18 / Returns)
// Lands in: Sales -> Invoices Detail
// Reuses Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Button, Input, SelectField.
// Checks `useActionAvailability('invoice.returns')` and renders `<CloudRequiredNotice />`
// when executed under offline edition.
// Builds valid request with real `invoice_items.id`, valid `ReturnReason`, and capped quantity.
// ============================================

import { memo, useCallback, useMemo, useState, useEffect } from 'react'
import { useCreateInvoiceReturn } from '@hisabche/api'
import { toIsoDay } from '@hisabche/formatting'
import type { RestockChoice, ReturnReason } from '@hisabche/validation'
import { RotateCcw } from 'lucide-react'
import { useActionAvailability } from '../../../lib/capability/use-action-availability'
import { Button } from '../button'
import { CloudRequiredNotice } from '../cloud-required-notice'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../dialog'
import { Input } from '../input'
import { SelectField, type SelectFieldOption } from '../select-field'

export interface ReturnInvoiceItemOption {
  id?: string | undefined
  productName?: string | undefined
  product_name?: string | undefined
  quantity?: number | undefined
}

export interface InvoiceReturnsDialogProps {
  invoiceId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  items?: readonly ReturnInvoiceItemOption[] | undefined
  t?: ((key: string, fallback?: string) => string) | undefined
}

export const InvoiceReturnsDialog = memo(function InvoiceReturnsDialog({
  invoiceId,
  open,
  onOpenChange,
  items,
  t,
}: InvoiceReturnsDialogProps) {
  const availability = useActionAvailability('invoice.returns')
  const createReturn = useCreateInvoiceReturn(invoiceId)

  const [returnNumber, setReturnNumber] = useState('')
  const [selectedLineId, setSelectedLineId] = useState<string>('')
  const [reason, setReason] = useState<ReturnReason>('defective')
  const [restockChoice, setRestockChoice] = useState<RestockChoice>('restock')
  const [quantity, setQuantity] = useState('1')

  // Initialize selectedLineId to first item when opened or items change
  useEffect(() => {
    if (items && items.length > 0 && !selectedLineId) {
      const firstValid = items.find((i) => i.id)
      if (firstValid?.id) setSelectedLineId(firstValid.id)
    }
  }, [items, selectedLineId])

  const activeItem = useMemo(() => {
    return items?.find((it) => it.id === selectedLineId) ?? items?.[0]
  }, [items, selectedLineId])

  const maxQuantity = Math.max(1, activeItem?.quantity ?? 1)

  const itemOptions: SelectFieldOption[] = useMemo(() => {
    if (!items || items.length === 0) return []
    return items.map((it, idx) => ({
      value: it.id || `item-${idx}`,
      label: `${it.productName || it.product_name || `کالا ${idx + 1}`} (${t?.('invoices.invoiceQuantity', 'تعداد در فاکتور') ?? 'تعداد در فاکتور'}: ${it.quantity ?? 1})`,
    }))
  }, [items, t])

  const reasonOptions: SelectFieldOption[] = useMemo(
    () => [
      {
        value: 'defective',
        label: t?.('invoices.reasonDefective', 'معیوب / خرابی کالا') ?? 'معیوب / خرابی کالا',
      },
      {
        value: 'wrong_item',
        label: t?.('invoices.reasonWrongItem', 'ارسال اشتباه') ?? 'ارسال اشتباه',
      },
      {
        value: 'customer_change_of_mind',
        label: t?.('invoices.reasonChangeOfMind', 'انصراف مشتری') ?? 'انصراف مشتری',
      },
      {
        value: 'damaged_in_transit',
        label: t?.('invoices.reasonDamaged', 'آسیب در حمل و نقل') ?? 'آسیب در حمل و نقل',
      },
      {
        value: 'expired',
        label: t?.('invoices.reasonExpired', 'انقضای تاریخ مصرف') ?? 'انقضای تاریخ مصرف',
      },
      {
        value: 'other',
        label: t?.('invoices.reasonOther', 'سایر موارد') ?? 'سایر موارد',
      },
    ],
    [t],
  )

  const restockOptions: SelectFieldOption[] = useMemo(
    () => [
      {
        value: 'restock',
        label:
          t?.('invoices.restockChoiceRestock', 'برگشت به انبار (افزایش موجودی)') ??
          'برگشت به انبار (افزایش موجودی)',
      },
      {
        value: 'scrap',
        label:
          t?.('invoices.restockChoiceScrap', 'اسقاط / ضایعات (بدون افزایش موجودی)') ??
          'اسقاط / ضایعات (بدون افزایش موجودی)',
      },
    ],
    [t],
  )

  const handleReturn = useCallback(async () => {
    const trimmedNumber = returnNumber.trim()
    const targetLineId = activeItem?.id || selectedLineId
    if (!trimmedNumber || !targetLineId) return

    const numQty = Number(quantity) || 1
    const clampedQty = Math.min(Math.max(1, numQty), maxQuantity)

    await createReturn.mutateAsync({
      returnType: 'sale_return',
      returnNumber: trimmedNumber,
      returnDate: toIsoDay(new Date()),
      lines: [
        {
          originalLineId: targetLineId,
          quantity: clampedQty,
          restockChoice,
          reasonCode: reason,
        },
      ],
    })

    onOpenChange(false)
  }, [
    returnNumber,
    activeItem,
    selectedLineId,
    quantity,
    maxQuantity,
    createReturn,
    restockChoice,
    reason,
    onOpenChange,
  ])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {availability.requiresOnline ? (
          <CloudRequiredNotice
            variant="inline"
            title={t?.('invoices.returnInvoice', 'ثبت مرجوعی فاکتور') ?? 'ثبت مرجوعی فاکتور'}
            onDismiss={() => onOpenChange(false)}
          />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <RotateCcw className="h-5 w-5 text-[hsl(var(--color-primary))]" />
                {t?.('invoices.returnInvoice', 'ثبت مرجوعی فاکتور') ?? 'ثبت مرجوعی فاکتور'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-3">
              <div>
                <label className="text-sm font-medium text-[hsl(var(--fg-primary))] mb-1 block">
                  {t?.('invoices.returnNumber', 'شماره برگه مرجوعی') ?? 'شماره برگه مرجوعی'}
                </label>
                <Input
                  value={returnNumber}
                  onChange={(e) => setReturnNumber(e.target.value)}
                  placeholder="مثلا: RET-1001"
                />
              </div>

              {itemOptions.length > 0 ? (
                <div>
                  <label className="text-sm font-medium text-[hsl(var(--fg-primary))] mb-1 block">
                    {t?.('invoices.returnLineItem', 'انتخاب قلم کالا برای مرجوعی') ??
                      'انتخاب قلم کالا برای مرجوعی'}
                  </label>
                  <SelectField
                    value={selectedLineId || itemOptions[0]?.value}
                    onChange={setSelectedLineId}
                    options={itemOptions}
                  />
                </div>
              ) : null}

              <div>
                <label className="text-sm font-medium text-[hsl(var(--fg-primary))] mb-1 block">
                  {t?.('invoices.returnQuantity', 'تعداد مرجوعی') ?? 'تعداد مرجوعی'} (حداکثر{' '}
                  {maxQuantity})
                </label>
                <Input
                  type="number"
                  min="1"
                  max={maxQuantity}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[hsl(var(--fg-primary))] mb-1 block">
                  {t?.('invoices.returnRestockAction', 'نحوه مدیریت کالا') ?? 'نحوه مدیریت کالا'}
                </label>
                <SelectField
                  value={restockChoice}
                  onChange={(val) => setRestockChoice(val as RestockChoice)}
                  options={restockOptions}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[hsl(var(--fg-primary))] mb-1 block">
                  {t?.('invoices.returnReason', 'علت مرجوعی') ?? 'علت مرجوعی'}
                </label>
                <SelectField
                  value={reason}
                  onChange={(val) => setReason(val as ReturnReason)}
                  options={reasonOptions}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t?.('common.cancel', 'انصراف') ?? 'انصراف'}
              </Button>
              <Button
                onClick={handleReturn}
                disabled={
                  !returnNumber.trim() ||
                  !(activeItem?.id || selectedLineId) ||
                  createReturn.isPending
                }
              >
                {t?.('invoices.submitReturn', 'ثبت و اعمال مرجوعی') ?? 'ثبت و اعمال مرجوعی'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
})
