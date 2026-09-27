import { QuickInvoiceContainer } from '@hisabche/ui'

const titles: Record<string, string> = {
  fa: 'فاکتور سریع',
  af: 'فاکتور سریع',
  en: 'Quick Invoice',
}

const descriptions: Record<string, string> = {
  fa: 'ثبت فاکتور در کمتر از ۳۰ ثانیه با حسابچه. فروش سریع، انتخاب محصول از انبار و مشتری از دفتر تلفن.',
  af: 'ثبت فاکتور در کمتر از ۳۰ ثانیه با حسابچه. فروش سریع، انتخاب جنس از گدام و مشتری از دفتر تلفن.',
  en: 'Create an invoice in under 30 seconds with Hisabche. Quick sale, pick product from stock and customer from contacts.',
}

const keywords: Record<string, string[]> = {
  fa: [
    'فاکتور سریع',
    'ثبت فاکتور',
    'فروش سریع',
    'فاکتور آنلاین',
    'صدور فاکتور',
    'فاکتور فروش',
    'محصول',
    'مشتری',
    'حسابچه',
    'فاکتور آسان',
  ],
  af: [
    'فاکتور سریع',
    'ثبت فاکتور',
    'فروش سریع',
    'فاکتور آنلاین',
    'صدور فاکتور',
    'فاکتور فروش',
    'جنس',
    'مشتری',
    'حسابچه',
    'فاکتور آسان',
  ],
  en: [
    'quick invoice',
    'create invoice',
    'quick sale',
    'online invoice',
    'issue invoice',
    'sales invoice',
    'product',
    'customer',
    'hisabche',
    'easy invoice',
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
  return <QuickInvoiceContainer />
}
