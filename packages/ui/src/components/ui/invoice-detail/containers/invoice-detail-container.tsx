"use client"

import { useCallback, useMemo, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { useInvoice } from "@hisabche/api"
import {
  InvoiceDetailPage,
  type InvoiceDetailDisplay,
} from "../invoice-detail-page"

const STATUS_MAP: Record<
  string,
  "success" | "warning" | "destructive" | "secondary"
> = {
  completed: "success",
  pending: "warning",
  partial: "secondary",
  cancelled: "destructive",
}

const getField = <T,>(a: T | undefined, b: T | undefined): T | undefined =>
  a ?? b

export function InvoiceDetailContainer() {
  const { t } = useTranslation()
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const printRef = useRef<HTMLDivElement>(null)
  const { data: invoice, isLoading } = useInvoice(id)

  const display: InvoiceDetailDisplay | null = useMemo(() => {
    if (!invoice) return null
    const inv = invoice as Record<string, unknown>
    return {
      id: inv.id as string,
      invoiceNumber:
        (getField(inv.invoiceNumber, inv.invoice_number) as string) ?? "",
      date: inv.date as string,
      status: inv.status as string,
      currency: (inv.currency as string) ?? "AFN",
      subtotal: (inv.subtotal as number) ?? 0,
      total: (inv.total as number) ?? 0,
      customerName:
        (getField(inv.customerName, inv.customer_name) as string) ?? "",
      discountTotal:
        (getField(inv.discountTotal, inv.discount_total) as number) ?? 0,
      taxTotal:
        (getField(inv.taxTotal, inv.tax_total) as number) ?? 0,
      paidAmount:
        (getField(inv.paidAmount, inv.paid_amount) as number) ?? 0,
      createdAt:
        (getField(inv.createdAt, inv.created_at) as string) ?? (inv.date as string),
      items: (
        (inv.items as unknown[]) ??
        (inv.invoiceItems as unknown[]) ??
        []
      ).map((item: any) => ({
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
  }, [invoice])

  const safeT = useCallback(
    (key: string, fallback?: string) => {
      const v = t(key)
      return v && v !== key ? v : (fallback ?? key)
    },
    [t]
  )

  const buildMessage = useCallback(
    (inv: Record<string, unknown>) =>
      `🧾 ${t("faktoor.title")}: #${getField(inv.invoiceNumber, inv.invoice_number)}\n📅 ${new Date(inv.date as string).toLocaleDateString("fa-AF")}\n${getField(inv.customerName, inv.customer_name) ? `👤 ${getField(inv.customerName, inv.customer_name)}\n` : ""}💰 *${((inv.total as number) ?? 0).toLocaleString()} ${(inv.currency as string) || "AFN"}*\n📌 ${t(`faktoor.${(inv.status as string) || "pending"}`)}`,
    [t]
  )

  const handlePrint = useCallback(() => {
    if (!printRef.current) return
    const content = printRef.current.innerHTML
    let styles = ""
    document
      .querySelectorAll("style, link[rel='stylesheet']")
      .forEach((el) => {
        styles += el.outerHTML
      })
    const win = window.open("", "_blank", "width=800,height=600")
    if (!win) return
    win.document.write(
      `<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8" />${styles}</head><body style="margin:20px;print-color-adjust:exact">${content}</body></html>`
    )
    win.document.close()
    win.focus()
    setTimeout(() => {
      win.print()
      win.close()
    }, 500)
  }, [])

  const handleSharePDF = useCallback(async () => {
    if (!invoice) return
    const text = buildMessage(invoice as Record<string, unknown>).replace(
      /\*/g,
      ""
    )
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Invoice #${(invoice as Record<string, unknown>).invoiceNumber}`,
          text,
        })
      } catch {}
    } else {
      await navigator.clipboard.writeText(text)
      alert(t("faktoor.copiedToClipboard"))
    }
  }, [invoice, buildMessage, t])

  const handleWhatsApp = useCallback(() => {
    if (!invoice) return
    window.open(
      `https://wa.me/?text=${encodeURIComponent(buildMessage(invoice as Record<string, unknown>))}`,
      "_blank"
    )
  }, [invoice, buildMessage])

  const handleTelegram = useCallback(() => {
    if (!invoice) return
    window.open(
      `https://t.me/share/url?url=&text=${encodeURIComponent(buildMessage(invoice as Record<string, unknown>))}`,
      "_blank"
    )
  }, [invoice, buildMessage])

  const handleEmail = useCallback(() => {
    if (!invoice) return
    const inv = invoice as Record<string, unknown>
    window.open(
      `mailto:?subject=${encodeURIComponent(`${t("faktoor.title")} #${getField(inv.invoiceNumber, inv.invoice_number)}`)}&body=${encodeURIComponent(`${t("faktoor.title")}: #${getField(inv.invoiceNumber, inv.invoice_number)}\n${t("faktoor.date")}: ${new Date(inv.date as string).toLocaleDateString("fa-AF")}\n${t("faktoor.total")}: ${((inv.total as number) ?? 0).toLocaleString()} ${(inv.currency as string) || "AFN"}`)}`,
      "_blank"
    )
  }, [invoice, t])

  const statusVariant = useCallback(
    (s: string) => STATUS_MAP[s] || "secondary",
    []
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
      statusVariant={statusVariant}
    />
  )
}