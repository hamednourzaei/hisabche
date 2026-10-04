'use client'

// ============================================
// «ترجمه‌ی سند» — translate the text of a financial document (#20).
//
// The person pastes the text of an invoice, a statement or a letter, picks the
// two languages, and gets the translation BESIDE the original.
//
// ⚠️ THE FIGURES ARE NOT THE MODEL'S. The server takes every number, date and
// document number out before the model sees the text and puts the originals
// back afterwards; if they do not all come back it refuses, and this screen
// says so instead of showing a document nobody can check.
// ⚠️ A TRANSLATION IS NOT AN ORIGINAL: the source stays on screen beside it.
// ⚠️ Nothing is saved. The translation is on this screen until it is copied.
// ============================================

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { formatNumber } from '@hisabche/formatting'
import { apiErrorMessage, useTranslateDocument, type DocumentTranslation } from '@hisabche/api'

import { cn } from '../../../lib/utils'
import { useIntlLocale } from '../../../hooks/use-intl-locale'
import { Button } from '../button'
import { SelectField } from '../select-field'

export const TRANSLATE_LANGUAGES = ['fa', 'af', 'en'] as const
type Language = (typeof TRANSLATE_LANGUAGES)[number]

/** The engine's limit, shown as a counter so the refusal is never a surprise. */
export const TRANSLATE_MAX_CHARACTERS = 8_000

/** Refusals with a translation. Anything else gets the general message. */
export const TRANSLATE_ERROR_CODES = [
  'TRANSLATE_SAME_LOCALE',
  'TRANSLATE_TOO_LONG',
  'TRANSLATE_NOTHING_TO_TRANSLATE',
  'TRANSLATE_FIGURE_ALTERED',
  'TRANSLATE_UNSUPPORTED_LOCALE',
  'AI_NOT_CONFIGURED',
  'AI_QUOTA_EXCEEDED',
  'AI_PROVIDER_BUSY',
  'AI_PROVIDER_ERROR',
] as const

const field =
  'h-10 w-full rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-3 text-sm text-[hsl(var(--fg-primary))] outline-none focus:border-[hsl(var(--color-primary))]'
const area =
  'min-h-48 w-full resize-y rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-3 text-sm leading-relaxed text-[hsl(var(--fg-primary))] outline-none focus:border-[hsl(var(--color-primary))]'
const label = 'block text-xs text-[hsl(var(--fg-secondary))]'

export function DocumentTranslateTool({ topupContact }: { topupContact?: string | undefined }) {
  const t = useTranslations('aiTranslate')
  const locale = useIntlLocale()
  const appLocale = useLocale()
  const translate = useTranslateDocument()

  const own = TRANSLATE_LANGUAGES.find((known) => known === appLocale) ?? 'fa'
  const [from, setFrom] = useState<Language>(own)
  const [to, setTo] = useState<Language>(own === 'en' ? 'fa' : 'en')
  const [text, setText] = useState('')
  const [result, setResult] = useState<DocumentTranslation | null>(null)
  const [copied, setCopied] = useState(false)

  const errorText = (error: unknown): string => {
    const raw = apiErrorMessage(error, '')
    const code = TRANSLATE_ERROR_CODES.find((known) => raw.includes(known))
    if (code === 'AI_QUOTA_EXCEEDED')
      return `${t('errors.AI_QUOTA_EXCEEDED')} ${topupContact ?? ''}`
    return code ? t(`errors.${code}`) : t('errors.general')
  }

  const options = TRANSLATE_LANGUAGES.map((code) => ({
    value: code,
    label: t(`languages.${code}`),
  }))
  const tooLong = text.length > TRANSLATE_MAX_CHARACTERS
  const ready = text.trim().length > 0 && !tooLong && from !== to

  const submit = () => {
    setCopied(false)
    translate.mutate({ text, from, to }, { onSuccess: setResult })
  }

  const copy = async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.text)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="flex-1 space-y-4 overflow-y-auto p-4">
      <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('intro')}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <span className={label}>{t('from')}</span>
          <SelectField
            name="from"
            data-field="from"
            aria-label={t('from')}
            value={from}
            onChange={(next) => setFrom(next as Language)}
            options={options}
            className={field}
          />
        </div>
        <div className="space-y-1">
          <span className={label}>{t('to')}</span>
          <SelectField
            name="to"
            data-field="to"
            aria-label={t('to')}
            value={to}
            onChange={(next) => setTo(next as Language)}
            options={options}
            className={field}
          />
        </div>
      </div>

      <label className="block space-y-1">
        <span className={label}>{t('source')}</span>
        <textarea
          name="text"
          dir="auto"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={t('sourcePlaceholder')}
          className={area}
        />
        <span
          className={cn(
            'block text-xs tabular-nums',
            tooLong ? 'text-[hsl(var(--color-destructive))]' : 'text-[hsl(var(--fg-tertiary))]',
          )}
        >
          {t('counter', {
            used: formatNumber(text.length, locale, 0),
            max: formatNumber(TRANSLATE_MAX_CHARACTERS, locale, 0),
          })}
        </span>
      </label>

      {from === to ? (
        <p className="text-xs text-[hsl(var(--fg-secondary))]">
          {t('errors.TRANSLATE_SAME_LOCALE')}
        </p>
      ) : null}

      <Button disabled={!ready || translate.isPending} onClick={submit}>
        {translate.isPending ? t('working') : t('translate')}
      </Button>

      {translate.error ? (
        <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
          {errorText(translate.error)}
        </p>
      ) : null}

      {result && !translate.isPending && !translate.error ? (
        <section className="space-y-3 border-t border-[hsl(var(--border-default))] pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-[hsl(var(--fg-primary))]">
              {t('result', { language: t(`languages.${result.to}`) })}
            </h2>
            <Button size="sm" variant="outline" onClick={copy}>
              {copied ? t('copied') : t('copy')}
            </Button>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="space-y-1">
              <span className={label}>{t('translation')}</span>
              <p dir="auto" className={cn(area, 'whitespace-pre-wrap')}>
                {result.text}
              </p>
            </div>
            <div className="space-y-1">
              <span className={label}>{t('original')}</span>
              <p dir="auto" className={cn(area, 'whitespace-pre-wrap')}>
                {result.source}
              </p>
            </div>
          </div>
          <p className="text-xs text-[hsl(var(--fg-tertiary))]">
            {t('figuresKept', { count: formatNumber(result.figuresSpotted, locale, 0) })}
          </p>
        </section>
      ) : null}

      <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t('note')}</p>
    </div>
  )
}
