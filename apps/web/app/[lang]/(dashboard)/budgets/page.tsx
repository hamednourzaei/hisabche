// apps/web/app/[lang]/(dashboard)/budgets/page.tsx
//
// Thin by design: metadata, then the shared container. Every query, every
// piece of state and every rule lives in `@hisabche/ui`, so desktop mounts
// exactly this screen from its own router without a second implementation.
import { BudgetsContainer } from '@hisabche/ui'

const titles: Record<string, string> = {
  fa: 'بودجه',
  af: 'بودجه',
  en: 'Budgets',
}

const keywords: Record<string, string[]> = {
  fa: ['بودجه', 'سقف هزینه', 'انحراف از بودجه', 'کنترل هزینه'],
  af: ['بودجه', 'سقف هزینه', 'انحراف از بودجه', 'کنترل هزینه'],
  en: ['budget', 'spending limit', 'variance', 'cost control'],
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return {
    title: titles[lang] || titles['fa'],
    keywords: keywords[lang] || keywords['fa'],
  }
}

export default function BudgetsPage() {
  return <BudgetsContainer />
}
