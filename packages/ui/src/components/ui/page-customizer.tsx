'use client'

// ============================================
// The wrench — «شخصی‌سازی این صفحه». ONE component for every page that lets a
// person choose what they see on it (lib/page-look.ts).
//
// It lists what the page offers, each with a switch; a hidden part is not
// mounted by the page, so it costs nothing. «بازگردانی پیش‌فرض» shows
// everything again. The dialog says plainly that this is the person's own
// view: it changes nobody else's page and nobody's access.
//
// A page passes one or more GROUPS, each with the look it belongs to — the
// dashboard's own parts, and the menu, are two looks edited in one place.
//
// `keepOne` — the page cannot be emptied (a hub with every section hidden is a
// blank screen with no way back but this dialog).
// ============================================

import { useState } from 'react'
import { RotateCcw, Wrench } from 'lucide-react'

import type { PageLook } from '../../lib/page-look'
import { cn } from '../../lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './dialog'
import { Switch } from './switch'

export interface CustomizerItem {
  id: string
  label: string
}

export interface CustomizerGroup {
  /** Shown above the group when the page has more than one. */
  title?: string | undefined
  look: PageLook
  items: readonly CustomizerItem[]
  /** At least one item of this group stays visible. */
  keepOne?: boolean | undefined
}

export function PageCustomizer({
  t,
  groups,
  className,
}: {
  t: (key: string, fallback?: string) => string
  groups: readonly CustomizerGroup[]
  className?: string | undefined
}) {
  const [open, setOpen] = useState(false)
  const offered = groups.filter((group) => group.items.length > 0)
  const hiddenCount = offered.reduce(
    (count, group) => count + group.items.filter((item) => !group.look.shows(item.id)).length,
    0,
  )
  // Nothing to choose, or nobody to remember the choice for.
  if (offered.length === 0 || !offered.some((group) => group.look.ready)) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-page-customizer=""
        aria-label={t('pageLook.open', 'شخصی‌سازی این صفحه')}
        title={t('pageLook.open', 'شخصی‌سازی این صفحه')}
        className={cn(
          'relative inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))] transition-colors hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]',
          className,
        )}
      >
        <Wrench className="size-4" aria-hidden="true" />
        {/* The absence of a mark is not a mark: say that something is hidden. */}
        {hiddenCount > 0 ? (
          <span className="absolute -end-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-[hsl(var(--color-primary))] px-1 text-[10px] font-bold leading-4 text-[hsl(var(--color-primary-fg))]">
            {hiddenCount}
          </span>
        ) : null}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md" data-page-customizer-dialog="">
          <DialogHeader>
            <DialogTitle>{t('pageLook.title', 'شخصی‌سازی این صفحه')}</DialogTitle>
            <DialogDescription>
              {t(
                'pageLook.hint',
                'هر چیزی را که خاموش کنید فقط برای خودِ شما پنهان می‌شود و دیگر بارگذاری هم نمی‌شود. دسترسی هیچ‌کس تغییر نمی‌کند.',
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {offered.map((group, index) => {
              const visible = group.items.filter((item) => group.look.shows(item.id)).length
              return (
                <section key={group.title ?? index} className="space-y-2">
                  {group.title && offered.length > 1 ? (
                    <h3 className="text-xs font-semibold text-[hsl(var(--fg-tertiary))]">
                      {group.title}
                    </h3>
                  ) : null}
                  <ul className="divide-y divide-[hsl(var(--border-default))] rounded-xl border border-[hsl(var(--border-default))]">
                    {group.items.map((item) => {
                      const shown = group.look.shows(item.id)
                      const last = group.keepOne === true && shown && visible === 1
                      return (
                        <li
                          key={item.id}
                          className="flex items-center justify-between gap-3 px-3 py-2.5"
                        >
                          <span className="min-w-0 truncate text-sm text-[hsl(var(--fg-primary))]">
                            {item.label}
                          </span>
                          <Switch
                            size="sm"
                            checked={shown}
                            disabled={last}
                            aria-label={item.label}
                            onCheckedChange={() => group.look.toggle(item.id)}
                          />
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )
            })}
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={hiddenCount === 0}
              onClick={() => {
                for (const group of offered) group.look.reset()
              }}
              className="inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm text-[hsl(var(--fg-secondary))] hover:text-[hsl(var(--fg-primary))] disabled:opacity-50"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              {t('pageLook.reset', 'بازگردانی پیش‌فرض')}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex min-h-9 items-center whitespace-nowrap rounded-full bg-[hsl(var(--color-primary))] px-5 text-sm font-bold text-[hsl(var(--color-primary-fg))]"
            >
              {t('pageLook.done', 'تمام')}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
