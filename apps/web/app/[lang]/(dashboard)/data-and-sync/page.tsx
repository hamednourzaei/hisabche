import { getTranslations } from 'next-intl/server'
import { DataAndSyncContainer } from '@hisabche/ui'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const t = await getTranslations({ locale: lang })
  return {
    title: t('nav.data_and_sync'),
    description: t('nav.data_and_sync_description'),
    robots: { index: false, follow: false },
  }
}

export default function DataAndSyncPage() {
  return <DataAndSyncContainer />
}
