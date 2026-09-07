// apps/web/app/[lang]/(dashboard)/operations/page.tsx
//
// T11 — L3 reorder suggestions, L4 dead stock, M3 shift history,
// N3 cash forecast, N4 stale opportunities.
//
// All five endpoints existed and had no caller.
import { InventoryOpsContainer } from '@hisabche/ui'

const titles: Record<string, string> = {
  fa: 'عملیات و پیش‌بینی',
  af: 'عملیات و پیش‌بینی',
  en: 'Operations and forecast',
}

const keywords: Record<string, string[]> = {
  fa: ['پیشنهاد سفارش', 'کالای راکد', 'پیش‌بینی نقدینگی', 'تاریخچه شیفت'],
  af: ['پیشنهاد سفارش', 'جنس راکد', 'پیش‌بینی نقدینگی', 'تاریخچه شیفت'],
  en: ['reorder suggestions', 'dead stock', 'cash forecast', 'shift history'],
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return {
    title: titles[lang] || titles['fa'],
    keywords: keywords[lang] || keywords['fa'],
  }
}

export default function OperationsPage() {
  return <InventoryOpsContainer />
}
