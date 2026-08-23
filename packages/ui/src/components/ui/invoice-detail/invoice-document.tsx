'use client'

import { Fragment, forwardRef, useEffect, useState } from 'react'
import { Barcode, Calendar, Mail, MapPin, Phone, User } from 'lucide-react'
import { buildInvoiceShareUrl as contractShareUrl } from '@hisabche/ui-contract'

/** Used when there is no `window` — SSR and static rendering. */
const DEFAULT_WEB_ORIGIN = 'https://hisabche.com'

// ✅ QR واقعی: لینک عمومی فاکتور رو به‌صورت عکس QR تولید می‌کنه که
// کپی/دانلود/اشتراک‌گذاری (چون داخل خروجی PDF/PNG/چاپ همین سند قرار
// می‌گیره) واقعاً کار می‌کنه — قبلاً فقط آیکون جای‌نگه‌دار بود.
export function InvoiceQRCode({ value, size = 64 }: { value: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    import('qrcode').then((QRCode) => {
      QRCode.toDataURL(value, { margin: 1, width: size * 2 })
        .then((url) => {
          if (!cancelled) setDataUrl(url)
        })
        .catch(() => {})
    })
    return () => {
      cancelled = true
    }
  }, [value, size])

  if (!dataUrl) return null
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={dataUrl} alt="QR" className="rounded" style={{ width: size, height: size }} />
}

// ✅ کلیک روی QR = کپی لینک (بدون نیاز به رفتن به پنل اشتراک‌گذاری)
function CopyableQR({
  value,
  t,
}: {
  value: string
  t: (key: string, fallback?: string) => string
}) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard ممکن است در دسترس نباشد
    }
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      title={t('invoices.copyLink', 'کپی لینک')}
      className="mt-2 w-fit cursor-pointer rounded-lg transition-opacity hover:opacity-80"
    >
      <InvoiceQRCode value={value} size={64} />
      {copied && (
        <p className="mt-0.5 text-[10px] text-[hsl(var(--color-success))]">
          {t('invoices.copied', 'کپی شد')}
        </p>
      )}
    </button>
  )
}

/* ═══════════════════════════════════════════════════════════
   InvoiceDocument — shared "paper" visual
   Used by both the invoice detail page (saved invoice) and the
   quick-invoice preview step (not-yet-saved invoice). Fields that
   only exist once an invoice is persisted (invoiceNumber, createdAt)
   are optional — pass undefined/omit rather than fabricating them.
   ═══════════════════════════════════════════════════════════ */

/** A component of a line — "گردنبند" made of زنجیر / سنگ / اجرت. */
export interface InvoiceDocumentItemDetail {
  id?: string | undefined
  title: string
  quantity: number
  amount: number
  unit?: string | undefined
  unitLabel?: string | null | undefined
}

export interface InvoiceDocumentItem {
  id?: string | undefined
  productName: string
  quantity: number
  unit?: string | undefined
  /** Free-text unit, only when `unit === "custom"`. */
  unitLabel?: string | null | undefined
  /** Weight, tracked separately from quantity. */
  weightGrams?: number | null | undefined
  unitPrice: number
  discount?: number | undefined // percentage, 0-100
  totalPrice: number
  /** Optional. Rendered as sub-rows; an empty list renders nothing at all. */
  details?: readonly InvoiceDocumentItemDetail[] | undefined
}

const UNIT_LABELS: Record<string, string> = {
  piece: 'عدد',
  gram: 'گرم',
  kg: 'کیلوگرم',
  carton: 'کارتن',
  box: 'جعبه',
  pack: 'بسته',
  meter: 'متر',
  liter: 'لیتر',
}

/**
 * What the parent line contributes on its own, before its components.
 *
 * The item's `totalPrice` is the COMBINED figure (base + components) because
 * that is what the invoice actually charges. But the components are printed as
 * their own rows with their own amounts, so printing the combined figure on the
 * parent row would show the component money twice and make the جمع look wrong:
 *
 *   قند       1  گرم  20,000   30,000   ← looked like the total, then…
 *   ├─ سنگ    1        10,000   10,000   ← …10,000 again, so جمع 30,000 read as an error
 *
 * Printing the base instead makes the column add up: 20,000 + 10,000 = 30,000.
 * For an item with no components base === totalPrice, so nothing changes.
 */
