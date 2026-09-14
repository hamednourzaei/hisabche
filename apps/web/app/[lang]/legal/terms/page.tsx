// apps/web/app/[lang]/legal/terms/page.tsx
import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { locales, resolveLocale } from '../../i18n-config'
import { LegalPageClient } from '../LegalPageClient'
import { buildLegalMetadata } from '../legal-metadata'

const titles: Record<string, string> = {
  fa: 'شرایط استفاده — حسابچه',
  af: 'شرایط استفاده — حسابچه',
  en: 'Terms of Use — Hisabche',
}

const descriptions: Record<string, string> = {
  fa: 'شرایط و ضوابط استفاده از نرم‌افزار حسابداری حسابچه.',
  af: 'شرایط و ضوابط استفاده از نرم‌افزار حسابداری حسابچه.',
  en: 'Terms and conditions for using the Hisabche accounting software.',
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const { lang } = await params
  return buildLegalMetadata({
    lang,
    path: '/legal/terms',
    title: titles[lang] || titles['fa'],
    description: descriptions[lang] || descriptions['fa'],
  })
}

// Built ahead per locale; the locale comes from the route (see layout.tsx).
export function generateStaticParams() {
  return locales.map((lang) => ({ lang }))
}

export default async function TermsPage({ params }: { params: Promise<{ lang: string }> }) {
  setRequestLocale(resolveLocale((await params).lang))
  return (
    <LegalPageClient
      titleKey="landing.legalPage.termsTitle"
      titleFallback="Terms of Use"
      introKey="landing.legalPage.termsIntro"
      introFallback="By using Hisabche, you agree to the terms below."
      sectionsKey="landing.legalPage.termsSections"
    />
  )
}
