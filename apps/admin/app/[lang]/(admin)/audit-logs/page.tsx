import { redirect } from 'next/navigation'

export default async function AdminAuditLogsPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  redirect(`/${lang}/security?tab=audit`)
}
