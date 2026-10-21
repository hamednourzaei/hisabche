'use client'

import { memo, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
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
import { Button } from '../button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../dialog'
import { UndoDisclosure } from '../undo-disclosure'

interface InvoiceRowActionsProps {
  inv: Invoice
  t: (key: string, fallback?: string) => string
  onNavigate: (id: string) => void
  onNavigateAction: (id: string, action: 'pdf' | 'print' | 'png') => void
  onDelete: (id: string) => void | Promise<void>
}

/** Room kept clear at the bottom for the phone's tab bar. */
const BOTTOM_CLEARANCE = 96
const MENU_WIDTH = 224

/**
 * ⚠️ THE MENU LIVES OUTSIDE THE CARD.
 *
 * Inside a card (overflow-hidden) the lower items were cut off and nothing
 * scrolled. It is portalled to <body>, placed from the button's rectangle,
 * opens upward when there is more room above, and scrolls within the screen.
 */
function menuPlacement(button: HTMLElement): CSSProperties {
  const rect = button.getBoundingClientRect()
  const below = window.innerHeight - rect.bottom - BOTTOM_CLEARANCE
  const above = rect.top - 8
  const left = Math.min(Math.max(8, rect.left), window.innerWidth - MENU_WIDTH - 8)
  return below >= 240 || below >= above
    ? { position: 'fixed', left, top: rect.bottom + 4, maxHeight: Math.max(160, below) }
    : { position: 'fixed', left, bottom: window.innerHeight - rect.top + 4, maxHeight: above }
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
  const [confirming, setConfirming] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [placement, setPlacement] = useState<CSSProperties | null>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (ref.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    // A fixed menu would stay put while the page moves under it.
    const close = () => setOpen(false)
    document.addEventListener('mousedown', onClick)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('mousedown', onClick)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
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
        onClick={(event) => {
          if (!open) setPlacement(menuPlacement(event.currentTarget))
          setOpen((v) => !v)
        }}
        aria-label={t('invoices.actions', 'عملیات')}
        aria-expanded={open}
        className="inline-flex items-center justify-center rounded-full min-h-[36px] min-w-[36px] text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))] transition-colors duration-150"
      >
        <MoreVertical className="size-4" />
      </button>

      {open &&
        placement &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            style={placement}
            className="z-50 w-56 overflow-y-auto overscroll-contain rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-1.5 shadow-lg"
          >
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
                setConfirming(true)
              }}
            >
              <Trash2 className="size-4" /> {t('action.delete', 'حذف')}
            </button>
          </div>,
          document.body,
        )}

      {/* ⚠️ «حذف» used to act the instant it was pressed — on a button that
          cancels an invoice, reverses its ledger entry and puts its stock back.
          It now asks, and says what it will do BEFORE it does it (#81). */}
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('invoices.deleteConfirmTitle', 'این فاکتور حذف شود؟')} #{inv.invoiceNumber}
            </DialogTitle>
          </DialogHeader>
          {confirming ? <UndoDisclosure t={t} route="DELETE /invoices/:id" /> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirming(false)}>
              {t('action.cancel', 'انصراف')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setConfirming(false)
                void onDelete(inv.id)
              }}
            >
              {t('action.delete', 'حذف')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
})

InvoiceRowActions.displayName = 'InvoiceRowActions'
