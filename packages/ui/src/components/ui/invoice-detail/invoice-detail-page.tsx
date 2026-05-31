"use client"

import { Button, Badge, Card, CardContent } from "@hisabche/ui"
import {
  ArrowRight,
  Printer,
  Share2,
  MessageCircle,
  Send,
  Mail,
  Loader2,
  FileText,
  Calendar,
  User,
} from "lucide-react"
import InvoicePDFDownload from "./InvoicePDFDownload"

interface InvoiceItem {
  id?: string
  productName?: string
  product_name?: string
  quantity?: number
  unitPrice?: number
  unit_price?: number
  totalPrice?: number
  total_price?: number
}

export interface InvoiceDetailDisplay {
  id: string
  invoiceNumber: string
  date: string
  status: string
  currency: string
  subtotal: number
  total: number
  customerName: string
  discountTotal: number
  taxTotal: number
  paidAmount: number
  createdAt: string
  items: InvoiceItem[]
}

export interface InvoiceDetailPageProps {
  t: (key: string, fallback?: string) => string
  invoice: InvoiceDetailDisplay | null
  isLoading: boolean
  onBack: () => void
  onPrint: () => void
  onSharePDF: () => void
  onWhatsApp: () => void
  onTelegram: () => void
  onEmail: () => void
  statusVariant: (
    status: string
  ) => "success" | "warning" | "destructive" | "secondary"
}

