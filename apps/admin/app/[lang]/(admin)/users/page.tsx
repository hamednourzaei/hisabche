import { redirect } from 'next/navigation'

export default async function AdminUsersPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  redirect(`/${lang}/customers?tab=users`)
}
