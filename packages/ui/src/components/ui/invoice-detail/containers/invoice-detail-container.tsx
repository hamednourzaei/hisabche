'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  useInvoice,
  useWorkspaces,
  useWorkflowInstance,
  useWorkflowInstanceDetail,
  useWorkflow,
  usePerformWorkflowAction,
  useInvoiceRelated,
  useRecordHistory,
  useRecordPayment,
  useCancelPayment,
  usePostInvoiceToLedger,
  type InvoiceLedgerPostResult,
} from '@hisabche/api'
import { useSubscriptionLocked } from '../../billing/subscription-lock'
import { InvoiceDetailPage, type InvoiceDetailDisplay } from '../invoice-detail-page'
import InvoicePDFDownload from '../InvoicePDFDownload'
import { InvoiceRelatedPanel } from '../invoice-related-panel'
import { RecordHistoryPanel } from '../../activity/record-history-panel'
import { useQueryClient } from '@tanstack/react-query'
import { useDateFormat } from '../../../../hooks/use-date-format'

/* ═══════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════ */

const STATUS_MAP: Record<string, 'success' | 'warning' | 'destructive' | 'secondary'> = {
  completed: 'success',
  pending: 'warning',
  partial: 'secondary',
  cancelled: 'destructive',
}

const getField = <T,>(a: T | undefined, b: T | undefined): T | undefined => a ?? b

/* ═══════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════ */

interface WorkflowActionRecord {
  id: string
  action: 'approved' | 'rejected' | 'forwarded' | 'cancelled'
  step_order: number
  actor_user_id: string
  actor_role?: string | null
  comment?: string | null
  created_at: string
}

interface WorkflowStep {
  step_order: number
  approver_role: string
  is_final: boolean
}

/* ═══════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════ */

/**
 * Why a ledger post did not book, in words the owner can act on.
 *  when there is nothing to say (never attempted, or it posted).
 */
/** Known refusal codes in words; anything else as the server sent it. */
function reasonText(reason: string, tr: (key: string, fallback: string) => string): string {
  const code = /^([A-Z][A-Z_]{5,})/.exec(reason)?.[1]
  if (code === 'ACCOUNTING_PERIOD_LOCKED') {
    return tr('invoiceDetail.reasonPeriodLocked', 'دوره‌ی حسابداری این تاریخ بسته شده است')
  }
  if (code === 'INVENTORY_INSUFFICIENT_STOCK') {
    return tr(
      'invoiceDetail.reasonInsufficientStock',
      'موجودی کافی با بهای ثبت‌شده برای این کالا وجود ندارد',
    )
  }
  if (reason === 'cancelled') return tr('invoiceDetail.reasonCancelled', 'فاکتور لغو شده است')
  return reason
}

function ledgerPostMessageOf(
  result: InvoiceLedgerPostResult | null,
  tr: (key: string, fallback: string) => string,
): string | null {
  if (!result) return null
  switch (result.status) {
    case 'posted':
      return result.uncostedProducts && result.uncostedProducts.length > 0
        ? tr(
            'invoiceDetail.ledgerPostedUncosted',
            'فاکتور در دفتر ثبت شد، ولی بهای تمام‌شده‌ی بعضی کالاها ثبت نشد چون موجودی آن‌ها بدون خرید (بدون لایه‌ی بها) وارد شده است. برای این کالاها فاکتور خرید یا موجودی اول دوره با بها ثبت کنید.',
          )
        : null
    case 'already_posted':
      return null
    case 'nothing_to_post':
      return tr(
        'invoiceDetail.ledgerNothingToPost',
        'مبلغ این فاکتور صفر است و چیزی برای ثبت در دفتر ندارد.',
      )
    case 'skipped':
      return `${tr('invoiceDetail.ledgerMissingAccounts', 'در سرفصل حساب‌ها این حساب‌ها تعریف نشده‌اند و تا تعریف نشوند فاکتور در دفتر ثبت نمی‌شود')}: ${result.missing.join('، ')}`
    case 'not_postable':
      return `${tr('invoiceDetail.ledgerNotPostable', 'این فاکتور الان قابل ثبت در دفتر نیست')}: ${reasonText(result.reason, tr)}`
  }
}

