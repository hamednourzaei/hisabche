// packages/ui/src/components/ui/manufacturing/containers/manufacturing-container.tsx
'use client'

import { memo, useCallback, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  apiErrorMessage,
  useBOMs,
  useCreateWorkOrder,
  useProducts,
  useWorkOrders,
  type BOM,
  type WorkOrder,
} from '@hisabche/api'

import { useIntlLocale } from '../../../../hooks/use-intl-locale'
import { ManufacturingView, type ManufacturingTabId } from '../manufacturing-view'
import {
  CreateWorkOrderDialog,
  type CreateWorkOrderInput,
} from '../components/CreateWorkOrderDialog'
import { ManufacturingReportView } from '../manufacturing-report'
import { ProductionEditor, type ProductionEditorTarget } from '../production-editor'
import { ProductionHistory } from '../production-history'
import { manufacturingErrorText } from '../manufacturing-errors'

/* ═══════════════════════════════════════════════════════════════════════════
   ManufacturingContainer — the manufacturing page.

   The page is the tables until someone makes or edits something; then it is
   the production form (the same one a product's page opens), and it comes
   back to the tables when that is done.
   ═══════════════════════════════════════════════════════════════════════════ */

interface EditorState {
  mode: 'produce' | 'definition'
  product: ProductionEditorTarget | null
  workOrderId?: string
  quantity?: number
}

export const ManufacturingContainer = memo(function ManufacturingContainer() {
  const tOriginal = useTranslations()
  const locale = useIntlLocale()
  const t = useCallback(
    (key: string, fallback?: string): string => {
      const v = tOriginal(key as Parameters<typeof tOriginal>[0])
      return v && v !== key ? v : (fallback ?? key)
    },
    [tOriginal],
  )

  const [activeTab, setActiveTab] = useState<ManufacturingTabId>('boms')
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [isWorkOrderDialogOpen, setIsWorkOrderDialogOpen] = useState(false)

  const { data: boms, isLoading: isBomsLoading, error: bomsError } = useBOMs()
  const {
    data: workOrders,
    isLoading: isWorkOrdersLoading,
    error: workOrdersError,
  } = useWorkOrders()

  // The planning dialog's product list. Planning is a convenience, not a
  // decision made from this list, so one page of active products is enough;
  // the production form itself searches the whole catalogue.
  const { data: productsData } = useProducts({ limit: 200, isActive: true })
  const { mutate: createWorkOrder, isPending: isCreatingWorkOrder } = useCreateWorkOrder()

  const isLoading = activeTab === 'boms' ? isBomsLoading : isWorkOrdersLoading
  const error = activeTab === 'boms' ? bomsError : workOrdersError
  const errorCode = error ? apiErrorMessage(error, '') : ''
  const errorText = error
    ? manufacturingErrorText(
        t,
        errorCode,
        t('manufacturing.loadFailed', 'اطلاعات تولید خوانده نشد.'),
      )
    : null

  const productOptions = useMemo(
    () =>
      (productsData?.products ?? [])
        .filter((p): p is typeof p & { id: string } => !!p.id)
        .map((p) => ({ id: p.id, name: p.name, unit: p.unit })),
    [productsData],
  )

  const bomOptions = useMemo(
    () =>
      (boms ?? [])
        .filter((b) => b.isActive)
        .map((b) => ({ id: b.id, productId: b.productId, version: b.version })),
    [boms],
  )

  const handleProduce = useCallback(() => setEditor({ mode: 'produce', product: null }), [])

  const handleEditDefinition = useCallback((bom: BOM) => {
    if (!bom.product) return
    setEditor({
      mode: 'definition',
      product: { productId: bom.productId, productName: bom.product.name },
    })
  }, [])

  const handleCompleteWorkOrder = useCallback((workOrder: WorkOrder) => {
    if (!workOrder.product) return
    setEditor({
      mode: 'produce',
      product: { productId: workOrder.productId, productName: workOrder.product.name },
      workOrderId: workOrder.id,
      quantity: workOrder.quantity,
    })
  }, [])

  const closeEditor = useCallback(() => setEditor(null), [])

  const handleSubmitWorkOrder = useCallback(
    (input: CreateWorkOrderInput) => {
      createWorkOrder(input, { onSuccess: () => setIsWorkOrderDialogOpen(false) })
    },
    [createWorkOrder],
  )

  if (editor) {
    return (
      <ProductionEditor
        t={t}
        locale={locale}
        mode={editor.mode}
        product={editor.product}
        workOrderId={editor.workOrderId}
        initialQuantity={editor.quantity}
        onDone={() => {
          // After a run, land where the result is.
          if (editor.mode === 'produce') setActiveTab('history')
          closeEditor()
        }}
        onCancel={closeEditor}
      />
    )
  }

  return (
    <>
      <ManufacturingView
        t={t}
        locale={locale}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        boms={boms ?? []}
        workOrders={workOrders ?? []}
        isLoading={isLoading}
        error={errorText}
        onProduce={handleProduce}
        onEditDefinition={handleEditDefinition}
        onCompleteWorkOrder={handleCompleteWorkOrder}
        onOpenCreateWorkOrder={() => setIsWorkOrderDialogOpen(true)}
        history={<ProductionHistory t={t} locale={locale} />}
        report={<ManufacturingReportView t={t} locale={locale} />}
      />

      <CreateWorkOrderDialog
        t={t}
        isOpen={isWorkOrderDialogOpen}
        onClose={() => setIsWorkOrderDialogOpen(false)}
        onSubmit={handleSubmitWorkOrder}
        isSubmitting={isCreatingWorkOrder}
        products={productOptions}
        boms={bomOptions}
      />
    </>
  )
})

ManufacturingContainer.displayName = 'ManufacturingContainer'
