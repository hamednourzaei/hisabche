import { redirect } from 'next/navigation'

export default async function AdminServersPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  redirect(`/${lang}/operations?tab=servers`)
}
