// ============================================
// «نماها» — saved views of a table (capabilities #87 and #89), on every table
// that uses the shared DataTable.
//
// A view is the table's LOOK under a name: hidden columns, sort, search.
// Applying one changes how the rows are shown; it never changes which rows the
// reader may see, and it carries no selection.
//
// The button has no data hooks; the panel (and its request) mounts only when
// it is opened, so a page of tables does not fetch a list per table on load.
// ============================================

'use client'

import { memo, useEffect, useRef, useState } from 'react'
import { Bookmark, Share2, Trash2 } from 'lucide-react'
import {
  apiErrorMessage,
  useCreateSavedView,
  useRemoveSavedView,
  useSavedViews,
  useUpdateSavedView,
  type SavedViewLook,
} from '@hisabche/api'

import { cn } from '../../../lib/utils'
import { FOCUS_RING } from '../focus-ring'

type T = (key: string, fallback?: string) => string

/** Refusals the panel can show, each with a sentence in the catalogue. */
export const SAVED_VIEW_ERROR_CODES = [
  'SAVED_VIEW_NAME_TAKEN',
  'SAVED_VIEWS_MIGRATION_PENDING',
] as const
const KNOWN: ReadonlySet<string> = new Set(SAVED_VIEW_ERROR_CODES)

function errorText(t: T, error: unknown, fallback: string): string {
  const message = apiErrorMessage(error, '')
  if (!message) return fallback
  return KNOWN.has(message) ? t(`table.views.errors.${message}`, message) : message
}

export interface SavedViewsMenuProps {
  t: T
  tableId: string
  /** The table as it looks now — what «save» stores. */
  current: SavedViewLook
  onApply: (look: SavedViewLook) => void
}

export const SavedViewsMenu = memo(function SavedViewsMenu(props: SavedViewsMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const label = props.t('table.views.title', 'نماهای ذخیره‌شده')

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent): void {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onPointerDown)
    return () => window.removeEventListener('mousedown', onPointerDown)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        title={label}
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'inline-flex size-9 items-center justify-center rounded-xl',
          'border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))]',
          'hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]',
          FOCUS_RING,
          open && 'bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-primary))]',
        )}
      >
        <Bookmark className="size-4" aria-hidden="true" />
      </button>
      {open ? <Panel {...props} onClose={() => setOpen(false)} /> : null}
    </div>
  )
})

