export const dynamic = 'force-dynamic'
export const revalidate = 0

import { UsersClient } from './users-client'

export default function AdminUsersPage() {
  return <UsersClient />
}
