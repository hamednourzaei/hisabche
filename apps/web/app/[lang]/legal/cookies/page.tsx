// apps/web/app/[lang]/legal/cookies/page.tsx
import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { locales, resolveLocale } from '../../i18n-config'
import { LegalPageClient } from '../LegalPageClient'
import { buildLegalMetadata } from '../legal-metadata'

const titles: Record<string, string> = {
  fa: 'سیاست کوکی',
  af: 'سیاست کوکی‌ها',
  en: 'Cookie Policy',
}

const descriptions: Record<string, string> = {
  fa: 'حسابچه از چه کوکی‌هایی استفاده می‌کند، هر کدام برای چه کاری است و چطور می‌توانید آن‌ها را در مرورگر خود مدیریت کنید.',
  af: 'حسابچه از کدام کوکی‌ها استفاده می‌کند، هر کدام برای چه کاری است و چطور می‌توانید آن‌ها را در مرورگر خود مدیریت کنید.',
  en: 'Which cookies Hisabche uses, what each one is for, and how you can view, block or clear them in your own browser.',
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const { lang } = await params
  return buildLegalMetadata({
    lang,
    path: '/legal/cookies',
    title: titles[lang] || titles['fa'],
    description: descriptions[lang] || descriptions['fa'],
  })
}

// Built ahead per locale; the locale comes from the route (see layout.tsx).
export function generateStaticParams() {
  return locales.map((lang) => ({ lang }))
}

export default async function CookiePolicyPage({ params }: { params: Promise<{ lang: string }> }) {
  setRequestLocale(resolveLocale((await params).lang))
  return (
    <LegalPageClient
      titleKey="landing.legalPage.cookieTitle"
      titleFallback="Cookie Policy"
      introKey="landing.legalPage.cookieIntro"
      introFallback="This policy explains what cookies Hisabche uses and why."
      sectionsKey="landing.legalPage.cookieSections"
    />
  )
}
