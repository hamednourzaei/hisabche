import { redirect } from 'next/navigation'

export default async function AdminSubscriptionsPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  redirect(`/${lang}/revenue?tab=subscriptions`)
}
