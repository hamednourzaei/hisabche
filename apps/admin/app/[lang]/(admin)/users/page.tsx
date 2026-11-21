import { redirect } from 'next/navigation'

export default async function AdminUsersPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  // Users are part of the customers hub now: one page, not a second tab.
  redirect(`/${lang}/customers`)
}