export function InvoiceDetailContainer() {
  const t = useTranslations()
  // ⚠️ THE CALENDAR FOLLOWS THE LANGUAGE. These were hardcoded to `'fa-AF'`,
  // so every reader got the Afghan solar calendar whatever they chose.
  const { date: fmtIntlDate } = useDateFormat()
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const documentRef = useRef<HTMLDivElement>(null)
  const autoActionRef = useRef(false)
  const queryClient = useQueryClient()
  const [exportingPNG, setExportingPNG] = useState(false)

  const { data: invoice, isLoading } = useInvoice(id)

  // H2 — the payments behind `paid_amount`, and the journal entry this invoice
  // produced. Both lived in the database with nothing able to reach them.
  const {
    data: related,
    isLoading: relatedLoading,
    isError: relatedFailed,
    refetch: refetchRelated,
  } = useInvoiceRelated(id)
  // ⚠️ «NOT READ» IS NOT «NOTHING PAID». Without the allocations the page used
  // `allocatedTotal ?? 0`, showed a fully paid invoice as open and offered a
  // payment the server then refused (PAYMENT_ALLOCATION_INVOICE_UNKNOWN on
  // INV-000051, allocated 2 000 000 of 2 000 000).
  const relatedKnown = related !== undefined && !relatedFailed

  // H6 — every recorded change to THIS invoice.
  const { data: recordHistory, isLoading: historyLoading } = useRecordHistory('invoice', id)

  // The journal has no per-entry screen yet, so this opens the accounting
  // ledger with the entry named in the URL rather than pretending a detail
  // route exists. H3 gives entries their own page; this link moves with it.
  const handleOpenJournalEntry = useCallback(
    (entryId: string) => router.push(`/accounting?tab=journal&entry=${entryId}`),
    [router],
  )

  // ✅ فرض تک-workspace: اولین workspace کاربر — برای نمایش لوگو/مهر کسب‌وکار روی فاکتور
  const { data: workspaces } = useWorkspaces()
  const currentWorkspace = Array.isArray(workspaces)
    ? (workspaces[0] as
        { name?: string; logo_url?: string | null; stamp_url?: string | null } | undefined)
    : undefined

  // ✅ FIX: قبلاً این سه کوئری مستقیم با supabaseClient (anon key) زده
  // می‌شد که هیچ session واقعی‌ای ندارد (auth واقعی از بک‌اند ماست، نه
  // Supabase Auth سمت کلاینت) — همین باعث ۴۰۱ Unauthorized می‌شد.
  // حالا از هوک‌های آماده که از apiClient (توکن backend) رد می‌شوند
  // استفاده می‌کند.
  const { data: workflowInstanceBase } = useWorkflowInstance('invoice', id ?? '')
  const { data: workflowDetail } = useWorkflowInstanceDetail(workflowInstanceBase?.id ?? '')
  const { data: workflowTemplate } = useWorkflow(workflowInstanceBase?.workflow_id ?? '')
  const { mutateAsync: performWorkflowAction } = usePerformWorkflowAction()

  const workflowData = useMemo(() => {
    if (!workflowInstanceBase) return null
    return {
      instance: workflowInstanceBase,
      steps: (workflowTemplate?.steps ?? []) as WorkflowStep[],
      actions: (workflowDetail?.actions ?? []) as WorkflowActionRecord[],
    }
  }, [workflowInstanceBase, workflowTemplate, workflowDetail])

  // ─── T9 — recording money against this invoice ────────────────────────
  //
  // `POST /api/payments` with allocations already existed and had no caller
  // from this screen. Without one, the only way an invoice got a paid amount
  // was the create form writing `paid_amount` onto the row — the drift the
  // owner reported on a real sale.
  // Expired subscription: the invoice stays viewable, but the controls that
  // would write (payments, workflow actions) are withheld.
  const subscriptionLocked = useSubscriptionLocked()
  const recordPayment = useRecordPayment()
  const cancelPayment = useCancelPayment()
  const postToLedger = usePostInvoiceToLedger()
  const [ledgerResult, setLedgerResult] = useState<InvoiceLedgerPostResult | null>(null)

  // ✅ FIX: استفاده از unknown به عنوان واسط
  const display: InvoiceDetailDisplay | null = useMemo(() => {
    if (!invoice) return null
    const inv = invoice as unknown as Record<string, unknown>
    const customer = (inv.customer as Record<string, unknown> | null) ?? null
    return {
      id: inv.id as string,
      // sale | purchase. Absent on pre-existing rows, which were all sales.
      type: (inv.type as 'sale' | 'purchase' | undefined) ?? 'sale',
      publicToken: (getField(inv.publicToken, inv.public_token) as string | undefined) ?? undefined,
      invoiceNumber: (getField(inv.invoiceNumber, inv.invoice_number) as string) ?? '',
      date: inv.date as string,
      dueDate: (getField(inv.dueDate, inv.due_date) as string | undefined) ?? null,
      status: inv.status as string,
      currency: (inv.currency as string) ?? 'AFN',
      subtotal: (inv.subtotal as number) ?? 0,
      total: (inv.total as number) ?? 0,
      customerName: (getField(inv.customerName, inv.customer_name) as string) ?? '',
      customerPhone: (customer?.phone as string | undefined) ?? null,
      customerEmail: (customer?.email as string | undefined) ?? null,
      customerAddress: (customer?.address as string | undefined) ?? null,
      discountTotal: (getField(inv.discountTotal, inv.discount_total) as number) ?? 0,
      taxTotal: (getField(inv.taxTotal, inv.tax_total) as number) ?? 0,
      paidAmount: (getField(inv.paidAmount, inv.paid_amount) as number) ?? 0,
      // T9 — who the money is from or to. Null on a walk-in cash sale, which
      // is a supported case: the payment is recorded with no party and
      // allocated to this invoice by id.
      customerId: (getField(inv.customerId, inv.customer_id) as string | undefined) ?? null,
      supplierId: (getField(inv.supplierId, inv.supplier_id) as string | undefined) ?? null,
      createdAt: (getField(inv.createdAt, inv.created_at) as string) ?? (inv.date as string),
      updatedAt: (getField(inv.updatedAt, inv.updated_at) as string | undefined) ?? undefined,
      notes: (inv.notes as string | undefined) ?? null,
      // ✅ نام/لوگو/مهر کسب‌وکار از workspace فعلی کاربر خوانده می‌شود؛
      // در نبود workspace به نام اپ در کامپوننت سند fallback می‌شود.
      businessName: currentWorkspace?.name,
      businessLogoUrl: currentWorkspace?.logo_url ?? null,
      businessStampUrl: currentWorkspace?.stamp_url ?? null,
      items: (
        (inv.items as unknown[]) ??
        (inv.invoiceItems as unknown[]) ??
        (inv.invoice_items as unknown[]) ??
        []
      ).map((item: any) => ({
        id: item.id,
        productName: item.productName ?? item.product_name,
        product_name: item.product_name,
        quantity: item.quantity,
        // ✅ واحد حالا در invoice_items ذخیره می‌شود (ستون unit/unit_label).
        unit: item.unit,
        unitLabel: item.unitLabel ?? item.unit_label ?? null,
        weightGrams: item.weightGrams ?? item.weight_grams ?? null,
        discount: item.discount ?? 0,
        unitPrice: item.unitPrice ?? item.unit_price,
        unit_price: item.unit_price,
        totalPrice: item.totalPrice ?? item.total_price,
        total_price: item.total_price,
        // اجزای این قلم، به همان ترتیبی که کاربر وارد کرده.
        details: ((item.details ?? item.invoice_item_details ?? []) as any[])
          .map((d: any) => ({
            id: d.id,
            title: d.title,
            quantity: Number(d.quantity ?? 1),
            amount: Number(d.amount ?? 0),
            unit: d.unit,
            unitLabel: d.unitLabel ?? d.unit_label ?? null,
            sortOrder: Number(d.sortOrder ?? d.sort_order ?? 0),
          }))
          .sort((a, b) => a.sortOrder - b.sortOrder),
      })),
    }
  }, [invoice, currentWorkspace])

  const safeT = useCallback(
    (key: string, fallback?: string) => {
      const v = t(key)
      return v && v !== key ? v : (fallback ?? key)
    },
    [t],
  )

  const buildMessage = useCallback(
    (inv: Record<string, unknown>) =>
      `🧾 ${t('invoices.title')}: #${getField(inv.invoiceNumber, inv.invoice_number)}\n📅 ${fmtIntlDate(inv.date as string)}\n${getField(inv.customerName, inv.customer_name) ? `👤 ${getField(inv.customerName, inv.customer_name)}\n` : ''}💰 *${((inv.total as number) ?? 0).toLocaleString()} ${(inv.currency as string) || 'AFN'}*\n📌 ${t(`invoices.${(inv.status as string) || 'pending'}`)}`,
    [t, fmtIntlDate],
  )

  const handlePrint = useCallback(() => {
    if (!documentRef.current) return
    const content = documentRef.current.innerHTML
    let styles = ''
    document.querySelectorAll("style, link[rel='stylesheet']").forEach((el) => {
      styles += el.outerHTML
    })
    const win = window.open('', '_blank', 'width=800,height=600')
    if (!win) return
    win.document.write(
      `<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8" />${styles}</head><body style="margin:20px;print-color-adjust:exact">${content}</body></html>`,
    )
    win.document.close()
    win.focus()
    setTimeout(() => {
      win.print()
      win.close()
    }, 500)
  }, [])

  const handleExportPNG = useCallback(async () => {
    if (!documentRef.current || exportingPNG) return
    try {
      setExportingPNG(true)
      const { default: html2canvas } = await import('html2canvas')
      const canvas = await html2canvas(documentRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
      })
      const dataUrl = canvas.toDataURL('image/png')
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = `invoice-${id ?? 'hisabche'}.png`
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch {
      alert(t('invoices.pngError'))
    } finally {
      setExportingPNG(false)
    }
  }, [exportingPNG, id, t])

  // ✅ اکشن‌های سریع از جدول فاکتورها (?action=print|png) — یک‌بار پس از لود سند اجرا می‌شود
  useEffect(() => {
    const action = searchParams.get('action')
    if (!action || autoActionRef.current || !invoice || !documentRef.current) return
    autoActionRef.current = true
    if (action === 'print') handlePrint()
    if (action === 'png') handleExportPNG()
    router.replace(`/invoices/${id}`)
  }, [searchParams, invoice, handlePrint, handleExportPNG, router, id])

  const handleSharePDF = useCallback(async () => {
    if (!invoice) return
    const inv = invoice as unknown as Record<string, unknown>
    const text = buildMessage(inv).replace(/\*/g, '')
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Invoice #${inv.invoiceNumber}`,
          text,
        })
      } catch {}
    } else {
      await navigator.clipboard.writeText(text)
      alert(t('invoices.copiedToClipboard'))
    }
  }, [invoice, buildMessage, t])

  const handleWhatsApp = useCallback(() => {
    if (!invoice) return
    const inv = invoice as unknown as Record<string, unknown>
    window.open(`https://wa.me/?text=${encodeURIComponent(buildMessage(inv))}`, '_blank')
  }, [invoice, buildMessage])

  const handleTelegram = useCallback(() => {
    if (!invoice) return
    const inv = invoice as unknown as Record<string, unknown>
    window.open(
      `https://t.me/share/url?url=&text=${encodeURIComponent(buildMessage(inv))}`,
      '_blank',
    )
  }, [invoice, buildMessage])

  const handleEmail = useCallback(() => {
    if (!invoice) return
    const inv = invoice as unknown as Record<string, unknown>
    window.open(
      `mailto:?subject=${encodeURIComponent(`${t('invoices.title')} #${getField(inv.invoiceNumber, inv.invoice_number)}`)}&body=${encodeURIComponent(`${t('invoices.title')}: #${getField(inv.invoiceNumber, inv.invoice_number)}\n${t('invoices.date')}: ${fmtIntlDate(inv.date as string)}\n${t('invoices.total')}: ${((inv.total as number) ?? 0).toLocaleString()} ${(inv.currency as string) || 'AFN'}`)}`,
      '_blank',
    )
  }, [invoice, t, fmtIntlDate])

  const statusVariant = useCallback((s: string) => STATUS_MAP[s] || 'secondary', [])

  const handleWorkflowAction = useCallback(
    async (action: 'approved' | 'rejected' | 'cancelled', comment?: string) => {
      if (!workflowInstanceBase?.id) return
      await performWorkflowAction({
        instanceId: workflowInstanceBase.id,
        action,
        ...(comment !== undefined && { comment }),
      })
      queryClient.invalidateQueries({ queryKey: ['invoice', id] })
    },
    [performWorkflowAction, workflowInstanceBase, queryClient, id],
  )

  return (
    <InvoiceDetailPage
      t={safeT}
      invoice={display}
      isLoading={isLoading}
      onBack={() => router.back()}
      onPrint={handlePrint}
      onSharePDF={handleSharePDF}
      onWhatsApp={handleWhatsApp}
      onTelegram={handleTelegram}
      onEmail={handleEmail}
      onExportPNG={handleExportPNG}
      exportingPNG={exportingPNG}
      pdfDownloadSlot={invoice ? <InvoicePDFDownload invoice={invoice} /> : null}
      // H2 — rendered only once the invoice itself has loaded. Fetching the
      // related records for an id that turns out not to exist would show an
      // empty payments panel beside a «فاکتور پیدا نشد» message.
      relatedSlot={
        display ? (
          <InvoiceRelatedPanel
            t={safeT}
            fmtMoney={(value) => value.toLocaleString('fa-AF')}
            fmtDate={(value) => fmtIntlDate(value)}
            currency={display.currency}
            isLoading={relatedLoading}
            payments={related?.payments ?? []}
            journalEntry={related?.journalEntry ?? null}
            allocatedTotal={related?.allocatedTotal ?? 0}
            storedPaidAmount={display.paidAmount}
            onOpenJournalEntry={handleOpenJournalEntry}
            invoiceTotal={display.total}
            isRecordingPayment={recordPayment.isPending}
            {...(subscriptionLocked
              ? {}
              : {
                  onPostToLedger: () =>
                    postToLedger.mutate(id, {
                      onSuccess: (result) => setLedgerResult(result),
                      onError: (err) =>
                        setLedgerResult({
                          status: 'not_postable',
                          // ⚠️ The API client rejects with a plain object
                          // ({ message, code, status }), not an Error — so
                          // `String(err)` rendered «[object Object]».
                          reason:
                            (err as { code?: string; message?: string })?.code &&
                            (err as { code?: string }).code !== 'UNKNOWN_ERROR'
                              ? String((err as { code?: string }).code)
                              : String((err as { message?: string })?.message ?? err),
                        }),
                    }),
                })}
            isPostingToLedger={postToLedger.isPending}
            ledgerPostMessage={ledgerPostMessageOf(ledgerResult, safeT)}
            recordPaymentError={paymentErrorMessage(recordPayment.error, safeT)}
            relatedFailed={!relatedLoading && !relatedKnown}
            onRetryRelated={() => void refetchRelated()}
            onRecordPayment={
              subscriptionLocked || !relatedKnown
                ? undefined
                : (input) => {
                    const isPurchase = display.type === 'purchase'
                    // ⚠️ NULL FOR A WALK-IN, NOT A BLOCK. An invoice with no customer is an
                    // ordinary cash sale; the server records its payment with no party as
                    // long as the payment names this invoice, which it always does below.
                    // The earlier version refused here and asked for a customer on a page
                    // that has no customer field.
                    const partyId = (isPurchase ? display.supplierId : display.customerId) || null
                    recordPayment.mutate({
                      // A purchase pays OUT to a supplier; a sale takes money IN.
                      // Reversed, this lands on the wrong side of the ledger.
                      direction: isPurchase ? 'out' : 'in',
                      partyType: isPurchase ? 'supplier' : 'customer',
                      partyId,
                      amount: input.amount,
                      // ⚠️ OMIT, DON'T SEND NULL. These fields are `.optional()` on
                      // the server, which accepts a missing key and REJECTS `null` —
                      // an invoice with no stored currency produced a 400 here.
                      ...(input.method ? { method: input.method } : {}),
                      ...(input.reference ? { reference: input.reference } : {}),
                      ...(input.date ? { entryDate: input.date } : {}),
                      ...(display.currency ? { currency: display.currency } : {}),
                      // Explicit, always. Auto-allocation settles the OLDEST open
                      // invoice first — so paying here would quietly clear a
                      // different invoice and leave this one untouched.
                      allocations: [{ invoiceId: display.id, amount: input.amount }],
                    })
                  }
            }
            onCancelPayment={
              subscriptionLocked
                ? undefined
                : (paymentId) => {
                    // The server requires a reason and refuses without one: a
                    // cancelled payment nobody explained is unauditable.
                    const reason = window.prompt(
                      safeT('invoiceDetail.cancelPaymentReason', 'دلیل حذف این پرداخت؟'),
                    )
                    if (!reason || !reason.trim()) return
                    cancelPayment.mutate({ paymentId, reason: reason.trim() })
                  }
            }
          />
        ) : null
      }
      /* H6 — «تاریخچه‌ی تغییرات این رکورد». `useRecordHistory` was written in
         G4 and had zero consumers; this is the first place it renders. */
      historySlot={
        display ? (
          <RecordHistoryPanel
            t={safeT}
            isLoading={historyLoading}
            entries={(recordHistory ?? []).map((entry) => ({
              id: entry.id,
              action: entry.action,
              createdAt: entry.created_at,
              userId: entry.user_id ?? null,
            }))}
          />
        ) : null
      }
      documentRef={documentRef}
      statusVariant={statusVariant}
      workflowInstance={workflowData?.instance ?? null}
      workflowActions={subscriptionLocked ? [] : (workflowData?.actions ?? [])}
      workflowSteps={workflowData?.steps ?? []}
      workflowPending={workflowData?.instance?.status === 'in_progress'}
      onWorkflowAction={handleWorkflowAction}
    />
  )
}

/**
 * The server refuses a payment with a rule code (PAYMENT_ALLOCATION_…). The
 * API client rejects with a plain object, not an Error. Codes are translated;
 * anything else is shown as the server sent it — never «[object Object]».
 */
function paymentErrorMessage(
  error: unknown,
  t: (key: string, fallback?: string) => string,
): string | null {
  if (!error) return null
  const { code, message } = error as { code?: string; message?: string }
  const text = String(message ?? '')
  const rule = /PAYMENT_[A-Z_]+/.exec(`${code ?? ''} ${text}`)?.[0]
  return rule ? t(`invoiceDetail.error_${rule}`, text) : text || String(error)
}
