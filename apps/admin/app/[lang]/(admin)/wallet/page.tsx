import { redirect } from 'next/navigation'

export default async function AdminWalletPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  redirect(`/${lang}/revenue?tab=wallet`)
}
