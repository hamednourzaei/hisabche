// apps/web/app/[lang]/legal/privacy/page.tsx
import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { locales, resolveLocale } from '../../i18n-config'
import { LegalPageClient } from '../LegalPageClient'
import { buildLegalMetadata } from '../legal-metadata'

const titles: Record<string, string> = {
  fa: 'حریم خصوصی — حسابچه',
  af: 'حریم خصوصی — حسابچه',
  en: 'Privacy Policy — Hisabche',
}

const descriptions: Record<string, string> = {
  fa: 'این‌که حسابچه چه داده‌ای جمع‌آوری می‌کند، چرا، و چگونه از آن محافظت می‌کند.',
  af: 'این‌که حسابچه چه معلوماتی جمع‌آوری می‌کند، چرا، و چگونه از آن محافظت می‌کند.',
  en: "What data Hisabche collects, why, and how it's protected.",
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
