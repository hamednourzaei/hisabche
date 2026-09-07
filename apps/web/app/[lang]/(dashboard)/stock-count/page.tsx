// apps/web/app/[lang]/(dashboard)/stock-count/page.tsx
//
// T11 / L2 — the counting screen. The service and its five routes shipped in
// phase L2 with no caller, so until now there was no way to correct stock at
// all: `products.quantity` is a projection and cannot be typed over.
import { CycleCountContainer } from '@hisabche/ui'

const titles: Record<string, string> = {
  fa: 'شمارش انبار',
  af: 'شمارش گدام',
  en: 'Stock count',
}

const keywords: Record<string, string[]> = {
  fa: ['شمارش انبار', 'انبارگردانی', 'اصلاح موجودی', 'کسری انبار'],
  af: ['شمارش گدام', 'گدام‌گردانی', 'اصلاح موجودی', 'کسری گدام'],
  en: ['stock count', 'cycle count', 'inventory adjustment', 'stock shortage'],
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return {
    title: titles[lang] || titles['fa'],
    keywords: keywords[lang] || keywords['fa'],
  }
}

export default function StockCountPage() {
  return <CycleCountContainer />
}
