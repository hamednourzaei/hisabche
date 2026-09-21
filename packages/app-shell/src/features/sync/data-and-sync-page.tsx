// Desktop hands the shared hub its own router, so one container serves both
// shells without a per-platform branch inside it.
import { useNavigate } from 'react-router-dom'
import { DataAndSyncContainer } from '@hisabche/ui/screens'

export default function DataAndSyncPage() {
  const navigate = useNavigate()
  return <DataAndSyncContainer onNavigate={(path) => navigate(path)} />
}
