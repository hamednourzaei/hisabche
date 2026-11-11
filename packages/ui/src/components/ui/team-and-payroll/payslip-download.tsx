'use client'

// ============================================
// «فیش حقوقی» — the PDF of ONE payroll row, downloaded from the server.
//
// V58 · P0-6b wiring. `GET /api/hr/payrolls/:id/payslip.pdf` existed with no
// caller: the payslip rendered the payroll row as the ledger holds it, and
// no screen could ask for it. This is the missing wire, not a second model
// (G2) — the same download pattern the invoice PDF button uses
// (InvoicePDFDownload).
//
// The server renders per request and answers in the UI language
// (Accept-Language), so the client sends nothing but the row's id.
// ============================================

import { useCallback, useState } from 'react'
import { FileDown, Loader2 } from 'lucide-react'

import { apiClient } from '@hisabche/api'

import { cn } from '../../../lib/utils'
import { OUTLINE_BUTTON } from '../button-classes'

type T = (key: string, fallback?: string) => string

export function PayslipDownload({
  t,
  payrollId,
}: {
  t: T
  payrollId: string
}) {
  const [loading, setLoading] = useState(false)

  const handleDownload = useCallback(async () => {
    if (!payrollId || loading) return
    try {
      setLoading(true)
      const response = await apiClient.get(`/hr/payrolls/${payrollId}/payslip.pdf`, {
        responseType: 'blob',
      })
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const blobUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = `payslip-${payrollId}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(blobUrl)
    } catch {
      alert(t('hr.payslipError', 'دانلود فیش حقوقی انجام نشد.'))
    } finally {
      setLoading(false)
    }
  }, [payrollId, loading, t])

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={loading || !payrollId}
      aria-label={t('hr.payslip', 'فیش حقوقی')}
      title={t('hr.payslip', 'فیش حقوقی')}
      className={cn(OUTLINE_BUTTON, 'gap-1 px-2 py-1 text-xs disabled:opacity-40 disabled:cursor-not-allowed')}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <FileDown className="size-4" aria-hidden="true" />
      )}
      <span className="hidden sm:inline">{loading ? t('hr.payslipLoading', 'در حال آماده‌سازی') : t('hr.payslip', 'فیش حقوقی')}</span>
    </button>
  )
}
