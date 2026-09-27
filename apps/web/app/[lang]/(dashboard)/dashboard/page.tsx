import { DashboardContainer } from '@hisabche/ui'

const titles: Record<string, string> = {
  fa: 'داشبورد',
  af: 'داشبورد',
  en: 'Dashboard',
}

const descriptions: Record<string, string> = {
  fa: 'نمای کلی کسب‌وکار',
  af: 'نمای کلی تجارت',
  en: 'Business overview',
}

const keywords: Record<string, string[]> = {
  fa: ['داشبورد', 'فروش', 'انبار', 'بدهی', 'گزارش', 'کسب‌وکار'],
  af: ['داشبورد', 'فروش', 'گدام', 'قرض', 'گزارش', 'تجارت'],
  en: ['dashboard', 'sales', 'inventory', 'debt', 'reports', 'business'],
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

export default function DashboardPage() {
  return (
    <main className="section">
      <DashboardContainer />
    </main>
  )
}
