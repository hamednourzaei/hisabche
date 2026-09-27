// One route for all four domains; the contract knows the list and the
// container validates the segment. It is user input: an unknown domain renders
// nothing, so the title falls back to the generic home label.
import { getTranslations } from 'next-intl/server'
import { DomainWorkspaceContainer } from '@hisabche/ui'
import { DOMAINS } from '@hisabche/ui-contract'

type Params = Promise<{ lang: string; domain: string }>

export async function generateMetadata({ params }: { params: Params }) {
  const { lang, domain } = await params
  const t = await getTranslations({ locale: lang })
  return {
    title: (DOMAINS as readonly string[]).includes(domain) ? t(`domain.${domain}`) : t('nav.today'),
    robots: { index: false, follow: false },
  }
}

export default async function DomainWorkspacePage({ params }: { params: Params }) {
  const { domain } = await params
  return <DomainWorkspaceContainer domain={domain} />
}
