// apps/web/app/(dashboard)/invoices/[id]/InvoicePDFDownload.tsx

"use client"

import { useCallback, useState } from "react"
import { FileDown, Loader2 } from "lucide-react"
import { Button } from "@hisabche/ui"
import { apiClient } from "@hisabche/api"

interface Invoice {
  id?: string
}

interface Props {
  invoice: Invoice
}

export default function InvoicePDFDownload({ invoice }: Props) {
  const invoiceId = invoice?.id ?? ""
  const [loading, setLoading] = useState(false)

  const handleDownload = useCallback(async () => {
    if (!invoiceId || loading) return

    try {
      setLoading(true)

      // استفاده از apiClient که خودکار توکن را اضافه می‌کند
      const response = await apiClient.get(`/invoices/${invoiceId}/pdf`, {
        responseType: 'blob',
      })

      const blob = new Blob([response.data], { type: 'application/pdf' })
      const blobUrl = window.URL.createObjectURL(blob)

      const link = document.createElement("a")
      link.href = blobUrl
      link.download = `invoice-${invoiceId}.pdf`

      document.body.appendChild(link)
      link.click()

      link.remove()
      window.URL.revokeObjectURL(blobUrl)
    } catch (error) {
      console.error("PDF download failed", error)
      alert("خطا در دانلود PDF. لطفاً دوباره وارد شوید.")
    } finally {
      setLoading(false)
    }
  }, [invoiceId, loading])

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleDownload}
      disabled={loading || !invoiceId}
      aria-label="دانلود PDF"
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <FileDown className="size-4" aria-hidden />
      )}
      <span className="hidden sm:inline ms-1.5">
        {loading ? "در حال دانلود..." : "PDF"}
      </span>
    </Button>
  )
}