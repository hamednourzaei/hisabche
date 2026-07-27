"use client";

import { forwardRef } from "react";
import { Barcode, Calendar, Mail, MapPin, Phone, User } from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   InvoiceDocument — shared "paper" visual
   Used by both the invoice detail page (saved invoice) and the
   quick-invoice preview step (not-yet-saved invoice). Fields that
   only exist once an invoice is persisted (invoiceNumber, createdAt)
   are optional — pass undefined/omit rather than fabricating them.
   ═══════════════════════════════════════════════════════════ */

export interface InvoiceDocumentItem {
  id?: string | undefined;
  productName: string;
  quantity: number;
  unit?: string | undefined;
  unitPrice: number;
  discount?: number | undefined; // percentage, 0-100
  totalPrice: number;
}

export interface InvoiceDocumentBusiness {
  name: string;
  logoUrl?: string | null | undefined;
  phone?: string | null | undefined;
  email?: string | null | undefined;
  address?: string | null | undefined;
}

export interface InvoiceDocumentCustomer {
  name?: string | null | undefined;
  phone?: string | null | undefined;
  email?: string | null | undefined;
  address?: string | null | undefined;
}

export interface InvoiceDocumentDisplaySettings {
  showSignature: boolean;
  showNotes: boolean;
  showBarcode: boolean;
}

export interface InvoiceDocumentData {
  invoiceNumber?: string | undefined; // absent for an unsaved preview
  date: string;
  dueDate?: string | null | undefined;
  business: InvoiceDocumentBusiness;
  customer?: InvoiceDocumentCustomer | null | undefined;
  items: InvoiceDocumentItem[];
  currency: string;
  subtotal: number;
  discountTotal?: number | undefined;
  taxTotal?: number | undefined;
  shippingTotal?: number | undefined;
  total: number;
  paidAmount?: number | undefined;
  notes?: string | null | undefined;
}

export interface InvoiceDocumentProps {
  t: (key: string, fallback?: string) => string;
  data: InvoiceDocumentData;
  display: InvoiceDocumentDisplaySettings;
  locale?: string;
}

const fmtDate = (d: string, locale: string) => {
  try {
    return new Date(d).toLocaleDateString(locale);
  } catch {
    return d;
  }
};

