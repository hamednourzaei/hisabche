// apps/web/app/[lang]/contact/page.tsx
import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { locales, resolveLocale } from '../i18n-config'
import { ContactPageClient } from './ContactPageClient'
import { buildLegalMetadata } from '../legal/legal-metadata'

const titles: Record<string, string> = {
  fa: 'تماس با پشتیبانی',
  af: 'تماس با بخش پشتیبانی',
  en: 'Contact Support',
}

const descriptions: Record<string, string> = {
  fa: 'راه‌های تماس با تیم پشتیبانی حسابچه از طریق ایمیل و شبکه‌های اجتماعی، و زمان معمول پاسخ‌گویی به پرسش‌های شما.',
  af: 'راه‌های تماس با تیم پشتیبانی حسابچه از طریق ایمیل و شبکه‌های اجتماعی، و زمان معمول جواب‌دادن به سوال‌های شما.',
  en: 'How to reach the Hisabche support team by email or social media, and how quickly you can usually expect a reply.',
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
