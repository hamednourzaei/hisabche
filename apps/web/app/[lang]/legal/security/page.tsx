// apps/web/app/[lang]/legal/security/page.tsx
import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { locales, resolveLocale } from '../../i18n-config'
import { LegalPageClient } from '../LegalPageClient'
import { buildLegalMetadata } from '../legal-metadata'

const titles: Record<string, string> = {
  fa: 'امنیت داده‌های کسب‌وکار',
  af: 'امنیت معلومات تجارت',
  en: 'Business Data Security',
}

const descriptions: Record<string, string> = {
  fa: 'حسابچه چگونه از داده‌های کسب‌وکار شما محافظت می‌کند: جداسازی داده‌ی هر کسب‌وکار، ارتباط رمزنگاری‌شده و کنترل دسترسی بر اساس نقش.',
  af: 'حسابچه چگونه از معلومات تجارت شما محافظت می‌کند: جداسازی معلومات هر تجارت، ارتباط رمزگذاری‌شده و کنترل دسترسی بر اساس نقش.',
  en: 'How Hisabche protects your business data: per-business isolation, encrypted connections and role-based access control.',
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
