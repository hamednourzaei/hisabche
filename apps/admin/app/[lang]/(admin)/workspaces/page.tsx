import { redirect } from 'next/navigation'

export default async function AdminWorkspacesPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  redirect(`/${lang}/customers?tab=workspaces`)
}
