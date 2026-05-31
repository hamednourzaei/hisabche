// apps/web/app/(dashboard)/invoices/[id]/InvoicePDFDownload.tsx

"use client"

import { useCallback, useRef, useState } from "react"
import { FileDown, Loader2 } from "lucide-react"
import { Button } from "@hisabche/ui"

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

  const handleDownload = useCallback(() => {
    if (!invoiceId || loading) return

    setLoading(true)

    const url = `https://hisabche.onrender.com/api/invoices/${invoiceId}/pdf`

    const iframe = document.createElement("iframe")
    iframe.style.display = "none"
    iframe.src = url
    document.body.appendChild(iframe)
    iframeRef.current = iframe

    setTimeout(() => {
      if (iframeRef.current) {
        document.body.removeChild(iframeRef.current)
        iframeRef.current = null
      }
      setLoading(false)
    }, 2000)
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
        {loading ? "..." : "PDF"}
      </span>
    </Button>
  )
}