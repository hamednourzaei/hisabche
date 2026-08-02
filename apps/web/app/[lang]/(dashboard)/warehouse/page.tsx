// apps/web/app/[lang]/(dashboard)/warehouse/page.tsx
import { WarehouseClient } from "./warehouse-client";

const titles: Record<string, string> = { "fa": "انبار", "af": "گدام", "en": "Warehouse" };
const descriptions: Record<string, string> = { "fa": "مدیریت انبار و موجودی", "af": "مدیریت گدام و موجودی", "en": "Warehouse & inventory management" };
const keywords: Record<string, string[]> = { "fa": ["انبار", "موجودی", "کالا"], "af": ["گدام", "موجودی", "جنس"], "en": ["warehouse", "inventory", "stock"] };

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return { title: titles[lang] || titles["fa"], description: descriptions[lang] || descriptions["fa"], keywords: keywords[lang] || keywords["fa"] };
}

export default function WarehousePage() {
  return <WarehouseClient />;
}