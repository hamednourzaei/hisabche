export const dynamic = 'force-dynamic'
export const revalidate = 0

import { WorkspacesClient } from './workspaces-client'

export default function AdminWorkspacesPage() {
  return <WorkspacesClient />
}