export const InvoiceDocument = forwardRef<HTMLDivElement, InvoiceDocumentProps>(
  function InvoiceDocument({ t, data, display, locale = "fa-AF" }, ref) {
    const {
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
    } = data;

    const remaining = total - paidAmount;
    const hasCustomerInfo = !!(customer?.name || customer?.phone || customer?.email || customer?.address);

    return (
      <div
        ref={ref}
        className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]"
      >
        <div className="p-6 sm:p-8">
          {/* Business header */}
          <div className="mb-6 flex flex-col gap-4 border-b border-[hsl(var(--border-default))] pb-6 sm:flex-row sm:items-start sm:justify-between">
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
                <h2 className="text-2xl font-bold text-[hsl(var(--color-primary))]">{business.name}</h2>
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
              </div>
            </div>

            <div className="text-end">
              <p className="text-lg font-bold text-[hsl(var(--fg-primary))]">{t("invoices.salesInvoice", "فاکتور فروش")}</p>
              <p className="text-2xl font-bold text-[hsl(var(--fg-primary))]">
                {invoiceNumber ? `#${invoiceNumber}` : t("invoices.notYetSaved", "—")}
              </p>
              {display.showBarcode && (
                <div className="mt-2 flex items-center justify-end gap-1.5 rounded-lg border border-dashed border-[hsl(var(--border-default))] px-3 py-2 text-[hsl(var(--fg-tertiary))]">
                  <Barcode className="size-5" />
                  <span className="text-[10px]">{invoiceNumber ?? t("invoices.barcodePlaceholder", "پس از ثبت فعال می‌شود")}</span>
                </div>
              )}
            </div>
          </div>

          {/* Invoice info + customer info */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-[hsl(var(--surface-muted))] p-4">
              <p className="mb-2 text-xs font-semibold text-[hsl(var(--fg-tertiary))]">{t("invoices.invoiceInfo", "اطلاعات فاکتور")}</p>
              <div className="space-y-1.5 text-sm text-[hsl(var(--fg-primary))]">
                <div className="flex items-center gap-2">
                  <Calendar className="size-3.5 text-[hsl(var(--fg-tertiary))]" />
                  <span>{t("invoices.date", "تاریخ")}: {fmtDate(date, locale)}</span>
                </div>
                {dueDate && (
                  <div className="flex items-center gap-2">
                    <Calendar className="size-3.5 text-[hsl(var(--fg-tertiary))]" />
                    <span>{t("invoices.dueDate", "سررسید")}: {fmtDate(dueDate, locale)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl bg-[hsl(var(--surface-muted))] p-4">
              <p className="mb-2 text-xs font-semibold text-[hsl(var(--fg-tertiary))]">{t("invoices.customerInfo", "اطلاعات مشتری")}</p>
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
                <p className="text-sm text-[hsl(var(--fg-tertiary))]">{t("invoices.walkInCustomer", "مشتری عمومی")}</p>
              )}
            </div>
          </div>

          {/* Items table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--border-default))]">
                  <th className="px-2 py-3 text-start font-medium text-[hsl(var(--fg-secondary))]">#</th>
                  <th className="px-2 py-3 text-start font-medium text-[hsl(var(--fg-secondary))]">{t("warehouse.productName", "نام محصول")}</th>
                  <th className="px-2 py-3 text-center font-medium text-[hsl(var(--fg-secondary))]">{t("invoices.quantity", "تعداد")}</th>
                  <th className="px-2 py-3 text-center font-medium text-[hsl(var(--fg-secondary))]">{t("invoices.unit", "واحد")}</th>
                  <th className="px-2 py-3 text-end font-medium text-[hsl(var(--fg-secondary))]">{t("invoices.unitPrice", "قیمت واحد")}</th>
                  <th className="px-2 py-3 text-end font-medium text-[hsl(var(--fg-secondary))]">{t("invoices.discount", "تخفیف")}</th>
                  <th className="px-2 py-3 text-end font-medium text-[hsl(var(--fg-secondary))]">{t("invoices.totalPrice", "قیمت کل")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={item.id || i} className="border-b border-[hsl(var(--border-default))]">
                    <td className="px-2 py-3 text-[hsl(var(--fg-tertiary))]">{i + 1}</td>
                    <td className="px-2 py-3 font-medium text-[hsl(var(--fg-primary))]">{item.productName}</td>
                    <td className="px-2 py-3 text-center text-[hsl(var(--fg-primary))]">{item.quantity}</td>
                    <td className="px-2 py-3 text-center text-[hsl(var(--fg-tertiary))]">{item.unit ?? "—"}</td>
                    <td className="px-2 py-3 text-end tabular-nums text-[hsl(var(--fg-primary))]">{item.unitPrice.toLocaleString()} {currency}</td>
                    <td className="px-2 py-3 text-end tabular-nums text-[hsl(var(--fg-tertiary))]">{item.discount ? `${item.discount}%` : "—"}</td>
                    <td className="px-2 py-3 text-end font-medium tabular-nums text-[hsl(var(--fg-primary))]">{item.totalPrice.toLocaleString()} {currency}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={6} className="px-2 py-3 text-end font-medium text-[hsl(var(--fg-primary))]">{t("invoices.subtotal", "جمع")}</td>
                  <td className="px-2 py-3 text-end font-medium tabular-nums text-[hsl(var(--fg-primary))]">{subtotal.toLocaleString()} {currency}</td>
                </tr>
                {discountTotal > 0 && (
                  <tr>
                    <td colSpan={6} className="px-2 py-2 text-end text-[hsl(var(--fg-secondary))]">{t("invoices.discount", "تخفیف")}</td>
                    <td className="px-2 py-2 text-end text-[hsl(var(--color-destructive))] tabular-nums">-{discountTotal.toLocaleString()} {currency}</td>
                  </tr>
                )}
                {taxTotal > 0 && (
                  <tr>
                    <td colSpan={6} className="px-2 py-2 text-end text-[hsl(var(--fg-secondary))]">{t("invoices.tax", "مالیات")}</td>
                    <td className="px-2 py-2 text-end tabular-nums text-[hsl(var(--fg-primary))]">{taxTotal.toLocaleString()} {currency}</td>
                  </tr>
                )}
                {shippingTotal > 0 && (
                  <tr>
                    <td colSpan={6} className="px-2 py-2 text-end text-[hsl(var(--fg-secondary))]">{t("invoices.shipping", "هزینه ارسال")}</td>
                    <td className="px-2 py-2 text-end tabular-nums text-[hsl(var(--fg-primary))]">{shippingTotal.toLocaleString()} {currency}</td>
                  </tr>
                )}
                <tr className="border-t-2 border-[hsl(var(--border-default))]">
                  <td colSpan={6} className="px-2 py-3 text-end text-lg font-bold text-[hsl(var(--fg-primary))]">{t("invoices.total", "مجموع")}</td>
                  <td className="px-2 py-3 text-end text-lg font-bold text-[hsl(var(--color-primary))] tabular-nums">{total.toLocaleString()} {currency}</td>
                </tr>
                {paidAmount > 0 && (
                  <tr>
                    <td colSpan={6} className="px-2 py-2 text-end text-[hsl(var(--fg-secondary))]">{t("invoices.paid", "پرداخت شده")}</td>
                    <td className="px-2 py-2 text-end text-[hsl(var(--color-success))] tabular-nums">-{paidAmount.toLocaleString()} {currency}</td>
                  </tr>
                )}
                {remaining > 0 && (
                  <tr>
                    <td colSpan={6} className="px-2 py-2 text-end font-medium text-[hsl(var(--color-destructive))]">{t("invoices.remaining", "باقیمانده")}</td>
                    <td className="px-2 py-2 text-end font-medium text-[hsl(var(--color-destructive))] tabular-nums">{remaining.toLocaleString()} {currency}</td>
                  </tr>
                )}
              </tfoot>
            </table>
          </div>

          {/* Notes */}
          {display.showNotes && notes && (
            <div className="mt-6 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))] p-4">
              <p className="mb-1 text-xs font-semibold text-[hsl(var(--fg-tertiary))]">{t("invoices.notes", "یادداشت‌ها")}</p>
              <p className="text-sm text-[hsl(var(--fg-primary))] whitespace-pre-wrap">{notes}</p>
            </div>
          )}

          {/* Signature area */}
          {display.showSignature && (
            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="text-center">
                <div className="h-16 border-b border-dashed border-[hsl(var(--border-strong))]" />
                <p className="mt-2 text-xs text-[hsl(var(--fg-tertiary))]">{t("invoices.customerSignature", "امضای مشتری")}</p>
              </div>
              <div className="text-center">
                <div className="h-16 border-b border-dashed border-[hsl(var(--border-strong))]" />
                <p className="mt-2 text-xs text-[hsl(var(--fg-tertiary))]">{t("invoices.sellerSignature", "مهر و امضای فروشنده")}</p>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-8 border-t border-[hsl(var(--border-default))] pt-4 text-center text-sm text-[hsl(var(--fg-secondary))]">
            <p>{t("invoices.thankYou", "از خرید شما سپاسگزاریم")}</p>
            <p className="mt-1 text-xs">{t("invoices.generatedBy", "ایجاد شده توسط")} Hisabche — hisabche.com</p>
          </div>
        </div>
      </div>
    );
  }
);

InvoiceDocument.displayName = "InvoiceDocument";
