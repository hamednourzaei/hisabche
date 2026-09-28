import { SettingsPage } from '@hisabche/ui'

const titles: Record<string, string> = {
  fa: 'تنظیمات',
  af: 'تنظیمات',
  en: 'Settings',
}

const descriptions: Record<string, string> = {
  fa: 'تنظیمات حساب، زبان، تم، پشتیبان‌گیری، چاپگر و مدیریت کسب‌وکار در حسابچه.',
  af: 'تنظیمات حساب، زبان، تم، پشتیبان‌گیری، چاپگر و مدیریت تجارت در حسابچه.',
  en: 'Account settings, language, theme, backup, printer and business management in Hisabche.',
}

const keywords: Record<string, string[]> = {
  fa: [
    'تنظیمات',
    'تنظیمات حساب',
    'تغییر زبان',
    'تم تاریک',
    'پشتیبان‌گیری',
    'چاپگر',
    'اطلاعات کسب‌وکار',
    'پیش‌شماره فاکتور',
    'حسابچه',
    'تنظیمات برنامه',
  ],
  af: [
    'تنظیمات',
    'تنظیمات حساب',
    'تغییر زبان',
    'تم تاریک',
    'پشتیبان‌گیری',
    'چاپگر',
    'اطلاعات تجارت',
    'پیش‌شماره فاکتور',
    'حسابچه',
    'تنظیمات برنامه',
  ],
  en: [
    'settings',
    'account settings',
    'change language',
    'dark theme',
    'backup',
    'printer',
    'business info',
    'invoice prefix',
    'hisabche',
    'app settings',
  ],
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return {
    title: titles[lang] || titles['fa'],
    description: descriptions[lang] || descriptions['fa'],
    keywords: keywords[lang] || keywords['fa'],
    robots: { index: false, follow: false },
  }
}

export default function Page() {
  return <SettingsPage />
}
