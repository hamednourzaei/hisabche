import { redirect } from 'next/navigation'

export default async function AdminBlogPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  redirect(`/${lang}/content?tab=blog`)
}
