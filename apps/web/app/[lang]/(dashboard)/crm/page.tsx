// ============================================
// /[lang]/crm → /[lang]/tasks
//
// The page is a list of follow-up TASKS assigned to staff — «وظیفه جدید»,
// who it is for, what happened with each customer. «CRM» named the module,
// not the thing on the screen, so the address is now /tasks.
//
// The old URL stays as a permanent redirect: it is in bookmarks, in the
// desktop app's history and in links already sent to employees, and a 404
// there would read as the feature being gone.
// ============================================

import { permanentRedirect } from 'next/navigation'

export default async function CrmRedirect({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  permanentRedirect(`/${lang}/tasks`)
}
