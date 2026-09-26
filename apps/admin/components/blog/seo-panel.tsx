'use client'

// The SEO side panel. The checklist is GUIDANCE ONLY — it never blocks saving
// or publishing (seoChecklist in @hisabche/validation, shared with the tests).
import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Check, X } from 'lucide-react'
import {
  SEO_META_DESCRIPTION,
  SEO_META_TITLE,
  SEO_MIN_INTERNAL_LINKS,
  SEO_MIN_WORDS,
  seoChecklist,
  type BlogLocale,
} from '@hisabche/validation'

import { Input } from '@/components/ui'
import { Panel } from '@/components/admin-shell/admin-ui'
import { cn } from '@/lib/utils'

export interface SeoFields {
  focusKeyword: string
  keywords: string
  metaTitle: string
  metaDescription: string
  slug: string
  canonicalUrl: string
  ogImageUrl: string
  noindex: boolean
}

function Counter({ length, min, max }: { length: number; min: number; max: number }) {
  const ok = length >= min && length <= max
  return (
    <span
      className={cn('text-xs tabular-nums', ok ? 'text-success' : 'text-muted-foreground')}
      dir="ltr"
    >
      {length} / {min}–{max}
    </span>
  )
}

export function SeoPanel({
  locale,
  title,
  html,
  fields,
  onChange,
  errorFor,
}: {
  locale: BlogLocale
  title: string
  html: string
  fields: SeoFields
  onChange: (patch: Partial<SeoFields>) => void
  errorFor: (field: string) => string | null
}) {
  const t = useTranslations()
  const checks = useMemo(
    () =>
      seoChecklist({
        title,
        metaTitle: fields.metaTitle || null,
        metaDescription: fields.metaDescription || null,
        focusKeyword: fields.focusKeyword || null,
        html,
        locale,
      }),
    [title, fields.metaTitle, fields.metaDescription, fields.focusKeyword, html, locale],
  )
  const previewTitle = (fields.metaTitle || title || t('admin.blog.seo.untitled')).slice(
    0,
    SEO_META_TITLE.max,
  )
  const previewDescription = fields.metaDescription.slice(0, SEO_META_DESCRIPTION.max)
  const passed = checks.filter((c) => c.pass).length

  const field = (
    key: keyof SeoFields,
    labelKey: string,
    props: React.ComponentProps<typeof Input> = {},
  ) => {
    const error = errorFor(key)
    return (
      <label className="block space-y-1">
        <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          {t(`admin.blog.seo.${labelKey}`)}
          {key === 'metaTitle' ? (
            <Counter
              length={(fields.metaTitle || title).length}
              min={SEO_META_TITLE.min}
              max={SEO_META_TITLE.max}
            />
          ) : null}
          {key === 'metaDescription' ? (
            <Counter
              length={fields.metaDescription.length}
              min={SEO_META_DESCRIPTION.min}
              max={SEO_META_DESCRIPTION.max}
            />
          ) : null}
        </span>
        <Input
          name={key}
          value={String(fields[key])}
          aria-invalid={error ? true : undefined}
          onChange={(e) => onChange({ [key]: e.target.value } as Partial<SeoFields>)}
          {...props}
        />
        {error ? <span className="block text-xs text-destructive">{error}</span> : null}
      </label>
    )
  }

  return (
    <Panel className="space-y-4 p-4" as="section">
      <h2 className="text-sm font-semibold">{t('admin.blog.seo.title')}</h2>

      <div
        className="space-y-1 rounded-xl border border-border p-3"
        aria-label={t('admin.blog.seo.preview')}
      >
        <p className="text-xs text-muted-foreground">{t('admin.blog.seo.preview')}</p>
        <p className="truncate text-xs text-success" dir="ltr">
          hisabche.com › {locale} › blog › {fields.slug || '…'}
        </p>
        <p className="line-clamp-1 text-base font-medium text-[hsl(var(--color-primary))]">
          {previewTitle}
        </p>
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {previewDescription || t('admin.blog.seo.noDescription')}
        </p>
      </div>

      {field('focusKeyword', 'focusKeyword')}
      {field('keywords', 'keywords', { placeholder: t('admin.blog.seo.keywordsHint') })}
      {field('metaTitle', 'metaTitle', { placeholder: title })}
      {field('metaDescription', 'metaDescription')}
      {field('slug', 'slug', { dir: 'ltr' })}
      {field('canonicalUrl', 'canonicalUrl', { dir: 'ltr', placeholder: 'https://hisabche.com/…' })}
      {field('ogImageUrl', 'ogImageUrl', { dir: 'ltr', placeholder: 'https://…' })}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={fields.noindex}
          onChange={(e) => onChange({ noindex: e.target.checked })}
        />
        {t('admin.blog.seo.noindex')}
      </label>

      <div>
        <p className="mb-2 text-xs font-semibold">
          {t('admin.blog.seo.checklist', { passed, total: checks.length })}
        </p>
        <ul className="space-y-1.5 text-xs">
          {checks.map((check) => (
            <li key={check.id} className="flex items-start gap-2">
              {check.pass ? (
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
              ) : (
                <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" />
              )}
              <span className={check.pass ? 'text-muted-foreground' : undefined}>
                {t(`admin.blog.seo.checks.${check.id}`, {
                  value: check.value ?? 0,
                  minWords: SEO_MIN_WORDS,
                  minLinks: SEO_MIN_INTERNAL_LINKS,
                })}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-muted-foreground">{t('admin.blog.seo.guidanceOnly')}</p>
      </div>
    </Panel>
  )
}
