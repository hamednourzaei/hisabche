'use client'

import { useNumberFormat } from '../../../hooks/use-number-format'
import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefObject,
} from 'react'
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
  LockKeyhole,
  FileCheck,
} from 'lucide-react'
import type { Invoice } from '../../../lib/invoices/invoices-types'
import type { AdvanceListRow } from '../../../lib/invoices/invoice-list-row'
import { buildInvoiceShareUrl } from '../invoice-detail/invoice-document'
import { buildInvoiceShareMessage } from '@hisabche/ui-contract'
import {
  apiErrorMessage,
  useMyCapabilities,
  usePostOrderDepositReceipt,
  useFinalizeAdvance,
} from '@hisabche/api'
import { Button } from '../button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../dialog'
import { UndoDisclosure } from '../undo-disclosure'

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

/**
 * The one dropdown primitive for row actions (invoice and advance): outside
 * click closes it, scroll/resize closes it, and the panel is portalled.
 */
function useActionMenu() {
  const [open, setOpen] = useState(false)
  const [placement, setPlacement] = useState<CSSProperties | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

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

  const toggle = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      if (!open) setPlacement(menuPlacement(event.currentTarget))
      setOpen((value) => !value)
    },
    [open],
  )

  return { open, setOpen, placement, ref, menuRef, toggle }
}

function ActionMenu({
  label,
  open,
  placement,
  menuRef,
  onToggle,
  anchorRef,
  children,
}: {
  label: string
  open: boolean
  placement: CSSProperties | null
  menuRef: RefObject<HTMLDivElement | null>
  onToggle: (event: ReactMouseEvent<HTMLButtonElement>) => void
  anchorRef: RefObject<HTMLDivElement | null>
  children: ReactNode
}) {
  return (
    <div className="relative inline-block" ref={anchorRef}>
      <button
        type="button"
        onClick={onToggle}
        aria-label={label}
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
            {children}
          </div>,
          document.body,
        )}
    </div>
  )
}

interface InvoiceRowActionsProps {
  inv: Invoice
  t: (key: string, fallback?: string) => string
  onNavigate: (id: string) => void
  onNavigateAction: (id: string, action: 'pdf' | 'print' | 'png') => void
  onDelete: (id: string) => void | Promise<void>
}

