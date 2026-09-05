// apps/web/app/[lang]/(dashboard)/product-list/page.tsx
//
// ─── G1 — DEPRECATED ROUTE, KEPT AS A REDIRECT ──────────────────────────────
//
// Canonical: /warehouse?tab=products.
//
// Product catalogue and stock are two views of one domain, not two
// destinations. They stay separate views — a catalogue is what the business
// sells, stock is what is on the shelf, and collapsing them into one list
// loses that — but under a single route.
//
// `ProductListContainer` is unchanged and now renders inside the warehouse
// screen's «کاتالوگ کالا» tab. It is also the second consumer the shared list
// engine's guard requires, which is another reason it is moved rather than
// removed.

import { permanentRedirect } from 'next/navigation'

export default async function ProductListRedirect({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  permanentRedirect(`/${lang}/warehouse?tab=products`)
}
