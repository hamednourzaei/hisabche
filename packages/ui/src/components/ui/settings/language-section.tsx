// ============================================
// «زبان برنامه» — the same section on web, Windows and Android.
//
// Below a tablet the header no longer carries a language picker, so this is
// where language is changed after onboarding. It renders the host's own
// options and calls the host's own switch (lib/language-switch.tsx).
// ============================================
'use client'

import { memo } from 'react'
import { useTranslations } from 'next-intl'
import { Languages } from 'lucide-react'

import { SelectField } from '../select-field'
import { useLanguageSwitch } from '../../../lib/language-switch'

const card =
  'rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]'

export const LanguageSection = memo(function LanguageSection() {
  const t = useTranslations()
  const language = useLanguageSwitch()
  if (!language) return null

  return (
    <section className={`${card} p-5`} aria-labelledby="app-language-title">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-secondary))]">
          <Languages className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <h2
            id="app-language-title"
            className="text-sm font-semibold text-[hsl(var(--fg-primary))]"
          >
            {t('settings.appLanguage')}
          </h2>
          <SelectField
            name="language"
            aria-label={t('settings.appLanguage')}
            value={language.current}
            onChange={language.change}
            options={language.options.map((option) => ({
              value: option.code,
              label: option.label,
            }))}
          />
        </div>
      </div>
    </section>
  )
})
