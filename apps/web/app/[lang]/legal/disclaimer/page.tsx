// apps/web/app/[lang]/legal/disclaimer/page.tsx
import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { locales, resolveLocale } from '../../i18n-config'
import { LegalPageClient } from '../LegalPageClient'
import { buildLegalMetadata } from '../legal-metadata'

const titles: Record<string, string> = {
  fa: 'سلب مسئولیت',
  af: 'سلب مسئولیت',
  en: 'Disclaimer',
}

const descriptions: Record<string, string> = {
  fa: 'حدود مسئولیت حسابچه در استفاده از نرم‌افزار و گزارش‌های مالی آن، و مواردی که تصمیم نهایی با خود کسب‌وکار یا حسابدار آن است.',
  af: 'حدود مسئولیت حسابچه در استفاده از نرم‌افزار و گزارش‌های مالی آن، و مواردی که تصمیم آخر با خود تجارت یا حسابدار آن است.',
  en: "The limits of Hisabche's liability for the software and its financial reports, and where final decisions rest with the business or its accountant.",
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const { lang } = await params
  return buildLegalMetadata({
    lang,
    path: '/legal/disclaimer',
    title: titles[lang] || titles['fa'],
    description: descriptions[lang] || descriptions['fa'],
  })
}

// Built ahead per locale; the locale comes from the route (see layout.tsx).
export function generateStaticParams() {
  return locales.map((lang) => ({ lang }))
}

export default async function DisclaimerPage({ params }: { params: Promise<{ lang: string }> }) {
  setRequestLocale(resolveLocale((await params).lang))
  return (
    <LegalPageClient
      titleKey="landing.legalPage.disclaimerTitle"
      titleFallback="Disclaimer"
      introKey="landing.legalPage.disclaimerIntro"
      introFallback="Please read this disclaimer carefully before using Hisabche."
      sectionsKey="landing.legalPage.disclaimerSections"
    />
  )
}
