// The same container web mounts. It validates the domain itself and navigates
// through `useLocalePush`, which leaves desktop paths unprefixed.
//
// ⚠️ The domain comes from the ROUTE, not only from the URL. `/domain/:domain`
// carries it as a segment, but `/accounting-workspace` and its three siblings
// carry none — they read `:domain` as undefined, handed the container `''`, and
// the container renders nothing for an unknown domain. All four workspaces were
// blank on Windows and Android while working on web.
import { useParams } from 'react-router-dom'
import { DomainWorkspaceContainer } from '@hisabche/ui/screens'

export default function DomainWorkspacePage({ domain }: { domain?: string | undefined }) {
  const params = useParams<{ domain: string }>()
  return <DomainWorkspaceContainer domain={domain ?? params.domain ?? ''} />
}
