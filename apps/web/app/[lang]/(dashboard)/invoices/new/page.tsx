import { InvoiceBuilderContainer } from '@hisabche/ui'

const titles: Record<string, string> = {
  fa: 'فاکتور جدید',
  af: 'بل جدید',
  en: 'New Invoice',
}

const descriptions: Record<string, string> = {
  fa: 'ساخت فاکتور با جدول اقلام قابل ویرایش و ستون‌های دلخواه کسب‌وکار شما.',
  af: 'ساخت بل با جدول اجناس قابل ویرایش و ستون‌های دلخواه کاروبار شما.',
  en: 'Build an invoice with an editable item grid and columns you define.',
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return {
    title: titles[lang] ?? titles.fa,
    description: descriptions[lang] ?? descriptions.fa,
    robots: { index: false, follow: false },
  }
}

export default function Page() {
  return (
    <main className="section">
      <InvoiceBuilderContainer />
    </main>
  )
}