export function InvoiceDetailPage({
  t,
  invoice,
  isLoading,
  onBack,
  onPrint,
  onSharePDF,
  onWhatsApp,
  onTelegram,
  onEmail,
  statusVariant,
}: InvoiceDetailPageProps) {
  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-[var(--hisab-primary)]" />
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <FileText className="size-16 text-[var(--hisab-muted-fg)]" />
        <p className="text-lg text-[var(--hisab-muted-fg)]">
          {t("faktoor.notFound")}
        </p>
        <Button onClick={onBack}>{t("action.back")}</Button>
      </div>
    )
  }

  const {
    invoiceNumber,
    date,
    status,
    currency,
    subtotal,
    total,
    customerName,
    discountTotal,
    taxTotal,
    paidAmount,
    createdAt,
    items,
  } = invoice

  return (
    <div className="space-y-6">
      {/* ── Header + Actions ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between no-print">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onBack}
            aria-label={t("common.back")}
          >
            <ArrowRight className="size-5" aria-hidden />
          </Button>
          <h1 className="text-2xl font-bold">
            {t("faktoor.detail")} #{invoiceNumber}
          </h1>
          <Badge variant={statusVariant(status)} size="sm">
            {t(`faktoor.${status}`)}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onWhatsApp}>
            <MessageCircle className="size-4" aria-hidden />
            <span className="hidden sm:inline ms-1.5">WhatsApp</span>
          </Button>
          <Button variant="outline" size="sm" onClick={onTelegram}>
            <Send className="size-4" aria-hidden />
            <span className="hidden sm:inline ms-1.5">Telegram</span>
          </Button>
          <Button variant="outline" size="sm" onClick={onEmail}>
            <Mail className="size-4" aria-hidden />
            <span className="hidden sm:inline ms-1.5">
              {t("action.email")}
            </span>
          </Button>
          <Button variant="outline" size="sm" onClick={onSharePDF}>
            <Share2 className="size-4" aria-hidden />
            <span className="hidden sm:inline ms-1.5">
              {t("action.share")}
            </span>
          </Button>
          <Button variant="outline" size="sm" onClick={onPrint}>
            <Printer className="size-4" aria-hidden />
            <span className="hidden sm:inline ms-1.5">
              {t("action.print")}
            </span>
          </Button>
          <InvoicePDFDownload invoice={invoice} />
        </div>
      </div>

      {/* ── Invoice Paper ── */}
      <Card className="glass-card">
        <CardContent className="p-6 sm:p-8">
          {/* Brand + Invoice Info */}
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-3xl font-bold text-[var(--hisab-primary)]">
                Hisabche
              </h2>
              <p className="mt-1 text-sm text-[var(--hisab-muted-fg)]">
                hisabche.com
              </p>
            </div>
            <div className="text-end">
              <p className="text-2xl font-bold">#{invoiceNumber}</p>
              <div className="mt-2 space-y-1 text-sm text-[var(--hisab-muted-fg)]">
                <div className="flex items-center justify-end gap-2">
                  <Calendar className="size-3.5" aria-hidden />
                  {new Date(date).toLocaleDateString("fa-AF")}
                </div>
                {customerName && (
                  <div className="flex items-center justify-end gap-2">
                    <User className="size-3.5" aria-hidden />
                    {customerName}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--hisab-border)]">
                  <th className="px-2 py-3 text-start font-medium text-[var(--hisab-muted-fg)]">
                    #
                  </th>
                  <th className="px-2 py-3 text-start font-medium text-[var(--hisab-muted-fg)]">
                    {t("godam.productName")}
                  </th>
                  <th className="px-2 py-3 text-center font-medium text-[var(--hisab-muted-fg)]">
                    {t("faktoor.quantity")}
                  </th>
                  <th className="px-2 py-3 text-end font-medium text-[var(--hisab-muted-fg)]">
                    {t("faktoor.unitPrice")}
                  </th>
                  <th className="px-2 py-3 text-end font-medium text-[var(--hisab-muted-fg)]">
                    {t("faktoor.totalPrice")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr
                    key={item.id || i}
                    className="border-b border-[var(--hisab-border)]"
                  >
                    <td className="px-2 py-3 text-[var(--hisab-muted-fg)]">
                      {i + 1}
                    </td>
                    <td className="px-2 py-3 font-medium">
                      {item.productName ?? item.product_name}
                    </td>
                    <td className="px-2 py-3 text-center">
                      {item.quantity}
                    </td>
                    <td className="px-2 py-3 text-end tabular-nums">
                      {(item.unitPrice ?? item.unit_price)?.toLocaleString()}{" "}
                      {currency}
                    </td>
                    <td className="px-2 py-3 text-end font-medium tabular-nums">
                      {(item.totalPrice ?? item.total_price)?.toLocaleString()}{" "}
                      {currency}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td
                    colSpan={4}
                    className="px-2 py-3 text-end font-medium"
                  >
                    {t("faktoor.subtotal")}
                  </td>
                  <td className="px-2 py-3 text-end font-medium tabular-nums">
                    {subtotal.toLocaleString()} {currency}
                  </td>
                </tr>
                {discountTotal > 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-2 py-2 text-end text-[var(--hisab-muted-fg)]"
                    >
                      {t("faktoor.discount")}
                    </td>
                    <td className="px-2 py-2 text-end text-[var(--hisab-destructive)] tabular-nums">
                      -{discountTotal.toLocaleString()} {currency}
                    </td>
                  </tr>
                )}
                {taxTotal > 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-2 py-2 text-end text-[var(--hisab-muted-fg)]"
                    >
                      {t("faktoor.tax")}
                    </td>
                    <td className="px-2 py-2 text-end tabular-nums">
                      {taxTotal.toLocaleString()} {currency}
                    </td>
                  </tr>
                )}
                <tr className="border-t-2 border-[var(--hisab-border)]">
                  <td
                    colSpan={4}
                    className="px-2 py-3 text-end text-lg font-bold"
                  >
                    {t("faktoor.total")}
                  </td>
                  <td className="px-2 py-3 text-end text-lg font-bold text-[var(--hisab-primary)] tabular-nums">
                    {total.toLocaleString()} {currency}
                  </td>
                </tr>
                {paidAmount > 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-2 py-2 text-end text-[var(--hisab-muted-fg)]"
                    >
                      {t("faktoor.paid")}
                    </td>
                    <td className="px-2 py-2 text-end text-[var(--hisab-success)] tabular-nums">
                      -{paidAmount.toLocaleString()} {currency}
                    </td>
                  </tr>
                )}
                {total - paidAmount > 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-2 py-2 text-end font-medium text-[var(--hisab-destructive)]"
                    >
                      {t("faktoor.remaining")}
                    </td>
                    <td className="px-2 py-2 text-end font-medium text-[var(--hisab-destructive)] tabular-nums">
                      {(total - paidAmount).toLocaleString()} {currency}
                    </td>
                  </tr>
                )}
              </tfoot>
            </table>
          </div>

          {/* Footer */}
          <div className="mt-8 border-t border-[var(--hisab-border)] pt-4 text-center text-sm text-[var(--hisab-muted-fg)]">
            <p>
              {t("faktoor.generatedBy")} Hisabche — hisabche.com
            </p>
            <p className="mt-1">
              {new Date(createdAt).toLocaleDateString("fa-AF")}{" "}
              {new Date(createdAt).toLocaleTimeString("fa-AF")}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}