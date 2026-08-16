import { CustomerDetailClient } from './customer-detail-client'

const titles: Record<string, string> = {
  fa: 'پرونده مشتری',
  af: 'پرونده مشتری',
  en: 'Customer profile',
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return { title: titles[lang] || titles['fa'], robots: { index: false, follow: false } }
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  return (
    <main className="section">
      <CustomerDetailClient customerId={id} />
    </main>
  )
}
