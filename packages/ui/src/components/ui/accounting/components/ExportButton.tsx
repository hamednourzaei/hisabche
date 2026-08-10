// packages/ui/src/components/ui/accounting/components/ExportButton.tsx
'use client'

import { memo, useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Download, Loader2 } from 'lucide-react'
import { cn } from '../../../../lib/utils'

export interface ExportColumn<T> {
  key: string
  header: string
  accessor: (row: T) => string | number
}

interface ExportButtonProps<T> {
  data: T[]
  columns: ExportColumn<T>[]
  filename: string
  className?: string
}

function toCsv<T>(data: T[], columns: ExportColumn<T>[]): string {
  const escapeCell = (value: string | number) => {
    const str = String(value ?? '')
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const header = columns.map((c) => escapeCell(c.header)).join(',')
  const rows = data.map((row) => columns.map((c) => escapeCell(c.accessor(row))).join(','))

  // ✅ BOM برای نمایش صحیح حروف فارسی در Excel
  return '\uFEFF' + [header, ...rows].join('\r\n')
}

function ExportButtonInner<T>({ data, columns, filename, className }: ExportButtonProps<T>) {
  const t = useTranslations()
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = useCallback(() => {
    if (data.length === 0) return
    setIsExporting(true)
    try {
      const csv = toCsv(data, columns)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } finally {
      setIsExporting(false)
    }
  }, [data, columns, filename])

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={isExporting || data.length === 0}
      className={cn(
        'flex items-center gap-1.5 md:gap-2 rounded-lg font-medium transition-colors',
        'px-2.5 md:px-3 lg:px-4 py-1.5 md:py-2',
        'text-[11px] md:text-xs lg:text-sm',
        'border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))]',
        'hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        'focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))]',
        className,
      )}
      aria-label={t('accounting.export.label')}
    >
      {isExporting ? (
        <Loader2 className="size-3.5 md:size-4 animate-spin" aria-hidden="true" />
      ) : (
        <Download className="size-3.5 md:size-4" aria-hidden="true" />
      )}
      <span>{t('accounting.export.button')}</span>
    </button>
  )
}

export const ExportButton = memo(ExportButtonInner) as typeof ExportButtonInner
