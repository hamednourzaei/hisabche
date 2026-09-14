// apps/web/app/[lang]/contact/page.tsx
import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { locales, resolveLocale } from '../i18n-config'
import { ContactPageClient } from './ContactPageClient'
import { buildLegalMetadata } from '../legal/legal-metadata'

const titles: Record<string, string> = {
  fa: 'تماس با ما — حسابچه',
  af: 'تماس با ما — حسابچه',
  en: 'Contact Us — Hisabche',
}

const descriptions: Record<string, string> = {
  fa: 'با تیم پشتیبانی حسابچه از طریق ایمیل یا شبکه‌های اجتماعی در ارتباط باشید.',
  af: 'با تیم پشتیبانی حسابچه از طریق ایمیل یا شبکه‌های اجتماعی در تماس شوید.',
  en: 'Get in touch with the Hisabche support team by email or social media.',
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const { lang } = await params
  return buildLegalMetadata({
    lang,
    path: '/contact',
    title: titles[lang] || titles['fa'],
    description: descriptions[lang] || descriptions['fa'],
  })
}

// Built ahead per locale; the locale comes from the route (see layout.tsx).
export function generateStaticParams() {
  return locales.map((lang) => ({ lang }))
}

export default async function ContactPage({ params }: { params: Promise<{ lang: string }> }) {
  setRequestLocale(resolveLocale((await params).lang))
  return <ContactPageClient />
}
