// A listing opens directly from `#/marketplace?app=<slug>` — the same link
// the developer screen and the installed-apps list give on web.
import { useSearchParams } from 'react-router-dom'
import { MarketplaceContainer } from '@hisabche/ui/screens'

export default function MarketplacePage() {
  const [params] = useSearchParams()
  return <MarketplaceContainer initialApp={params.get('app') ?? undefined} />
}
