"use client"

import { useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { useInvoice } from "@hisabche/api"
import { InvoiceDetailPage, type InvoiceDetailDisplay } from "../invoice-detail-page"

const getField = <T,>(a: T | undefined, b: T | undefined): T | undefined => a ?? b

export function InvoiceDetailContainer() {
  const { t } = useTranslation()
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const printRef = useRef<HTMLDivElement>(null)
  const { data: invoice, isLoading } = useInvoice(id)

  const inv = invoice as any
  const display: InvoiceDetailDisplay | null = inv
    ? {
        id: inv.id,
        invoiceNumber: getField(inv.invoiceNumber, inv.invoice_number) ?? "",
        date: inv.date,
        status: inv.status,
        currency: inv.currency ?? "AFN",
        subtotal: inv.subtotal ?? 0,
        total: inv.total ?? 0,
        customerName: getField(inv.customerName, inv.customer_name) ?? "",
        discountTotal: getField(inv.discountTotal, inv.discount_total) ?? 0,
        taxTotal: getField(inv.taxTotal, inv.tax_total) ?? 0,
        paidAmount: getField(inv.paidAmount, inv.paid_amount) ?? 0,
        createdAt: getField(inv.createdAt, inv.created_at) ?? inv.date,
        items: (inv.items ?? inv.invoiceItems ?? []).map((item: any) => ({
          id: item.id,
          productName: item.productName ?? item.product_name,
          product_name: item.product_name,
          quantity: item.quantity,
          unitPrice: item.unitPrice ?? item.unit_price,
          unit_price: item.unit_price,
          totalPrice: item.totalPrice ?? item.total_price,
          total_price: item.total_price,
        })),
      }
    : null

  const safeT = (key: string, fallback?: string) => {
    const v = t(key)
    return v && v !== key ? v : (fallback ?? key)
  }

  const handlePrint = useCallback(() => {
    if (!printRef.current) return
    const content = printRef.current.innerHTML
    let styles = ""
    document.querySelectorAll("style, link[rel='stylesheet']").forEach((el) => {
      styles += el.outerHTML
    })
    const win = window.open("", "_blank", "width=800,height=600")
    if (!win) return
    win.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8" />${styles}</head><body style="margin:20px;print-color-adjust:exact">${content}</body></html>`)
    win.document.close()
    win.focus()
    setTimeout(() => {
      win.print()
      win.close()
    }, 500)
  }, [])

  const msg = useCallback(
    (inv: any) =>
      `🧾 ${t("faktoor.title")}: #${getField(inv.invoiceNumber, inv.invoice_number)}\n📅 ${new Date(inv.date).toLocaleDateString("fa-AF")}\n${getField(inv.customerName, inv.customer_name) ? `👤 ${getField(inv.customerName, inv.customer_name)}\n` : ""}💰 *${(inv.total ?? 0).toLocaleString()} ${inv.currency || "AFN"}*\n📌 ${t(`faktoor.${inv.status || "pending"}`)}`,
    [t]
  )

  const handleSharePDF = useCallback(async () => {
    if (!inv) return
    const text = msg(inv).replace(/\*/g, "")
    if (navigator.share) {
      try { await navigator.share({ title: `Invoice #${inv.invoiceNumber}`, text }) } catch {}
    } else {
      await navigator.clipboard.writeText(text)
      alert(t("faktoor.copiedToClipboard"))
    }
  }, [inv, msg, t])

  const handleWhatsApp = useCallback(() => {
    if (!inv) return
    window.open(`https://wa.me/?text=${encodeURIComponent(msg(inv))}`, "_blank")
  }, [inv, msg])

  const handleTelegram = useCallback(() => {
    if (!inv) return
    window.open(`https://t.me/share/url?url=&text=${encodeURIComponent(msg(inv))}`, "_blank")
  }, [inv, msg])

  const handleEmail = useCallback(() => {
    if (!inv) return
    window.open(
      `mailto:?subject=${encodeURIComponent(`${t("faktoor.title")} #${getField(inv.invoiceNumber, inv.invoice_number)}`)}&body=${encodeURIComponent(`${t("faktoor.title")}: #${getField(inv.invoiceNumber, inv.invoice_number)}\n${t("faktoor.date")}: ${new Date(inv.date).toLocaleDateString("fa-AF")}\n${t("faktoor.total")}: ${(inv.total ?? 0).toLocaleString()} ${inv.currency || "AFN"}`)}`,
      "_blank"
    )
  }, [inv, t])

  const statusVariant = (s: string): "success" | "warning" | "destructive" | "secondary" =>
    ({ completed: "success", pending: "warning", partial: "secondary", cancelled: "destructive" } as const)[s] || "secondary"

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
      statusVariant={statusVariant}
    />
  )
}