function baseTotalOf(item: InvoiceDocumentItem): number {
  const components = (item.details ?? []).reduce((sum, d) => sum + d.quantity * d.amount, 0)
  return item.totalPrice - components
}

/** Resolves the display unit, honouring a user-defined label. */
export function unitText(
  unit: string | null | undefined,
  unitLabel?: string | null | undefined,
): string {
  if (!unit) return '—'
  if (unit === 'custom') return unitLabel?.trim() || '—'
  return UNIT_LABELS[unit] ?? unit
}

export interface InvoiceDocumentBusiness {
  name: string
  logoUrl?: string | null | undefined
  phone?: string | null | undefined
  email?: string | null | undefined
  address?: string | null | undefined
  /** مهر/امضای مالک — اگر ست شده باشد، به‌جای خط‌چین زیر هر فاکتور نمایش داده می‌شود */
  stampUrl?: string | null | undefined
}

export interface InvoiceDocumentCustomer {
  name?: string | null | undefined
  phone?: string | null | undefined
  email?: string | null | undefined
  address?: string | null | undefined
}

export interface InvoiceDocumentDisplaySettings {
  showSignature: boolean
  showNotes: boolean
  showBarcode: boolean
}

export interface InvoiceDocumentData {
  /**
   * sale | purchase. Drives the document heading and the party label.
   * Absent means sale — that is what every pre-existing invoice was.
   */
  type?: 'sale' | 'purchase' | undefined
  invoiceId?: string | undefined // real DB id — used as a fallback link if no public token yet
  publicToken?: string | undefined // unguessable share token — used for the QR/public link when available
  invoiceNumber?: string | undefined // absent for an unsaved preview
  date: string
  dueDate?: string | null | undefined
  business: InvoiceDocumentBusiness
  customer?: InvoiceDocumentCustomer | null | undefined
  items: InvoiceDocumentItem[]
  currency: string
  subtotal: number
  discountTotal?: number | undefined
  taxTotal?: number | undefined
  shippingTotal?: number | undefined
  total: number
  paidAmount?: number | undefined
  notes?: string | null | undefined
}

export interface InvoiceDocumentProps {
  t: (key: string, fallback?: string) => string
  data: InvoiceDocumentData
  display: InvoiceDocumentDisplaySettings
  locale?: string
  /**
   * Replaces the built-in items table.
   *
   * The invoice builder renders the columns the user configured, which the
   * fixed seven-column table here cannot express. Everything else about the
   * document — the header, the party blocks, the notes, the stamp, the QR —
   * is identical, so the preview genuinely IS this document rather than a
   * lookalike. Omitting it leaves every existing caller untouched.
   */
  itemsSlot?: React.ReactNode
}

// نگاشت locale بلند (fa-AF/fa-IR/en) به پیشوند واقعی مسیر (af/fa/en)

// ✅ اگر public_token در دسترس باشد، لینک به مسیر عمومی (بدون نیاز به ورود)
// اشاره می‌کند؛ در غیر این صورت (تا وقتی migration اجرا شود) به مسیر
// احراز-هویت‌دار قبلی برمی‌گردد — یعنی اسکن QR فعلاً ممکن است هنوز
// درخواست ورود کند تا وقتی ستون public_token در دیتابیس اضافه شود.
export function buildInvoiceShareUrl(
  locale: string,
  invoiceId?: string,
  publicToken?: string,
): string | null {
  // The URL shape lives in `@hisabche/ui-contract` so React Native builds the
  // identical link; only the origin is a browser detail. Signature unchanged,
  // so every existing call site keeps working.
  const origin = typeof window !== 'undefined' ? window.location.origin : DEFAULT_WEB_ORIGIN
  return contractShareUrl(origin, locale, invoiceId, publicToken)
}

const fmtDate = (d: string, locale: string) => {
  try {
    return new Date(d).toLocaleDateString(locale)
  } catch {
    return d
  }
}

