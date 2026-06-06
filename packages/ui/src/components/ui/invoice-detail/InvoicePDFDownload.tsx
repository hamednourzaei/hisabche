"use client"

import { useCallback, useState } from "react"
import { FileDown, Loader2 } from "lucide-react"
import { Button } from "@hisabche/ui"

interface Invoice {
  id?: string
}

interface Props {
  invoice: Invoice
  token?: string
}

export default function InvoicePDFDownload({
  invoice,
  token,
}: Props) {
  const invoiceId = invoice?.id ?? ""
  const [loading, setLoading] = useState(false)

  const handleDownload = useCallback(async () => {
    if (!invoiceId || loading) return

    try {
      setLoading(true)

      const response = await fetch(
        `https://hisabche.onrender.com/api/invoices/${invoiceId}/pdf`,
        {
          method: "GET",
          headers: {
            ...(token
              ? {
                  Authorization: `Bearer ${token}`,
                }
              : {}),
          },
          credentials: "include",
        },
      )

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`)
      }

      const blob = await response.blob()

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

      alert("خطا در دانلود PDF")
    } finally {
      setLoading(false)
    }
  }, [invoiceId, loading, token])

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleDownload}
      disabled={loading || !invoiceId}
      aria-label="دانلود PDF"
    >
      {loading ? (
        <Loader2
          className="size-4 animate-spin"
          aria-hidden
        />
      ) : (
        <FileDown
          className="size-4"
          aria-hidden
        />
      )}

      <span className="hidden sm:inline ms-1.5">
        {loading ? "در حال دانلود..." : "PDF"}
      </span>
    </Button>
  )
}