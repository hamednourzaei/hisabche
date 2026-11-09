'use client'

// ============================================
// Settings, compact (owner request, 9 Nov 2026):
//
//  · `SettingsQuickChips` — the small, rarely changed settings (language,
//    books currency, time zone and branches, backup, performance, storage)
//    are one row of titled chips under the account card. A chip opens its
//    section in a centred dialog; the section itself is unchanged.
//  · `SettingsCollapsible` — a long section (barcode scanner, business
//    profile, pages and tabs) closed by default, opened with its chevron.
//  · `SettingsLinkRow` — the «go to another page» cards side by side.
// ============================================

import { useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import type { LucideIcon } from 'lucide-react'
import { ChevronDown } from 'lucide-react'

import { cn } from '../../../lib/utils'
import { Dialog, DialogContent, DialogTitle } from '../dialog'

export interface QuickSetting {
  id: string
  icon: LucideIcon
  /** A message key. */
  titleKey: string
  render: () => ReactNode
}

export function SettingsQuickChips({ items }: { items: readonly QuickSetting[] }) {
  const t = useTranslations()
  const tr = (key: string) => t(key as Parameters<typeof t>[0])
  const [openId, setOpenId] = useState<string | null>(null)
  const open = items.find((item) => item.id === openId) ?? null

  return (
    <>
      <div
        data-settings-quick=""
        aria-label={tr('settings.quick.label')}
        role="group"
        className="grid grid-cols-2 gap-2 sm:grid-cols-3"
      >
        {items.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              type="button"
              data-quick-setting={item.id}
              onClick={() => setOpenId(item.id)}
              className={cn(
                'flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-start text-sm font-medium',
                'border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] text-[hsl(var(--fg-primary))]',
                'transition-colors hover:bg-[hsl(var(--surface-muted))]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))]',
              )}
            >
              <Icon
                className="size-4 shrink-0 text-[hsl(var(--color-primary))]"
                aria-hidden="true"
              />
              <span className="min-w-0 truncate">{tr(item.titleKey)}</span>
            </button>
          )
        })}
      </div>
      <Dialog open={open !== null} onOpenChange={(next) => (next ? undefined : setOpenId(null))}>
        {open ? (
          <DialogContent className="max-w-xl">
            <DialogTitle className="sr-only">{tr(open.titleKey)}</DialogTitle>
            {open.render()}
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  )
}

export function SettingsCollapsible({
  id,
  icon: Icon,
  titleKey,
  children,
}: {
  id: string
  icon: LucideIcon
  titleKey: string
  children: ReactNode
}) {
  const t = useTranslations()
  const tr = (key: string) => t(key as Parameters<typeof t>[0])
  const [open, setOpen] = useState(false)
  const panelId = `settings-collapsible-${id}`

  return (
    <div data-settings-collapsible={id} className="space-y-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-start',
          'border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]',
          'transition-colors hover:bg-[hsl(var(--surface-muted))]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))]',
        )}
      >
        <Icon className="size-5 shrink-0 text-[hsl(var(--color-primary))]" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate font-semibold text-[hsl(var(--fg-primary))]">
          {tr(titleKey)}
        </span>
        <span className="sr-only">
          {open ? tr('settings.quick.collapse') : tr('settings.quick.expand')}
        </span>
        <ChevronDown
          className={cn(
            'size-5 shrink-0 text-[hsl(var(--fg-tertiary))] transition-transform motion-reduce:transition-none',
            open && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </button>
      {open ? <div id={panelId}>{children}</div> : null}
    </div>
  )
}

/** Cards that only lead to another page, side by side instead of stacked. */
export function SettingsLinkRow({ children }: { children: ReactNode }) {
  return (
    <div
      data-settings-links=""
      className="grid gap-3 sm:grid-cols-3 sm:[&>a]:flex-col sm:[&>a]:items-start sm:[&>a>svg:last-child]:hidden sm:[&_.truncate]:whitespace-normal"
    >
      {children}
    </div>
  )
}
