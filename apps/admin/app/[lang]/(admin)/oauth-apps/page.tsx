export const dynamic = 'force-dynamic'
export const revalidate = 0

import { OAuthAppsClient } from './oauth-apps-client'

export default function AdminOAuthAppsPage() {
  return <OAuthAppsClient />
}
