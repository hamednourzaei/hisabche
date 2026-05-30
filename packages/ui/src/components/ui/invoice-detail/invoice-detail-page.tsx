"use client"

import { useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { useInvoice } from "@hisabche/api"
import { Button, Badge, Card, CardContent } from "@hisabche/ui"
import {
  ArrowRight, Printer, Share2, MessageCircle, Send, Mail,
  Loader2, FileText, Calendar, User,
} from "lucide-react"
import InvoicePDFDownload from "./InvoicePDFDownload"

interface InvoiceItem {
  id?: string; productName?: string; product_name?: string
  quantity?: number; unitPrice?: number; unit_price?: number
  totalPrice?: number; total_price?: number
}

interface Invoice {
  id: string; invoiceNumber?: string; invoice_number?: string
  date: string; status: string; currency?: string
  subtotal?: number; total?: number
  customerName?: string; customer_name?: string
  discountTotal?: number; discount_total?: number
  taxTotal?: number; tax_total?: number
  paidAmount?: number; paid_amount?: number
  createdAt?: string; created_at?: string
  items?: InvoiceItem[]; invoiceItems?: InvoiceItem[]
}

export function InvoiceDetailPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const printRef = useRef<HTMLDivElement>(null)
  const { data: invoice, isLoading } = useInvoice(id)
  const inv = invoice as Invoice | undefined
  const getField = <T,>(f: T | undefined, fb: T | undefined): T | undefined => f ?? fb

  const handlePrint = useCallback(() => {
    if (!printRef.current) return
    const c = printRef.current.innerHTML
    let s = ""; document.querySelectorAll("style, link[rel='stylesheet']").forEach((e) => { s += e.outerHTML })
    const w = window.open("", "_blank", "width=800,height=600")
    if (!w) return
    w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8" />${s}</head><body style="margin:20px;print-color-adjust:exact">${c}</body></html>`)
    w.document.close(); w.focus(); setTimeout(() => { w.print(); w.close() }, 500)
  }, [])

  const handleSharePDF = useCallback(async () => {
    if (!inv) return
    const text = `🧾 ${t("faktoor.title")}: #${getField(inv.invoiceNumber, inv.invoice_number)}\n📅 ${new Date(inv.date).toLocaleDateString("fa-AF")}\n${getField(inv.customerName, inv.customer_name) ? `👤 ${getField(inv.customerName, inv.customer_name)}\n` : ""}💰 ${(inv.total ?? 0).toLocaleString()} ${inv.currency || "AFN"}\n📌 ${t(`faktoor.${inv.status || "pending"}`)}`
    if (navigator.share) { try { await navigator.share({ title: `Invoice #${inv.invoiceNumber}`, text }) } catch {} }
    else { await navigator.clipboard.writeText(text); alert(t("faktoor.copiedToClipboard")) }
  }, [inv, t])

  const msg = (inv: Invoice) => `🧾 *${t("faktoor.title")}*: #${getField(inv.invoiceNumber, inv.invoice_number)}\n📅 ${new Date(inv.date).toLocaleDateString("fa-AF")}\n${getField(inv.customerName, inv.customer_name) ? `👤 ${getField(inv.customerName, inv.customer_name)}\n` : ""}💰 *${(inv.total ?? 0).toLocaleString()} ${inv.currency || "AFN"}*\n📌 ${t(`faktoor.${inv.status || "pending"}`)}`

  const handleWhatsApp = useCallback(() => { if (!inv) return; window.open(`https://wa.me/?text=${encodeURIComponent(msg(inv))}`, "_blank") }, [inv, t])
  const handleTelegram = useCallback(() => { if (!inv) return; window.open(`https://t.me/share/url?url=&text=${encodeURIComponent(msg(inv))}`, "_blank") }, [inv, t])
  const handleEmail = useCallback(() => {
    if (!inv) return
    window.open(`mailto:?subject=${encodeURIComponent(`${t("faktoor.title")} #${getField(inv.invoiceNumber, inv.invoice_number)}`)}&body=${encodeURIComponent(`${t("faktoor.title")}: #${getField(inv.invoiceNumber, inv.invoice_number)}\n${t("faktoor.date")}: ${new Date(inv.date).toLocaleDateString("fa-AF")}\n${t("faktoor.total")}: ${(inv.total ?? 0).toLocaleString()} ${inv.currency || "AFN"}`)}`, "_blank")
  }, [inv, t])

  if (isLoading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-[var(--hisab-primary)]" /></div>
  if (!inv) return <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4"><FileText className="size-16 text-[var(--hisab-muted-fg)]" /><p className="text-lg text-[var(--hisab-muted-fg)]">{t("faktoor.notFound")}</p><Button onClick={() => router.push("/invoices")}>{t("action.back")}</Button></div>

  const statusVariant = (s: string): "success" | "warning" | "destructive" | "secondary" => ({ completed: "success", pending: "warning", partial: "secondary", cancelled: "destructive" } as const)[s] || "secondary"
  const items: InvoiceItem[] = inv.items ?? inv.invoiceItems ?? []
  const invNum = getField(inv.invoiceNumber, inv.invoice_number)
  const custName = getField(inv.customerName, inv.customer_name)
  const discTotal = getField(inv.discountTotal, inv.discount_total) ?? 0
  const taxTotal = getField(inv.taxTotal, inv.tax_total) ?? 0
  const paidAmt = getField(inv.paidAmount, inv.paid_amount) ?? 0
  const createdAt = getField(inv.createdAt, inv.created_at) ?? inv.date
  const currency = inv.currency ?? "AFN"

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between no-print">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" onClick={() => router.back()}><ArrowRight className="size-5" /></Button>
          <h1 className="text-2xl font-bold">{t("faktoor.detail")} #{invNum}</h1>
          <Badge variant={statusVariant(inv.status)} size="sm">{t(`faktoor.${inv.status}`)}</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleWhatsApp}><MessageCircle className="size-4" /><span className="hidden sm:inline ml-1.5">WhatsApp</span></Button>
          <Button variant="outline" size="sm" onClick={handleTelegram}><Send className="size-4" /><span className="hidden sm:inline ml-1.5">Telegram</span></Button>
          <Button variant="outline" size="sm" onClick={handleEmail}><Mail className="size-4" /><span className="hidden sm:inline ml-1.5">{t("action.email")}</span></Button>
          <Button variant="outline" size="sm" onClick={handleSharePDF}><Share2 className="size-4" /><span className="hidden sm:inline ml-1.5">{t("action.share")}</span></Button>
          <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="size-4" /><span className="hidden sm:inline ml-1.5">{t("action.print")}</span></Button>
          <InvoicePDFDownload invoice={inv} />
        </div>
      </div>

      <div ref={printRef}>
        <Card className="glass-card">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-8">
              <div><h2 className="text-3xl font-bold text-[var(--hisab-primary)]">Hisabche</h2><p className="text-sm text-[var(--hisab-muted-fg)] mt-1">hisabche.com</p></div>
              <div className="text-right">
                <p className="text-2xl font-bold">#{invNum}</p>
                <div className="mt-2 space-y-1 text-sm text-[var(--hisab-muted-fg)]">
                  <div className="flex items-center justify-end gap-2"><Calendar className="size-3.5" />{new Date(inv.date).toLocaleDateString("fa-AF")}</div>
                  {custName && <div className="flex items-center justify-end gap-2"><User className="size-3.5" />{custName}</div>}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[var(--hisab-border)]"><th className="py-3 px-2 text-right font-medium text-[var(--hisab-muted-fg)]">#</th><th className="py-3 px-2 text-right font-medium text-[var(--hisab-muted-fg)]">{t("godam.productName")}</th><th className="py-3 px-2 text-center font-medium text-[var(--hisab-muted-fg)]">{t("faktoor.quantity")}</th><th className="py-3 px-2 text-right font-medium text-[var(--hisab-muted-fg)]">{t("faktoor.unitPrice")}</th><th className="py-3 px-2 text-right font-medium text-[var(--hisab-muted-fg)]">{t("faktoor.totalPrice")}</th></tr></thead>
                <tbody>
                  {items.map((item: InvoiceItem, i: number) => (
                    <tr key={item.id || i} className="border-b border-[var(--hisab-border)]">
                      <td className="py-3 px-2 text-[var(--hisab-muted-fg)]">{i + 1}</td>
                      <td className="py-3 px-2 font-medium">{getField(item.productName, item.product_name)}</td>
                      <td className="py-3 px-2 text-center">{item.quantity}</td>
                      <td className="py-3 px-2 text-right">{(getField(item.unitPrice, item.unit_price))?.toLocaleString()} {currency}</td>
                      <td className="py-3 px-2 text-right font-medium">{(getField(item.totalPrice, item.total_price))?.toLocaleString()} {currency}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr><td colSpan={4} className="py-3 px-2 text-right font-medium">{t("faktoor.subtotal")}</td><td className="py-3 px-2 text-right font-medium">{inv.subtotal?.toLocaleString()} {currency}</td></tr>
                  {discTotal > 0 && <tr><td colSpan={4} className="py-2 px-2 text-right text-[var(--hisab-muted-fg)]">{t("faktoor.discount")}</td><td className="py-2 px-2 text-right text-[var(--hisab-destructive)]">-{discTotal.toLocaleString()} {currency}</td></tr>}
                  {taxTotal > 0 && <tr><td colSpan={4} className="py-2 px-2 text-right text-[var(--hisab-muted-fg)]">{t("faktoor.tax")}</td><td className="py-2 px-2 text-right">{taxTotal.toLocaleString()} {currency}</td></tr>}
                  <tr className="border-t-2 border-[var(--hisab-border)]"><td colSpan={4} className="py-3 px-2 text-right text-lg font-bold">{t("faktoor.total")}</td><td className="py-3 px-2 text-right text-lg font-bold text-[var(--hisab-primary)]">{inv.total?.toLocaleString()} {currency}</td></tr>
                  {paidAmt > 0 && <tr><td colSpan={4} className="py-2 px-2 text-right text-[var(--hisab-muted-fg)]">{t("faktoor.paid")}</td><td className="py-2 px-2 text-right text-[var(--hisab-success)]">-{paidAmt.toLocaleString()} {currency}</td></tr>}
                  {((inv.total || 0) - paidAmt) > 0 && <tr><td colSpan={4} className="py-2 px-2 text-right font-medium text-[var(--hisab-destructive)]">{t("faktoor.remaining")}</td><td className="py-2 px-2 text-right font-medium text-[var(--hisab-destructive)]">{((inv.total || 0) - paidAmt).toLocaleString()} {currency}</td></tr>}
                </tfoot>
              </table>
            </div>

            <div className="mt-8 border-t border-[var(--hisab-border)] pt-4 text-center text-sm text-[var(--hisab-muted-fg)]">
              <p>{t("faktoor.generatedBy")} Hisabche — hisabche.com</p>
              <p className="mt-1">{new Date(createdAt).toLocaleDateString("fa-AF")} {new Date(createdAt).toLocaleTimeString("fa-AF")}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}