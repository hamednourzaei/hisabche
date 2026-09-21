// Desktop mounts the same container with its own router, so one implementation
// serves both shells. The container validates the domain segment itself.
import { useNavigate, useParams } from 'react-router-dom'
import { DomainWorkspaceContainer } from '@hisabche/ui/screens'

export default function DomainWorkspacePage() {
  const navigate = useNavigate()
  const { domain } = useParams<{ domain: string }>()

  return <DomainWorkspaceContainer domain={domain ?? ''} onNavigate={(path) => navigate(path)} />
}
