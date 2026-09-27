import { InvoicePreviewContainer } from '@hisabche/ui'

const titles: Record<string, string> = {
  fa: 'پیش‌نمایش فاکتور',
  af: 'پیش‌نمایش بل',
  en: 'Invoice Preview',
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return {
    title: titles[lang] ?? titles.fa,
    robots: { index: false, follow: false },
  }
}

export default function Page() {
  return <InvoicePreviewContainer />
}
