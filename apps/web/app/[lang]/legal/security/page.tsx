// apps/web/app/[lang]/legal/security/page.tsx
import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { locales, resolveLocale } from '../../i18n-config'
import { LegalPageClient } from '../LegalPageClient'
import { buildLegalMetadata } from '../legal-metadata'

const titles: Record<string, string> = {
  fa: 'امنیت — حسابچه',
  af: 'امنیت — حسابچه',
  en: 'Security — Hisabche',
}

const descriptions: Record<string, string> = {
  fa: 'این‌که حسابچه چگونه از داده‌های شما محافظت می‌کند.',
  af: 'این‌که حسابچه چگونه از معلومات شما محافظت می‌کند.',
  en: 'How Hisabche protects your data.',
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const { lang } = await params
  return buildLegalMetadata({
    lang,
    path: '/legal/security',
    title: titles[lang] || titles['fa'],
    description: descriptions[lang] || descriptions['fa'],
  })
}

// Built ahead per locale; the locale comes from the route (see layout.tsx).
export function generateStaticParams() {
  return locales.map((lang) => ({ lang }))
}

export default async function SecurityPage({ params }: { params: Promise<{ lang: string }> }) {
  setRequestLocale(resolveLocale((await params).lang))
  return (
    <LegalPageClient
      titleKey="landing.legalPage.securityTitle"
      titleFallback="Security"
      introKey="landing.legalPage.securityIntro"
      introFallback="An overview of how Hisabche protects your business data."
      sectionsKey="landing.legalPage.securitySections"
    />
  )
}
