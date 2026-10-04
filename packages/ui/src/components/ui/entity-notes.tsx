'use client'

// ============================================
// «یادداشت‌ها» — what colleagues wrote about this customer, supplier, product
// or employee (#103). Drop it on any page that shows one of them.
//
// A log: a note is added and stays as written — no edit, no delete, and the
// hint under the box says so before the person writes.
//
// Loads only when opened. «Not set up», «not allowed», «failed» and «none yet»
// are four different sentences.
// ============================================

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { StickyNote } from 'lucide-react'
import {
  apiErrorMessage,
  useAddEntityNote,
  useEntityNotes,
  type NoteEntityType,
} from '@hisabche/api'

import { cn } from '../../lib/utils'
import { useDateFormat } from '../../hooks/use-date-format'
import { Button } from './button'

export const NOTE_ERROR_CODES = [
  'NOTE_EMPTY_BODY',
  'NOTE_BODY_TOO_LONG',
  'NOTES_MIGRATION_PENDING',
] as const
export const MAX_NOTE_LENGTH = 4000

export function EntityNotes({
  entityType,
  entityId,
  className,
}: {
  entityType: NoteEntityType
  entityId: string
  className?: string | undefined
}) {
  const t = useTranslations('notes')
  const { date } = useDateFormat()
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState('')
  const notes = useEntityNotes(entityType, entityId, open)
  const add = useAddEntityNote(entityType, entityId)

  const message = (error: unknown): string => {
    if ((error as { response?: { status?: number } } | null)?.response?.status === 403)
      return t('forbidden')
    const raw = apiErrorMessage(error, '')
    const code = NOTE_ERROR_CODES.find((known) => raw.includes(known))
    return code ? t(`errors.${code}`) : t('errors.general')
  }

  return (
    <section
      className={cn(
        'space-y-3 rounded-2xl border border-[hsl(var(--border-default))] p-4',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold text-[hsl(var(--fg-primary))]">
          <StickyNote className="size-4 text-[hsl(var(--color-primary))]" aria-hidden="true" />
          {t('title')}
        </h3>
        <Button size="sm" variant="ghost" onClick={() => setOpen((value) => !value)}>
          {open ? t('hide') : t('show')}
        </Button>
      </div>

      {open && notes.isLoading ? (
        <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('loading')}</p>
      ) : null}
      {open && notes.error ? (
        <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
          {message(notes.error)}
        </p>
      ) : null}

      {open && notes.data ? (
        <>
          <div className="space-y-2">
            <textarea
              name="body"
              value={body}
              maxLength={MAX_NOTE_LENGTH}
              onChange={(event) => setBody(event.target.value)}
              placeholder={t('placeholder')}
              aria-label={t('placeholder')}
              rows={3}
              className="w-full rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-3 text-sm text-[hsl(var(--fg-primary))] outline-none focus:border-[hsl(var(--color-primary))]"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t('permanent')}</p>
              <Button
                size="sm"
                disabled={add.isPending || body.trim().length === 0}
                onClick={() => add.mutate(body, { onSuccess: () => setBody('') })}
              >
                {t('add')}
              </Button>
            </div>
            {add.error ? (
              <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
                {message(add.error)}
              </p>
            ) : null}
          </div>

          {notes.data.length === 0 ? (
            <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('empty')}</p>
          ) : (
            <ul className="space-y-2">
              {notes.data.map((note) => (
                <li key={note.id} className="rounded-xl bg-[hsl(var(--surface-muted))] p-3 text-sm">
                  <p className="whitespace-pre-wrap text-[hsl(var(--fg-primary))]" dir="auto">
                    {note.body}
                  </p>
                  <p className="mt-1 text-xs text-[hsl(var(--fg-tertiary))]">
                    {date(note.createdAt)}
                    {note.mine ? ` · ${t('mine')}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </section>
  )
}
