// apps/web/app/[lang]/legal/refund/page.tsx
import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { locales, resolveLocale } from '../../i18n-config'
import { LegalPageClient } from '../LegalPageClient'
import { buildLegalMetadata } from '../legal-metadata'

const titles: Record<string, string> = {
  fa: 'سیاست بازگشت وجه — حسابچه',
  af: 'سیاست بازگشت پول — حسابچه',
  en: 'Refund Policy — Hisabche',
}

const descriptions: Record<string, string> = {
  fa: 'شرایط بازگشت وجه برای پلن‌های پولی حسابچه.',
  af: 'شرایط بازگشت پول برای پلان‌های پولی حسابچه.',
  en: "Refund terms for Hisabche's paid plans.",
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const { lang } = await params
  return buildLegalMetadata({
    lang,
    path: '/legal/refund',
    title: titles[lang] || titles['fa'],
    description: descriptions[lang] || descriptions['fa'],
  })
}

// Built ahead per locale; the locale comes from the route (see layout.tsx).
export function generateStaticParams() {
  return locales.map((lang) => ({ lang }))
}

export default async function RefundPolicyPage({ params }: { params: Promise<{ lang: string }> }) {
  setRequestLocale(resolveLocale((await params).lang))
  return (
    <LegalPageClient
      titleKey="landing.legalPage.refundTitle"
      titleFallback="Refund Policy"
      introKey="landing.legalPage.refundIntro"
      introFallback="This policy explains how refunds work for Hisabche's paid plans."
      sectionsKey="landing.legalPage.refundSections"
    />
  )
}
