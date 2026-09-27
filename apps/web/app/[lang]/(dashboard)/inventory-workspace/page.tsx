// Thin by design. A dynamic `[domain]` route would be one file instead of
// four, but `nav-destinations.test.ts` proves a destination reaches a screen by
// looking for its page file — and it cannot see a folder called `[domain]`.
// Four files a guard can check beat one file it cannot.
import { getTranslations } from 'next-intl/server'
import { DomainWorkspaceContainer } from '@hisabche/ui'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const t = await getTranslations({ locale: lang })
  return { title: t('domain.inventory'), robots: { index: false, follow: false } }
}

export default function InventoryWorkspacePage() {
  return (
    <main className="section">
      <DomainWorkspaceContainer domain="inventory" />
    </main>
  )
}
