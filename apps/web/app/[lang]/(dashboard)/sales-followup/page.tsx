// ============================================
// /[lang]/sales-followup → /[lang]/crm
//
// This page was a second screen over the same `/api/interactions` data as
// /crm — two places to record and follow up the same customer contact, which
// drift apart. It is removed; the URL stays only as a permanent redirect so
// existing bookmarks and links land on /crm, in the reader's own language.
// ============================================

import { permanentRedirect } from 'next/navigation'

export default async function SalesFollowupRedirect({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  permanentRedirect(`/${lang}/crm`)
}
