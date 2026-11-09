// ============================================
// «صورت‌حساب جدید» — ONE button for every kind of document on /invoices
// (owner request, 8 Nov 2026).
//
// Pressing it blurs the page and opens a vertical column of four choices —
// sale, purchase, pre-sale, pre-purchase — each going to /invoices/new with
// its `?type=`. Nothing is created until the reader picks one; Escape or a
// click on the blurred page closes it.
// ============================================

'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowDownLeft, ArrowUpRight, HandCoins, PackagePlus, Plus, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type * as React from 'react'
import { cn } from '../../../lib/utils'

export type NewDocumentKind = 'sale' | 'purchase' | 'pre_sale' | 'pre_purchase'

export const NEW_DOCUMENT_KINDS: readonly NewDocumentKind[] = [
  'sale',
  'purchase',
  'pre_sale',
  'pre_purchase',
]

const KIND_ICON: Record<NewDocumentKind, LucideIcon> = {
  sale: ArrowUpRight,
  purchase: ArrowDownLeft,
  pre_sale: HandCoins,
  pre_purchase: PackagePlus,
}

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))] focus-visible:ring-offset-2'

const MENU_WIDTH = 240 // w-60
const EDGE = 12

/**
 * Where the column of choices goes. It hangs from the button, aligned to its
 * start edge, but is pushed back inside the screen when the button sits near
 * an edge (owner report, 9 Nov 2026: in Persian the column ran off the left
 * side). Below 768px it is centred, like every other menu.
 */
function menuPlacement(anchor: {
  top: number
  left: number
  right: number
  rtl: boolean
}): React.CSSProperties {
  const width = window.innerWidth
  if (width < 768) {
    return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
  }
  const room = Math.max(EDGE, width - MENU_WIDTH - EDGE)
  const left = anchor.rtl ? anchor.right - MENU_WIDTH : anchor.left
  return { top: anchor.top, left: Math.min(Math.max(EDGE, left), room) }
}

export function NewInvoiceChooser({
  t,
  onChoose,
}: {
  t: (key: string) => string
  onChoose: (kind: NewDocumentKind) => void
}) {
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState<{
    top: number
    left: number
    right: number
    rtl: boolean
  } | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const firstRef = useRef<HTMLButtonElement | null>(null)
  const menuId = useId()

  const close = useCallback(() => {
    setOpen(false)
    triggerRef.current?.focus()
  }, [])

  const toggle = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect && triggerRef.current) {
      setAnchor({
        top: rect.bottom + 8,
        left: rect.left,
        right: rect.right,
        rtl: getComputedStyle(triggerRef.current).direction === 'rtl',
      })
    }
    setOpen((value) => !value)
  }, [])

  useEffect(() => {
    if (!open) return
    firstRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
      }
    }
    const onResize = () => setOpen(false)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
    }
  }, [open, close])

  const choose = (kind: NewDocumentKind) => {
    setOpen(false)
    onChoose(kind)
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        data-new-invoice-trigger=""
        className={cn(
          'inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-4 sm:px-5',
          'min-h-[44px] sm:min-h-[40px]',
          'text-sm font-bold text-[hsl(var(--color-primary-fg))]',
          'bg-[hsl(var(--color-primary))]',
          'shadow-sm shadow-[hsl(var(--color-primary)/0.15)]',
          'transition-all duration-200 hover:brightness-110 active:scale-[0.98]',
          FOCUS_RING,
          'motion-reduce:transition-none motion-reduce:active:scale-100',
        )}
      >
        {open ? (
          <X className="size-4 sm:size-[18px]" aria-hidden="true" />
        ) : (
          <Plus className="size-4 sm:size-[18px]" aria-hidden="true" />
        )}
        <span className="whitespace-nowrap">{t('invoices.newinvoices')}</span>
      </button>

      {open && anchor && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 z-[60]" data-new-invoice-layer="">
              <div
                aria-hidden="true"
                onClick={close}
                className="absolute inset-0 bg-[hsl(var(--surface-base)/0.55)] backdrop-blur-sm motion-reduce:backdrop-blur-none"
              />
              <div
                id={menuId}
                role="menu"
                aria-label={t('invoices.newDocument.label')}
                className="absolute flex max-h-[calc(100dvh-2rem)] w-60 flex-col gap-2 overflow-y-auto overscroll-contain animate-in fade-in slide-in-from-top-2 duration-150 motion-reduce:animate-none"
                style={menuPlacement(anchor)}
              >
                {NEW_DOCUMENT_KINDS.map((kind, index) => {
                  const Icon = KIND_ICON[kind]
                  return (
                    <button
                      key={kind}
                      ref={index === 0 ? firstRef : undefined}
                      type="button"
                      role="menuitem"
                      data-new-document={kind}
                      onClick={() => choose(kind)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-2xl border border-[hsl(var(--border-default))] px-4 py-3 text-start',
                        'bg-[hsl(var(--surface-elevated))] shadow-lg',
                        'transition-colors hover:border-[hsl(var(--color-primary)/0.5)] hover:bg-[hsl(var(--surface-muted))]',
                        FOCUS_RING,
                      )}
                    >
                      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))]">
                        <Icon className="size-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-[hsl(var(--fg-primary))]">
                          {t(`invoices.newDocument.${kind}`)}
                        </span>
                        <span className="block text-xs text-[hsl(var(--fg-tertiary))]">
                          {t(`invoices.newDocument.${kind}Hint`)}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
