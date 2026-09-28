// apps/web/app/[lang]/(dashboard)/wallet/page.tsx
import { WalletContainer } from '@hisabche/ui'

const titles: Record<string, string> = {
  fa: 'کیف پول کسب‌وکار',
  af: 'کیف پول کسب‌وکار',
  en: 'Business wallet',
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return { title: titles[lang] || titles['fa'] }
}

export default function WalletPage() {
  return <WalletContainer />
}
