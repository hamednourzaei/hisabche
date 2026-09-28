'use client'

import { useState, type RefObject } from 'react'
import { ArrowRight, Loader2, FileText } from 'lucide-react'
import { ApprovalCard } from '../workflow/approval-timeline'
import { GHOST_ICON_BUTTON, OUTLINE_BUTTON } from '../button-classes'
import {
  InvoiceDocument,
  buildInvoiceShareUrl,
  type InvoiceDocumentData,
  type InvoiceDocumentDisplaySettings,
} from './invoice-document'
import { InvoiceSidebar, type InvoiceSidebarActions } from './invoice-sidebar'

interface InvoiceItemDetail {
  id?: string | undefined
  title: string
  quantity: number
  amount: number
  unit?: string | undefined
  unitLabel?: string | null | undefined
  sortOrder?: number | undefined
}

interface InvoiceItem {
  id?: string | undefined
  productName?: string | undefined
  product_name?: string | undefined
  quantity?: number | undefined
  unit?: string | undefined
  unitLabel?: string | null | undefined
  weightGrams?: number | null | undefined
  discount?: number | undefined
  unitPrice?: number | undefined
  unit_price?: number | undefined
  totalPrice?: number | undefined
  total_price?: number | undefined
  /** Components of this line. Empty is valid and renders nothing. */
  details?: InvoiceItemDetail[] | undefined
}

interface TimelineAction {
  id: string
  action: 'approved' | 'rejected' | 'forwarded' | 'cancelled'
  step_order: number
  actor_user_id: string
  actor_role?: string | null
  comment?: string | null
  created_at: string
}

interface TimelineStep {
  step_order: number
  approver_role: string
  is_final: boolean
}

export interface InvoiceDetailDisplay {
  id: string
  /** sale | purchase — drives the document heading and party labels. */
  type?: 'sale' | 'purchase' | undefined
  publicToken?: string | undefined
  invoiceNumber: string
  date: string
  dueDate?: string | null | undefined
  status: string
  currency: string
  subtotal: number
  total: number
  customerName: string
  customerPhone?: string | null | undefined
  customerEmail?: string | null | undefined
  customerAddress?: string | null | undefined
  discountTotal: number
  taxTotal: number
  paidAmount: number
  /**
   * T9 — the party a payment recorded from this screen belongs to.
   *
   * Null on a walk-in cash sale, which is supported: the payment carries no
   * party and is allocated to the invoice by id.
   */
  customerId?: string | null
  supplierId?: string | null
  createdAt: string
  updatedAt?: string | undefined
  notes?: string | null | undefined
  businessName?: string | undefined
  businessLogoUrl?: string | null | undefined
  businessStampUrl?: string | null | undefined
  items: InvoiceItem[]
}

export interface InvoiceDetailPageProps {
  t: (key: string, fallback?: string) => string
  invoice: InvoiceDetailDisplay | null
  isLoading: boolean
  onBack: () => void
  onPrint: () => void
  onPrintReceipt?: (() => void) | undefined
  printingReceipt?: boolean | undefined
  onSharePDF: () => void
  onWhatsApp: () => void
  onTelegram: () => void
  onEmail: () => void
  onExportPNG?: () => void
  exportingPNG?: boolean
  pdfDownloadSlot?: React.ReactNode
  /** H2 — the payments and journal entry behind this invoice. Rendered under
   *  the sidebar; the container owns the query. */
  relatedSlot?: React.ReactNode
  /** «Why this profit?» — the evidence chain, rendered by the container. */
  evidenceSlot?: React.ReactNode
  /** H6 — the audit trail for this record. */
  historySlot?: React.ReactNode
  documentRef?: RefObject<HTMLDivElement | null>
  statusVariant: (status: string) => 'success' | 'warning' | 'destructive' | 'secondary'
  workflowInstance?: {
    id: string
    status: string
    current_step: number
    total_steps: number
  } | null
  workflowActions?: TimelineAction[]
  workflowSteps?: TimelineStep[]
  workflowPending?: boolean
  onWorkflowAction?: (
    action: 'approved' | 'rejected' | 'cancelled',
    comment?: string,
  ) => Promise<void>
}

const DEFAULT_DISPLAY: InvoiceDocumentDisplaySettings = {
  showSignature: true,
  showNotes: true,
  showBarcode: true,
}

