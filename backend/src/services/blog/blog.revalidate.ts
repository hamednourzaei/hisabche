// ============================================
// backend/src/services/blog/blog.revalidate.ts
//
// Tells the web app to drop its cached blog pages after an admin change, so a
// published article appears (and an unpublished one disappears) at once rather
// than on the next hourly ISR revalidation.
//
// Explicit defaults (G4): with BLOG_REVALIDATE_URL or REVALIDATE_SECRET unset
// nothing is sent and the pages refresh on their hourly revalidation — the
// same as a scheduled post, which never needs a call.
//
// ⚠️ A FAILED CALL NEVER UNDOES THE SAVE. The article is already stored; the
// failure is logged and reported to the admin (`revalidated: false`), and the
// hourly revalidation still picks the change up.
// ============================================

export type RevalidateOutcome = 'sent' | 'disabled' | 'failed'

interface Logger {
  warn: (obj: unknown, msg?: string) => void
}

export async function revalidateBlogPages(log: Logger): Promise<RevalidateOutcome> {
  const url = process.env.BLOG_REVALIDATE_URL?.trim() ?? ''
  const secret = process.env.REVALIDATE_SECRET?.trim() ?? ''
  if (!url || !secret) return 'disabled'

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-revalidate-secret': secret },
      body: JSON.stringify({ tags: ['blog'] }),
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) {
      log.warn({ status: response.status }, 'blog revalidation was refused by the web app')
      return 'failed'
    }
    return 'sent'
  } catch (err) {
    log.warn({ err }, 'blog revalidation request failed')
    return 'failed'
  }
}