function Panel({
  t,
  tableId,
  current,
  onApply,
  onClose,
}: SavedViewsMenuProps & { onClose: () => void }) {
  const views = useSavedViews(tableId)
  const create = useCreateSavedView()
  const update = useUpdateSavedView()
  const remove = useRemoveSavedView()
  const [name, setName] = useState('')
  const [shared, setShared] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const trimmed = name.trim()

  return (
    <div
      role="dialog"
      aria-label={t('table.views.title', 'نماهای ذخیره‌شده')}
      className={cn(
        'absolute end-0 z-30 mt-1.5 w-72 rounded-xl p-2',
        'border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] shadow-xl',
      )}
    >
      <span className="block px-1 pb-1 text-[11px] font-semibold text-[hsl(var(--fg-tertiary))]">
        {t('table.views.title', 'نماهای ذخیره‌شده')}
      </span>

      {views.isLoading ? (
        <div className="h-9 animate-pulse rounded-lg bg-[hsl(var(--surface-muted))]" />
      ) : views.error ? (
        // A failed read is said as one — not shown as «no views yet».
        <p role="alert" className="px-1 py-1 text-xs text-[hsl(var(--color-destructive))]">
          {errorText(t, views.error, t('table.views.loadFailed', 'نماها خوانده نشد.'))}
        </p>
      ) : (views.data ?? []).length === 0 ? (
        <p className="px-1 py-1 text-xs text-[hsl(var(--fg-secondary))]">
          {t('table.views.empty', 'هنوز نمایی ذخیره نکرده‌اید.')}
        </p>
      ) : (
        <ul className="max-h-56 space-y-0.5 overflow-y-auto">
          {(views.data ?? []).map((view) => (
            <li key={view.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  onApply(view.state)
                  onClose()
                }}
                className="min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-start text-sm text-[hsl(var(--fg-primary))] hover:bg-[hsl(var(--surface-muted))]"
              >
                {view.name}
                {!view.mine ? (
                  <span className="ms-1.5 text-[11px] text-[hsl(var(--fg-tertiary))]">
                    {t('table.views.sharedWithYou', 'مشترک')}
                  </span>
                ) : null}
              </button>
              {view.mine ? (
                <>
                  <button
                    type="button"
                    aria-pressed={view.shared}
                    title={
                      view.shared
                        ? t('table.views.unshare', 'دیگر با همکاران مشترک نباشد')
                        : t('table.views.share', 'با همکاران مشترک شود')
                    }
                    aria-label={
                      view.shared
                        ? t('table.views.unshare', 'دیگر با همکاران مشترک نباشد')
                        : t('table.views.share', 'با همکاران مشترک شود')
                    }
                    onClick={() =>
                      update.mutate(
                        { id: view.id, shared: !view.shared },
                        {
                          onError: (error) =>
                            setProblem(
                              errorText(t, error, t('table.views.saveFailed', 'ذخیره نشد.')),
                            ),
                        },
                      )
                    }
                    className={cn(
                      'rounded-lg p-1.5 hover:bg-[hsl(var(--surface-muted))]',
                      view.shared
                        ? 'text-[hsl(var(--color-primary))]'
                        : 'text-[hsl(var(--fg-tertiary))]',
                    )}
                  >
                    <Share2 className="size-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    title={t('action.delete', 'حذف')}
                    aria-label={t('action.delete', 'حذف')}
                    onClick={() =>
                      remove.mutate(view.id, {
                        onError: (error) =>
                          setProblem(
                            errorText(t, error, t('table.views.saveFailed', 'ذخیره نشد.')),
                          ),
                      })
                    }
                    className="rounded-lg p-1.5 text-[hsl(var(--color-destructive))] hover:bg-[hsl(var(--color-destructive)/0.08)]"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </button>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <form
        className="mt-2 space-y-1.5 border-t border-[hsl(var(--border-default))] pt-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (!trimmed) return
          setProblem(null)
          create.mutate(
            { tableId, name: trimmed, state: current, shared },
            {
              onSuccess: () => {
                setName('')
                setShared(false)
              },
              onError: (error) =>
                setProblem(errorText(t, error, t('table.views.saveFailed', 'ذخیره نشد.'))),
            },
          )
        }}
      >
        <input
          name="name"
          value={name}
          maxLength={60}
          onChange={(event) => setName(event.target.value)}
          placeholder={t('table.views.namePlaceholder', 'نام نمای فعلی')}
          aria-label={t('table.views.namePlaceholder', 'نام نمای فعلی')}
          className={cn(
            'h-9 w-full rounded-lg px-2 text-sm',
            'border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))]',
            'text-[hsl(var(--fg-primary))] placeholder:text-[hsl(var(--fg-tertiary))]',
          )}
        />
        <label className="flex items-center gap-2 px-1 text-xs text-[hsl(var(--fg-secondary))]">
          <input
            type="checkbox"
            checked={shared}
            onChange={(event) => setShared(event.target.checked)}
            className="size-4 accent-[hsl(var(--color-primary))]"
          />
          {t('table.views.shareOnSave', 'همکاران هم این نما را ببینند')}
        </label>
        <button
          type="submit"
          disabled={!trimmed || create.isPending}
          className={cn(
            'h-9 w-full rounded-lg text-sm font-medium',
            'bg-[hsl(var(--color-primary))] text-white disabled:opacity-40',
          )}
        >
          {t('table.views.save', 'ذخیره‌ی نمای فعلی')}
        </button>
        {problem ? (
          <p role="alert" className="px-1 text-xs text-[hsl(var(--color-destructive))]">
            {problem}
          </p>
        ) : null}
      </form>
    </div>
  )
}
