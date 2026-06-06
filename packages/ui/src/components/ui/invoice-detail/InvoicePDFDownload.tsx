// apps/web/app/(dashboard)/invoices/[id]/InvoicePDFDownload.tsx

"use client"

import { useCallback, useRef, useState } from "react"
import { FileDown, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@hisabche/store"

interface Invoice {
  id?: string
}

interface Props {
  invoice: Invoice
}

export default function InvoicePDFDownload({ invoice }: Props) {
  const invoiceId = invoice?.id ?? ""
  const [loading, setLoading] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  
  // گرفتن user از store (برای توکن باید از جای دیگر بیایی)
  const { user, isAuthenticated } = useAuthStore()

  const handleDownload = useCallback(async () => {
    if (!invoiceId || loading || !isAuthenticated) return

    setLoading(true)

    try {
      const url = `https://hisabche.onrender.com/api/invoices/${invoiceId}/pdf`
      
      // درخواست بدون توکن (اگر بک‌اند عمومی است)
      // یا اگر نیاز به توکن داری، باید از supabase client استفاده کنی
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      
      window.open(blobUrl, '_blank')
      
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
    } catch (error) {
      console.error("PDF download failed:", error)
    } finally {
      setLoading(false)
    }
  }, [invoiceId, loading, isAuthenticated])

  if (!isAuthenticated) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled
        aria-label="PDF (نیاز به ورود)"
      >
        <FileDown className="size-4" aria-hidden />
        <span className="hidden sm:inline ms-1.5">PDF</span>
      </Button>
    )
  }

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
        {loading ? "..." : "PDF"}
      </span>
    </Button>
  )
}