export const InvoiceRowActions = memo(function InvoiceRowActions({
  inv,
  t,
  onNavigate,
  onNavigateAction,
  onDelete,
}: InvoiceRowActionsProps) {
  const fmtNum = useNumberFormat()
  const menu = useActionMenu()
  const [copied, setCopied] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const shareUrl = buildInvoiceShareUrl('fa-AF', inv.id, inv.publicToken)
  // Shared with mobile so a customer gets the same wording either way.
  const message = buildInvoiceShareMessage(
    {
      invoiceNumber: inv.invoiceNumber,
      formattedTotal: `${fmtNum(inv.total)} ${inv.currency}`,
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
    <>
      <ActionMenu
        label={t('invoices.actions', 'عملیات')}
        open={menu.open}
        placement={menu.placement}
        menuRef={menu.menuRef}
        anchorRef={menu.ref}
        onToggle={menu.toggle}
      >
        <button
          type="button"
          className={item}
          onClick={() => {
            menu.setOpen(false)
            onNavigate(inv.id)
          }}
        >
          <Eye className="size-4" /> {t('action.view', 'مشاهده')}
        </button>
        <button
          type="button"
          className={item}
          onClick={() => {
            menu.setOpen(false)
            onNavigateAction(inv.id, 'pdf')
          }}
        >
          <FileText className="size-4" /> {t('invoices.pdf', 'دانلود PDF')}
        </button>
        <button
          type="button"
          className={item}
          onClick={() => {
            menu.setOpen(false)
            onNavigateAction(inv.id, 'png')
          }}
        >
          <ImageIcon className="size-4" /> {t('invoices.exportPNG', 'خروجی تصویر')}
        </button>
        <button
          type="button"
          className={item}
          onClick={() => {
            menu.setOpen(false)
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
            window.open(`https://t.me/share/url?url=&text=${encodeURIComponent(message)}`, '_blank')
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
            menu.setOpen(false)
            setConfirming(true)
          }}
        >
          <Trash2 className="size-4" /> {t('action.delete', 'حذف')}
        </button>
      </ActionMenu>

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
    </>
  )
})

InvoiceRowActions.displayName = 'InvoiceRowActions'

/**
 * The advance row's menu.
 *
 * «قطعی کردن» is the FINALIZE the advance document can actually have today:
 * the deposit was recorded but its receipt could not be booked (`pending_posting`
 * / `posting_unknown`), so the action posts that receipt through the existing
 * ledger path. It writes no stock and no revenue — an advance document books
 * nothing but the money it received. The server call is idempotent by the
 * deposit id, so a double tap or an offline retry returns the first entry.
 */
export const AdvanceRowActions = memo(function AdvanceRowActions({
  target,
  t,
  onOpenParty,
  onOpenInvoice,
}: {
  target: AdvanceListRow
  t: (key: string, fallback?: string) => string
  onOpenParty?: ((id: string) => void) | undefined
  onOpenInvoice?: ((id: string) => void) | undefined
}) {
  const menu = useActionMenu()
  const capabilities = useMyCapabilities()
  const postReceipt = usePostOrderDepositReceipt()
  const finalizeAdvanceMutation = useFinalizeAdvance()
  const [confirming, setConfirming] = useState(false)
  const [confirmingFinalizeInvoice, setConfirmingFinalizeInvoice] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [finalizeInvoiceError, setFinalizeInvoiceError] = useState<string | null>(null)
  const advance = target.advance

  const needsFinalize = advance.status === 'pending_posting' || advance.status === 'posting_unknown'
  const isAlreadyFinalized = Boolean(advance.appliedInvoiceId)
  const isPurchase = advance.sourceType === 'pre_purchase'
  // The route asks for `invoice.create`. The capability is not authorization;
  // the server checks it again — this only keeps a refused button off screen.
  const canFinalize = capabilities.can('invoice.create') === true

  const finalize = useCallback(async () => {
    setError(null)
    try {
      await postReceipt.mutateAsync({
        // An advance names itself as its document: `order_id = id`.
        orderId: advance.id,
        depositId: advance.id,
        customerId: advance.customerId ?? '',
      })
      setConfirming(false)
    } catch (err) {
      setError(apiErrorMessage(err, t('invoices.finalizeFailed', 'ثبت نشد. دوباره تلاش کنید.')))
    }
  }, [advance.customerId, advance.id, postReceipt, t])

  const handleFinalizeInvoice = useCallback(async () => {
    setFinalizeInvoiceError(null)
    try {
      const res = await finalizeAdvanceMutation.mutateAsync(advance.id)
      setConfirmingFinalizeInvoice(false)
      if (res?.invoice && typeof res.invoice === 'object' && 'id' in res.invoice) {
        onOpenInvoice?.(String(res.invoice.id))
      }
    } catch (err) {
      setFinalizeInvoiceError(
        apiErrorMessage(
          err,
          t('invoices.finalizeInvoiceFailed', 'ثبت نهایی فاکتور ناموفق بود. دوباره تلاش کنید.'),
        ),
      )
    }
  }, [advance.id, finalizeAdvanceMutation, onOpenInvoice, t])

  return (
    <>
      <ActionMenu
        label={t('invoices.actions', 'عملیات')}
        open={menu.open}
        placement={menu.placement}
        menuRef={menu.menuRef}
        anchorRef={menu.ref}
        onToggle={menu.toggle}
      >
        <button
          type="button"
          className={item}
          onClick={() => {
            menu.setOpen(false)
            onOpenParty?.(advance.customerId ?? '')
          }}
          disabled={!onOpenParty}
        >
          <Eye className="size-4" /> {t('invoices.openParty', 'مشاهده طرف حساب')}
        </button>
        {!isAlreadyFinalized && canFinalize ? (
          <button
            type="button"
            className={item}
            onClick={() => {
              menu.setOpen(false)
              setFinalizeInvoiceError(null)
              setConfirmingFinalizeInvoice(true)
            }}
          >
            <FileCheck className="size-4" /> {t('invoices.finalizeInvoice', 'ثبت نهایی فاکتور')}
          </button>
        ) : null}
        {needsFinalize && canFinalize ? (
          <button
            type="button"
            className={item}
            onClick={() => {
              menu.setOpen(false)
              setError(null)
              setConfirming(true)
            }}
          >
            <LockKeyhole className="size-4" /> {t('invoices.finalize', 'قطعی کردن')}
          </button>
        ) : null}
      </ActionMenu>

      <Dialog
        open={confirmingFinalizeInvoice}
        onOpenChange={(open) => {
          if (finalizeAdvanceMutation.isPending) return
          setConfirmingFinalizeInvoice(open)
          if (!open) setFinalizeInvoiceError(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isPurchase
                ? t('invoices.finalizePurchaseTitle', 'ثبت نهایی فاکتور خرید')
                : t('invoices.finalizeSaleTitle', 'ثبت نهایی فاکتور فروش')}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm leading-relaxed text-[hsl(var(--fg-secondary))]">
            {isPurchase
              ? t(
                  'invoices.finalizePurchaseBody',
                  'با ثبت نهایی، فاکتور خرید رسمی ایجاد شده، سند حسابداری ثبت و موجودی کالاهای خریداری‌شده به انبار اضافه خواهد شد.',
                )
              : t(
                  'invoices.finalizeSaleBody',
                  'با ثبت نهایی، فاکتور فروش رسمی ایجاد شده، سند حسابداری ثبت و موجودی کالاهای تحویل‌شده از انبار کسر خواهد شد.',
                )}
          </p>
          {finalizeInvoiceError ? (
            <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
              {finalizeInvoiceError}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmingFinalizeInvoice(false)}
              disabled={finalizeAdvanceMutation.isPending}
            >
              {t('action.cancel', 'انصراف')}
            </Button>
            <Button
              type="button"
              onClick={() => void handleFinalizeInvoice()}
              disabled={finalizeAdvanceMutation.isPending}
            >
              {finalizeAdvanceMutation.isPending
                ? t('invoices.finalizing', 'در حال ثبت…')
                : t('invoices.finalizeInvoice', 'ثبت نهایی فاکتور')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirming}
        onOpenChange={(open) => {
          if (postReceipt.isPending) return
          setConfirming(open)
          if (!open) setError(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('invoices.finalizeTitle', 'این پیش‌پرداخت قطعی شود؟')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[hsl(var(--fg-secondary))]">
            {t(
              'invoices.finalizeBody',
              'مبلغ دریافتی یک‌بار در دفتر ثبت می‌شود. اجرای دوباره چیزی اضافه نمی‌کند و موجودی یا فروش تغییر نمی‌کند.',
            )}
          </p>
          <UndoDisclosure t={t} route="POST /orders/:id/deposits/:depositId/post" />
          {error ? (
            <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirming(false)}
              disabled={postReceipt.isPending}
            >
              {t('action.cancel', 'انصراف')}
            </Button>
            <Button type="button" onClick={() => void finalize()} disabled={postReceipt.isPending}>
              {postReceipt.isPending
                ? t('invoices.finalizing', 'در حال ثبت…')
                : t('invoices.finalize', 'قطعی کردن')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
})

AdvanceRowActions.displayName = 'AdvanceRowActions'
