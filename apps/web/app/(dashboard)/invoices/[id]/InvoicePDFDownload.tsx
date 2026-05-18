// apps/web/app/invoices/[id]/InvoicePDFDownload.tsx

"use client"

import { useCallback, useRef, useState } from "react"
import { FileDown, Loader2 } from "lucide-react"
import { Button } from "@hisabche/ui"

interface Props {
  invoice: any
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

export default function InvoicePDFDownload({ invoice }: Props) {
  const invoiceId = (invoice as any)?.id ?? ""
  const [loading, setLoading] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  const handleDownload = useCallback(() => {
    if (!invoiceId || loading) return
    setLoading(true)

    const url = `${API_URL}/api/invoices/${invoiceId}/pdf`

    // Create hidden iframe
    const iframe = document.createElement("iframe")
    iframe.style.display = "none"
    iframe.src = url
    document.body.appendChild(iframe)
    iframeRef.current = iframe

    // Cleanup after download starts
    setTimeout(() => {
      if (iframeRef.current) {
        document.body.removeChild(iframeRef.current)
        iframeRef.current = null
      }
      setLoading(false)
    }, 2000)
  }, [invoiceId, loading])

  return (
    <Button variant="outline" size="sm" onClick={handleDownload} disabled={loading}>
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <FileDown className="size-4" />
      )}
      <span className="hidden sm:inline ml-1.5">
        {loading ? "..." : "PDF"}
      </span>
    </Button>
  )
}