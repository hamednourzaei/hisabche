import { redirect } from 'next/navigation'

export default async function AdminOAuthAppsPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  redirect(`/${lang}/product?tab=oauth`)
}
