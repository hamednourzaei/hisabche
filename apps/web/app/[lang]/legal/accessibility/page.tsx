// apps/web/app/[lang]/legal/accessibility/page.tsx
import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { locales, resolveLocale } from '../../i18n-config'
import { LegalPageClient } from '../LegalPageClient'
import { buildLegalMetadata } from '../legal-metadata'

const titles: Record<string, string> = {
  fa: 'بیانیه دسترسی‌پذیری',
  af: 'بیانیه دسترسی‌پذیری',
  en: 'Accessibility Statement',
}

const descriptions: Record<string, string> = {
  fa: 'تعهد حسابچه به دسترسی‌پذیری: کنتراست رنگ، پشتیبانی صفحه‌کلید و ساختار معنایی، محدودیت‌های فعلی و راه گزارش یک مانع.',
  af: 'تعهد حسابچه به دسترسی‌پذیری: کنتراست رنگ، پشتیبانی کیبورد و ساختار معنایی، محدودیت‌های فعلی و راه گزارش یک مانع.',
  en: "Hisabche's commitment to accessibility — colour contrast, keyboard support and semantic structure — its known limits, and how to report a barrier.",
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const { lang } = await params
  return buildLegalMetadata({
    lang,
    path: '/legal/accessibility',
    title: titles[lang] || titles['fa'],
    description: descriptions[lang] || descriptions['fa'],
  })
}

// Built ahead per locale; the locale comes from the route (see layout.tsx).
export function generateStaticParams() {
  return locales.map((lang) => ({ lang }))
}

export default async function AccessibilityPage({ params }: { params: Promise<{ lang: string }> }) {
  setRequestLocale(resolveLocale((await params).lang))
  return (
    <LegalPageClient
      titleKey="landing.legalPage.accessibilityTitle"
      titleFallback="Accessibility Statement"
      introKey="landing.legalPage.accessibilityIntro"
      introFallback="Hisabche is committed to making its product usable by as many people as possible."
      sectionsKey="landing.legalPage.accessibilitySections"
    />
  )
}
