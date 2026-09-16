// apps/web/app/[lang]/legal/copyright/page.tsx
import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { locales, resolveLocale } from '../../i18n-config'
import { LegalPageClient } from '../LegalPageClient'
import { buildLegalMetadata } from '../legal-metadata'

const titles: Record<string, string> = {
  fa: 'حق نشر و کپی‌رایت',
  af: 'حق نشر',
  en: 'Copyright Notice',
}

const descriptions: Record<string, string> = {
  fa: 'اطلاعیه‌ی حق نشر حسابچه: مالکیت نرم‌افزار، طراحی و محتوا، و این‌که برای استفاده یا بازنشر بخشی از آن چه باید کرد.',
  af: 'اطلاعیه‌ی حق نشر حسابچه: مالکیت نرم‌افزار، دیزاین و محتوا، و این‌که برای استفاده یا نشر دوباره‌ی بخشی از آن چه باید کرد.',
  en: "Hisabche's copyright notice: who owns the software, design and content, and what to do if you want to reuse part of it.",
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const { lang } = await params
  return buildLegalMetadata({
    lang,
    path: '/legal/copyright',
    title: titles[lang] || titles['fa'],
    description: descriptions[lang] || descriptions['fa'],
  })
}

// Built ahead per locale; the locale comes from the route (see layout.tsx).
export function generateStaticParams() {
  return locales.map((lang) => ({ lang }))
}

export default async function CopyrightPage({ params }: { params: Promise<{ lang: string }> }) {
  setRequestLocale(resolveLocale((await params).lang))
  return (
    <LegalPageClient
      titleKey="landing.legalPage.copyrightTitle"
      titleFallback="Copyright"
      introKey="landing.legalPage.copyrightIntro"
      introFallback="Copyright notice covering the Hisabche software, design and content."
      sectionsKey="landing.legalPage.copyrightSections"
    />
  )
}
