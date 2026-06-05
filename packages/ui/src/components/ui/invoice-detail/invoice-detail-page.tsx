"use client"

import { Button } from "../button"
import { Badge } from "../badge"
import { Card, CardContent } from "../card"
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
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <FileText className="size-16 text-muted-foreground" aria-hidden />
        <p className="text-lg text-muted-foreground">
          {t("faktoor.notFound", "فاکتور پیدا نشد")}
        </p>
        <Button onClick={onBack}>
          {t("action.back", "بازگشت")}
        </Button>
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
            size="icon"
            onClick={onBack}
            aria-label={t("common.back", "بازگشت")}
          >
            <ArrowRight className="size-5" aria-hidden />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">
            {t("faktoor.detail", "جزئیات فاکتور")} #{invoiceNumber}
          </h1>
          <Badge variant={statusVariant(status)}>
            {t(`faktoor.${status}`, status)}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onWhatsApp} className="gap-1.5">
            <MessageCircle className="size-4" aria-hidden />
            <span className="hidden sm:inline">WhatsApp</span>
          </Button>
          <Button variant="outline" size="sm" onClick={onTelegram} className="gap-1.5">
            <Send className="size-4" aria-hidden />
            <span className="hidden sm:inline">Telegram</span>
          </Button>
          <Button variant="outline" size="sm" onClick={onEmail} className="gap-1.5">
            <Mail className="size-4" aria-hidden />
            <span className="hidden sm:inline">{t("action.email", "ایمیل")}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={onSharePDF} className="gap-1.5">
            <Share2 className="size-4" aria-hidden />
            <span className="hidden sm:inline">{t("action.share", "اشتراک")}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={onPrint} className="gap-1.5">
            <Printer className="size-4" aria-hidden />
            <span className="hidden sm:inline">{t("action.print", "چاپ")}</span>
          </Button>
          <InvoicePDFDownload invoice={invoice} />
        </div>
      </div>

      {/* ── Invoice Paper ── */}
      <Card className="glass-card border-border">
        <CardContent className="p-6 sm:p-8">
          {/* Brand + Invoice Info */}
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-3xl font-bold text-primary">
                Hisabche
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                hisabche.com
              </p>
            </div>
            <div className="text-end">
              <p className="text-2xl font-bold text-foreground">#{invoiceNumber}</p>
              <div className="mt-2 space-y-1 text-sm text-muted-foreground">
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
                <tr className="border-b border-border">
                  <th className="px-2 py-3 text-start font-medium text-muted-foreground">
                    #
                  </th>
                  <th className="px-2 py-3 text-start font-medium text-muted-foreground">
                    {t("godam.productName", "نام محصول")}
                  </th>
                  <th className="px-2 py-3 text-center font-medium text-muted-foreground">
                    {t("faktoor.quantity", "تعداد")}
                  </th>
                  <th className="px-2 py-3 text-end font-medium text-muted-foreground">
                    {t("faktoor.unitPrice", "قیمت واحد")}
                  </th>
                  <th className="px-2 py-3 text-end font-medium text-muted-foreground">
                    {t("faktoor.totalPrice", "قیمت کل")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr
                    key={item.id || i}
                    className="border-b border-border"
                  >
                    <td className="px-2 py-3 text-muted-foreground">
                      {i + 1}
                    </td>
                    <td className="px-2 py-3 font-medium text-foreground">
                      {item.productName ?? item.product_name}
                    </td>
                    <td className="px-2 py-3 text-center text-foreground">
                      {item.quantity}
                    </td>
                    <td className="px-2 py-3 text-end tabular-nums text-foreground">
                      {(item.unitPrice ?? item.unit_price)?.toLocaleString()} {currency}
                    </td>
                    <td className="px-2 py-3 text-end font-medium tabular-nums text-foreground">
                      {(item.totalPrice ?? item.total_price)?.toLocaleString()} {currency}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} className="px-2 py-3 text-end font-medium text-foreground">
                    {t("faktoor.subtotal", "جمع")}
                  </td>
                  <td className="px-2 py-3 text-end font-medium tabular-nums text-foreground">
                    {subtotal.toLocaleString()} {currency}
                  </td>
                </tr>
                {discountTotal > 0 && (
                  <tr>
                    <td colSpan={4} className="px-2 py-2 text-end text-muted-foreground">
                      {t("faktoor.discount", "تخفیف")}
                    </td>
                    <td className="px-2 py-2 text-end text-destructive tabular-nums">
                      -{discountTotal.toLocaleString()} {currency}
                    </td>
                  </tr>
                )}
                {taxTotal > 0 && (
                  <tr>
                    <td colSpan={4} className="px-2 py-2 text-end text-muted-foreground">
                      {t("faktoor.tax", "مالیات")}
                    </td>
                    <td className="px-2 py-2 text-end tabular-nums text-foreground">
                      {taxTotal.toLocaleString()} {currency}
                    </td>
                  </tr>
                )}
                <tr className="border-t-2 border-border">
                  <td colSpan={4} className="px-2 py-3 text-end text-lg font-bold text-foreground">
                    {t("faktoor.total", "مجموع")}
                  </td>
                  <td className="px-2 py-3 text-end text-lg font-bold text-primary tabular-nums">
                    {total.toLocaleString()} {currency}
                  </td>
                </tr>
                {paidAmount > 0 && (
                  <tr>
                    <td colSpan={4} className="px-2 py-2 text-end text-muted-foreground">
                      {t("faktoor.paid", "پرداخت شده")}
                    </td>
                    <td className="px-2 py-2 text-end text-success tabular-nums">
                      -{paidAmount.toLocaleString()} {currency}
                    </td>
                  </tr>
                )}
                {total - paidAmount > 0 && (
                  <tr>
                    <td colSpan={4} className="px-2 py-2 text-end font-medium text-destructive">
                      {t("faktoor.remaining", "باقیمانده")}
                    </td>
                    <td className="px-2 py-2 text-end font-medium text-destructive tabular-nums">
                      {(total - paidAmount).toLocaleString()} {currency}
                    </td>
                  </tr>
                )}
              </tfoot>
            </table>
          </div>

          {/* Footer */}
          <div className="mt-8 border-t border-border pt-4 text-center text-sm text-muted-foreground">
            <p>
              {t("faktoor.generatedBy", "ایجاد شده توسط")} Hisabche — hisabche.com
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