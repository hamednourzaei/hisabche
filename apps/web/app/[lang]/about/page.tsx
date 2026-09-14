// apps/web/app/[lang]/about/page.tsx
import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { locales, resolveLocale } from '../i18n-config'
import { LegalPageClient } from '../legal/LegalPageClient'
import { buildLegalMetadata } from '../legal/legal-metadata'

const titles: Record<string, string> = {
  fa: 'درباره ما — حسابچه',
  af: 'درباره ما — حسابچه',
  en: 'About Us — Hisabche',
}

const descriptions: Record<string, string> = {
  fa: 'حسابچه چیست و برای چه کسانی ساخته شده است.',
  af: 'حسابچه چیست و برای چه کسانی ساخته شده است.',
  en: "What Hisabche is and who it's built for.",
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const { lang } = await params
  return buildLegalMetadata({
    lang,
    path: '/about',
    title: titles[lang] || titles['fa'],
    description: descriptions[lang] || descriptions['fa'],
  })
}

// Built ahead per locale; the locale comes from the route (see layout.tsx).
export function generateStaticParams() {
  return locales.map((lang) => ({ lang }))
}

export default async function AboutPage({ params }: { params: Promise<{ lang: string }> }) {
  setRequestLocale(resolveLocale((await params).lang))
  return (
    <LegalPageClient
      titleKey="landing.legalPage.aboutTitle"
      titleFallback="About Us"
      introKey="landing.legalPage.aboutIntro"
      introFallback="Hisabche is accounting, invoicing and inventory software built for small and medium businesses in Iran and Afghanistan."
      sectionsKey="landing.legalPage.aboutSections"
    />
  )
}
