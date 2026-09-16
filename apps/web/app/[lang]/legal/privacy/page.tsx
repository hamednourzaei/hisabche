// apps/web/app/[lang]/legal/privacy/page.tsx
import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { locales, resolveLocale } from '../../i18n-config'
import { LegalPageClient } from '../LegalPageClient'
import { buildLegalMetadata } from '../legal-metadata'

const titles: Record<string, string> = {
  fa: 'سیاست حریم خصوصی',
  af: 'سیاست محرمیت',
  en: 'Privacy Policy',
}

const descriptions: Record<string, string> = {
  fa: 'حسابچه چه داده‌هایی از شما و کسب‌وکارتان جمع‌آوری می‌کند، برای چه از آن‌ها استفاده می‌شود و چگونه از آن‌ها محافظت می‌شود.',
  af: 'حسابچه چه معلوماتی از شما و تجارت‌تان جمع‌آوری می‌کند، برای چه از آن استفاده می‌شود و چگونه از آن محافظت می‌شود.',
  en: 'What data Hisabche collects about you and your business, what it is used for, and how it is protected.',
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const { lang } = await params
  return buildLegalMetadata({
    lang,
    path: '/legal/privacy',
    title: titles[lang] || titles['fa'],
    description: descriptions[lang] || descriptions['fa'],
  })
}

// Built ahead per locale; the locale comes from the route (see layout.tsx).
export function generateStaticParams() {
  return locales.map((lang) => ({ lang }))
}

export default async function PrivacyPage({ params }: { params: Promise<{ lang: string }> }) {
  setRequestLocale(resolveLocale((await params).lang))
  return (
    <LegalPageClient
      titleKey="landing.legalPage.privacyTitle"
      titleFallback="Privacy Policy"
      introKey="landing.legalPage.privacyIntro"
      introFallback="This policy explains what data Hisabche collects and how it is used and protected."
      sectionsKey="landing.legalPage.privacySections"
    />
  )
}
