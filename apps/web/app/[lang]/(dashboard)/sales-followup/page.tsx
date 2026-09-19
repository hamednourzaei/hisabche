// ============================================
// /[lang]/sales-followup → /[lang]/tasks
//
// This page was a second screen over the same `/api/interactions` data as
// /tasks — two places to record and follow up the same customer contact, which
// drift apart. It is removed; the URL stays only as a permanent redirect so
// existing bookmarks and links land on /tasks, in the reader's own language.
// Straight to the final URL: chaining redirects costs a round trip and,
// through /crm, an extra 308 in every crawl.
// ============================================

import { permanentRedirect } from 'next/navigation'

export default async function SalesFollowupRedirect({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  permanentRedirect(`/${lang}/tasks`)
}
