// apps/web/app/[lang]/legal/data-deletion/page.tsx
import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { locales, resolveLocale } from '../../i18n-config'
import { LegalPageClient } from '../LegalPageClient'
import { buildLegalMetadata } from '../legal-metadata'

const titles: Record<string, string> = {
  fa: 'درخواست حذف داده — حسابچه',
  af: 'درخواست حذف معلومات — حسابچه',
  en: 'Data Deletion Request — Hisabche',
}

const descriptions: Record<string, string> = {
  fa: 'چگونه درخواست حذف کامل حساب و داده‌های خود در حسابچه را ثبت کنید.',
  af: 'چگونه درخواست حذف کامل حساب و معلومات خود در حسابچه را ثبت کنید.',
  en: 'How to request deletion of your Hisabche account and data.',
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const { lang } = await params
  return buildLegalMetadata({
    lang,
    path: '/legal/data-deletion',
    title: titles[lang] || titles['fa'],
    description: descriptions[lang] || descriptions['fa'],
  })
}

// Built ahead per locale; the locale comes from the route (see layout.tsx).
export function generateStaticParams() {
  return locales.map((lang) => ({ lang }))
}

export default async function DataDeletionPage({ params }: { params: Promise<{ lang: string }> }) {
  setRequestLocale(resolveLocale((await params).lang))
  return (
    <LegalPageClient
      titleKey="landing.legalPage.dataDeletionTitle"
      titleFallback="Data Deletion Request"
      introKey="landing.legalPage.dataDeletionIntro"
      introFallback="You can request full deletion of your Hisabche account and data at any time."
      sectionsKey="landing.legalPage.dataDeletionSections"
    />
  )
}
