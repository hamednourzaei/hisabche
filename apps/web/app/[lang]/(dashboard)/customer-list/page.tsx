// apps/web/app/[lang]/(dashboard)/customer-list/page.tsx
//
// ─── G1 — DEPRECATED ROUTE, KEPT AS A REDIRECT ──────────────────────────────
//
// Canonical: /customers.
//
// `/customer-list` and `/customers` read the same endpoint and show the same
// people. Having both meant two places to look for one customer, and two
// screens to keep in step when the customer model changes.
//
// The route is NOT deleted. Anything already pointing here — a bookmark, a
// notification written before this change, a link in a message — keeps working
// and lands on the canonical screen instead of a 404.
//
// `CustomerListContainer` is untouched and still exported: it is one of the two
// consumers `contract-consumers.test.ts` requires for the shared list engine,
// and deleting it to tidy a route would silently drop that guard to one.
//
// 308, not 307: the consolidation is permanent, and saying so keeps the
// deprecated URL from competing with the canonical one in search results.

import { permanentRedirect } from 'next/navigation'

export default async function CustomerListRedirect({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  permanentRedirect(`/${lang}/customers`)
}
