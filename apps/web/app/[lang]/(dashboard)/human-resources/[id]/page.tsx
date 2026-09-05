// apps/web/app/[lang]/(dashboard)/human-resources/[id]/page.tsx
//
// ─── G1 — DEPRECATED ROUTE, KEPT AS A REDIRECT ──────────────────────────────
//
// Canonical: /team-and-payroll/[id].
//
// This one carries an id, so the redirect must carry it too — dropping the
// employee and landing on the list would look like the record had been
// deleted. Notification deep-links written before this change point here.

import { permanentRedirect } from 'next/navigation'

export default async function EmployeeDetailRedirect({
  params,
}: {
  params: Promise<{ lang: string; id: string }>
}) {
  const { lang, id } = await params
  permanentRedirect(`/${lang}/team-and-payroll/${id}`)
}
