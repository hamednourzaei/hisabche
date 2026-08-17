export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

// The same auth screen the web app renders, imported from the shared package
// rather than copied. The previous local copy under components/ui/auth had
// already drifted from it, which is why this page stopped matching the site.
import { AuthContainer } from '@hisabche/ui'

export default function AdminLoginPage() {
  return <AuthContainer initialMode="login" />
}
