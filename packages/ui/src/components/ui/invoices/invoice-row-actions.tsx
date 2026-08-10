'use client'

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '../../../lib/utils'
import {
  Eye,
  Copy,
  Check,
  Printer,
  Image as ImageIcon,
  FileText,
  MoreVertical,
  MessageCircle,
  Send,
  Mail,
  Trash2,
} from 'lucide-react'
import type { Invoice } from '../../../lib/invoices/invoices-types'
import { buildInvoiceShareUrl } from '../invoice-detail/invoice-document'
import { buildInvoiceShareMessage } from '@hisabche/ui-contract'

interface InvoiceRowActionsProps {
  inv: Invoice
  t: (key: string, fallback?: string) => string
  onNavigate: (id: string) => void
  onNavigateAction: (id: string, action: 'pdf' | 'print' | 'png') => void
  onDelete: (id: string) => void | Promise<void>
}

const item =
  'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))] transition-colors duration-150'

export const InvoiceRowActions = memo(function InvoiceRowActions({
  inv,
  t,
  onNavigate,
  onNavigateAction,
  onDelete,
}: InvoiceRowActionsProps) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const shareUrl = buildInvoiceShareUrl('fa-AF', inv.id, inv.publicToken)
  // Shared with mobile so a customer gets the same wording either way.
  const message = buildInvoiceShareMessage(
    {
      invoiceNumber: inv.invoiceNumber,
      formattedTotal: `${inv.total.toLocaleString()} ${inv.currency}`,
      shareUrl,
    },
    t,
  )

  const handleCopyLink = useCallback(async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard unavailable — ignore
    }
  }, [shareUrl])

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('invoices.actions', 'عملیات')}
        aria-expanded={open}
        className="inline-flex items-center justify-center rounded-full min-h-[36px] min-w-[36px] text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))] transition-colors duration-150"
      >
        <MoreVertical className="size-4" />
      </button>

      {open && (
        <div className="absolute end-0 z-20 mt-1 w-56 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-1.5 shadow-lg">
          <button
            type="button"
            className={item}
            onClick={() => {
              setOpen(false)
              onNavigate(inv.id)
            }}
          >
            <Eye className="size-4" /> {t('action.view', 'مشاهده')}
          </button>
          <button
            type="button"
            className={item}
            onClick={() => {
              setOpen(false)
              onNavigateAction(inv.id, 'pdf')
            }}
          >
            <FileText className="size-4" /> {t('invoices.pdf', 'دانلود PDF')}
          </button>
          <button
            type="button"
            className={item}
            onClick={() => {
              setOpen(false)
              onNavigateAction(inv.id, 'png')
            }}
          >
            <ImageIcon className="size-4" /> {t('invoices.exportPNG', 'خروجی تصویر')}
          </button>
          <button
            type="button"
            className={item}
            onClick={() => {
              setOpen(false)
              onNavigateAction(inv.id, 'print')
            }}
          >
            <Printer className="size-4" /> {t('action.print', 'چاپ')}
          </button>
          <div className="my-1 h-px bg-[hsl(var(--border-default))]" />
          <button
            type="button"
            className={item}
            onClick={() =>
              window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank')
            }
          >
            <MessageCircle className="size-4" /> WhatsApp
          </button>
          <button
            type="button"
            className={item}
            onClick={() =>
              window.open(
                `https://t.me/share/url?url=&text=${encodeURIComponent(message)}`,
                '_blank',
              )
            }
          >
            <Send className="size-4" /> Telegram
          </button>
          <button
            type="button"
            className={item}
            onClick={() =>
              window.open(
                `mailto:?subject=${encodeURIComponent(`${t('invoices.title', 'فاکتور')} #${inv.invoiceNumber}`)}&body=${encodeURIComponent(message)}`,
                '_blank',
              )
            }
          >
            <Mail className="size-4" /> {t('action.email', 'ایمیل')}
          </button>
          <button type="button" className={item} onClick={handleCopyLink} disabled={!shareUrl}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}{' '}
            {copied ? t('invoices.copied', 'کپی شد') : t('invoices.copyLink', 'کپی لینک')}
          </button>
          <div className="my-1 h-px bg-[hsl(var(--border-default))]" />
          <button
            type="button"
            className={cn(
              item,
              'text-[hsl(var(--color-destructive))] hover:bg-[hsl(var(--color-destructive)/0.1)] hover:text-[hsl(var(--color-destructive))]',
            )}
            onClick={() => {
              setOpen(false)
              onDelete(inv.id)
            }}
          >
            <Trash2 className="size-4" /> {t('action.delete', 'حذف')}
          </button>
        </div>
      )}
    </div>
  )
})

InvoiceRowActions.displayName = 'InvoiceRowActions'
