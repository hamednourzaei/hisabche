// apps/web/app/[lang]/(dashboard)/human-resources/page.tsx
//
// ─── G1 — DEPRECATED ROUTE, KEPT AS A REDIRECT ──────────────────────────────
//
// Canonical: /team-and-payroll.
//
// Two entries existed for the same people: `nav.team` → /human-resources and
// `nav.coworkers` → /team-and-payroll. NAV_CONTRACT already carried a note that
// "colleagues and payroll are one section now" — the menu entry had been
// removed, but the route and every link into it stayed.
//
// The route is NOT deleted, so notification deep-links written before this
// change keep resolving.
//
// `HumanResourcesContainer` is untouched: /team-and-payroll renders the same
// screens, and the employee detail route beside this file now redirects into
// the canonical prefix rather than being orphaned.

import { permanentRedirect } from 'next/navigation'

export default async function HumanResourcesRedirect({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  permanentRedirect(`/${lang}/team-and-payroll`)
}
