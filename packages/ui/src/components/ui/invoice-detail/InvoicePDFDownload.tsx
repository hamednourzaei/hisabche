// apps/web/app/[lang]/(dashboard)/invoices/[id]/InvoicePDFDownload.tsx
'use client'

import { useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import { FileDown, Loader2 } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { apiClient } from '@hisabche/api'

/* ═══════════════════════════════════════════════════════════════════════════
   InvoicePDFDownload v3 — i18n-ready
   ═══════════════════════════════════════════════════════════════════════════ */

interface Invoice {
  id?: string | undefined
}

interface Props {
  invoice: Invoice
}

const outlineBtn =
  'inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))] transition-colors duration-150 motion-reduce:transition-none disabled:opacity-40 disabled:cursor-not-allowed'

export default function InvoicePDFDownload({ invoice }: Props) {
  const t = useTranslations()
  const invoiceId = invoice?.id ?? ''
  const [loading, setLoading] = useState(false)

  const handleDownload = useCallback(async () => {
    if (!invoiceId || loading) return
    try {
      setLoading(true)
      const response = await apiClient.get(`/invoices/${invoiceId}/pdf`, { responseType: 'blob' })
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const blobUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = `invoice-${invoiceId}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(blobUrl)
    } catch {
      alert(t('invoices.pdfError'))
    } finally {
      setLoading(false)
    }
  }, [invoiceId, loading, t])

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={loading || !invoiceId}
      aria-label={t('invoices.downloadPDF')}
      className={outlineBtn}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <FileDown className="size-4" aria-hidden="true" />
      )}
      <span className="hidden sm:inline">{loading ? t('invoices.downloading') : 'PDF'}</span>
    </button>
  )
}
