// apps/web/app/[lang]/legal/gdpr/page.tsx
import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { locales, resolveLocale } from '../../i18n-config'
import { LegalPageClient } from '../LegalPageClient'
import { buildLegalMetadata } from '../legal-metadata'

const titles: Record<string, string> = {
  fa: 'حقوق حریم خصوصی (GDPR) — حسابچه',
  af: 'حقوق محرمیت (GDPR) — حسابچه',
  en: 'GDPR & Privacy Rights — Hisabche',
}

const descriptions: Record<string, string> = {
  fa: 'حقوق شما بر داده‌های شخصی خود و نحوه‌ی اعمال آن‌ها در حسابچه.',
  af: 'حقوق شما بر معلومات شخصی خود و نحوه‌ی اعمال آن‌ها در حسابچه.',
  en: 'Your rights over your personal data and how to exercise them at Hisabche.',
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const { lang } = await params
  return buildLegalMetadata({
    lang,
    path: '/legal/gdpr',
    title: titles[lang] || titles['fa'],
    description: descriptions[lang] || descriptions['fa'],
  })
}

// Built ahead per locale; the locale comes from the route (see layout.tsx).
export function generateStaticParams() {
  return locales.map((lang) => ({ lang }))
}

export default async function GdprPage({ params }: { params: Promise<{ lang: string }> }) {
  setRequestLocale(resolveLocale((await params).lang))
  return (
    <LegalPageClient
      titleKey="landing.legalPage.gdprTitle"
      titleFallback="GDPR & Privacy Rights"
      introKey="landing.legalPage.gdprIntro"
      introFallback="An overview of your data-protection rights and how to exercise them."
      sectionsKey="landing.legalPage.gdprSections"
    />
  )
}
