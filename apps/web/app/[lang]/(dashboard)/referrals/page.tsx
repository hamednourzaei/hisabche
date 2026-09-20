// apps/web/app/[lang]/(dashboard)/referrals/page.tsx
import { ReferralsContainer } from '@hisabche/ui'

const titles: Record<string, string> = {
  fa: 'معرفی حسابچه',
  af: 'معرفی حسابچه',
  en: 'Refer Hisabche',
}

const keywords: Record<string, string[]> = {
  fa: ['معرفی', 'رفرال', 'کمیسیون', 'لینک معرفی', 'درآمد معرفی'],
  af: ['معرفی', 'رفرال', 'کمیسیون', 'لینک معرفی', 'درآمد معرفی'],
  en: ['referral', 'commission', 'invite link', 'affiliate'],
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return {
    title: titles[lang] || titles.fa,
    keywords: keywords[lang] || keywords.fa,
  }
}

export default function ReferralsPage() {
  return <ReferralsContainer />
}