export function InvoiceDetailPage({
  t,
  invoice,
  isLoading,
  onBack,
  onPrint,
  onPrintReceipt,
  printingReceipt,
  onSharePDF,
  onWhatsApp,
  onTelegram,
  onEmail,
  onExportPNG,
  exportingPNG,
  pdfDownloadSlot,
  relatedSlot,
  evidenceSlot,
  historySlot,
  documentRef,
  statusVariant,
  workflowInstance,
  workflowActions = [],
  workflowSteps = [],
  workflowPending = false,
  onWorkflowAction,
}: InvoiceDetailPageProps) {
  const [display, setDisplay] = useState<InvoiceDocumentDisplaySettings>(DEFAULT_DISPLAY)

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-[hsl(var(--color-primary))]" />
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <FileText className="size-16 text-[hsl(var(--fg-tertiary))]" />
        <p className="text-lg text-[hsl(var(--fg-secondary))]">
          {t('invoices.notFound', 'فاکتور پیدا نشد')}
        </p>
        <button type="button" onClick={onBack} className={OUTLINE_BUTTON}>
          {t('action.back', 'بازگشت')}
        </button>
      </div>
    )
  }

  const {
    id: invoiceId,
    publicToken,
    invoiceNumber,
    date,
    dueDate,
    status,
    currency,
    subtotal,
    total,
    customerName,
    customerPhone,
    customerEmail,
    customerAddress,
    discountTotal,
    taxTotal,
    paidAmount,
    createdAt,
    updatedAt,
    notes,
    businessName,
    businessLogoUrl,
    businessStampUrl,
    items,
  } = invoice

  const documentData: InvoiceDocumentData = {
    type: invoice.type ?? 'sale',
    invoiceId,
    publicToken,
    invoiceNumber,
    date,
    dueDate,
    business: {
      name: businessName || t('app.name', 'Hisabche'),
      logoUrl: businessLogoUrl,
      stampUrl: businessStampUrl,
    },
    customer:
      customerName || customerPhone || customerEmail || customerAddress
        ? {
            name: customerName,
            phone: customerPhone,
            email: customerEmail,
            address: customerAddress,
          }
        : null,
    items: items.map((item, i) => ({
      id: item.id ?? String(i),
      productName: item.productName ?? item.product_name ?? '',
      quantity: item.quantity ?? 0,
      unit: item.unit,
      unitLabel: item.unitLabel,
      weightGrams: item.weightGrams,
      unitPrice: item.unitPrice ?? item.unit_price ?? 0,
      discount: item.discount ?? 0,
      totalPrice: item.totalPrice ?? item.total_price ?? 0,
      details: item.details ?? [],
    })),
    currency,
    subtotal,
    discountTotal,
    taxTotal,
    total,
    paidAmount,
    notes,
  }

  const actions: InvoiceSidebarActions = {
    onPrint,
    onPrintReceipt,
    printingReceipt,
    onSharePDF,
    onWhatsApp,
    onTelegram,
    onEmail,
    onExportPNG,
    exportingPNG,
    pdfDownloadSlot,
  }

  const shareUrl = buildInvoiceShareUrl('fa-AF', invoiceId, publicToken)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 no-print">
        <button type="button" onClick={onBack} className={GHOST_ICON_BUTTON}>
          <ArrowRight className="size-5" />
        </button>
        <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))]">
          {t('invoices.detail', 'جزئیات فاکتور')} #{invoiceNumber}
        </h1>
      </div>

      {/* Workflow Approval Card */}
      {workflowInstance && workflowSteps.length > 0 && onWorkflowAction && (
        <ApprovalCard
          actions={workflowActions}
          steps={workflowSteps}
          currentStep={workflowInstance.current_step}
          status={workflowInstance.status}
          instanceId={workflowInstance.id}
          isPending={workflowPending}
          onAction={onWorkflowAction}
          t={t}
          disabled={workflowInstance.status !== 'in_progress'}
        />
      )}

      {/* Document + Sidebar */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <InvoiceDocument ref={documentRef} t={t} data={documentData} display={display} />
        </div>
        <div className="no-print lg:col-span-1">
          <InvoiceSidebar
            t={t}
            statusInfo={{ status, variant: statusVariant(status) }}
            summary={{ total, paidAmount, currency }}
            metadata={{ invoiceNumber, createdAt, updatedAt }}
            actions={actions}
            shareUrl={shareUrl}
            display={display}
            onDisplayChange={(key, value) => setDisplay((prev) => ({ ...prev, [key]: value }))}
          />

          {/* H2 — the payments behind «پرداخت‌شده» and the entry this invoice
              produced. A slot, following `pdfDownloadSlot`: the container owns
              the query, so this component stays free of data hooks and the
              quick-invoice preview — which reuses the sidebar above for an
              invoice that does not exist yet — is unaffected. */}
          {relatedSlot ? <div className="mt-6">{relatedSlot}</div> : null}
          {evidenceSlot ? <div className="mt-6">{evidenceSlot}</div> : null}
          {historySlot ? <div className="mt-6">{historySlot}</div> : null}
        </div>
      </div>
    </div>
  )
}