export const InvoiceDocument = forwardRef<HTMLDivElement, InvoiceDocumentProps>(
  function InvoiceDocument({ t, data, display, locale = 'fa-AF', itemsSlot }, ref) {
    const {
      type = 'sale',
      invoiceId,
      publicToken,
      invoiceNumber,
      date,
      dueDate,
      business,
      customer,
      items,
      currency,
      subtotal,
      discountTotal = 0,
      taxTotal = 0,
      shippingTotal = 0,
      total,
      paidAmount = 0,
      notes,
    } = data

    const remaining = total - paidAmount
    const hasCustomerInfo = !!(
      customer?.name ||
      customer?.phone ||
      customer?.email ||
      customer?.address
    )
    const isPurchase = type === 'purchase'

    return (
      <div
        ref={ref}
        className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]"
      >
        <div className="max-w-full overflow-x-hidden p-3 text-xs sm:p-6 sm:text-sm md:p-8">
          {/* Business header */}
          <div className="mb-4 flex flex-col gap-3 border-b border-[hsl(var(--border-default))] pb-4 sm:mb-6 sm:flex-row sm:items-start sm:justify-between sm:pb-6">
            <div className="flex items-center gap-3">
              {business.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={business.logoUrl}
                  alt={business.name}
                  className="size-12 shrink-0 rounded-xl object-cover border border-[hsl(var(--border-default))]"
                />
              ) : null}
              <div>
                <h2 className="text-2xl font-bold text-[hsl(var(--color-primary))]">
                  {business.name}
                </h2>
                <div className="mt-1 space-y-0.5 text-xs text-[hsl(var(--fg-secondary))]">
                  {business.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="size-3" />
                      {business.phone}
                    </div>
                  )}
                  {business.email && (
                    <div className="flex items-center gap-1.5">
                      <Mail className="size-3" />
                      {business.email}
                    </div>
                  )}
                  {business.address && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="size-3" />
                      {business.address}
                    </div>
                  )}
                </div>
                {/* QR — فقط همین یک‌جا، زیر نام کسب‌وکار؛ کلیک = کپی لینک */}
                {display.showBarcode &&
                  (invoiceId || publicToken ? (
                    <CopyableQR
                      value={buildInvoiceShareUrl(locale, invoiceId, publicToken)!}
                      t={t}
                    />
                  ) : (
                    <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-dashed border-[hsl(var(--border-default))] px-3 py-2 text-[hsl(var(--fg-tertiary))] w-fit">
                      <Barcode className="size-5" />
                      <span className="text-[10px]">
                        {t('invoices.barcodePlaceholder', 'پس از ثبت فعال می‌شود')}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            <div className="text-end">
              <p className="text-lg font-bold text-[hsl(var(--fg-primary))]">
                {isPurchase
                  ? t('invoices.purchaseInvoice', 'فاکتور خرید')
                  : t('invoices.saleInvoice', 'فاکتور فروش')}
              </p>
              <p className="text-2xl font-bold text-[hsl(var(--fg-primary))]">
                {invoiceNumber ? `#${invoiceNumber}` : t('invoices.notYetSaved', '—')}
              </p>
            </div>
          </div>

          {/* Invoice info + customer info */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-[hsl(var(--surface-muted))] p-4">
              <p className="mb-2 text-xs font-semibold text-[hsl(var(--fg-tertiary))]">
                {t('invoices.invoiceInfo', 'اطلاعات فاکتور')}
              </p>
              <div className="space-y-1.5 text-sm text-[hsl(var(--fg-primary))]">
                <div className="flex items-center gap-2">
                  <Calendar className="size-3.5 text-[hsl(var(--fg-tertiary))]" />
                  <span>
                    {t('invoices.date', 'تاریخ')}: {fmtDate(date, locale)}
                  </span>
                </div>
                {dueDate && (
                  <div className="flex items-center gap-2">
                    <Calendar className="size-3.5 text-[hsl(var(--fg-tertiary))]" />
                    <span>
                      {t('invoices.dueDate', 'سررسید')}: {fmtDate(dueDate, locale)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl bg-[hsl(var(--surface-muted))] p-4">
              <p className="mb-2 text-xs font-semibold text-[hsl(var(--fg-tertiary))]">
                {isPurchase
                  ? t('invoices.supplierInfo', 'اطلاعات فروشنده')
                  : t('invoices.customerInfo', 'اطلاعات مشتری')}
              </p>
              {hasCustomerInfo ? (
                <div className="space-y-1.5 text-sm text-[hsl(var(--fg-primary))]">
                  {customer?.name && (
                    <div className="flex items-center gap-2">
                      <User className="size-3.5 text-[hsl(var(--fg-tertiary))]" />
                      <span>{customer.name}</span>
                    </div>
                  )}
                  {customer?.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="size-3.5 text-[hsl(var(--fg-tertiary))]" />
                      <span>{customer.phone}</span>
                    </div>
                  )}
                  {customer?.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="size-3.5 text-[hsl(var(--fg-tertiary))]" />
                      <span>{customer.email}</span>
                    </div>
                  )}
                  {customer?.address && (
                    <div className="flex items-center gap-2">
                      <MapPin className="size-3.5 text-[hsl(var(--fg-tertiary))]" />
                      <span>{customer.address}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-[hsl(var(--fg-tertiary))]">
                  {t('invoices.walkInCustomer', 'مشتری عمومی')}
                </p>
              )}
            </div>
          </div>

          {/* Items table
              overflow-x-auto lets wide tables scroll horizontally on narrow
              screens without clipping. touch-pan-y keeps vertical swipes
              (page/section scroll) working even when the gesture starts over
              this table — otherwise a touch that begins here can get
              captured by the horizontal scroller and the rest of the
              invoice becomes hard to reach on mobile. */}
          {itemsSlot ?? (
            <div className="overflow-x-auto touch-pan-y rounded-lg border border-[hsl(var(--border-default))]">
              <table className="w-full min-w-[520px] border-collapse text-[11px] sm:min-w-0 sm:text-sm">
                <thead>
                  <tr className="border-b border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))]">
                    <th className="border-e border-[hsl(var(--border-default))] px-1.5 py-2 text-start font-medium text-[hsl(var(--fg-secondary))] sm:px-2 sm:py-3">
                      #
                    </th>
                    <th className="border-e border-[hsl(var(--border-default))] px-1.5 py-2 text-start font-medium text-[hsl(var(--fg-secondary))] sm:px-2 sm:py-3">
                      {t('warehouse.productName', 'نام محصول')}
                    </th>
                    <th className="border-e border-[hsl(var(--border-default))] px-1.5 py-2 text-center font-medium text-[hsl(var(--fg-secondary))] sm:px-2 sm:py-3">
                      {t('invoices.quantity', 'تعداد')}
                    </th>
                    <th className="border-e border-[hsl(var(--border-default))] px-1.5 py-2 text-center font-medium text-[hsl(var(--fg-secondary))] sm:px-2 sm:py-3">
                      {t('invoices.unit', 'واحد')}
                    </th>
                    <th className="border-e border-[hsl(var(--border-default))] px-1.5 py-2 text-end font-medium text-[hsl(var(--fg-secondary))] sm:px-2 sm:py-3">
                      {t('invoices.unitPrice', 'قیمت واحد')}
                    </th>
                    <th className="border-e border-[hsl(var(--border-default))] px-1.5 py-2 text-end font-medium text-[hsl(var(--fg-secondary))] sm:px-2 sm:py-3">
                      {t('invoices.discount', 'تخفیف')}
                    </th>
                    <th className="px-1.5 py-2 text-end font-medium text-[hsl(var(--fg-secondary))] sm:px-2 sm:py-3">
                      {t('invoices.totalPrice', 'قیمت کل')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <Fragment key={item.id || i}>
                      <tr className="border-b border-[hsl(var(--border-default))]">
                        <td className="border-e border-[hsl(var(--border-default))] px-1.5 py-2 text-[hsl(var(--fg-tertiary))] sm:px-2 sm:py-3">
                          {i + 1}
                        </td>
                        <td className="border-e border-[hsl(var(--border-default))] px-1.5 py-2 font-medium text-[hsl(var(--fg-primary))] sm:px-2 sm:py-3">
                          {item.productName}
                          {/* وزن جدا از تعداد است: «۱ عدد، ۱۲٫۵ گرم» */}
                          {item.weightGrams ? (
                            <span className="ms-1 text-[10px] font-normal text-[hsl(var(--fg-tertiary))]">
                              ({item.weightGrams.toLocaleString()} {t('unit.gram', 'گرم')})
                            </span>
                          ) : null}
                        </td>
                        <td className="border-e border-[hsl(var(--border-default))] px-1.5 py-2 text-center text-[hsl(var(--fg-primary))] sm:px-2 sm:py-3">
                          {item.quantity}
                        </td>
                        <td className="border-e border-[hsl(var(--border-default))] px-1.5 py-2 text-center text-[hsl(var(--fg-tertiary))] sm:px-2 sm:py-3">
                          {unitText(item.unit, item.unitLabel)}
                        </td>
                        <td className="border-e border-[hsl(var(--border-default))] px-1.5 py-2 text-end tabular-nums text-[hsl(var(--fg-primary))] sm:px-2 sm:py-3">
                          {item.unitPrice.toLocaleString()} {currency}
                        </td>
                        <td className="border-e border-[hsl(var(--border-default))] px-1.5 py-2 text-end tabular-nums text-[hsl(var(--fg-tertiary))] sm:px-2 sm:py-3">
                          {item.discount ? `${item.discount}%` : '—'}
                        </td>
                        <td className="px-1.5 py-2 text-end font-medium tabular-nums text-[hsl(var(--fg-primary))] sm:px-2 sm:py-3">
                          {/* سهم خودِ این قلم — بدون اجزا. اجزا ردیف خودشان را
                            دارند و جداگانه شمرده می‌شوند، وگرنه خواننده مبلغ
                            جزء را دوبار می‌بیند و جمع غلط به نظر می‌رسد. */}
                          {baseTotalOf(item).toLocaleString()} {currency}
                        </td>
                      </tr>

                      {/* اجزای این قلم. اگر جزئیاتی نباشد، هیچ چیز رندر نمی‌شود. */}
                      {(item.details ?? []).map((detail, d) => (
                        <tr
                          key={detail.id || `${i}-${d}`}
                          className="border-b border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))]"
                        >
                          <td className="border-e border-[hsl(var(--border-default))] px-1.5 py-1 sm:px-2" />
                          <td className="border-e border-[hsl(var(--border-default))] px-1.5 py-1 ps-5 text-[11px] text-[hsl(var(--fg-secondary))] sm:px-2 sm:ps-6">
                            ├─ {detail.title}
                          </td>
                          <td className="border-e border-[hsl(var(--border-default))] px-1.5 py-1 text-center text-[11px] text-[hsl(var(--fg-secondary))] sm:px-2">
                            {detail.quantity}
                          </td>
                          <td className="border-e border-[hsl(var(--border-default))] px-1.5 py-1 text-center text-[11px] text-[hsl(var(--fg-tertiary))] sm:px-2">
                            {unitText(detail.unit, detail.unitLabel)}
                          </td>
                          <td className="border-e border-[hsl(var(--border-default))] px-1.5 py-1 text-end text-[11px] tabular-nums text-[hsl(var(--fg-secondary))] sm:px-2">
                            {detail.amount.toLocaleString()} {currency}
                          </td>
                          <td className="border-e border-[hsl(var(--border-default))] px-1.5 py-1 sm:px-2" />
                          <td className="px-1.5 py-1 text-end text-[11px] tabular-nums text-[hsl(var(--fg-tertiary))] sm:px-2">
                            {(detail.quantity * detail.amount).toLocaleString()} {currency}
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td
                      colSpan={6}
                      className="px-1.5 py-2 text-end font-medium text-[hsl(var(--fg-primary))] sm:px-2 sm:py-3"
                    >
                      {t('invoices.subtotal', 'جمع')}
                    </td>
                    <td className="px-1.5 py-2 text-end font-medium tabular-nums text-[hsl(var(--fg-primary))] sm:px-2 sm:py-3">
                      {subtotal.toLocaleString()} {currency}
                    </td>
                  </tr>
                  {discountTotal > 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-2 py-2 text-end text-[hsl(var(--fg-secondary))]"
                      >
                        {t('invoices.discount', 'تخفیف')}
                      </td>
                      <td className="px-2 py-2 text-end text-[hsl(var(--color-destructive))] tabular-nums">
                        -{discountTotal.toLocaleString()} {currency}
                      </td>
                    </tr>
                  )}
                  {taxTotal > 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-2 py-2 text-end text-[hsl(var(--fg-secondary))]"
                      >
                        {t('invoices.tax', 'مالیات')}
                      </td>
                      <td className="px-2 py-2 text-end tabular-nums text-[hsl(var(--fg-primary))]">
                        {taxTotal.toLocaleString()} {currency}
                      </td>
                    </tr>
                  )}
                  {shippingTotal > 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-2 py-2 text-end text-[hsl(var(--fg-secondary))]"
                      >
                        {t('invoices.shipping', 'هزینه ارسال')}
                      </td>
                      <td className="px-2 py-2 text-end tabular-nums text-[hsl(var(--fg-primary))]">
                        {shippingTotal.toLocaleString()} {currency}
                      </td>
                    </tr>
                  )}
                  <tr className="border-t-2 border-[hsl(var(--border-default))]">
                    <td
                      colSpan={6}
                      className="px-2 py-3 text-end text-lg font-bold text-[hsl(var(--fg-primary))]"
                    >
                      {t('invoices.total', 'مجموع')}
                    </td>
                    <td className="px-2 py-3 text-end text-lg font-bold text-[hsl(var(--color-primary))] tabular-nums">
                      {total.toLocaleString()} {currency}
                    </td>
                  </tr>
                  {paidAmount > 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-2 py-2 text-end text-[hsl(var(--fg-secondary))]"
                      >
                        {t('invoices.paid', 'پرداخت شده')}
                      </td>
                      <td className="px-2 py-2 text-end text-[hsl(var(--color-success))] tabular-nums">
                        -{paidAmount.toLocaleString()} {currency}
                      </td>
                    </tr>
                  )}
                  {remaining > 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-2 py-2 text-end font-medium text-[hsl(var(--color-destructive))]"
                      >
                        {t('invoices.remaining', 'باقیمانده')}
                      </td>
                      <td className="px-2 py-2 text-end font-medium text-[hsl(var(--color-destructive))] tabular-nums">
                        {remaining.toLocaleString()} {currency}
                      </td>
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>
          )}

          {/* Notes */}
          {display.showNotes && notes && (
            <div className="mt-6 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))] p-4">
              <p className="mb-1 text-xs font-semibold text-[hsl(var(--fg-tertiary))]">
                {t('invoices.notes', 'یادداشت‌ها')}
              </p>
              <p className="text-sm text-[hsl(var(--fg-primary))] whitespace-pre-wrap">{notes}</p>
            </div>
          )}

          {/* Signature area — فقط مهر و امضای فروشنده (امضای مشتری حذف شد) */}
          {display.showSignature && (
            <div className="mt-8 flex justify-center">
              <div className="text-center">
                {business.stampUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={business.stampUrl} alt="" className="mx-auto h-16 object-contain" />
                ) : (
                  <div className="h-16 w-40 border-b border-dashed border-[hsl(var(--border-strong))]" />
                )}
                <p className="mt-2 text-xs text-[hsl(var(--fg-tertiary))]">
                  {t('invoices.sellerSignature', 'مهر و امضای فروشنده')}
                </p>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-8 border-t border-[hsl(var(--border-default))] pt-4 text-center text-sm text-[hsl(var(--fg-secondary))]">
            <p>{t('invoices.thankYou', 'از خرید شما سپاسگزاریم')}</p>
            <p className="mt-1 text-xs">
              {t('invoices.generatedBy', 'ایجاد شده توسط')} Hisabche — hisabche.com
            </p>
          </div>
        </div>
      </div>
    )
  },
)

InvoiceDocument.displayName = 'InvoiceDocument'
