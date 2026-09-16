// apps/web/app/[lang]/legal/refund/page.tsx
import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { locales, resolveLocale } from '../../i18n-config'
import { LegalPageClient } from '../LegalPageClient'
import { buildLegalMetadata } from '../legal-metadata'

const titles: Record<string, string> = {
  fa: 'سیاست بازگشت وجه',
  af: 'سیاست بازگشت پول',
  en: 'Refund Policy',
}

const descriptions: Record<string, string> = {
  fa: 'شرایط بازگشت وجه برای اشتراک‌های پولی حسابچه: در چه مواردی بازپرداخت انجام می‌شود و درخواست آن را چطور ثبت کنید.',
  af: 'شرایط بازگشت پول برای اشتراک‌های پولی حسابچه: در کدام حالت‌ها پول بازگردانده می‌شود و درخواست آن را چطور ثبت کنید.',
  en: "Refund terms for Hisabche's paid subscriptions: when a refund applies, how cancelling works, and how to request one.",
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
