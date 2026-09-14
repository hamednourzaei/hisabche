// apps/web/app/[lang]/(dashboard)/permissions/page.tsx
//
// The permission matrix now lives inside Governance, next to members,
// approvals, separation of duties and the audit log. A second route to the same
// screen was a duplicate page; old links and bookmarks land on the tab.
import { permanentRedirect } from 'next/navigation'

export default async function PermissionsRedirect({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  permanentRedirect(`/${lang}/governance?tab=permissions`)
}
