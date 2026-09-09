// ============================================
// apps/web/app/[lang]/(dashboard)/assistant/page.tsx
//
// The AI assistant, at its own URL.
//
// ⚠️ `robots: noindex` like every other dashboard page. The assistant answers
// from the signed-in workspace's own figures; a crawler has no session and
// would index a login redirect.
// ============================================

import { Suspense } from 'react'

import { AiAssistantContainer } from '@hisabche/ui'

const titles: Record<string, string> = {
  fa: 'دستیار هوشمند',
  af: 'دستیار هوشمند',
  en: 'AI Assistant',
}

const descriptions: Record<string, string> = {
  fa: 'درباره‌ی فروش، موجودی، بدهی مشتریان و حساب‌های کسب‌وکارتان بپرسید و پاسخ را از روی داده‌های همین کسب‌وکار بگیرید.',
  af: 'درباره‌ی فروش، موجودی، بدهی مشتریان و حساب‌های کسب‌وکارتان بپرسید و پاسخ را از روی داده‌های همین کسب‌وکار بگیرید.',
  en: 'Ask about your sales, stock, customer debt and accounts, and get answers from this business’s own data.',
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return {
    title: titles[lang] || titles.fa,
    description: descriptions[lang] || descriptions.fa,
    robots: { index: false, follow: false },
  }
}

export default function AssistantPage() {
  return (
    <main className="section">
      <Suspense fallback={null}>
        <AiAssistantContainer />
      </Suspense>
    </main>
  )
}
